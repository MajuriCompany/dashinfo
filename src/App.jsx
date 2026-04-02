import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import OffersOverview from './pages/OffersOverview'
import OfferDetail from './pages/OfferDetail'
import Settings from './pages/Settings'
import Debug from './pages/Debug'

export default function App() {
  const { authenticated, hasCredentials, login, setupCredentials, logout } = useAuth()

  if (!authenticated) {
    return (
      <Login
        hasCredentials={hasCredentials}
        onLogin={login}
        onSetup={setupCredentials}
      />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout onLogout={logout} />}>
          <Route path="/" element={<Overview />} />
          <Route path="/ofertas" element={<OffersOverview />} />
          <Route path="/oferta" element={<OfferDetail />} />
          <Route path="/config" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
