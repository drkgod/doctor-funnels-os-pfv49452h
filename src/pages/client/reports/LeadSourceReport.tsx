import { useState, useEffect } from 'react'
import { fetchLeadSourceReport } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const SOURCE_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  form: 'Formulário',
  phone: 'Telefone',
  referral: 'Indicação',
  doctoralia: 'Doctoralia',
  manual: 'Manual',
}

export function LeadSourceReport({
  tenantId,
  dateFrom,
  dateTo,
}: {
  tenantId: string
  dateFrom: string
  dateTo: string
}) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    if (!tenantId) return
    setLoading(true)
    setError(false)
    try {
      setData(await fetchLeadSourceReport(tenantId, dateFrom, dateTo))
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId, dateFrom, dateTo])

  const total = data.reduce((s, r) => s + r.count, 0)

  return (
    <ReportTabState loading={loading} error={error} empty={data.length === 0} onRetry={load}>
      {data.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Principal Origem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {SOURCE_NAMES[data[0].source] || data[0].source}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Distribuicao por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mt-4">
                {data.map((r) => (
                  <div key={r.source}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{SOURCE_NAMES[r.source] || r.source}</span>
                      <span className="text-muted-foreground">
                        {r.count} ({total ? ((r.count / total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                    <Progress value={total ? (r.count / total) * 100 : 0} className="h-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportTabState>
  )
}
