import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { patientService } from '@/services/patientService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Props {
  patientsByStage: Record<string, any[]>
  onMoveOptimistic: (id: string, from: string, to: string) => void
  onMoveRevert: (id: string, from: string, to: string) => void
}

const STAGES = [
  { id: 'lead', title: 'Lead' },
  { id: 'contact', title: 'Contato' },
  { id: 'scheduled', title: 'Agendado' },
  { id: 'consultation', title: 'Consulta' },
  { id: 'return', title: 'Retorno' },
  { id: 'procedure', title: 'Procedimento' },
]

export const STAGE_COLORS: Record<string, string> = {
  lead: 'hsl(220, 70%, 55%)',
  contact: 'hsl(189, 100%, 42%)',
  scheduled: 'hsl(45, 93%, 47%)',
  consultation: 'hsl(152, 68%, 40%)',
  return: 'hsl(270, 60%, 50%)',
  procedure: 'hsl(330, 60%, 50%)',
}

export const SOURCE_STYLES: Record<string, string> = {
  WhatsApp: 'bg-success/10 text-success',
  Formulario: 'bg-primary/10 text-primary',
  Telefone: 'bg-accent/10 text-accent',
  Indicacao: 'bg-[hsl(270,60%,50%)]/10 text-[hsl(270,60%,50%)]',
  Doctoralia: 'bg-teal-500/10 text-teal-600',
  Manual: 'bg-muted text-muted-foreground',
}

function PatientCard({ p, stage, onDragStart, onClick }: any) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true)
        onDragStart(e, p.id, stage)
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

export function KanbanBoard({ patientsByStage, onMoveOptimistic, onMoveRevert }: Props) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string, stage: string) => {
    e.dataTransfer.setData('id', id)
    e.dataTransfer.setData('stage', stage)
  }

  const handleDrop = async (e: React.DragEvent, toStage: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('id')
    const fromStage = e.dataTransfer.getData('stage')
    if (fromStage === toStage) return

    onMoveOptimistic(id, fromStage, toStage)
    try {
      await patientService.movePatient(id, toStage)
    } catch (err) {
      onMoveRevert(id, toStage, fromStage)
      toast({
        title: 'Erro ao mover',
        description: 'Não foi possível mover o paciente. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4 items-start scroll-smooth snap-x snap-mandatory">
      {STAGES.map((stage) => (
        <div
          key={stage.id}
          className={cn(
            'flex-shrink-0 min-w-[280px] sm:min-w-[240px] snap-start flex-1 flex flex-col bg-secondary/30 rounded-md p-3 h-full max-h-[calc(100vh-200px)] transition-colors duration-150',
            dragOverCol === stage.id
              ? 'bg-primary/5 border-2 border-dashed border-primary/30'
              : 'border-t-[3px] border-x border-b border-solid border-transparent',
          )}
          style={{
            borderTopColor: dragOverCol === stage.id ? 'transparent' : STAGE_COLORS[stage.id],
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverCol(stage.id)
          }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          <div className="flex items-center justify-between px-1 mb-3">
            <h3 className="text-[13px] font-semibold text-foreground">{stage.title}</h3>
            <div className="text-[11px] font-semibold min-w-[24px] h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary">
              {patientsByStage[stage.id]?.length || 0}
            </div>
          </div>

          <div className="flex flex-col gap-0 overflow-y-auto pr-1 pb-2">
            {patientsByStage[stage.id]?.map((p) => (
              <PatientCard
                key={p.id}
                p={p}
                stage={stage.id}
                onDragStart={handleDragStart}
                onClick={() => navigate(`/crm/patients/${p.id}`)}
              />
            ))}
          </div>

          <button
            onClick={() => navigate(`/crm?action=new&stage=${stage.id}`)}
            className="mt-auto w-full h-[36px] text-[12px] border border-dashed border-border rounded-md text-muted-foreground bg-transparent hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            Adicionar
          </button>
        </div>
      ))}
    </div>
  )
}
