import { useState, useEffect } from 'react'
import { fetchLeadSourceReport } from '@/services/reportService'
import { ReportTabState } from './ReportTabState'
import { StatCard } from './StatCard'

const SOURCE_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  form: 'Formulario',
  phone: 'Telefone',
  referral: 'Indicacao',
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
  const topSource = data.length > 0 ? SOURCE_NAMES[data[0].source] || data[0].source : '-'

  return (
    <ReportTabState
      loading={loading}
      error={error}
      empty={data.length === 0}
      onRetry={load}
      skeletonCards={2}
      hasChart={false}
    >
      {data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[28px] print:grid-cols-2">
            <StatCard label="Principal Origem" value={topSource} />
            <StatCard label="Total de Leads" value={total} />
          </div>

          <div className="bg-card border border-border rounded-md p-6 mb-[28px] print:border-none print:shadow-none print:p-0">
            <div className="text-[15px] font-semibold text-foreground mb-[20px]">
              Distribuicao por Origem
            </div>
            <div>
              {data.map((r) => {
                const pct = total ? (r.count / total) * 100 : 0
                return (
                  <div key={r.source} className="flex items-center h-10 mb-2">
                    <div className="text-[13px] font-medium min-w-[100px]">
                      {SOURCE_NAMES[r.source] || r.source}
                    </div>
                    <div className="flex-1 flex items-center">
                      <div
                        className="h-[24px] rounded-md bg-primary transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                      <span className="text-[13px] font-semibold ml-2">{r.count}</span>
                      <span className="text-[12px] text-muted-foreground ml-1">
                        ({pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </ReportTabState>
  )
}
