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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-100 px-5 py-4">
          <div role="img" aria-label="Copo" className="h-11 w-32 bg-[url('/brand/copo-logo-horizontal.png')] bg-[length:140%_auto] bg-center bg-no-repeat" />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Loyalty</p>
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
            className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden">
          <div role="img" aria-label="Copo" className="h-9 w-24 bg-[url('/brand/copo-logo-horizontal.png')] bg-[length:140%_auto] bg-center bg-no-repeat" />
          <div className="flex gap-1">
            {navItems.map(item => <NavLink key={item.to} to={item.to} aria-label={item.label} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600'}`}>{item.icon}</NavLink>)}
            <button onClick={handleLogout} aria-label="Cerrar sesión" className="rounded-lg px-3 py-2 text-sm text-gray-500 active:scale-[0.98]">↪</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
