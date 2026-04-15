import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus,
  CalendarCheck,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  MessageCircle,
  CalendarPlus,
  BarChart3,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { useTenant } from '@/hooks/useTenant'
import { ModuleGate } from '@/components/ModuleGate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  fetchDashboardStats,
  fetchRecentActivity,
  fetchUpcomingAppointments,
  fetchPipelineSummary,
} from '@/services/dashboardService'

export default function ClientDashboardWrapper() {
  return (
    <ModuleGate module_key="dashboard">
      <ClientDashboard />
    </ModuleGate>
  )
}

function ClientDashboard() {
  const { tenant, loading: tenantLoading, isModuleEnabled } = useTenant()
  const navigate = useNavigate()

  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [stats, setStats] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [pipeline, setPipeline] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      setError(false)
      const [s, a, appts, p] = await Promise.all([
        fetchDashboardStats(tenant.id, period),
        fetchRecentActivity(tenant.id),
        fetchUpcomingAppointments(tenant.id),
        fetchPipelineSummary(tenant.id),
      ])
      setStats(s)
      setActivity(a)
      setAppointments(appts)
      setPipeline(p)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant?.id, period])

  if (tenantLoading || (loading && !stats)) {
    return (
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 max-w-[1600px] mx-auto text-center">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">
          Não foi possível carregar o dashboard. Tente novamente.
        </h2>
        <Button onClick={loadData} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      </div>
    )
  }

  const isEmpty = stats?.new_leads === 0 && stats?.total_appointments === 0
  const comparePercent =
    stats?.previous_appointments > 0
      ? Math.round(
          ((stats.total_appointments - stats.previous_appointments) / stats.previous_appointments) *
            100,
        )
      : 0

  const stageTranslations: Record<string, string> = {
    lead: 'Leads',
    contact: 'Contato',
    scheduled: 'Agendados',
    consultation: 'Consulta',
    return: 'Retorno',
    procedure: 'Procedimento',
  }

  const apptTranslations: Record<string, string> = {
    consultation: 'Consulta',
    return: 'Retorno',
    procedure: 'Procedimento',
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600',
    confirmed: 'bg-success/10 text-success',
    completed: 'bg-primary/10 text-primary',
    no_show: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  }

  const statusTranslations: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Realizado',
    no_show: 'Faltou',
    cancelled: 'Cancelado',
  }

  const handleActionClick = (module: string, path: string) => {
    if (isModuleEnabled(module)) {
      navigate(path)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Métricas da sua clínica</p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as 'week' | 'month')}
          className="bg-card border border-border rounded-md"
        >
          <ToggleGroupItem value="week" className="text-xs px-4 h-9">
            Semana
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="text-xs px-4 h-9">
            Mês
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card icon={UserPlus} label="Novos Leads" value={stats?.new_leads} />
        <Card
          icon={CalendarCheck}
          label="Agendamentos"
          value={stats?.total_appointments}
          trend={
            comparePercent !== 0
              ? { value: comparePercent, positive: comparePercent > 0 }
              : undefined
          }
        />
        <Card
          icon={CheckCircle}
          label="Consultas Realizadas"
          value={stats?.completed_appointments}
          iconColor="text-success"
          iconBg="bg-success/10"
        />
        <Card
          icon={XCircle}
          label="No-shows"
          value={stats?.no_shows}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
        />
        <Card
          icon={TrendingUp}
          label="Taxa de Conversão"
          value={`${stats?.conversion_rate}%`}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Pipeline */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Pipeline de Pacientes</h3>
            <div className="flex w-full h-12 rounded-md overflow-hidden bg-secondary">
              {pipeline.map((p, i) => {
                const total = pipeline.reduce((acc, curr) => acc + curr.count, 0)
                const width =
                  total > 0 ? Math.max((p.count / total) * 100, 5) : 100 / pipeline.length
                const colors = [
                  'bg-blue-500',
                  'bg-indigo-500',
                  'bg-purple-500',
                  'bg-fuchsia-500',
                  'bg-pink-500',
                  'bg-rose-500',
                ]
                return (
                  <div
                    key={p.stage}
                    style={{ width: `${width}%` }}
                    className={cn(
                      'h-full border-r border-background/20 last:border-0 flex items-center justify-center cursor-pointer hover:brightness-110 transition-all',
                      colors[i % colors.length],
                    )}
                    onClick={() => navigate(`/crm?stage=${p.stage}`)}
                    title={`${stageTranslations[p.stage]}: ${p.count}`}
                  >
                    {p.count > 0 && width > 10 && (
                      <span className="text-white text-xs font-bold px-1 truncate">{p.count}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap justify-between mt-3 text-xs text-muted-foreground">
              {pipeline.map((p) => (
                <div
                  key={p.stage}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-foreground"
                  onClick={() => navigate(`/crm?stage=${p.stage}`)}
                >
                  <span className="w-2 h-2 rounded-full bg-primary/60"></span>
                  <span>
                    {stageTranslations[p.stage]}: <span className="font-semibold">{p.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Atividade Recente */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col justify-center min-h-[300px]">
            <h3 className="text-base font-semibold mb-4">Atividade Recente</h3>

            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <UserPlus className="w-10 h-10 text-muted-foreground mb-3" />
                <h4 className="font-medium text-sm mb-1">Nenhuma atividade recente.</h4>
                {isEmpty && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
                      Bem-vindo ao Doctor Funnels! Comece adicionando seus primeiros pacientes.
                    </p>
                    <Button size="sm" onClick={() => navigate('/crm?action=new')}>
                      Adicionar paciente
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (act.type === 'new_lead') navigate(`/crm?search=${act.entity_id}`)
                      if (act.type === 'appointment') navigate(`/agenda`)
                      if (act.type === 'message') navigate(`/whatsapp`)
                    }}
                  >
                    <div className="mt-0.5 p-2 rounded-full bg-secondary text-muted-foreground">
                      {act.type === 'new_lead' && <UserPlus className="w-4 h-4" />}
                      {act.type === 'appointment' && <Calendar className="w-4 h-4" />}
                      {act.type === 'message' && <MessageCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(act.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {activity.length >= 10 && (
                  <Button variant="link" className="w-full mt-2 text-xs h-8 text-muted-foreground">
                    Ver tudo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Próximos Agendamentos */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Próximos Agendamentos</h3>
            {appointments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">Nenhum agendamento próximo.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/agenda?action=new')}>
                  Agendar consulta
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 border border-border rounded-md bg-background flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm truncate pr-2">{apt.patient_name}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] uppercase font-semibold whitespace-nowrap',
                          statusColors[apt.status],
                        )}
                      >
                        {statusTranslations[apt.status] || apt.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
                        <span>
                          {format(new Date(apt.datetime_start), "EEE, dd/MM 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        <span>{apptTranslations[apt.type] || apt.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn
                icon={UserPlus}
                label="Novo Paciente"
                onClick={() => handleActionClick('crm', '/crm?action=new')}
                enabled={isModuleEnabled('crm')}
              />
              <ActionBtn
                icon={CalendarPlus}
                label="Agendar Consulta"
                onClick={() => handleActionClick('agenda', '/agenda?action=new')}
                enabled={isModuleEnabled('agenda')}
              />
              <ActionBtn
                icon={MessageCircle}
                label="WhatsApp"
                onClick={() => handleActionClick('whatsapp', '/whatsapp')}
                enabled={isModuleEnabled('whatsapp')}
              />
              <ActionBtn
                icon={BarChart3}
                label="Relatórios"
                onClick={() => handleActionClick('dashboard', '/reports')}
                enabled={isModuleEnabled('dashboard')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({
  icon: Icon,
  label,
  value,
  trend,
  iconColor = 'text-muted-foreground',
  iconBg = 'bg-secondary',
}: {
  icon: any
  label: string
  value: string | number
  trend?: { value: number; positive: boolean }
  iconColor?: string
  iconBg?: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col">
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center mb-3', iconBg)}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-bold">{value}</h4>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trend.positive ? 'text-success' : 'text-destructive',
            )}
          >
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  enabled,
}: {
  icon: any
  label: string
  onClick: () => void
  enabled: boolean
}) {
  const content = (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={cn(
        'flex flex-col items-center justify-center p-4 border rounded-md transition-colors gap-2 h-24 w-full',
        enabled
          ? 'bg-background border-border hover:bg-secondary hover:border-primary/50 cursor-pointer'
          : 'bg-secondary/30 border-border/50 opacity-60 cursor-not-allowed',
      )}
    >
      <Icon className="w-6 h-6 text-muted-foreground" />
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </button>
  )

  if (!enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-not-allowed w-full">{content}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Módulo não disponível</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}
