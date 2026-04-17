import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users, Calendar, FileText, Mic, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import {
  formatDistanceToNow,
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfYear,
  endOfYear,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

import { useAuth } from '@/hooks/use-auth'
import { useTenant } from '@/hooks/useTenant'
import { ModuleGate } from '@/components/ModuleGate'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { fetchDashboardStats, fetchDoctorStats } from '@/services/dashboardService'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'

type RangeOption = 'hoje' | 'esta_semana' | 'este_mes' | 'ultimos_30_dias' | 'este_ano'

const rangeLabels: Record<RangeOption, string> = {
  hoje: 'Hoje',
  esta_semana: 'Esta Semana',
  este_mes: 'Este Mês',
  ultimos_30_dias: 'Últimos 30 Dias',
  este_ano: 'Este Ano',
}

const getRangeDates = (option: RangeOption) => {
  const now = new Date()
  switch (option) {
    case 'hoje':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'esta_semana':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        to: endOfDay(now).toISOString(),
      }
    case 'este_mes':
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    case 'ultimos_30_dias':
      return { from: subDays(startOfDay(now), 30).toISOString(), to: endOfDay(now).toISOString() }
    case 'este_ano':
      return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
  }
}

const chartConfigAppointments = {
  count: { label: 'Consultas', color: 'hsl(var(--primary))' },
}

const chartConfigPatients = {
  count: { label: 'Pacientes', color: 'hsl(var(--primary))' },
}

export default function ClientDashboardWrapper() {
  return (
    <ModuleGate moduleKey="dashboard">
      <ClientDashboard />
    </ModuleGate>
  )
}

function ClientDashboard() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [role, setRole] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rangeOption, setRangeOption] = useState<RangeOption>('este_mes')

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setRole(data.role)
      })
  }, [user])

  const loadData = useCallback(async () => {
    if (!tenant?.id || !user || !role) return

    try {
      setLoading(true)
      setError(false)
      const range = getRangeDates(rangeOption)

      let data
      if (role === 'doctor') {
        data = await fetchDoctorStats(tenant.id, user.id, range)
      } else {
        data = await fetchDashboardStats(tenant.id, range)
      }
      setStats(data)
    } catch (err) {
      console.error(err)
      setError(true)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do dashboard.',
        variant: 'destructive',
        action: (
          <ToastAction altText="Tentar novamente" onClick={() => window.location.reload()}>
            Tentar Novamente
          </ToastAction>
        ),
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, user, role, rangeOption, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await loadData()
  })

  if (loading || (!stats && !error)) return <DashboardSkeleton />
  if (error && !stats) return <ErrorState onRetry={loadData} />

  const isWelcome =
    stats.total_patients === 0 && stats.total_appointments === 0 && stats.total_records === 0

  return (
    <div className="p-6 space-y-0 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {pullDistance > 0 && (
        <div
          className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none"
          style={{ top: `${pullDistance - 40}px` }}
        >
          <div className="bg-card shadow-md rounded-full p-2 border border-border">
            <Loader2 className={cn('w-5 h-5 text-primary', isRefreshing && 'animate-spin')} />
          </div>
        </div>
      )}
      <Header rangeOption={rangeOption} setRangeOption={setRangeOption} />

      {isWelcome ? <WelcomeBanner onStart={() => navigate('/crm')} /> : <StatsRow stats={stats} />}

      <ChartsRow stats={stats} />
      <ListsRow stats={stats} navigate={navigate} />
    </div>
  )
}

function Header({
  rangeOption,
  setRangeOption,
}: {
  rangeOption: RangeOption
  setRangeOption: (val: RangeOption) => void
}) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua clínica</p>
      </div>
      <div className="flex items-center gap-[8px] overflow-x-auto pb-2 md:pb-0 scrollbar-none">
        {(Object.keys(rangeLabels) as RangeOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setRangeOption(opt)}
            className={cn(
              'whitespace-nowrap px-[14px] py-[6px] rounded-full text-[12px] font-medium cursor-pointer transition-all duration-150',
              rangeOption === opt
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
            )}
          >
            {rangeLabels[opt]}
          </button>
        ))}
      </div>
    </div>
  )
}

