import { NavLink } from 'react-router-dom'
import { useAuthContext } from '@/hooks/use-auth'
import { useTenant } from '@/hooks/use-tenant'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
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
  GitBranch,
} from 'lucide-react'

const ADMIN_LINKS = [
  { to: '/admin', icon: LayoutDashboard, label: 'Painel' },
  { to: '/admin/tenants', icon: Building2, label: 'Gerenciar Tenants' },
  { to: '/admin/bots', icon: Bot, label: 'Chatbots IA' },
  { to: '/admin/integrations', icon: Plug, label: 'Integrações' },
  { to: '/admin/logs', icon: ScrollText, label: 'Logs do Sistema' },
]

const CLIENT_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', module_key: 'dashboard' },
  { to: '/crm', icon: Users, label: 'CRM', module_key: 'crm' },
  { to: '/pipelines', icon: GitBranch, label: 'Pipelines', module_key: 'crm' },
  { to: '/prontuarios', icon: ScrollText, label: 'Prontuários', module_key: 'prontuarios' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda', module_key: 'agenda' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', module_key: 'whatsapp' },
  { to: '/email', icon: Mail, label: 'Email', module_key: 'email' },
  { to: '/automations', icon: Zap, label: 'Automações', module_key: 'automations' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios', module_key: 'reports' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

interface SidebarNavProps {
  onItemClick?: () => void
}

export function SidebarNav({ onItemClick }: SidebarNavProps) {
  const { isAdmin } = useAuthContext()
  const { loading, isModuleEnabled } = useTenant()

  const links = isAdmin
    ? ADMIN_LINKS
    : CLIENT_LINKS.filter((link) => {
        if (!link.module_key) return true
        return isModuleEnabled(link.module_key)
      })

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {!isAdmin && loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg mb-1" />
            ))
          : links.map((link, index) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin' || link.to === '/dashboard'}
                onClick={onItemClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-r-lg transition-all duration-150 border-l-[3px] animate-in fade-in',
                    isActive
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
                  )
                }
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationDuration: '200ms',
                  animationFillMode: 'both',
                }}
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
