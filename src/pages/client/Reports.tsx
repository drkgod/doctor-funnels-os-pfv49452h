import { useState, useEffect } from 'react'
import { GenericPage } from '@/components/GenericPage'
import { ModuleGate } from '@/components/ModuleGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { subDays, format, startOfMonth, startOfYear } from 'date-fns'
import { Download } from 'lucide-react'
import { FunnelReport } from './reports/FunnelReport'
import { AppointmentReport } from './reports/AppointmentReport'
import { WhatsAppReport } from './reports/WhatsAppReport'
import { EmailReport } from './reports/EmailReport'
import { LeadSourceReport } from './reports/LeadSourceReport'
import {
  fetchFunnelReport,
  fetchAppointmentReport,
  fetchWhatsAppReport,
  fetchEmailReport,
  exportReportCSV,
} from '@/services/reportService'
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

  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [activeFilter, setActiveFilter] = useState<number | string | null>(30)

  const setDates = (filter: number | 'month' | 'year') => {
    setActiveFilter(filter)
    const today = new Date()
    setDateTo(format(today, 'yyyy-MM-dd'))
    if (typeof filter === 'number') {
      setDateFrom(format(subDays(today, filter), 'yyyy-MM-dd'))
    } else if (filter === 'month') {
      setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'))
    } else if (filter === 'year') {
      setDateFrom(format(startOfYear(today), 'yyyy-MM-dd'))
    }
  }

  const handleExport = async (type: string) => {
    if (!tenantId) return
    try {
      if (type === 'funnel' || type === 'all') {
        const d = await fetchFunnelReport(tenantId, dateFrom, dateTo)
        exportReportCSV('Funil', d.stages)
      }
      if (type === 'appointments' || type === 'all') {
        const d = await fetchAppointmentReport(tenantId, dateFrom, dateTo)
        exportReportCSV('Agendamentos', [
          {
            total: d.total_appointments,
            concluidos: d.completed_count,
            no_show: d.no_show_count,
            cancelados: d.cancelled_count,
            pendentes: d.pending_count,
          },
        ])
      }
      if (type === 'whatsapp' || type === 'all') {
        const d = await fetchWhatsAppReport(tenantId, dateFrom, dateTo)
        exportReportCSV('WhatsApp', [
          {
            totais: d.total_messages,
            recebidas: d.inbound_count,
            enviadas: d.outbound_count,
            conversas: d.total_conversations,
          },
        ])
      }
      if (type === 'email' || type === 'all') {
        const d = await fetchEmailReport(tenantId, dateFrom, dateTo)
        exportReportCSV('Email', [
          {
            campanhas: d.total_campaigns,
            emails_enviados: d.total_sent,
            taxa_abertura: d.open_rate,
          },
        ])
      }
      toast({ title: 'Exportacao concluida', description: 'O arquivo foi gerado com sucesso.' })
    } catch (e) {
      toast({
        title: 'Erro na exportacao',
        description: 'Nao foi possivel exportar os dados.',
        variant: 'destructive',
      })
    }
  }

  return (
    <ModuleGate moduleKey="dashboard">
      <GenericPage title="Relatorios">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[24px] print:hidden">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                  De
                </span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setActiveFilter(null)
                  }}
                  className="h-[38px] w-[150px] text-[13px] bg-input border-border rounded-md"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                  Ate
                </span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setActiveFilter(null)
                  }}
                  className="h-[38px] w-[150px] text-[13px] bg-input border-border rounded-md"
                />
              </div>
            </div>

            <div className="flex items-end pb-0.5">
              <div className="flex gap-[6px] overflow-x-auto pb-1 md:pb-0 scrollbar-none items-center w-full">
                {[
                  { label: '7 dias', val: 7 },
                  { label: '30 dias', val: 30 },
                  { label: '90 dias', val: 90 },
                  { label: 'Este mes', val: 'month' },
                  { label: 'Este ano', val: 'year' },
                ].map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setDates(f.val as any)}
                    className={cn(
                      'h-[32px] px-[12px] text-[12px] font-medium rounded-full border border-border shrink-0 transition-colors',
                      activeFilter === f.val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-end pb-0.5 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-[38px] text-[13px] gap-1 w-full md:w-auto border-border bg-transparent"
                >
                  <Download className="w-[14px] h-[14px]" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card border border-border shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-md min-w-[200px]"
              >
                <DropdownMenuItem
                  className="p-[8px_12px] text-[13px] hover:bg-secondary cursor-pointer"
                  onClick={() => handleExport('funnel')}
                >
                  Exportar Funil CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="p-[8px_12px] text-[13px] hover:bg-secondary cursor-pointer"
                  onClick={() => handleExport('appointments')}
                >
                  Exportar Agendamentos CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="p-[8px_12px] text-[13px] hover:bg-secondary cursor-pointer"
                  onClick={() => handleExport('whatsapp')}
                >
                  Exportar WhatsApp CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="p-[8px_12px] text-[13px] hover:bg-secondary cursor-pointer"
                  onClick={() => handleExport('email')}
                >
                  Exportar Email CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="p-[8px_12px] text-[13px] hover:bg-secondary cursor-pointer"
                  onClick={() => handleExport('all')}
                >
                  Exportar Tudo CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="funnel" className="w-full">
          <TabsList className="mb-[24px] border-b border-border bg-transparent w-full justify-start h-auto p-0 rounded-none print:hidden flex-wrap">
            {[
              { val: 'funnel', label: 'Funil' },
              { val: 'appointments', label: 'Agendamentos' },
              { val: 'whatsapp', label: 'WhatsApp' },
              { val: 'email', label: 'Email' },
              { val: 'sources', label: 'Origens' },
            ].map((t) => (
              <TabsTrigger
                key={t.val}
                value={t.val}
                className="p-[10px_16px] text-[13px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none hover:text-foreground/80"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div>
            <TabsContent value="funnel" className="mt-0">
              <FunnelReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
            <TabsContent value="appointments" className="mt-0">
              <AppointmentReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
            <TabsContent value="whatsapp" className="mt-0">
              <WhatsAppReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
            <TabsContent value="email" className="mt-0">
              <EmailReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
            <TabsContent value="sources" className="mt-0">
              <LeadSourceReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
          </div>
        </Tabs>
      </GenericPage>
    </ModuleGate>
  )
}