function WelcomeBanner({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full p-8 bg-gradient-to-br from-primary/5 to-accent border border-primary/15 rounded-xl mb-6">
      <h2 className="text-[20px] font-bold text-foreground">Bem-vindo ao Doctor Funnels!</h2>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-[24px] h-[24px] rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center shrink-0">
            1
          </div>
          <p className="text-[14px] text-foreground">
            <Link to="/crm" className="text-primary underline font-medium">
              Cadastre seus pacientes no CRM
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[24px] h-[24px] rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center shrink-0">
            2
          </div>
          <p className="text-[14px] text-foreground">
            <Link to="/agenda" className="text-primary underline font-medium">
              Agende consultas na Agenda
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[24px] h-[24px] rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center shrink-0">
            3
          </div>
          <p className="text-[14px] text-foreground">
            <Link to="/prontuarios" className="text-primary underline font-medium">
              Crie prontuários no módulo Prontuários
            </Link>
          </p>
        </div>
      </div>
      <Button onClick={onStart} className="mt-5 h-[44px] px-8 bg-primary text-[14px] font-semibold">
        Começar
      </Button>
    </div>
  )
}

function StatsRow({ stats }: { stats: any }) {
  const pctSigned =
    stats.total_records > 0 ? Math.round((stats.signed_records / stats.total_records) * 100) : 0

  return (
    <div className="flex flex-row md:grid md:grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px] overflow-x-auto snap-x pb-4 md:pb-0 scrollbar-none mb-4 md:mb-0">
      {/* Card 1 */}
      <div
        className="min-w-[240px] snap-start p-5 bg-card border border-border rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ animationDelay: '0ms', animationFillMode: 'both' }}
      >
        <div className="absolute top-[16px] right-[16px] w-[40px] h-[40px] rounded-full flex items-center justify-center bg-primary/[0.08]">
          <Users className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          Pacientes
        </div>
        <div className="text-[32px] font-bold text-foreground mt-1 leading-none">
          {stats.total_patients}
        </div>
        <div className="text-[12px] mt-1 flex items-center gap-1 font-medium">
          {stats.new_patients > 0 ? (
            <span className="flex items-center gap-1 text-[hsl(152,68%,40%)]">
              <TrendingUp className="w-3 h-3" />+{stats.new_patients} novos
            </span>
          ) : (
            <span className="text-muted-foreground">0 novos</span>
          )}
        </div>
      </div>

      {/* Card 2 */}
      <div
        className="min-w-[240px] snap-start p-5 bg-card border border-border rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ animationDelay: '75ms', animationFillMode: 'both' }}
      >
        <div className="absolute top-[16px] right-[16px] w-[40px] h-[40px] rounded-full flex items-center justify-center bg-[hsl(270,60%,50%)]/[0.08]">
          <Calendar className="w-[18px] h-[18px] text-[hsl(270,60%,50%)]" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          Consultas
        </div>
        <div className="text-[32px] font-bold text-foreground mt-1 leading-none">
          {stats.total_appointments}
        </div>
        <div className="text-[12px] mt-1 flex items-center gap-2 font-medium">
          <span className="flex items-center gap-1 text-[hsl(152,68%,40%)]">
            <TrendingUp className="w-3 h-3" />
            {stats.completed_appointments} realizadas
          </span>
          {stats.no_show_appointments > 0 && (
            <span className="flex items-center gap-1 border-l border-border/50 pl-2 text-destructive">
              <TrendingDown className="w-3 h-3" />
              {stats.no_show_appointments} faltas
            </span>
          )}
        </div>
      </div>

      {/* Card 3 */}
      <div
        className="min-w-[240px] snap-start p-5 bg-card border border-border rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ animationDelay: '150ms', animationFillMode: 'both' }}
      >
        <div className="absolute top-[16px] right-[16px] w-[40px] h-[40px] rounded-full flex items-center justify-center bg-[hsl(45,93%,47%)]/[0.08]">
          <FileText className="w-[18px] h-[18px] text-[hsl(45,93%,47%)]" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          Prontuários
        </div>
        <div className="text-[32px] font-bold text-foreground mt-1 leading-none">
          {stats.total_records}
        </div>
        <div className="text-[12px] mt-1 flex items-center gap-1 font-medium">
          <span className="flex items-center gap-1 text-[hsl(152,68%,40%)]">
            <TrendingUp className="w-3 h-3" />
            {stats.signed_records} assinados ({pctSigned}%)
          </span>
        </div>
      </div>

      {/* Card 4 */}
      <div
        className="min-w-[240px] snap-start p-5 bg-card border border-border rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ animationDelay: '225ms', animationFillMode: 'both' }}
      >
        <div className="absolute top-[16px] right-[16px] w-[40px] h-[40px] rounded-full flex items-center justify-center bg-[hsl(195,80%,45%)]/[0.08]">
          <Mic className="w-[18px] h-[18px] text-[hsl(195,80%,45%)]" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          Transcrições IA
        </div>
        <div className="text-[32px] font-bold text-foreground mt-1 leading-none">
          {stats.total_transcriptions}
        </div>
        <div className="text-[12px] mt-1 flex items-center gap-1 font-medium text-muted-foreground">
          {stats.total_transcriptions > 0 ? (
            <span className="flex items-center gap-1 text-[hsl(152,68%,40%)]">
              <TrendingUp className="w-3 h-3" />
              {stats.total_transcriptions} consultas transcritas
            </span>
          ) : (
            'Nenhuma transcrição ainda'
          )}
        </div>
      </div>
    </div>
  )
}

