import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Settings, RefreshCw, Bug, LogOut } from 'lucide-react'
import { useContext, createContext, useState } from 'react'

export const RefreshContext = createContext(null)

const NAV = [
  { to: '/',        label: 'Visão Geral',   Icon: LayoutDashboard },
  { to: '/oferta',  label: 'Por Oferta',    Icon: TrendingUp },
  { to: '/config',  label: 'Configurações', Icon: Settings },
  { to: '/debug',   label: 'Debug',         Icon: Bug },
]

export default function Layout({ onLogout }) {
  const [refreshFn, setRefreshFn] = useState(null)
  const [loading, setLoading]     = useState(false)

  async function handleRefresh() {
    if (refreshFn) {
      setLoading(true)
      await refreshFn()
      setLoading(false)
    }
  }

  return (
    <RefreshContext.Provider value={{ setRefreshFn }}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-700">
            <h1 className="font-bold text-sm leading-tight">Dashboard<br />Infoprodutos</h1>
            <p className="text-gray-400 text-xs mt-1">Mercado Hispânico</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-700 space-y-1">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar dados
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </RefreshContext.Provider>
  )
}
