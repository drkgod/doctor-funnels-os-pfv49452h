import { useState, useEffect } from 'react'
import { fetchEmailReport } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { StatCard } from './StatCard'
import { cn } from '@/lib/utils'

export function EmailReport({
  tenantId,
  dateFrom,
  dateTo,
}: {
  tenantId: string
  dateFrom: string
  dateTo: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(false)
    try {
      setData(await fetchEmailReport(tenantId, dateFrom, dateTo))
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId, dateFrom, dateTo])

  const openRate = data?.open_rate || 0
  const clickRate = data?.click_rate || 0

  return (
    <ReportTabState
      loading={loading}
      error={error}
      empty={!data || data.total_campaigns === 0}
      onRetry={load}
      skeletonCards={4}
      hasChart={false}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard
              label="Campanhas Enviadas"
              value={`${data.sent_campaigns} / ${data.total_campaigns}`}
            />
            <StatCard label="Emails Enviados" value={data.total_sent} />
            <StatCard
              label="Taxa de Abertura"
              value={`${openRate}%`}
              valueClass={openRate > 20 ? 'text-success' : 'text-amber-500'}
            />
            <StatCard
              label="Taxa de Cliques"
              value={`${clickRate}%`}
              valueClass={clickRate > 5 ? 'text-success' : 'text-amber-500'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[28px] print:grid-cols-2">
            <StatCard
              label="Taxa de Rejeicao (Bounce)"
              value={`${data.bounce_rate}%`}
              valueClass="text-destructive"
            />
            <div className="p-5 bg-card border border-border rounded-md transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] print:shadow-none print:border-none">
              <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.3px] mb-[20px]">
                Uso no Periodo
              </div>
              <div className="space-y-4">
                {data.usage.map((u: any, i: number) => {
                  // Simplified assumption: limit is 1000 for this example, adjust if from real module
                  const limit = 1000
                  const pct = Math.min(100, (u.emails_sent / limit) * 100)
                  const barColor =
                    pct < 80 ? 'bg-success' : pct < 100 ? 'bg-amber-500' : 'bg-destructive'

                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <span className="text-[12px]">{u.emails_sent} enviados</span>
                        <span className="text-[12px] text-muted-foreground">Limite: {limit}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className={cn('h-full', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {data.usage.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">
                    Sem registros de uso no periodo.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </ReportTabState>
  )
}
