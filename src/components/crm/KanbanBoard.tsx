import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  UserPlus,
  MessageCircle,
  CalendarCheck,
  Stethoscope,
  RotateCcw,
  HeartPulse,
} from 'lucide-react'

interface Props {
  patientsByStage: Record<string, any[]>
  stages: any[]
  onMove: (id: string, from: string, to: string) => void
}

export const SOURCE_STYLES: Record<string, string> = {
  WhatsApp: 'bg-success/10 text-success',
  Formulario: 'bg-primary/10 text-primary',
  Telefone: 'bg-accent/10 text-accent',
  Indicacao: 'bg-[hsl(270,60%,50%)]/10 text-[hsl(270,60%,50%)]',
  Doctoralia: 'bg-teal-500/10 text-teal-600',
  Manual: 'bg-muted text-muted-foreground',
}

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'user-plus':
      return UserPlus
    case 'message-circle':
      return MessageCircle
    case 'calendar-check':
      return CalendarCheck
    case 'stethoscope':
      return Stethoscope
    case 'rotate-ccw':
      return RotateCcw
    case 'heart-pulse':
      return HeartPulse
    default:
      return null
  }
}

function PatientCard({ p, stage, onDragStart, onClick }: any) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true)
        onDragStart(e, p.id, stage.id)
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={onClick}
      className={cn(
        'bg-card border rounded-md p-[14px] mb-2 cursor-grab transition-all duration-150',
        'hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]',
        isDragging && 'opacity-70 shadow-[0_8px_24px_rgba(0,0,0,0.15)] rotate-2',
      )}
    >
      <div className="text-[14px] font-medium text-foreground">{p.full_name}</div>
      <div className="text-[12px] text-muted-foreground mt-1 font-mono">
        {p.phone || 'Sem telefone'}
      </div>

      <div className="mt-2">
        <span
          className={cn(
            'text-[10px] font-semibold px-[6px] py-[1px] rounded-full',
            SOURCE_STYLES[p.source] || SOURCE_STYLES['Manual'],
          )}
        >
          {p.source}
        </span>
      </div>

      {p.tags && p.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {p.tags.map((t: string) => (
            <span
              key={t}
              className="text-[10px] px-[6px] py-[1px] rounded-[4px] bg-accent/10 text-accent"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground mt-2">
        há {formatDistanceToNow(new Date(p.updated_at), { locale: ptBR })}
      </div>
    </div>
  )
}

export function KanbanBoard({ patientsByStage, stages, onMove }: Props) {
  const navigate = useNavigate()
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string, stageId: string) => {
    e.dataTransfer.setData('id', id)
    e.dataTransfer.setData('stage', stageId)
  }

  const handleDrop = (e: React.DragEvent, toStageId: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('id')
    const fromStageId = e.dataTransfer.getData('stage')
    if (fromStageId === toStageId || !fromStageId || !id) return

    onMove(id, fromStageId, toStageId)
  }

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4 items-start scroll-smooth snap-x snap-mandatory">
      {stages.map((stage) => {
        const Icon = getIcon(stage.icon)
        const count = patientsByStage[stage.id]?.length || 0

        return (
          <div
            key={stage.id}
            className={cn(
              'flex-shrink-0 min-w-[280px] sm:min-w-[240px] snap-start flex-1 flex flex-col bg-secondary/30 rounded-md p-3 h-full max-h-[calc(100vh-200px)] transition-colors duration-150',
              dragOverCol === stage.id
                ? 'bg-primary/5 border-2 border-dashed border-primary/30'
                : 'border-t-[3px] border-x border-b border-solid border-transparent',
            )}
            style={{
              borderTopColor: dragOverCol === stage.id ? 'transparent' : stage.color,
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverCol(stage.id)
            }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4" style={{ color: stage.color }} />}
                <h3 className="text-[13px] font-semibold text-foreground">{stage.name}</h3>
              </div>
              <div className="text-[11px] font-semibold min-w-[24px] h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                {count}
              </div>
            </div>

            <div className="flex flex-col gap-0 overflow-y-auto pr-1 pb-2">
              {patientsByStage[stage.id]?.length > 0 ? (
                patientsByStage[stage.id]?.map((p) => (
                  <PatientCard
                    key={p.id}
                    p={p}
                    stage={stage}
                    onDragStart={handleDragStart}
                    onClick={() => navigate(`/crm/patients/${p.id}`)}
                  />
                ))
              ) : (
                <div className="py-8 text-center text-[12px] text-muted-foreground/60">
                  Nenhum paciente
                </div>
              )}
            </div>

            <button
              onClick={() => navigate(`/crm?action=new&stage=${stage.slug}`)}
              className="mt-auto w-full h-[36px] text-[12px] border border-dashed border-border rounded-md text-muted-foreground bg-transparent hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              Adicionar
            </button>
          </div>
        )
      })}
    </div>
  )
}
