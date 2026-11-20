# 基金做 T 助手 —— 后端接入方案（FastAPI + JSON 存储）

## Context

前端 `frontend/` 已完成 6 个页面（总览/持仓/基金详情/流水/成本分析/设置），全部跑在 mock 数据上。仓库里目前**没有任何后端代码**。

本轮要解决的问题：把 mock 数据换成「真实行情 + 本地账本」。具体是——净值、大盘指数、赎回费率阶梯从天天基金/东财实时拉取；交易流水与费率档案落到本地 JSON 文件；持仓成本、做 T 配对、隐性成本这些计算全部收归后端，前端只做渲染。

已确认的技术决策（用户拍板）：
- 后端：**Python + FastAPI**
- 存储：**JSON 文件**（非 SQLite）
- 计算逻辑：**后端统一计算**
- 本轮范围：**行情 + 费率自动拉取 + 流水落库**（前端可增删改流水）

## 目录结构

```
/workspace
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py          # app 工厂、CORS、路由挂载、lifespan（建目录/写种子/预热缓存）
│   │   ├── config.py        # 路径、超时、TTL 常量
│   │   ├── models.py        # 请求体 pydantic 模型（只校验入参）+ 响应序列化辅助
│   │   ├── store.py         # JsonStore：原子读/写 + 线程锁 + .bak 备份
│   │   ├── seed.py          # mock.ts 的 6 只基金/20 笔流水/费率 → Python 字面量
│   │   ├── calc.py          # calc.ts 的逐函数移植（唯一计算真相源）
│   │   ├── services/
│   │   │   ├── portfolio.py # 组合聚合：并发取行情 → 配对 → 推导持仓 → 汇总 → 成本曲线
│   │   │   ├── funds.py     # 基金/费率 CRUD + 自动费率抓取
│   │   │   ├── trades.py    # 流水 CRUD + 金额/费用自动补全
│   │   │   └── settings.py  # 设置读写
│   │   └── datasources/
│   │       ├── base.py      # HttpClient（超时/重试/UA）+ DiskCache（TTL + stale-while-error）
│   │       ├── eastmoney.py # 基本信息/运作费用/净值历史/费率页/分页净值
│   │       └── sina.py      # 指数行情（GBK）
│   ├── scripts/dump_calc.py # 与前端 calc.ts 对拍
│   └── data/                # 运行时生成（.gitignore 保留 .gitkeep）
│       ├── funds.json  trades.json  settings.json
│       └── cache/nav/  cache/quote/  cache/fee/  cache/index.json
└── frontend/
    ├── scripts/calc_dump.ts # 对拍用（Node 24 原生跑 TS）
    └── src/lib/api.ts       # 新增：fetch 封装
```

依赖（尽量少）：`fastapi` `uvicorn[standard]` `httpx` `beautifulsoup4`（stdlib `html.parser` 即可，不引 lxml）`pydantic`。不引 sqlite/orjson/lxml/dateutil；时区用固定 `+08:00` 偏移，不依赖 zoneinfo。
安装：`cd backend && uv venv && uv add "fastapi" "uvicorn[standard]" httpx beautifulsoup4`。

## JSON 存储

| 文件 | 内容 |
|---|---|
| `funds.json` | `{version, updatedAt, items:[{fund:{code,name,category,company}, fee:{subscribeRate,dailyHoldRate,redeemTiers,minSubscribe}, feeSource:"manual\|auto", updatedAt}]}` |
| `trades.json` | `{version, updatedAt, items:[Trade]}` — 数组顺序即插入顺序，做 T 配对依赖它 |
| `settings.json` | `{version, pairMaxGapDays:10, autoRefresh:true, refreshSeconds:30, remindTier:true, remindPendingT:true}` |

- 写入用标准库 `json` + `threading.RLock`（单进程单用户，不需要 flock）。FastAPI 路由一律用 `def`（非 `async def`），阻塞 IO 自动进线程池。
- **原子写**：写 `.tmp` → `flush` + `fsync` → `os.replace` 覆盖原文件；写前把旧文件复制成 `.bak`。
- 首次启动：`seed.py` 用 `mock.ts` 的数据初始化 `funds.json` / `trades.json`，保证种子场景（6 只持仓、4 次做 T）与现在的 demo 一致。
- 响应体**不**用 pydantic 序列化，手写 `dict`，字段名严格对齐 `types.ts`，避免 pydantic 改名或多出 null。`Trade.note` 为空时**省略该 key**（TS 是 `note?: string`）。

## 数据源（已实测连通性，直接用，不要再试）

