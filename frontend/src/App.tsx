import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ThemeProvider } from './lib/theme'
import { StoreProvider } from './lib/store'
import { CostAnalysis } from './pages/CostAnalysis'
import { Dashboard } from './pages/Dashboard'
import { FundDetail } from './pages/FundDetail'
import { Holdings } from './pages/Holdings'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/holdings" element={<Holdings />} />
              <Route path="/fund/:code" element={<FundDetail />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/cost" element={<CostAnalysis />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </ThemeProvider>
  )
}
