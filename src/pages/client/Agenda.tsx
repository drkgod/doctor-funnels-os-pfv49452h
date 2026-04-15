import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ModuleGate } from '@/components/ModuleGate'
import { useTenant } from '@/hooks/useTenant'
import { appointmentService, Appointment } from '@/services/appointmentService'
import { supabase } from '@/lib/supabase/client'
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { DayView } from '@/components/agenda/DayView'
import { WeekView } from '@/components/agenda/WeekView'
import { MonthView } from '@/components/agenda/MonthView'
import { AppointmentDialog } from '@/components/agenda/AppointmentDialog'
import { AppointmentDrawer } from '@/components/agenda/AppointmentDrawer'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

export default function Agenda() {
  const { tenant } = useTenant()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [view, setView] = useState<'day' | 'week' | 'month'>(() => {
    return (localStorage.getItem('df-agenda-view') as any) || 'week'
  })

  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null)

  const [slotDate, setSlotDate] = useState<Date | null>(null)
  const [slotTime, setSlotTime] = useState<string | null>(null)

  const loadData = async () => {
    if (!tenant?.id) return
    setLoading(true)
    setError(false)
    try {
      let from, to
      if (view === 'day') {
        from = startOfDay(currentDate).toISOString()
        to = endOfDay(currentDate).toISOString()
      } else if (view === 'week') {
        from = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString()
        to = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString()
      } else {
        from = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }).toISOString()
        to = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }).toISOString()
      }
      const data = await appointmentService.fetchAppointments(tenant.id, from, to)
      setAppointments(data)
    } catch (e) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant?.id, currentDate, view])

  useEffect(() => {
    localStorage.setItem('df-agenda-view', view)
  }, [view])

  useEffect(() => {
    const pid = searchParams.get('patient_id')
    const act = searchParams.get('action')
    if (pid || act === 'new') {
      setDialogOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!tenant?.id) return
    const channel = supabase
      .channel('agenda-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          loadData()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant?.id, currentDate, view])

  const handlePrev = () => {
    if (view === 'day') setCurrentDate(subDays(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subMonths(currentDate, 1))
  }

  const handleNext = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addMonths(currentDate, 1))
  }

  const handleToday = () => setCurrentDate(new Date())

  const getHeaderTitle = () => {
    if (view === 'day') return format(currentDate, "dd 'de' MMMM", { locale: ptBR })
    if (view === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 })
      const e = endOfWeek(currentDate, { weekStartsOn: 1 })
      if (s.getMonth() === e.getMonth())
        return `${format(s, 'dd')} - ${format(e, "dd 'de' MMMM", { locale: ptBR })}`
      return `${format(s, "dd 'de' MMM", { locale: ptBR })} - ${format(e, "dd 'de' MMM", { locale: ptBR })}`
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
  }

  const handleSlotClick = (date: Date, time?: string) => {
    setSlotDate(date)
    setSlotTime(time || null)
    setSelectedApp(null)
    setDialogOpen(true)
  }

  const handleAppClick = (app: Appointment) => {
    setSelectedApp(app)
    setDrawerOpen(true)
  }

  const handleSaveAppointment = async (data: any) => {
    if (!tenant?.id) return
    if (selectedApp) {
      await appointmentService.updateAppointment(selectedApp.id, data)
      toast({ title: 'Sucesso', description: 'Agendamento atualizado com sucesso.' })
    } else {
      await appointmentService.createAppointment(tenant.id, data)
      toast({ title: 'Sucesso', description: 'Agendamento criado com sucesso.' })
    }
    loadData()
  }

  if (error) {
    return (
      <ModuleGate module_key="agenda">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
          <p className="text-destructive mb-4 font-medium">
            Não foi possível carregar a agenda. Tente novamente.
          </p>
          <Button onClick={loadData}>Tentar novamente</Button>
        </div>
      </ModuleGate>
    )
  }

  return (
    <ModuleGate module_key="agenda">
      <div className="flex flex-col h-[calc(100vh-100px)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold">Agenda</h1>

          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as any)}
              className="bg-card border rounded-md"
            >
              <ToggleGroupItem value="day" className="px-3 text-sm">
                Dia
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="px-3 text-sm">
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="px-3 text-sm">
                Mês
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center bg-card border rounded-md p-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" className="h-8 min-w-[140px] font-medium" onClick={() => {}}>
                {getHeaderTitle()}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" className="shrink-0" onClick={handleToday}>
              Hoje
            </Button>
            <Button
              className="shrink-0"
              onClick={() => {
                setSlotDate(new Date())
                setSlotTime(null)
                setSelectedApp(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
            </Button>
          </div>
        </div>

        {!loading && appointments.length === 0 && view !== 'day' && (
          <div className="mb-4 p-4 border rounded-md bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-medium">Nenhum agendamento</p>
              <p className="text-sm text-muted-foreground">
                Sua agenda está livre. Crie um agendamento para começar.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSlotDate(new Date())
                setDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <Skeleton className="w-full h-full rounded-md" />
          ) : (
            <>
              {view === 'day' && (
                <DayView
                  currentDate={currentDate}
                  appointments={appointments}
                  onSlotClick={(time) => handleSlotClick(currentDate, time)}
                  onAppointmentClick={handleAppClick}
                  onNewAppointment={() => {
                    setSlotDate(currentDate)
                    setSlotTime(null)
                    setSelectedApp(null)
                    setDialogOpen(true)
                  }}
                />
              )}
              {view === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  appointments={appointments}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppClick}
                />
              )}
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  appointments={appointments}
                  onDayClick={(date) => {
                    setCurrentDate(date)
                    setView('day')
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {dialogOpen && tenant?.id && (
        <AppointmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialDate={slotDate}
          initialTime={slotTime}
          initialPatientId={searchParams.get('patient_id')}
          tenantId={tenant.id}
          onSave={handleSaveAppointment}
          appointment={selectedApp}
        />
      )}

      {drawerOpen && selectedApp && (
        <AppointmentDrawer
          appointment={selectedApp}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onEdit={() => {
            setDrawerOpen(false)
            setTimeout(() => setDialogOpen(true), 150)
          }}
          onConfirm={async () => {
            await appointmentService.updateAppointment(selectedApp.id, { status: 'confirmed' })
            toast({ title: 'Sucesso', description: 'Confirmado' })
            loadData()
            setDrawerOpen(false)
          }}
          onComplete={async () => {
            await appointmentService.completeAppointment(selectedApp.id)
            toast({ title: 'Sucesso', description: 'Concluído' })
            loadData()
            setDrawerOpen(false)
          }}
          onNoShow={async () => {
            await appointmentService.markNoShow(selectedApp.id)
            toast({ title: 'Sucesso', description: 'No-show registrado' })
            loadData()
            setDrawerOpen(false)
          }}
          onCancel={async () => {
            await appointmentService.cancelAppointment(selectedApp.id)
            toast({ title: 'Sucesso', description: 'Cancelado' })
            loadData()
            setDrawerOpen(false)
          }}
        />
      )}
    </ModuleGate>
  )
}