✅ 可用：
1. `fundmobapi.eastmoney.com/FundMNewApi/FundMNBasicInformation?FCODE={code}&deviceid=1&plat=Iphone&product=EFund&version=6.2.8`
   → `Datas.SHORTNAME/FTYPE/JJGS/FSRQ/DWJZ/LJJZ/RZDF/RATE/SOURCERATE/MINSG/SGZT/SHZT`
2. 同域 `FundMNDetailInformation` → `Datas.MGREXP/TRUSTEXP/SALESEXP`（三者之和 = `dailyHoldRate`）、`FULLNAME/RISKLEVEL/INDEXNAME`
3. `fund.eastmoney.com/pingzhongdata/{code}.js` → **全量历史净值**。UTF-8 BOM，需 `utf-8-sig`。`Data_netWorthTrend` = `[{"x":epoch_ms,"y":nav,"equityReturn":pct}]`；`Data_ACWorthTrend` = `[[epoch_ms,accNav]]`；另有 `fS_name/fund_Rate/fund_sourceRate/fund_minsg`。文件约 437KB，**必须落盘缓存**。注意 `x` 是 UTC 零点，取日期要用 UTC 转换否则会跨日。
4. `api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize=20`（需 `Referer: https://fundf10.eastmoney.com/`）→ `Data.LSJZList[{FSRQ,DWJZ,LJJZ,JZZZL,SGZT,SHZT}]`，作 pingzhongdata 的降级源
5. `fundf10.eastmoney.com/jjfl_{code}.html` → **赎回费率阶梯**（UTF-8，46KB）。定位含「赎回费率」的 `<h4>`，取其后第一个 `<table class="w650 comm jjfl">` 的 `tbody tr`，两列 = 期限文本、费率。期限文本映射（已用 161725 实测）：
   | 页面文本 | minDays | maxDays |
   |---|---|---|
   | 小于7天 | 0 | 6 |
   | 大于等于7天，小于365天 | 7 | 364 |
   | 大于等于365天，小于730天 | 365 | 729 |
   | 大于等于730天 | 730 | null |
   「小于 N」→ maxDays = N-1；年→365 天、月→30 天。解析后按 minDays 升序 + 校验不重叠。
   同页还能取「申购起点」（如 10.00元）、「运作费用」表的管理费/托管费/销售服务费、申购费率的折后档。
6. `hq.sinajs.cn/list=sh000300,sz399001,sz399006,sh000905,sh000016`（**必须带 `Referer: https://finance.sina.com.cn/`**，否则 403；响应 **GBK**）→ 字段序 `0 名称,1 今开,2 昨收,3 现价,4 最高,5 最低,…,30 日期,31 时间`。`price=现价`、`change=现价-昨收`、`changePct=change/昨收*100`

❌ **不可用（必须优雅降级）**：`fundgz.1234567.com.cn/js/{code}.js` → 404（服务已下线，所有代码都 404）；`push2.eastmoney.com` → 全部空；`fundmobapi` 的 `FundMNFInfo`/`FundMNQuote` → `Datas: null`。
→ 结论：**盘中实时估值拿不到**，`estimateNav/estimateChange/estimateTime` 生产环境恒为 `null`。`nav/navDate` 用最新公布净值（T-1 或当日收盘）。

## 计算层移植（`app/calc.py`）

逐函数对应 `frontend/src/lib/calc.ts`：`parseDate/formatDate/addDays/daysBetween/today`、`matchRedeemTier`、`nextTier`、`subscribeFee/redeemFee/dailyHoldFee`、`round2/round4`、`pairTrades`、`deriveHolding`、`summarize`。

**必须避的坑**：
- TS `Math.round(x)` = `floor(x+0.5)`（半值向 +∞ 进位）；Python 内置 `round()` 是银行家舍入。移植用 `math.floor(x + 0.5)` 自建 `_js_round`，并复刻 `round2/round4` 的 `+Number.EPSILON` 偏移（`sys.float_info.epsilon`）。
- **不要**用 `Decimal` 改写计算链（十进制精确 ≠ IEEE754 双精度，会产生 ±0.01 偏差）。中间量不做中间舍入，只在输出点 round2/round4，与 TS 完全一致。
- 日期用 `datetime.date`，无时区；`days_between = (d2-d1).days`；`today()` 用固定 `+08:00`。
- `pair_trades`：分组用保序 `dict`（与 TS `Map` 插入序一致）；JS 稳定排序 → Python `sorted` 稳定排序，天然等价；`unmatched` 用 id 集合代替 TS 的引用比较。
- `derive_holding`：赎回时 `costAmount -= avgCost * shares`（移动加权平均），持有费按每笔 buy 腿 `shares * nav * rate/100/365 * days` 计提（与 TS 同为简化模型）；`rawCostAmount = costAmount - (subscribeFeePaid + holdFeeAccrued) + redeemFeePaid`（注意是**加**）。
- `summarize`：`costAmount = Σ(marketValue - profit)`。

