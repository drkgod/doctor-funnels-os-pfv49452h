import { useState, useEffect } from 'react'
import { fetchAppointmentAnalytics } from '@/services/reportAnalyticsService'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export function ConsultasTab({ tenantId, dateRange, onDataLoaded }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchAppointmentAnalytics(tenantId, dateRange)
      setData(res)
      onDataLoaded(res)
    } catch (e) {
      setError(true)
      toast({ title: 'Erro', description: 'Falha ao carregar dados.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) loadData()
  }, [tenantId, dateRange])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[280px] w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Ocorreu um erro ao carregar os dados.</p>
        <Button onClick={loadData} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (data?.total_appointments === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Nenhuma consulta encontrada no período. Agende consultas para ver as estatísticas aqui.
        </p>
        <Button onClick={() => (window.location.href = '/agenda')}>Ir para Agenda</Button>
      </div>
    )
  }

  const pieData = [
    { name: 'Confirmadas', value: data.by_status['confirmed'] || 0, fill: 'hsl(var(--primary))' },
    { name: 'Realizadas', value: data.by_status['completed'] || 0, fill: 'hsl(152, 68%, 40%)' },
    {
      name: 'Canceladas',
      value: data.by_status['cancelled'] || 0,
      fill: 'hsl(var(--destructive))',
    },
    { name: 'Faltas', value: data.by_status['no_show'] || 0, fill: 'hsl(45, 93%, 47%)' },
    {
      name: 'Pendentes',
      value: data.by_status['pending'] || 0,
      fill: 'hsl(var(--muted-foreground))',
    },
  ].filter((d) => d.value > 0)

  const hourData = data.by_hour.filter((d: any) => d.count > 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total de Consultas" value={data.total_appointments} />
        <StatCard title="Realizadas" value={data.by_status['completed'] || 0} />
        <StatCard title="Taxa de Faltas" value={`${data.no_show_rate.toFixed(1)}%`} />
        <StatCard title="Taxa de Cancelamento" value={`${data.cancellation_rate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Consultas por Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Consultas']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Por Dia da Semana</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_weekday}>
              <XAxis
                dataKey="name"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Horários Mais Populares</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourData} layout="vertical" margin={{ left: -20 }}>
              <XAxis
                type="number"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                dataKey="hour"
                type="category"
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="text-sm font-semibold">Detalhamento por Tipo</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Realizadas</TableHead>
              <TableHead>Faltas</TableHead>
              <TableHead>Taxa de Faltas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.type_details.map((t: any) => (
              <TableRow key={t.type}>
                <TableCell className="capitalize">{t.type}</TableCell>
                <TableCell>{t.total}</TableCell>
                <TableCell>{t.completed}</TableCell>
                <TableCell>{t.no_show}</TableCell>
                <TableCell>{t.no_show_rate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="p-5 bg-card border border-border rounded-xl flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </span>
      <span className="text-2xl md:text-3xl font-bold text-foreground">{value}</span>
    </div>
  )
}
