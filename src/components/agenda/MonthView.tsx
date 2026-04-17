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
import { useIsMobile } from '@/hooks/use-mobile'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { typeMap } from './DayView'

interface MonthViewProps {
  currentDate: Date
  appointments: Appointment[]
  onDayClick: (date: Date) => void
}

export function MonthView({ currentDate, appointments, onDayClick }: MonthViewProps) {
  const isMobile = useIsMobile()

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

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-7 bg-secondary border-b border-border">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div
            key={d}
            className="p-[10px] text-center text-[11px] font-semibold text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-7 auto-rows-[minmax(60px,1fr)] md:auto-rows-[minmax(100px,1fr)] h-full">
          {days.map((d) => {
            const isCurrentMonth = isSameMonth(d, currentDate)
            const isToday = isSameDay(d, new Date())
            const dayApps = appointments.filter((a) => isSameDay(new Date(a.datetime_start), d))

            return (
              <div
                key={d.toISOString()}
                onClick={() => onDayClick(d)}
                className={cn(
                  'p-[8px] border-b border-border border-r border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors flex flex-col',
                  !isCurrentMonth && 'opacity-30',
                  isCurrentMonth && d < new Date() && !isToday && 'opacity-50',
                )}
              >
                <div className="flex justify-end md:justify-start">
                  <span
                    className={cn(
                      'text-[13px] font-medium flex items-center justify-center',
                      isToday &&
                        'w-[28px] h-[28px] bg-primary text-primary-foreground rounded-full',
                    )}
                  >
                    {format(d, 'd')}
                  </span>
                </div>

                <div className="mt-1 flex-1 flex flex-col gap-1 overflow-hidden">
                  {isMobile ? (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <div className="flex flex-wrap justify-center gap-[2px]">
                        {dayApps.slice(0, 4).map((app) => {
                          const typeCfg =
                            typeMap[app.type as keyof typeof typeMap] || typeMap.consultation
                          return (
                            <div
                              key={app.id}
                              className={cn('w-[6px] h-[6px] rounded-full', typeCfg.dot)}
                            />
                          )
                        })}
                      </div>
                      {dayApps.length > 4 && (
                        <div className="text-[9px] text-muted-foreground font-medium">
                          +{dayApps.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {dayApps.slice(0, 3).map((app) => {
                        const typeCfg =
                          typeMap[app.type as keyof typeof typeMap] || typeMap.consultation
                        return (
                          <div
                            key={app.id}
                            className="flex items-center gap-1.5 text-[11px] truncate"
                          >
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', typeCfg.dot)} />
                            <span className="truncate">{app.patient_name}</span>
                            {app.type === 'google_calendar' && (
                              <CalendarDays className="w-3 h-3 ml-auto text-muted-foreground opacity-50 shrink-0" />
                            )}
                          </div>
                        )
                      })}
                      {dayApps.length > 3 && (
                        <div className="text-[11px] text-muted-foreground font-medium mt-auto">
                          +{dayApps.length - 3} mais
                        </div>
                      )}
                    </>
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
