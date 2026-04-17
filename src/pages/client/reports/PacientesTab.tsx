import { useState, useEffect } from 'react'
import { fetchPatientAnalytics } from '@/services/reportAnalyticsService'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

export function PacientesTab({ tenantId, dateRange, onDataLoaded }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchPatientAnalytics(tenantId, dateRange)
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
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

  if (data?.total_patients === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Nenhum paciente encontrado no período. Cadastre pacientes no CRM para ver as estatísticas
          aqui.
        </p>
        <Button onClick={() => (window.location.href = '/crm')}>Ir para CRM</Button>
      </div>
    )
  }

  const retentionData = [
    { name: 'Retornaram', value: data.returning_patients, fill: 'hsl(var(--primary))' },
    {
      name: 'Única Consulta',
      value: Math.max(0, data.total_patients - data.returning_patients),
      fill: 'hsl(var(--muted))',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Pacientes" value={data.total_patients} />
        <StatCard title="Novos no Período" value={data.new_in_period} />
        <StatCard title="Taxa de Retorno" value={`${data.retention_rate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Novos Pacientes por Mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_month}>
              <XAxis
                dataKey="month"
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

        <div className="p-5 bg-card border border-border rounded-xl flex flex-col items-center justify-center relative">
          <h3 className="text-sm font-semibold w-full text-left absolute top-5 left-5">
            Retenção de Pacientes
          </h3>
          <div className="w-[200px] h-[200px] mt-8 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={retentionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {retentionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold">{data.retention_rate.toFixed(0)}%</span>
              <span className="text-xs text-muted-foreground mt-1">Retenção</span>
            </div>
          </div>
        </div>
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
