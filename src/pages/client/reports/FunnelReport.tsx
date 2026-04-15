import { useState, useEffect } from 'react'
import { fetchFunnelReport, fetchDailyTrend } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STAGE_NAMES: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contato',
  scheduled: 'Agendado',
  consultation: 'Consulta',
  return: 'Retorno',
  procedure: 'Procedimento',
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

  return (
    <ReportTabState loading={loading} error={error} empty={isEmpty} onRetry={load}>
      {data && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 py-6 overflow-x-auto pb-4">
            {data.stages.map((stage, idx) => (
              <div
                key={stage.stage}
                className="flex items-center flex-col md:flex-row gap-4 shrink-0"
              >
                <div className="flex flex-col items-center justify-center bg-card border rounded-lg p-4 min-w-[120px] h-[100px] shadow-sm">
                  <span className="text-sm font-medium text-muted-foreground">
                    {STAGE_NAMES[stage.stage]}
                  </span>
                  <span className="text-3xl font-bold mt-2">{stage.count}</span>
                </div>
                {idx < data.stages.length - 1 && (
                  <div className="flex flex-col items-center text-muted-foreground min-w-[60px]">
                    <span className="text-xs font-semibold mb-1">
                      {data.conversions[idx].rate}%
                    </span>
                    <ArrowRight className="hidden md:block w-5 h-5" />
                    <ArrowDown className="block md:hidden w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.stages.find((s) => s.stage === 'lead')?.count || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Chegaram a Consulta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.stages.find((s) => s.stage === 'consultation')?.count || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Taxa de Conversao Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.stages[0].count
                    ? (
                        ((data.stages.find((s) => s.stage === 'consultation')?.count || 0) /
                          data.stages[0].count) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pacientes em Procedimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.stages.find((s) => s.stage === 'procedure')?.count || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolucao de Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ChartContainer
                  config={{ count: { label: 'Leads', color: 'hsl(var(--primary))' } }}
                >
                  <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => {
                        try {
                          return format(parseISO(v), 'dd/MM', { locale: ptBR })
                        } catch {
                          return v
                        }
                      }}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportTabState>
  )
}