function ChartsRow({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mt-4 md:mt-4">
      {/* Chart 1 */}
      <div className="p-5 bg-card border border-border rounded-xl flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[14px] font-semibold">Consultas da Semana</h3>
        </div>
        <div className="h-[200px] lg:h-[240px] w-full flex-1">
          {stats.daily_appointments?.every((d: any) => d.count === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Calendar className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[13px]">Nenhuma consulta nos últimos 7 dias</p>
            </div>
          ) : (
            <ChartContainer config={chartConfigAppointments} className="h-full w-full">
              <BarChart
                data={stats.daily_appointments}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickMargin={8}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  activeBar={{ fill: 'hsl(var(--primary) / 0.8)' }}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* Chart 2 */}
      <div className="p-5 bg-card border border-border rounded-xl flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[14px] font-semibold">Crescimento de Pacientes</h3>
        </div>
        <div className="h-[200px] lg:h-[240px] w-full flex-1">
          {stats.monthly_patients?.every((d: any) => d.count === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[13px]">Nenhum paciente registrado</p>
            </div>
          ) : (
            <ChartContainer config={chartConfigPatients} className="h-full w-full">
              <AreaChart
                data={stats.monthly_patients}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickMargin={8}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                  activeDot={{ r: 6 }}
                  dot={{ r: 4, fill: 'var(--color-count)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  )
}

function ListsRow({ stats, navigate }: { stats: any; navigate: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mt-4">
      {/* Upcoming Appointments */}
      <div className="p-5 bg-card border border-border rounded-xl mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[14px] font-semibold">Próximas Consultas</h3>
          </div>
          <Link to="/agenda" className="text-[12px] text-primary font-medium hover:underline">
            Ver Agenda
          </Link>
        </div>
        <div className="flex flex-col">
          {stats.upcoming_appointments?.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center">
              <Calendar className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-[13px] text-muted-foreground mt-2">
                Nenhuma consulta agendada para os próximos 7 dias
              </p>
              <Button
                variant="outline"
                className="text-[12px] mt-3 h-8"
                onClick={() => navigate('/agenda')}
              >
                Agendar Consulta
              </Button>
            </div>
          ) : (
            stats.upcoming_appointments?.map((apt: any, i: number) => {
              const isToday =
                new Date(apt.datetime_start).toDateString() === new Date().toDateString()
              return (
                <div
                  key={apt.id}
                  onClick={() => navigate(`/agenda?date=${apt.datetime_start}`)}
                  className={cn(
                    'flex items-center gap-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors',
                    i !== stats.upcoming_appointments.length - 1 && 'border-b border-border/30',
                    isToday && 'border-l-[3px] border-l-primary pl-3 bg-primary/[0.03]',
                  )}
                >
                  <div className="text-[13px] font-semibold tabular-nums min-w-[48px]">
                    {format(new Date(apt.datetime_start), 'HH:mm')}
                  </div>
                  <div className="text-[13px] font-medium flex-1 truncate">{apt.patient_name}</div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide',
                        getTypeStyle(apt.type),
                      )}
                    >
                      {apt.type}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide',
                        getStatusStyle(apt.status),
                      )}
                    >
                      {apt.status}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent Records */}
      <div className="p-5 bg-card border border-border rounded-xl mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[14px] font-semibold">Prontuários Recentes</h3>
          </div>
        </div>
        <div className="flex flex-col">
          {stats.recent_records?.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center">
              <FileText className="w-10 h-10 text-muted-foreground opacity-20" />
              <p className="text-[13px] text-muted-foreground mt-2">
                Nenhum prontuário criado ainda
              </p>
              <Button
                variant="outline"
                className="text-[12px] mt-3 h-8"
                onClick={() => navigate('/prontuarios')}
              >
                Novo Prontuário
              </Button>
            </div>
          ) : (
            stats.recent_records?.map((rec: any, i: number) => (
              <div
                key={rec.id}
                onClick={() => navigate(`/prontuarios/${rec.id}`)}
                className={cn(
                  'flex items-center gap-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors',
                  i !== stats.recent_records.length - 1 && 'border-b border-border/30',
                )}
              >
                <div className="text-[13px] font-medium flex-1 truncate">{rec.patient_name}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide',
                      getTypeStyle(rec.record_type),
                    )}
                  >
                    {rec.record_type}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold tracking-wide',
                      getRecordStatusStyle(rec.status),
                    )}
                  >
                    {STATUS_LABELS[rec.status] || rec.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground text-right min-w-[80px]">
                  {formatDistanceToNow(new Date(rec.updated_at), { locale: ptBR, addSuffix: true })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Em andamento',
  review: 'Revisão',
  completed: 'Concluído',
  signed: 'Assinado',
}

const getTypeStyle = (type: string) => {
  const t = type?.toLowerCase() || ''
  if (t.includes('retorno')) return 'bg-[hsl(152,68%,40%)]/10 text-[hsl(152,68%,40%)]'
  if (t.includes('procedimento')) return 'bg-[hsl(270,60%,50%)]/10 text-[hsl(270,60%,50%)]'
  return 'bg-primary/10 text-primary'
}

const getStatusStyle = (status: string) => {
  const s = status?.toLowerCase() || ''
  if (s === 'completed' || s === 'confirmed') return 'bg-primary/10 text-primary'
  if (s === 'cancelled' || s === 'no_show') return 'bg-destructive/10 text-destructive'
  return 'bg-secondary text-secondary-foreground'
}

const getRecordStatusStyle = (status: string) => {
  const s = status?.toLowerCase() || ''
  if (s === 'in_progress') return 'bg-[hsl(195,80%,45%)]/10 text-[hsl(195,80%,45%)]'
  if (s === 'review') return 'bg-[hsl(45,93%,47%)]/10 text-[hsl(45,93%,47%)]'
  if (s === 'completed') return 'bg-primary/10 text-primary'
  if (s === 'signed') return 'bg-[hsl(270,60%,50%)]/10 text-[hsl(270,60%,50%)]'
  return 'bg-secondary text-secondary-foreground'
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-0 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[28px] w-[80px] rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-row md:grid md:grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px] overflow-x-auto snap-x pb-4 md:pb-0 scrollbar-none mb-4 md:mb-0">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="min-w-[240px] snap-start p-5 bg-card border border-border rounded-xl"
          >
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-3" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mt-4 md:mt-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-5 bg-card border border-border rounded-xl h-[240px] flex flex-col"
          >
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="flex-1 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mt-4 md:mt-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-5 bg-card border border-border rounded-xl mt-4">
            <Skeleton className="h-4 w-40 mb-6" />
            {[1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0"
              >
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
      <p className="text-muted-foreground mb-4">
        Ocorreu um erro ao carregar os dados do dashboard.
      </p>
      <Button onClick={onRetry}>Tentar Novamente</Button>
    </div>
  )
}
