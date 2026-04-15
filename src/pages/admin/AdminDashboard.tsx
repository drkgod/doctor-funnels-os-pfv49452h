import { Link } from 'react-router-dom'
import { Building2, Users, MessageSquare, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const stats = [
  {
    title: 'Tenants Ativos',
    value: '24',
    icon: Building2,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    trend: '+12%',
    positive: true,
  },
  {
    title: 'Novos Leads',
    value: '842',
    icon: Users,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    trend: '+5%',
    positive: true,
  },
  {
    title: 'Mensagens / Mês',
    value: '45.2k',
    icon: MessageSquare,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    trend: '-2%',
    positive: false,
  },
  {
    title: 'Automações',
    value: '156',
    icon: Zap,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    trend: '+18%',
    positive: true,
  },
]

const mockTenants = [
  {
    id: '1',
    name: 'Clínica Odonto Vida',
    plan: 'professional',
    status: 'active',
    created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Dra. Ana Silva',
    plan: 'essential',
    status: 'trial',
    created_at: '2026-04-02T14:20:00Z',
  },
  {
    id: '3',
    name: 'Centro Médico Saúde',
    plan: 'clinic',
    status: 'active',
    created_at: '2026-04-10T09:30:00Z',
  },
  {
    id: '4',
    name: 'Dr. Carlos Mendes',
    plan: 'essential',
    status: 'suspended',
    created_at: '2026-01-20T11:00:00Z',
  },
  {
    id: '5',
    name: 'Clínica Bem Estar',
    plan: 'professional',
    status: 'cancelled',
    created_at: '2025-11-05T16:45:00Z',
  },
]

const mockActivities = [
  {
    id: '1',
    timestamp: 'Hoje, 14:30',
    action: 'Novo tenant criado: Clínica Sorriso',
    type: 'Tenant',
  },
  {
    id: '2',
    timestamp: 'Hoje, 11:15',
    action: 'Instância WhatsApp conectada (Clínica Odonto Vida)',
    type: 'WhatsApp',
  },
  {
    id: '3',
    timestamp: 'Ontem, 16:45',
    action: 'Plano atualizado para Professional (Dra. Ana Silva)',
    type: 'Faturamento',
  },
  {
    id: '4',
    timestamp: 'Ontem, 09:20',
    action: 'Módulo IA ativado (Centro Médico Saúde)',
    type: 'Módulos',
  },
  {
    id: '5',
    timestamp: '12 Abr, 15:00',
    action: 'Tenant suspenso por falta de pagamento (Dr. Carlos Mendes)',
    type: 'Sistema',
  },
]

export const getPlanBadgeClasses = (plan: string) => {
  switch (plan?.toLowerCase()) {
    case 'professional':
      return 'bg-primary/10 text-primary'
    case 'clinic':
      return 'bg-accent/15 text-accent'
    default:
      return 'bg-secondary text-foreground'
  }
}

export const getStatusBadgeClasses = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'ativo':
      return 'bg-success/10 text-success'
    case 'trial':
      return 'bg-amber-500/10 text-[hsl(45,93%,47%)]'
    case 'suspended':
    case 'suspenso':
      return 'bg-destructive/10 text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto w-full pb-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-2">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-6 bg-card rounded-[var(--radius)] border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{stat.title}</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h3 className="text-[28px] font-bold text-foreground leading-none">
                    {stat.value}
                  </h3>
                  <span
                    className={cn(
                      'text-[12px] flex items-center font-medium',
                      stat.positive ? 'text-green-500' : 'text-red-500',
                    )}
                  >
                    {stat.positive ? (
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    )}
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div
                className={cn('w-10 h-10 rounded-full flex items-center justify-center', stat.bg)}
              >
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-[16px] font-semibold text-foreground mb-4">Tenants Recentes</h2>
          <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                    <th className="px-4 py-3 whitespace-nowrap">Nome</th>
                    <th className="px-4 py-3 whitespace-nowrap">Plano</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {mockTenants.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                        <Link
                          to={`/admin/tenants/${t.id}`}
                          className="font-medium text-primary cursor-pointer hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block capitalize',
                            getPlanBadgeClasses(t.plan),
                          )}
                        >
                          {t.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block capitalize',
                            getStatusBadgeClasses(t.status),
                          )}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(t.created_at), 'dd/MM/yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <h2 className="text-[16px] font-semibold text-foreground mb-4">Atividade Recente</h2>
          <div className="bg-card rounded-[var(--radius)] border border-border px-4 py-1">
            <div className="flex flex-col">
              {mockActivities.map((act, i) => (
                <div
                  key={act.id}
                  className={cn(
                    'py-3 flex flex-col gap-1',
                    i !== mockActivities.length - 1 && 'border-b border-border/50',
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                      {act.timestamp}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded inline-block">
                      {act.type}
                    </span>
                  </div>
                  <p className="text-[14px] text-foreground leading-snug mt-1">{act.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