**对拍**（地基，必须做）：
```bash
node frontend/scripts/calc_dump.ts > /tmp/ts.json    # Node 24 原生支持类型擦除跑 .ts（已验证）
python backend/scripts/dump_calc.py > /tmp/py.json
diff /tmp/ts.json /tmp/py.json && echo PARITY_OK
```
两个脚本用同一份种子数据、同一 `asOf`，输出 holdings/pairs/summary，要求逐字节一致。

## API 契约（前缀 `/api`，响应字段名与 `types.ts` 一致）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | `{status, version, asOf, dataDir, cacheDir}` |
| GET | `/portfolio?asOf=` | **聚合端点，一次拿全**（见下） |
| GET | `/market` | `MarketSnapshot` |
| GET | `/funds` | `[{fund, fee, feeSource, updatedAt}]` |
| GET | `/funds/{code}` | `{fund, fee, quote, holding}` |
| POST | `/funds` | body `{fund, fee}` → upsert |
| PUT | `/funds/{code}` | body `{fee}` → 只改费率 |
| DELETE | `/funds/{code}` | 删基金 |
| GET | `/funds/{code}/fee/auto` | 抓东财费率 → `{fee, source:"eastmoney", raw}`（不入库，供表单预览） |
| GET | `/funds/{code}/nav-history?range=30\|90\|180\|all` | `{code, points:[{date,nav,accNav,changePct}]}` |
| GET | `/trades?fundCode=` | `{trades:[...]}` 倒序 |
| POST | `/trades` | body `{fundCode,date,side,shares,nav,amount?,feeRate?,fee?,note?}` → 服务端补 amount/fee |
| PUT/DELETE | `/trades/{id}` | 改 / 删单笔 |
| GET/PUT | `/settings` | 设置读写（`pairMaxGapDays` 改完服务端重算配对） |
| GET | `/export` / POST `/import` / DELETE `/data?confirm=true` | 备份 / 恢复 / 清空 |

`GET /api/portfolio` 响应结构：
```jsonc
{
  "asOf": "2026-11-20",
  "holdings": [{ /* 完全对齐 Holding */ }],
  "trades": [ /* Trade[]，note 为空则省略 */ ],
  "pairs": [ /* TPair[]，id 形如 "tp-t3-t4" */ ],
  "market": { "indices": [ /* IndexQuote[] */ ], "updatedAt": "2026-11-19 15:35" },
  "summary": { /* PortfolioSummary 的 15 个字段，一字不改 */ },
  "costCurve": [{ "date": "...", "value": 123.45 }],
  "meta": { "generatedAt": "...", "source": "live|stale|degraded", "warnings": [], "fundStatus": [] }
}
```
约定：
- `estimateNav/estimateChange/estimateTime` 恒 `null`。
- `RedeemTier.maxDays` 用 `null` 表示无上限。
- **唯一语义扩展**：`Holding` 新增**可选**字段 `dayChangePct?: number`（来自已公布日涨跌幅 RZDF）。因为 `estimateChange` 恒 null 会让「今日盈亏」永远 ¥0，改为 `Σ(marketValue × dayChangePct/100)`。只加可选字段，不动既有字段。

## 前端改造

| 文件 | 改动 |
|---|---|
| `frontend/vite.config.ts` | 加 `server.proxy['/api'] = { target: 'http://127.0.0.1:8000', changeOrigin: true }` |
| `frontend/src/lib/api.ts`（新增） | fetch 封装（base `/api`、10s AbortController、错误归一化），导出各端点方法 |
| `frontend/src/lib/store.tsx` | **重写为异步 store**：状态 `{data, status:'loading'\|'ready'\|'error', source:'api'\|'mock'}`；`useEffect` 拉 `/api/portfolio`；失败 → 用现有 `calc.ts`+`mock.ts` 现算兜底并置 `source='mock'`；暴露 `refresh()`；`useFundDetail(code)` 签名不变 |
| `frontend/src/components/ErrorBanner.tsx`（新增） | 顶部横幅：后端离线（演示数据）/ 数据源降级（展示 `meta.warnings`） |
| `frontend/src/pages/Transactions.tsx` | 加「记一笔」+ 每行编辑/删除 → `POST/PUT/DELETE /api/trades` |
| `frontend/src/pages/TradeForm.tsx`（新增） | 流水表单弹窗：基金下拉、日期、买卖、份额、净值、金额（可自动=份额×净值）、费率（可自动=档案费率/赎回档位）、备注 |
| `frontend/src/pages/FundForm.tsx` | 去掉 `MOCK_FUNDS/MOCK_FEES/MOCK_NAV` 依赖；新增「自动获取费率」→ `GET /api/funds/{code}/fee/auto` 回填；「保存」→ `POST/PUT /api/funds`（当前保存是空操作，必须接上） |
| `frontend/src/pages/FundDetail.tsx` | `mockNavSeries(code)` → `GET /api/funds/{code}/nav-history`（真实净值/累计净值） |
| `frontend/src/pages/Dashboard.tsx` | `mockCostCumulative` → store 的 `costCurve`（后端按真实数据算）；`mockIndexSeries` 保留（无真实历史源，见"已知缺口"） |
| `frontend/src/pages/Settings.tsx` | 「本地 SQLite 数据库 / ~/jijin-go/data/jijin.db」→ 「本地 JSON 文件」+ 显示 `/api/health` 返回的真实路径；配对时间窗口 → `PUT /api/settings`；导出/导入/清空 → API |
| `frontend/src/components/Layout.tsx` | 「实时估值已开启」徽标 → 「净值已更新 · navDate」/「盘中估值不可用（仅 T-1 净值）」 |
| `frontend/src/types.ts` | **仅新增**可选字段 `dayChangePct` 与 `NavPoint/PortfolioResponse/ApiMeta` 类型，既有字段一字不改 |

