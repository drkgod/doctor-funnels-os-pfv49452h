import { useState, useEffect, useMemo, useCallback } from 'react'
import { GenericPage } from '@/components/GenericPage'
import { ModuleGate } from '@/components/ModuleGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { subDays, format, startOfMonth, startOfYear } from 'date-fns'
import { Download } from 'lucide-react'
import { ConsultasTab } from './reports/ConsultasTab'
import { PacientesTab } from './reports/PacientesTab'
import { ProntuariosTab } from './reports/ProntuariosTab'
import { TranscricoesTab } from './reports/TranscricoesTab'
import { exportReportCSV } from '@/services/reportAnalyticsService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Reports() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string>('')
  const { toast } = useToast()

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.tenant_id) setTenantId(data.tenant_id)
        })
    }
  }, [user])

  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [activeFilter, setActiveFilter] = useState<string>('month')
  const [activeTab, setActiveTab] = useState('appointments')
  const [exportData, setExportData] = useState<any>(null)

  // Fix 1: Stabilize dateRange object to prevent infinite re-renders in child tabs
  const dateRange = useMemo(() => ({ from: dateFrom, to: dateTo }), [dateFrom, dateTo])

  // Fix 5: Stable callback to prevent infinite re-renders when data loads
  const handleDataLoaded = useCallback((data: any) => {
    setExportData(data)
  }, [])

  const setDates = (filter: string) => {
    setActiveFilter(filter)
    const today = new Date()
    setDateTo(format(today, 'yyyy-MM-dd'))
    if (filter === 'today') setDateFrom(format(today, 'yyyy-MM-dd'))
    else if (filter === 'week')
      setDateFrom(
        format(subDays(today, today.getDay() === 0 ? 6 : today.getDay() - 1), 'yyyy-MM-dd'),
      )
    else if (filter === 'month') setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'))
    else if (filter === '30days') setDateFrom(format(subDays(today, 30), 'yyyy-MM-dd'))
    else if (filter === 'year') setDateFrom(format(startOfYear(today), 'yyyy-MM-dd'))
  }

  const handleExport = () => {
    if (!exportData) {
      toast({ title: 'Aviso', description: 'Nenhum dado disponível para exportar.' })
      return
    }
    try {
      exportReportCSV(activeTab, exportData)
      toast({ title: 'Exportação concluída', description: 'O arquivo foi gerado com sucesso.' })
    } catch (e) {
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      })
    }
  }

  return (
    <ModuleGate moduleKey="reports">
      <GenericPage title="Relatórios">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex gap-[6px] overflow-x-auto scrollbar-none items-center">
              {[
                { label: 'Hoje', val: 'today' },
                { label: 'Esta Semana', val: 'week' },
                { label: 'Este Mês', val: 'month' },
                { label: 'Últimos 30 Dias', val: '30days' },
                { label: 'Este Ano', val: 'year' },
                { label: 'Personalizado', val: 'custom' },
              ].map((f) => (
                <button
                  key={f.val}
                  onClick={() => setDates(f.val)}
                  className={cn(
                    'h-[32px] px-[14px] text-[12px] font-medium rounded-full border shrink-0 transition-colors',
                    activeFilter === f.val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-transparent hover:bg-secondary/70',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {activeFilter === 'custom' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 animate-fade-in">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-[32px] w-full sm:w-[130px] text-[12px] bg-input border-border rounded-md"
                  aria-label="Data inicial"
                />
                <span className="text-muted-foreground text-sm text-center sm:text-left">até</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-[32px] w-full sm:w-[130px] text-[12px] bg-input border-border rounded-md"
                  aria-label="Data final"
                />
              </div>
            )}
          </div>

          <Button
            onClick={handleExport}
            variant="outline"
            className="h-[32px] text-[12px] gap-2 shrink-0 border-border bg-transparent"
          >
            <Download className="w-[14px] h-[14px]" /> Exportar CSV
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 border-b border-border bg-transparent w-full justify-start h-auto p-0 rounded-none print:hidden overflow-x-auto flex-nowrap shrink-0">
            {[
              { val: 'appointments', label: 'Consultas' },
              { val: 'patients', label: 'Pacientes' },
              { val: 'records', label: 'Prontuários' },
              { val: 'transcriptions', label: 'Transcrições IA' },
            ].map((t) => (
              <TabsTrigger
                key={t.val}
                value={t.val}
                className="p-[10px_16px] text-[13px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none hover:text-foreground/80 shrink-0"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-0">
            <TabsContent value="appointments" className="m-0 border-none p-0 outline-none">
              <ConsultasTab
                tenantId={tenantId}
                dateRange={dateRange}
                onDataLoaded={handleDataLoaded}
                {...({
                  cachedData: activeTab === 'appointments' ? exportData : undefined,
                } as any)}
              />
            </TabsContent>
            <TabsContent value="patients" className="m-0 border-none p-0 outline-none">
              <PacientesTab
                tenantId={tenantId}
                dateRange={dateRange}
                onDataLoaded={handleDataLoaded}
                {...({
                  cachedData: activeTab === 'patients' ? exportData : undefined,
                } as any)}
              />
            </TabsContent>
            <TabsContent value="records" className="m-0 border-none p-0 outline-none">
              <ProntuariosTab
                tenantId={tenantId}
                dateRange={dateRange}
                onDataLoaded={handleDataLoaded}
                {...({ cachedData: activeTab === 'records' ? exportData : undefined } as any)}
              />
            </TabsContent>
            <TabsContent value="transcriptions" className="m-0 border-none p-0 outline-none">
              <TranscricoesTab
                tenantId={tenantId}
                dateRange={dateRange}
                onDataLoaded={handleDataLoaded}
                {...({
                  cachedData: activeTab === 'transcriptions' ? exportData : undefined,
                } as any)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </GenericPage>
    </ModuleGate>
  )
}
