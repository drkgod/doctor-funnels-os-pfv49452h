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

  const setDates = (filter: number | 'month' | 'year') => {
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
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-card border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setDates(7)}>
                7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDates(30)}>
                30 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDates(90)}>
                90 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDates('month')}>
                Este mes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDates('year')}>
                Este ano
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">De:</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px] h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Ate:</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px] h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="ml-2">
                    <Download className="w-4 h-4 mr-2" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('funnel')}>
                    Exportar Funil CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('appointments')}>
                    Exportar Agendamentos CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('whatsapp')}>
                    Exportar WhatsApp CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('email')}>
                    Exportar Email CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('all')}>
                    Exportar Tudo CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Tabs defaultValue="funnel" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="funnel">Funil</TabsTrigger>
              <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="sources">Origens</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="funnel">
                <FunnelReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
              </TabsContent>
              <TabsContent value="appointments">
                <AppointmentReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
              </TabsContent>
              <TabsContent value="whatsapp">
                <WhatsAppReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
              </TabsContent>
              <TabsContent value="email">
                <EmailReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
              </TabsContent>
              <TabsContent value="sources">
                <LeadSourceReport tenantId={tenantId} dateFrom={dateFrom} dateTo={dateTo} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </GenericPage>
    </ModuleGate>
  )
}
