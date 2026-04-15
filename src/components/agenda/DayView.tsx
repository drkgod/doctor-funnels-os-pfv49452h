import { format, isSameDay } from 'date-fns'
import { Appointment } from '@/services/appointmentService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface DayViewProps {
  currentDate: Date
  appointments: Appointment[]
  onSlotClick: (time: string) => void
  onAppointmentClick: (appointment: Appointment) => void
  onNewAppointment: () => void
}

export function DayView({
  currentDate,
  appointments,
  onSlotClick,
  onAppointmentClick,
  onNewAppointment,
}: DayViewProps) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7) // 07:00 to 21:00
  const dayAppointments = appointments.filter((a) =>
    isSameDay(new Date(a.datetime_start), currentDate),
  )

  const getTypeTranslation = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'Consulta'
      case 'return':
        return 'Retorno'
      case 'procedure':
        return 'Procedimento'
      default:
        return type
    }
  }

  const getStatusTranslation = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente'
      case 'confirmed':
        return 'Confirmado'
      case 'completed':
        return 'Concluído'
      case 'no_show':
        return 'No-show'
      default:
        return status
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      <ScrollArea className="flex-1 border rounded-md bg-card">
        <div className="min-w-[600px] flex flex-col">
          {hours.map((hour) => {
            const timeLabel = `${hour.toString().padStart(2, '0')}:00`
            const hourAppointments = dayAppointments.filter(
              (a) => new Date(a.datetime_start).getHours() === hour,
            )
            return (
              <div key={hour} className="flex border-b min-h-[80px]">
                <div className="w-16 p-2 text-xs text-muted-foreground text-right border-r bg-muted/20">
                  {timeLabel}
                </div>
                <div
                  className="flex-1 relative p-1 cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => onSlotClick(timeLabel)}
                >
                  {hourAppointments.map((app) => {
                    const startMins = new Date(app.datetime_start).getMinutes()
                    const durationMins =
                      (new Date(app.datetime_end).getTime() -
                        new Date(app.datetime_start).getTime()) /
                      60000
                    const top = `${(startMins / 60) * 100}%`
                    const height = `${(durationMins / 60) * 100}%`

                    return (
                      <div
                        key={app.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAppointmentClick(app)
                        }}
                        className="absolute z-10 bg-primary/10 border-l-4 border-primary p-2 text-sm rounded cursor-pointer hover:bg-primary/20 transition-colors w-[calc(100%-8px)]"
                        style={{ top, height: `calc(${height} - 4px)`, minHeight: '32px' }}
                      >
                        <div className="font-semibold truncate leading-none">
                          {app.patient_name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <span>
                            {format(new Date(app.datetime_start), 'HH:mm')} -{' '}
                            {format(new Date(app.datetime_end), 'HH:mm')}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 rounded-full bg-background border">
                            {getTypeTranslation(app.type)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="hidden md:block w-[300px] border rounded-md bg-card p-4 flex flex-col">
        <h3 className="font-semibold mb-4 text-sm">{dayAppointments.length} agendamentos hoje</h3>
        <div className="space-y-3 flex-1 overflow-y-auto">
          {dayAppointments.length === 0 ? (
            <div className="text-center pt-8">
              <p className="text-sm font-medium mb-1">Nenhum agendamento</p>
              <p className="text-xs text-muted-foreground mb-4">
                Sua agenda está livre. Crie um agendamento para começar.
              </p>
              <Button variant="outline" size="sm" onClick={onNewAppointment}>
                <Plus className="w-3 h-3 mr-2" /> Novo Agendamento
              </Button>
            </div>
          ) : (
            dayAppointments.map((app) => (
              <div
                key={app.id}
                className="text-sm border-l-2 border-primary pl-3 py-1 cursor-pointer hover:bg-muted/50 rounded-r transition-colors"
                onClick={() => onAppointmentClick(app)}
              >
                <div className="font-medium truncate">{app.patient_name}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-between mt-1">
                  <span>{format(new Date(app.datetime_start), 'HH:mm')}</span>
                  <Badge variant="secondary" className="text-[10px] scale-90 origin-right">
                    {getStatusTranslation(app.status)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
