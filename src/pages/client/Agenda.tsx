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
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { DayView } from '@/components/agenda/DayView'
import { WeekView } from '@/components/agenda/WeekView'
import { MonthView } from '@/components/agenda/MonthView'
import { AppointmentDialog } from '@/components/agenda/AppointmentDialog'
import { AppointmentDrawer } from '@/components/agenda/AppointmentDrawer'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { GoogleCalendarConnect } from '@/components/GoogleCalendarConnect'

export default function Agenda() {
  const { tenant } = useTenant()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [view, setView] = useState<'day' | 'week' | 'month'>(() => {
    return (localStorage.getItem('df-agenda-view') as any) || 'week'
  })

  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [gcalEvents, setGcalEvents] = useState<any[]>([])

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

      // Try fetching Google Calendar events. Silently ignore if not connected or fails.
      try {
        const { data: gData, error: gError } = await supabase.functions.invoke(
          'google-calendar-sync',
          {
            body: { action: 'list_events', timeMin: from, timeMax: to },
          },
        )
        if (gData && !gError && Array.isArray(gData)) {
          setGcalEvents(gData)
        } else {
          setGcalEvents([])
        }
      } catch (err) {
        setGcalEvents([])
      }
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

  const allAppointments = [...appointments]
  if (gcalEvents && gcalEvents.length > 0) {
    const localGcalIds = new Set(appointments.map((a) => a.google_event_id).filter(Boolean))
    gcalEvents.forEach((evt) => {
      if (!localGcalIds.has(evt.id) && evt.start?.dateTime && evt.end?.dateTime) {
        allAppointments.push({
          id: evt.id,
          tenant_id: tenant?.id || '',
          patient_id: 'gcal_ghost',
          doctor_id: null,
          datetime_start: evt.start.dateTime,
          datetime_end: evt.end.dateTime,
          type: 'google_calendar',
          status: 'confirmed',
          google_event_id: evt.id,
          notes: evt.description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          patient_name: evt.summary || 'Evento Google Calendar',
        })
      }
    })
  }

  if (error) {
    return (
      <ModuleGate moduleKey="agenda">
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
    <ModuleGate moduleKey="agenda">
      <div className="flex flex-col h-[calc(100vh-100px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div className="flex items-center justify-between md:justify-start gap-3">
            <div className="flex border border-border rounded-md overflow-hidden">
              {['day', 'week', 'month'].map((v) => (
                <button
                  key={v}
                  className={cn(
                    'px-[14px] py-2 text-[13px] transition-colors',
                    view === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                  onClick={() => setView(v as any)}
                >
                  {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <Button variant="outline" className="h-9 text-[13px] px-[14px]" onClick={handleToday}>
              Hoje
            </Button>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            <div className="hidden md:flex items-center mr-2">
              <GoogleCalendarConnect />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-md p-0 hover:bg-secondary"
                onClick={handlePrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[15px] font-semibold cursor-pointer hover:text-primary transition-colors select-none text-center min-w-[140px]">
                {getHeaderTitle()}
              </span>
              <Button
                variant="ghost"
                className="h-9 w-9 rounded-md p-0 hover:bg-secondary"
                onClick={handleNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button
              className="h-10 font-semibold px-4"
              onClick={() => {
                setSlotDate(new Date())
                setSlotTime(null)
                setSelectedApp(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> <span>Novo Agendamento</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="w-full h-full flex gap-6">
              <Skeleton className="flex-1 rounded-md" />
              {view === 'day' && <Skeleton className="w-[300px] hidden lg:block rounded-md" />}
            </div>
          ) : (
            <>
              {view === 'day' && (
                <DayView
                  currentDate={currentDate}
                  appointments={allAppointments}
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
                  appointments={allAppointments}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppClick}
                />
              )}
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  appointments={allAppointments}
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
            toast({ title: 'Sucesso', description: 'Confirmado com sucesso.' })
            loadData()
            setDrawerOpen(false)
          }}
          onComplete={async () => {
            await appointmentService.completeAppointment(selectedApp.id)
            toast({ title: 'Sucesso', description: 'Concluído com sucesso.' })
            loadData()
            setDrawerOpen(false)
          }}
          onNoShow={async () => {
            await appointmentService.markNoShow(selectedApp.id)
            toast({ title: 'Sucesso', description: 'No-show registrado com sucesso.' })
            loadData()
            setDrawerOpen(false)
          }}
          onCancel={async () => {
            await appointmentService.cancelAppointment(selectedApp.id)
            toast({ title: 'Sucesso', description: 'Cancelado com sucesso.' })
            loadData()
            setDrawerOpen(false)
          }}
        />
      )}
    </ModuleGate>
  )
}
