import { useState, useEffect } from 'react'
import { fetchFunnelReport, fetchDailyTrend } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { StatCard } from './StatCard'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area, ComposedChart } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const STAGE_NAMES: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contato',
  scheduled: 'Agendado',
  consultation: 'Consulta',
  return: 'Retorno',
  procedure: 'Procedimento',
}

const STAGE_STYLES: Record<string, { bg: string; text: string; hex: string }> = {
  lead: { bg: 'bg-[#3b82f6]/12', text: 'text-[#3b82f6]', hex: '#3b82f6' },
  contact: { bg: 'bg-[#00b4d8]/12', text: 'text-[#00b4d8]', hex: '#00b4d8' },
  scheduled: { bg: 'bg-[#f59e0b]/12', text: 'text-[#f59e0b]', hex: '#f59e0b' },
  consultation: { bg: 'bg-[#22c55e]/12', text: 'text-[#22c55e]', hex: '#22c55e' },
  return: { bg: 'bg-[#a855f7]/12', text: 'text-[#a855f7]', hex: '#a855f7' },
  procedure: { bg: 'bg-[#e11d48]/12', text: 'text-[#e11d48]', hex: '#e11d48' },
}

export function FunnelReport({
  tenantId,
  dateFrom,
  dateTo,
}: {
  tenantId: string
  dateFrom: string
  dateTo: string
}) {
  const [data, setData] = useState<{ stages: any[]; conversions: any[] } | null>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(false)
    try {
      const [fData, tData] = await Promise.all([
        fetchFunnelReport(tenantId, dateFrom, dateTo),
        fetchDailyTrend(tenantId, dateFrom, dateTo, 'leads'),
      ])
      setData(fData)
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

  const isEmpty = !data || data.stages[0]?.count === 0

  const getRateColor = (rate: number) => {
    if (rate >= 50) return 'text-success'
    if (rate >= 20) return 'text-foreground'
    return 'text-destructive'
  }

  const maxCount = data?.stages[0]?.count || 1
  const leads = data?.stages.find((s) => s.stage === 'lead')?.count || 0
  const consults = data?.stages.find((s) => s.stage === 'consultation')?.count || 0
  const rate = leads ? ((consults / leads) * 100).toFixed(1) : '0.0'
  const procs = data?.stages.find((s) => s.stage === 'procedure')?.count || 0

  return (
    <ReportTabState
      loading={loading}
      error={error}
      empty={isEmpty}
      onRetry={load}
      skeletonCards={4}
      hasFunnel={true}
    >
      {data && (
        <>
          <div className="bg-card border border-border rounded-md p-7 mb-[28px] print:border-none print:shadow-none print:p-0 print:mb-6">
            {/* Desktop */}
            <div className="hidden md:flex items-center justify-center gap-0">
              {data.stages.map((stage, idx) => {
                const ratio = stage.count / maxCount
                const width = Math.max(160 * ratio, 80)
                const isLast = idx === data.stages.length - 1
                const style = STAGE_STYLES[stage.stage]

                return (
                  <div key={stage.stage} className="flex items-center">
                    <div
                      className={cn('text-center p-[20px_12px] rounded-lg relative', style.bg)}
                      style={{ width: `${width}px` }}
                    >
                      <div
                        className={cn(
                          'text-[11px] font-semibold uppercase tracking-[0.5px]',
                          style.text,
                        )}
                      >
                        {STAGE_NAMES[stage.stage] || stage.stage}
                      </div>
                      <div className="text-[24px] font-bold text-foreground mt-1">
                        {stage.count}
                      </div>
                    </div>
                    {!isLast && (
                      <div className="flex flex-col items-center justify-center px-1.5 min-w-[48px]">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        <span
                          className={cn(
                            'text-[11px] font-bold',
                            getRateColor(data.conversions[idx]?.rate || 0),
                          )}
                        >
                          {data.conversions[idx]?.rate}%
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile */}
            <div className="flex flex-col md:hidden w-full">
              {data.stages.map((stage, idx) => {
                const isLast = idx === data.stages.length - 1
                const style = STAGE_STYLES[stage.stage]

                return (
                  <div key={stage.stage}>
                    <div
                      className={cn(
                        'p-[14px_16px] flex justify-between items-center rounded-lg mb-1',
                        style.bg,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: style.hex }}
                        />
                        <span
                          className={cn(
                            'text-[11px] font-semibold uppercase tracking-[0.5px]',
                            style.text,
                          )}
                        >
                          {STAGE_NAMES[stage.stage] || stage.stage}
                        </span>
                      </div>
                      <div className="text-[20px] font-bold text-foreground">{stage.count}</div>
                    </div>
                    {!isLast && (
                      <div className="flex justify-center items-center gap-2 my-1">
                        <span
                          className={cn(
                            'text-[11px] font-bold',
                            getRateColor(data.conversions[idx]?.rate || 0),
                          )}
                        >
                          {data.conversions[idx]?.rate}%
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-[28px] print:grid-cols-3">
            <StatCard label="Total de Leads" value={leads} />
            <StatCard label="Chegaram a Consulta" value={consults} />
            <StatCard label="Taxa de Conversao" value={`${rate}%`} valueClass="text-success" />
            <StatCard label="Pacientes em Procedimento" value={procs} />
          </div>

          <div className="bg-card border border-border rounded-md p-6 mb-[28px] print:border-none print:shadow-none print:p-0">
            <div className="text-[15px] font-semibold text-foreground mb-[20px]">
              Evolucao de Leads
            </div>
            <div className="h-[200px] md:h-[260px]">
              <ChartContainer config={{ count: { label: 'Leads', color: 'hsl(var(--primary))' } }}>
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
