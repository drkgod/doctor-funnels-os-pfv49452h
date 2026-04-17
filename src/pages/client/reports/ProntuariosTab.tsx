import { useState, useEffect } from 'react'
import { fetchRecordAnalytics } from '@/services/reportAnalyticsService'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

export function ProntuariosTab({ tenantId, dateRange, onDataLoaded }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchRecordAnalytics(tenantId, dateRange)
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

  if (data?.total_records === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Nenhum prontuário criado no período. Crie prontuários no módulo Prontuários para ver as
          estatísticas aqui.
        </p>
        <Button onClick={() => (window.location.href = '/prontuarios')}>Ir para Prontuários</Button>
      </div>
    )
  }

  const statusColors: any = {
    in_progress: 'hsl(195, 80%, 45%)',
    review: 'hsl(45, 93%, 47%)',
    completed: 'hsl(var(--primary))',
    signed: 'hsl(270, 60%, 50%)',
  }
  const statusLabels: any = {
    in_progress: 'Em andamento',
    review: 'Revisão',
    completed: 'Concluído',
    signed: 'Assinado',
  }

  const pieData = Object.entries(data.by_status)
    .map(([status, value]: any) => ({
      name: statusLabels[status] || status,
      value,
      fill: statusColors[status] || 'hsl(var(--muted))',
    }))
    .filter((d) => d.value > 0)

  const aiPieData = [
    { name: 'Com IA', value: data.ai_assisted, fill: 'hsl(var(--primary))' },
    {
      name: 'Sem IA',
      value: Math.max(0, data.total_records - data.ai_assisted),
      fill: 'hsl(var(--muted))',
    },
  ].filter((d) => d.value > 0)

  const avgHours = Math.floor(data.average_completion_time)
  const avgMins = Math.round((data.average_completion_time - avgHours) * 60)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total de Prontuários" value={data.total_records} />
        <StatCard title="Assinados" value={data.by_status['signed'] || 0} />
        <StatCard title="Taxa de Assinatura" value={`${data.signed_rate.toFixed(1)}%`} />
        <StatCard
          title="Assistidos por IA"
          value={`${data.ai_assisted} (${data.ai_assisted_rate.toFixed(0)}%)`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Prontuários por Status</h3>
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
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Prontuários']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-4">Uso de IA nos Prontuários</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={aiPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {aiPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Prontuários']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Tempo Médio de Finalização
          </h3>
          <div className="text-4xl font-bold text-primary mt-2">
            {avgHours}h {avgMins}min
          </div>
          <p className="text-xs text-muted-foreground mt-4 max-w-[200px]">
            Tempo médio decorrido entre a criação e a assinatura do documento
          </p>
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
