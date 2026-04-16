import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, Tag, ArrowLeftRight, BarChart3, Upload, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Contas' },
  { to: '/categories', icon: Tag, label: 'Categorias' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/import', icon: Upload, label: 'Importar' },
]

export function Sidebar() {
  const { logout, user } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <span className="text-xl font-bold text-primary">💰 Plutos</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