## 实施步骤（每步可独立验证）

1. **骨架 + 存储 + 种子**：`pyproject.toml`、`config.py`、`store.py`、`seed.py`、`main.py` 骨架 → `GET /api/portfolio` 用种子数据返回全量（先不联网）
2. **计算层移植 + 对拍**：`calc.py` + `scripts/dump_calc.py` + `frontend/scripts/calc_dump.ts` → `diff` 为空（整个方案的地基）
3. **数据源层**：`datasources/`（eastmoney + sina + 缓存 + 降级）→ `/api/funds/{code}/fee/auto`、`/nav-history`、`/api/market` 可用
4. **聚合服务**：`services/portfolio.py` + 成本曲线 → `/api/portfolio` 接真实数据
5. **写接口 + 前端联调**：`/trades` `/funds` `/settings` CRUD + `store.tsx` 异步化 + `TradeForm` + `FundForm` 保存
6. **页面细节替换 + 端到端验证**：净值走势图、Settings 数据管理、Layout 徽标

## 验证方案

```bash
# 起后端
cd backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# 起前端（已配 /api 代理）
cd frontend && npm run dev     # 5180
```
curl 断言点：
1. `/api/health` → 200，`dataDir` 指向 `backend/data`
2. `/api/portfolio` → 6 只持仓、4 次做 T（种子）、`meta.warnings` 为空
3. `/api/funds/161725/fee/auto` → `redeemTiers` 4 档（0-6 / 7-364 / 365-729 / 730-null）、`dailyHoldRate`=1.2、`subscribeRate`=0.1
4. `/api/funds/161725/nav-history?range=30` → 30 个点，末点日期 = 最新净值日
5. `/api/market` → 5 个指数，点位合理
6. 写链路：`POST /api/trades`（缺 amount/fee，服务端自动补）→ `GET /api/trades` 长度 +1 → `DELETE` → 复原；`cat backend/data/trades.json` 确认落盘
7. 并发：10 个并发 `POST /api/trades` → 长度恰为 10（锁生效）；写入中途 kill 进程 → 文件仍是合法 JSON（有 `.bak`）
8. 降级：断网后 `/api/portfolio` 仍 200，`meta.source` 为 `stale`/`degraded`，`warnings` 非空
9. 对拍：`node frontend/scripts/calc_dump.ts` vs `python backend/scripts/dump_calc.py` → `diff` 为空
10. 浏览器（TRAE-browseruse）：5180 六个页面截图 —— 总览（真实点位 + 非 mock 成本曲线）、持仓、基金详情（真实净值曲线 + 费率阶梯）、流水（新增/编辑/删除一笔并刷新验证持久化）、成本、设置（显示 JSON 路径 + 导出文件落地）；再停掉后端刷新 → 出现「演示数据」横幅且不白屏

## 已知缺口（需在 README / 界面上诚实标注）

- **盘中实时估值不可得**：`fundgz` 服务已下线，`push2` 被挡。`estimate*` 恒 null；「今日盈亏」改用已公布日涨跌幅。
- **指数历史曲线无真实源**：Dashboard 的「大盘走势」暂时保留 `mockIndexSeries`（点位真实，曲线是模拟）。
- **赎回费档位是简化模型**：按「最早买入日」算持有天数，真实规则是先进先出逐份额计费，后续可升级。
- 单用户本地使用，不做鉴权。
