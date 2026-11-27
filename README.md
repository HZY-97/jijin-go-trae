# 基金做 T 助手

长周期持有场外基金，通过择时做 T 稀释持仓成本，并把**买入费、每日持有费、卖出费**这些隐性成本完整摊开。

数据全部存在本机 JSON 文件里，行情与费率实时抓自天天基金 / 新浪财经。

```
├── backend/     FastAPI：真实行情抓取 + 费率档案 + 全部计算逻辑
└── frontend/    React + Vite：6 个页面的前端
```

---

## 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | ≥ 3.12 | 后端 |
| Node.js | ≥ 20 | 前端构建 |
| uv | 任意版本 | 可选，Python 依赖管理（用 pip 也行） |

---

## 快速开始

### 1. 启动后端

```bash
cd backend

# 推荐：uv 会自动创建 .venv 并装好依赖
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

没有 uv 也可以用标准 venv：

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install "fastapi>=0.115,<1.0" "uvicorn[standard]>=0.30" \
            "httpx>=0.27,<0.29" "beautifulsoup4>=4.12,<5" "pydantic>=2.9,<3"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

首次启动会自动播种 6 只基金 + 20 笔演示流水，并**从天天基金抓取真实费率**替换演示值。
启动后访问 <http://127.0.0.1:8000/docs> 可以看到完整 API 文档。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开 <http://127.0.0.1:5180>。

前端通过 Vite 代理把 `/api` 转发到 `127.0.0.1:8000`，所以两个进程要同时开着。

---

## 生产部署

### 构建前端

```bash
cd frontend
npm install          # 首次
npm run build        # 产物在 frontend/dist/
```

### 一体化部署（最省事，进程最少）

用 `vite preview` 同时托管静态产物**并**代理 `/api`：

```bash
# 终端 1：后端
cd backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

# 终端 2：前端（4173 端口）
cd frontend
npx vite preview --host 127.0.0.1 --port 4173
```

浏览器打开 <http://127.0.0.1:4173>。

> `vite preview` 默认继承 `vite.config.ts` 里的 `server.proxy` 配置，所以 `/api` 会自动转发到后端。
> SPA 深链（直接访问 `/holdings`、`/fund/161725`）也会正确回退到 index.html。

**注意**：`vite preview` 是开发服务器，性能和稳定性不适合长期对外服务。正式长期运行请用下面的方案。

### 正式部署（nginx 反代）

#### 1. 后端常驻

systemd 示例 `/etc/systemd/system/jijin-backend.service`：

```ini
[Unit]
Description=基金做T助手 API
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/jijin/backend
ExecStart=/path/to/jijin/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now jijin-backend
sudo systemctl status jijin-backend
```

#### 2. nginx 托管前端静态产物

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态产物
    root /path/to/jijin/frontend/dist;
    index index.html;

    # SPA 深链回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 行情抓取可能较慢，放宽超时
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

拿到 HTTPS 证书（可选但推荐）：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 3. 验证

```bash
curl http://127.0.0.1:8000/api/health          # 后端活着
curl -I http://your-domain.com/                # 首页 200
curl -I http://your-domain.com/holdings        # SPA 深链也要 200
curl http://your-domain.com/api/portfolio      # 反代通了
```

---

## 数据存放位置

全部数据在 `backend/data/`，**这个目录已在 .gitignore 中，不会被提交**：

| 文件 | 内容 |
|------|------|
| `funds.json` | 基金档案与费率档案 |
| `trades.json` | 交易流水 |
| `settings.json` | 应用设置（配对窗口、刷新间隔等） |
| `cache/` | 行情与费率缓存（可安全删除，会自动重建） |

每个文件写入时都会先备份成 `.bak`，万一损坏会自动回退备份。

### 备份与迁移

界面里「设置 → 数据管理」有导出 / 导入 / 清空三个按钮，导出的是标准 JSON，跨机器迁移直接用。

也可以直接拷目录（在仓库根目录执行，排除可重建的缓存）：

```bash
tar czf jijin-backup-$(date +%F).tar.gz --exclude='data/cache' -C backend data
```

恢复时把 `data/` 放回 `backend/` 下即可。

---

## 常见问题

**页面右上角显示「后端未连接，当前显示演示数据」**
后端没起来或端口不对。检查 `curl 127.0.0.1:8000/api/health` 是否返回 200。
注意用 `vite preview` 部署时，`vite.config.ts` 里的代理目标是 `127.0.0.1:8000`，后端换个端口就要同步改这里。

**费率抓取失败 / 数据源降级**
行情和费率来自天天基金与新浪财经的公开接口，偶尔会限流或超时。
后端会自动回退到磁盘缓存并在页面顶部提示。缓存分三种有效期：大盘指数 60 秒、基金净值 10 分钟、历史净值 6 小时、费率档案 7 天 —— 费率是合约条款，所以存得最久。缓存在 `backend/data/cache/`，删掉会自动重建。

**净值日期停在昨天**
场外基金每个交易日晚间公布净值，这是正常现象。盘中实时估值接口（`fundgz.1234567.com.cn`）已经下线，本应用展示的是最近一个已公布净值。

**赎回费档位算得不对**
当前是简化模型：按**最早买入日**计算持有天数，不是每笔买入单独计。
如果你需要精确到每笔，可在「添加基金」里手工调整费率档位。

**想清空演示数据重来**
「设置 → 数据管理 → 清空所有数据」，或直接删掉 `backend/data/` 目录里的三个 json 文件后重启后端（会自动重新播种）。

**手工改过的费率会不会被重启覆盖**
不会。启动时只有 `feeSource` 为 `seed` 的记录会被真实费率替换；你在界面上手工改过的费率会标记为 `manual`，重启后原样保留。

**端口被占用**
```bash
lsof -i :8000    # 后端
lsof -i :5180    # 前端 dev
lsof -i :4173    # 前端 preview
```

**直接访问 8000 端口想改后端监听地址**
改 `vite.config.ts` 里的代理目标（`target`）和启动命令的 `--host`/`--port` 两处，保持一致。

---

## 常用命令

```bash
# 后端
cd backend
uv sync                                          # 安装依赖
uv run uvicorn app.main:app --reload             # 开发 (127.0.0.1:8000)

# 前端
cd frontend
npm run dev                                      # 开发服务器 (5180)
npm run build                                    # 构建到 dist/
npx vite preview --port 4173                     # 预览构建产物 (4173)
npm run lint                                     # oxlint 检查
```

---

## 技术说明

- **计算逻辑只有一份**，在后端 `app/calc.py`；前端 `src/lib/calc.ts` 是它的镜像。
  两者通过 `backend/scripts/compare_calc.py` 与 `frontend/scripts/calc_dump.ts` 做逐值对拍，改一边必须同步另一边。

- **数据源**
  - 基金基本信息、最新净值、费率档案 → 天天基金（`fundmobapi.eastmoney.com`、`fundf10.eastmoney.com/jjfl_{code}.html`）
  - 历史净值 → `fund.eastmoney.com/pingzhongdata/{code}.js`
  - 大盘指数 → 新浪财经 `hq.sinajs.cn`

- **存储**用标准库 `json` + 线程锁 + 原子写（临时文件 → fsync → `os.replace`），没有引入数据库。单用户本地工具，不需要更多。

- **响应体手写 dict**，pydantic 只用于校验入参，这样字段名能和前端 TypeScript 类型严格对齐。
