import { useState, useEffect } from 'react'
import { fetchWhatsAppReport, fetchDailyTrend } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { StatCard } from './StatCard'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area, ComposedChart } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function WhatsAppReport({
  tenantId,
  dateFrom,
  dateTo,
}: {
  tenantId: string
  dateFrom: string
  dateTo: string
}) {
  const [data, setData] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(false)
    try {
      const [wData, tData] = await Promise.all([
        fetchWhatsAppReport(tenantId, dateFrom, dateTo),
        fetchDailyTrend(tenantId, dateFrom, dateTo, 'messages'),
      ])
      setData(wData)
      setTrend(tData)
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId, dateFrom, dateTo])

  const getRtClass = (rt: number | null) => {
    if (rt === null) return 'text-foreground'
    if (rt < 5) return 'text-success'
    if (rt <= 30) return 'text-amber-500'
    return 'text-destructive'
  }

  return (
    <ReportTabState
      loading={loading}
      error={error}
      empty={!data || (data.total_messages === 0 && data.total_conversations === 0)}
      onRetry={load}
      skeletonCards={4}
    >
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard label="Mensagens Totais" value={data.total_messages} />
            <StatCard label="Recebidas" value={data.inbound_count} />
            <StatCard
              label="Enviadas"
              value={data.outbound_count}
              subtext={
                <div className="flex gap-2 mt-1">
                  <span className="text-[11px] font-medium text-[#22c55e]">
                    Bot: {data.bot_percentage}%
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-[11px] font-medium text-primary">
                    Humano: {(100 - data.bot_percentage).toFixed(1)}%
                  </span>
                </div>
              }
            />
            <StatCard
              label="Tempo Medio de Resposta"
              value={
                data.average_response_time !== null
                  ? `${data.average_response_time}min`
                  : 'Sem dados'
              }
              valueClass={getRtClass(data.average_response_time)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard label="Conversas Totais" value={data.total_conversations} />
            <StatCard label="Ativas" value={data.active_conversations} valueClass="text-success" />
            <StatCard
              label="Aguardando"
              value={data.waiting_conversations}
              valueClass="text-amber-500"
            />
          </div>

          <div className="bg-card border border-border rounded-md p-6 mb-[28px] print:border-none print:shadow-none print:p-0">
            <div className="text-[15px] font-semibold text-foreground mb-[20px]">
              Volume de Mensagens
            </div>
            <div className="h-[200px] md:h-[260px]">
              <ChartContainer
                config={{ count: { label: 'Mensagens', color: 'hsl(var(--primary))' } }}
              >
                <ComposedChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => {
                      try {
                        return format(parseISO(v), 'dd/MM', { locale: ptBR })
                      } catch {
                        return v
                      }
                    }}
                  />
                  <YAxis
                    width={30}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="bg-card border-border rounded-lg p-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                        labelClassName="text-[12px] font-semibold"
                        indicator="dot"
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    fill="hsl(var(--primary)/0.08)"
                    stroke="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
          </div>
        </>
      )}
    </ReportTabState>
  )
}
