import { format, isSameDay, addDays, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Appointment } from '@/services/appointmentService'
import { ScrollArea } from '@/components/ui/scroll-area'

interface WeekViewProps {
  currentDate: Date
  appointments: Appointment[]
  onAppointmentClick: (appointment: Appointment) => void
  onSlotClick: (date: Date) => void
}

export function WeekView({
  currentDate,
  appointments,
  onAppointmentClick,
  onSlotClick,
}: WeekViewProps) {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'bg-blue-500'
      case 'return':
        return 'bg-green-500'
      case 'procedure':
        return 'bg-amber-500'
      default:
        return 'bg-primary'
    }
  }

  return (
    <ScrollArea className="h-full border rounded-md bg-card overflow-x-auto snap-x">
      <div className="flex min-w-[800px] h-full divide-x">
        {days.map((day) => {
          const dayApps = appointments.filter((a) => isSameDay(new Date(a.datetime_start), day))
          const isToday = isSameDay(day, new Date())

          return (
            <div key={day.toISOString()} className="flex-1 min-w-[120px] flex flex-col snap-start">
              <div
                className={`p-3 text-center border-b ${isToday ? 'bg-primary/5' : 'bg-muted/20'}`}
              >
                <div
                  className={`text-xs font-medium uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {format(day, 'E', { locale: ptBR })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {format(day, 'dd')}
                </div>
              </div>
              <div
                className="flex-1 p-2 space-y-2 cursor-pointer hover:bg-muted/5 min-h-[400px]"
                onClick={() => onSlotClick(day)}
              >
                {dayApps.map((app) => (
                  <div
                    key={app.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAppointmentClick(app)
                    }}
                    className="p-2 border rounded text-xs bg-background shadow-sm hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getTypeColor(app.type)}`} />
                      <span className="font-mono text-muted-foreground">
                        {format(new Date(app.datetime_start), 'HH:mm')}
                      </span>
                    </div>
                    <div className="font-medium truncate">{app.patient_name}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
