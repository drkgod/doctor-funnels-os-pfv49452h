import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'

interface AppointmentDrawerProps {
  appointment: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onConfirm: () => void
  onComplete: () => void
  onNoShow: () => void
  onCancel: () => void
}

export function AppointmentDrawer({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onConfirm,
  onComplete,
  onNoShow,
  onCancel,
}: AppointmentDrawerProps) {
  if (!appointment) return null

  const startD = new Date(appointment.datetime_start)
  const endD = new Date(appointment.datetime_end)
  const isPast = startD < new Date()

  const typeMap: Record<string, string> = {
    consultation: 'Consulta',
    return: 'Retorno',
    procedure: 'Procedimento',
  }
  const statusMap: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    pending: { label: 'Pendente', variant: 'secondary' },
    confirmed: { label: 'Confirmado', variant: 'default' },
    completed: { label: 'Concluído', variant: 'outline' },
    no_show: { label: 'No-show', variant: 'destructive' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col border-l">
        <SheetHeader>
          <SheetTitle>Detalhes do Agendamento</SheetTitle>
          <SheetDescription>Informações e ações rápidas</SheetDescription>
        </SheetHeader>
        <div className="flex-1 py-6 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Paciente</h4>
            <Link
              to={`/crm/patients/${appointment.patient_id}`}
              className="text-lg font-semibold hover:underline text-primary"
            >
              {appointment.patient_name}
            </Link>
            {appointment.patient_phone && (
              <p className="text-sm text-muted-foreground mt-1">{appointment.patient_phone}</p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Data e Hora</h4>
            <p className="text-sm font-medium">
              {format(startD, "dd/MM/yyyy 'das' HH:mm", { locale: ptBR })} às{' '}
              {format(endD, 'HH:mm')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Tipo</h4>
              <Badge variant="outline">{typeMap[appointment.type] || appointment.type}</Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
              <Badge variant={statusMap[appointment.status]?.variant || 'outline'}>
                {statusMap[appointment.status]?.label || appointment.status}
              </Badge>
            </div>
          </div>

          {appointment.notes && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Observações</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                {appointment.notes}
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-4">
            Criado em: {format(new Date(appointment.created_at), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t mt-auto">
          {appointment.status === 'pending' && (
            <Button onClick={onConfirm} className="w-full">
              Confirmar
            </Button>
          )}
          {appointment.status === 'confirmed' && isPast && (
            <Button
              onClick={onComplete}
              variant="outline"
              className="w-full bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
            >
              Concluir
            </Button>
          )}
          {(appointment.status === 'confirmed' || appointment.status === 'pending') && isPast && (
            <Button
              onClick={onNoShow}
              variant="outline"
              className="w-full text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
            >
              No-show
            </Button>
          )}

          <Button variant="secondary" onClick={onEdit} className="w-full">
            Editar
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              if (confirm('Tem certeza que deseja cancelar este agendamento?')) onCancel()
            }}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Cancelar Agendamento
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
