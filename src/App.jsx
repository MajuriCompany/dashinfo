import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import OfferDetail from './pages/OfferDetail'
import Settings from './pages/Settings'
import Debug from './pages/Debug'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/oferta" element={<OfferDetail />} />
          <Route path="/config" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
