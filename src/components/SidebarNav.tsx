import { NavLink } from 'react-router-dom'
import { useRole } from '@/hooks/use-role'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Bot,
  Plug,
  ScrollText,
  Users,
  CalendarDays,
  MessageCircle,
  Mail,
  Zap,
  BarChart3,
  Settings,
} from 'lucide-react'

const ADMIN_LINKS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Painel' },
  { to: '/admin/tenants', icon: Building2, label: 'Gerenciar Tenants' },
  { to: '/admin/bots', icon: Bot, label: 'Chatbots IA' },
  { to: '/admin/integrations', icon: Plug, label: 'Integrações' },
  { to: '/admin/logs', icon: ScrollText, label: 'Logs do Sistema' },
]

const CLIENT_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/crm', icon: Users, label: 'CRM' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/email', icon: Mail, label: 'Email' },
  { to: '/automations', icon: Zap, label: 'Automações' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

interface SidebarNavProps {
  onItemClick?: () => void
}

export function SidebarNav({ onItemClick }: SidebarNavProps) {
  const { role } = useRole()
  const links = role === 'super_admin' ? ADMIN_LINKS : CLIENT_LINKS

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/dashboard'}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-r-lg transition-all duration-150 border-l-[3px]',
                isActive
                  ? 'bg-primary/10 text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
              )
            }
          >
            <link.icon className="h-5 w-5 shrink-0" />
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="p-6 border-t mt-auto">
        <p className="text-xs text-muted-foreground font-medium text-center">
          Doctor Funnels OS v1.0
        </p>
      </div>
    </div>
  )
}
