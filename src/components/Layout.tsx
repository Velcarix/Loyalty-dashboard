import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const navItems = [
  { to: '/programas', label: 'Programas', icon: '🎫' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]

export function Layout() {
  const { merchant, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
        <div className="px-5 py-5">
          <span className="text-xl font-bold text-primary">Copo Loyalty</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 px-4 py-4">
          <p className="truncate text-sm font-semibold text-gray-900">{merchant?.businessName}</p>
          <p className="truncate text-xs text-gray-400">{merchant?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
