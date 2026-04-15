import {
  format,
  isSameDay,
  isSameMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import { Appointment } from '@/services/appointmentService'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MonthViewProps {
  currentDate: Date
  appointments: Appointment[]
  onDayClick: (date: Date) => void
}

export function MonthView({ currentDate, appointments, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

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
    <div className="h-full border rounded-md bg-card flex flex-col">
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div
            key={d}
            className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-7 auto-rows-[minmax(100px,1fr)] h-full min-h-[500px]">
          {days.map((d) => {
            const isCurrentMonth = isSameMonth(d, currentDate)
            const isToday = isSameDay(d, new Date())
            const dayApps = appointments.filter((a) => isSameDay(new Date(a.datetime_start), d))

            return (
              <div
                key={d.toISOString()}
                onClick={() => onDayClick(d)}
                className={`border-r border-b p-2 cursor-pointer transition-colors hover:bg-muted/10 flex flex-col
                  ${!isCurrentMonth ? 'bg-muted/5 opacity-50' : ''}
                  ${isToday ? 'bg-primary/5' : ''}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {format(d, 'd')}
                  </span>
                  {dayApps.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-1.5 rounded">
                      {dayApps.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-auto">
                  {dayApps.slice(0, 5).map((app) => (
                    <div
                      key={app.id}
                      className={`w-2 h-2 rounded-full ${getTypeColor(app.type)}`}
                      title={app.patient_name}
                    />
                  ))}
                  {dayApps.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{dayApps.length - 5}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
