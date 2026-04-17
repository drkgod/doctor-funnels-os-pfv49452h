import { useState, useEffect } from 'react'
import { fetchTranscriptionAnalytics } from '@/services/reportAnalyticsService'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

export function TranscricoesTab({ tenantId, dateRange, onDataLoaded }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { toast } = useToast()

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetchTranscriptionAnalytics(tenantId, dateRange)
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
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
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

  if (data?.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Nenhuma transcrição realizada no período. Grave consultas no módulo de Prontuários para
          ver as estatísticas aqui.
        </p>
        <Button onClick={() => (window.location.href = '/prontuarios')}>Ir para Prontuários</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Transcrições" value={data.total} />
        <StatCard title="Concluídas" value={data.completed} />
        <StatCard title="Falhadas" value={data.failed} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Duração Média
          </h3>
          <div className="text-4xl font-bold text-primary mt-2">
            {data.average_duration.toFixed(1)} min
          </div>
          <p className="text-xs text-muted-foreground mt-4">Tempo médio de gravação por consulta</p>
        </div>

        <div className="p-8 bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Duração Total
          </h3>
          <div className="text-4xl font-bold text-primary mt-2">
            {data.total_duration_hours}h {data.total_duration_minutes}min
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Soma total do tempo de áudio processado com IA
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
