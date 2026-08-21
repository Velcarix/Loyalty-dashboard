import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Icon, type IconName } from '@/components/Icon'

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: '/programas', label: 'Programas', icon: 'program' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

export function Layout() {
  const { merchant, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F7F9FC] text-ink">
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <div role="img" aria-label="Copo" className="h-11 w-32 bg-[url('/brand/copo-logo-horizontal.png')] bg-[length:140%_auto] bg-center bg-no-repeat" />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Loyalty</p>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  isActive ? 'bg-primary text-white shadow-sm shadow-primary/25' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="truncate text-sm font-bold text-slate-900">{merchant?.businessName}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{merchant?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-[0.98]"
          >
            <Icon name="logout" size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
          <div role="img" aria-label="Copo" className="h-9 w-24 bg-[url('/brand/copo-logo-horizontal.png')] bg-[length:140%_auto] bg-center bg-no-repeat" />
          <div className="flex items-center gap-1">
            {navItems.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600'}`}><Icon name={item.icon} size={16} />{item.label}</NavLink>)}
            <button onClick={handleLogout} aria-label="Cerrar sesión" className="inline-flex min-h-10 items-center rounded-lg px-2 text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-[0.98]"><Icon name="logout" size={17} /></button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
