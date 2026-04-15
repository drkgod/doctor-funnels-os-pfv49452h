import { useState, useEffect } from 'react'
import { fetchAppointmentReport } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { StatCard } from './StatCard'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'

const DOW_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function AppointmentReport({
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
      setData(await fetchAppointmentReport(tenantId, dateFrom, dateTo))
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId, dateFrom, dateTo])

  const dowData =
    data?.dow.map((count: number, idx: number) => ({ day: DOW_NAMES[idx], count })) || []

  const maxCount = Math.max(...dowData.map((d: any) => d.count), 0)

  return (
    <ReportTabState
      loading={loading}
      error={error}
      empty={!data || data.total_appointments === 0}
      onRetry={load}
      skeletonCards={5}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard label="Total" value={data.total_appointments} />
            <StatCard
              label="Concluidos"
              value={data.completed_count}
              subtext={`${data.completion_rate}%`}
              valueClass="text-success"
            />
            <StatCard
              label="No-show"
              value={data.no_show_count}
              subtext={`${data.no_show_rate}%`}
              valueClass="text-destructive"
            />
            <StatCard
              label="Cancelados"
              value={data.cancelled_count}
              subtext={`${data.cancellation_rate}%`}
              valueClass="text-amber-500"
            />
            <StatCard
              label="Pendentes"
              value={data.pending_count + data.confirmed_count}
              valueClass="text-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard label="Consultas" value={data.types.consultation || 0} />
            <StatCard label="Retornos" value={data.types.return || 0} />
            <StatCard label="Procedimentos" value={data.types.procedure || 0} />
          </div>

          <div className="bg-card border border-border rounded-md p-6 mb-[28px] print:border-none print:shadow-none print:p-0">
            <div className="text-[15px] font-semibold text-foreground mb-[20px]">
              Agendamentos por Dia da Semana
            </div>
            <div className="h-[180px] md:h-[220px]">
              <ChartContainer
                config={{ count: { label: 'Agendamentos', color: 'hsl(var(--primary))' } }}
              >
                <BarChart data={dowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fontSize: 12, fontWeight: 500, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    width={30}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip
                    cursor={{ fill: 'transparent' }}
                    content={
                      <ChartTooltipContent
                        className="bg-card border-border rounded-lg p-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                        labelClassName="text-[12px] font-semibold"
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {dowData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.count === maxCount && maxCount > 0
                            ? 'hsl(var(--accent))'
                            : 'hsl(var(--primary))'
                        }
                        className="transition-opacity hover:opacity-80"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </>
      )}
    </ReportTabState>
  )
}
