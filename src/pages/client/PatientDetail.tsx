import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MessageCircle,
  Activity,
  ExternalLink,
  RefreshCw,
  LayoutGrid,
  CalendarPlus,
  X,
} from 'lucide-react'
import { ModuleGate } from '@/components/ModuleGate'
import { patientService } from '@/services/patientService'
import { useTenant } from '@/hooks/useTenant'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PatientDialog } from '@/components/crm/PatientDialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { STAGE_COLORS, SOURCE_STYLES } from '@/components/crm/KanbanBoard'

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { toast } = useToast()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      setError(null)
      const res = await patientService.fetchPatientById(id)
      setData(res)
    } catch (err: any) {
      if (err?.code === 'PGRST116') setError('Paciente não encontrado')
      else setError('Não foi possível carregar os dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleDelete = async () => {
    try {
      await patientService.deletePatient(id!)
      toast({ title: 'Paciente excluído' })
      navigate('/crm')
    } catch (err) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  if (loading)
    return (
      <ModuleGate module_key="crm">
        <div className="p-6 max-w-[1200px] mx-auto space-y-6">
          <Skeleton className="h-4 w-40 mb-6" />
          <Skeleton className="h-10 w-[300px] mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-5">
              <Skeleton className="h-[200px] w-full rounded-md animate-pulse" />
              <Skeleton className="h-[300px] w-full rounded-md animate-pulse" />
            </div>
            <div className="space-y-5">
              <Skeleton className="h-[150px] w-full rounded-md animate-pulse" />
              <Skeleton className="h-[150px] w-full rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </ModuleGate>
    )
  if (error === 'Paciente não encontrado')
    return (
      <ModuleGate module_key="crm">
        <div className="p-20 text-center">
          <h2 className="text-xl font-semibold mb-4">Paciente não encontrado</h2>
          <Button onClick={() => navigate('/crm')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </ModuleGate>
    )
  if (error)
    return (
      <ModuleGate module_key="crm">
        <div className="p-20 text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </ModuleGate>
    )

  const { patient, appointments, conversations, recentMessages } = data
  const age = patient.date_of_birth
    ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / 3.15576e10)
    : '—'

  const timeline = [
    {
      id: 'cre',
      date: patient.created_at,
      type: 'created',
      text: `Paciente cadastrado. Origem: ${patient.source}`,
      icon: Activity,
    },
    ...appointments.map((a: any) => ({
      id: a.id,
      date: a.datetime_start,
      type: 'appointment',
      text: `Agendamento: ${a.type} em ${format(new Date(a.datetime_start), 'dd/MM/yyyy', { locale: ptBR })}`,
      icon: Calendar,
    })),
    ...recentMessages.map((m: any) => ({
      id: m.id,
      date: m.created_at,
      type: 'message',
      text: `Mensagem: ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`,
      icon: MessageCircle,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <ModuleGate module_key="crm">
      <div className="p-6 max-w-[1200px] mx-auto">
        <button
          onClick={() => navigate('/crm')}
          className="text-[13px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao CRM
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-bold text-foreground">{patient.full_name}</h1>
            <span
              className="text-[12px] px-[10px] py-[3px] rounded-full font-semibold text-white"
              style={{
                backgroundColor: STAGE_COLORS[patient.pipeline_stage] || STAGE_COLORS['lead'],
              }}
            >
              {patient.pipeline_stage.toUpperCase()}
            </span>
            <span
              className={cn(
                'text-[12px] px-[10px] py-[3px] rounded-full font-semibold',
                SOURCE_STYLES[patient.source] || SOURCE_STYLES['Manual'],
              )}
            >
              {patient.source}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="w-9 h-9 p-0"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-5">
            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">
                Informações do Paciente
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    Idade / Nascimento
                  </div>
                  <div className="text-[14px] text-foreground mt-0.5">
                    {patient.date_of_birth ? (
                      `${age} anos (${format(new Date(patient.date_of_birth), 'dd/MM/yyyy')})`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    CPF
                  </div>
                  <div className="text-[14px] text-foreground mt-0.5">
                    {patient.cpf || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    Telefone
                  </div>
                  <div className="text-[14px] mt-0.5">
                    {patient.phone ? (
                      <a href={`tel:${patient.phone}`} className="text-primary hover:underline">
                        {patient.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    Email
                  </div>
                  <div className="text-[14px] mt-0.5">
                    {patient.email ? (
                      <a href={`mailto:${patient.email}`} className="text-primary hover:underline">
                        {patient.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    Endereço
                  </div>
                  <div className="text-[14px] text-foreground mt-0.5">
                    {patient.address || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">
                Timeline
              </h2>
              {timeline.length === 0 ? (
                <div className="text-[13px] text-muted-foreground py-4 text-center">
                  Nenhuma atividade registrada para este paciente.
                </div>
              ) : (
                <div className="pl-6 border-l-2 border-border mt-2">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="relative pb-5 pl-5">
                      <div
                        className={cn(
                          'absolute w-2.5 h-2.5 rounded-full border-2 -left-[29px] top-1 bg-background',
                          ev.type === 'created' || ev.type === 'stage_change'
                            ? 'border-primary bg-primary/10'
                            : ev.type === 'appointment'
                              ? 'border-accent bg-accent/10'
                              : ev.type === 'message'
                                ? 'border-success bg-success/10'
                                : 'border-border',
                        )}
                      />
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(ev.date), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className="text-[13px] mt-1 text-foreground">{ev.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">
                Agendamentos
              </h2>
              {appointments.length === 0 ? (
                <div className="text-[13px] text-muted-foreground text-center py-4">
                  Nenhum agendamento.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-secondary text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Profissional</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {appointments.map((a: any) => (
                        <tr key={a.id} className="hover:bg-secondary/50">
                          <td className="px-3 py-2">
                            {format(new Date(a.datetime_start), 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td className="px-3 py-2">{a.type}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {a.profiles?.full_name || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                a.status === 'confirmed'
                                  ? 'bg-success/10 text-success'
                                  : a.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : a.status === 'cancelled'
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {a.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button
                variant="outline"
                className="mt-3 h-9 text-[13px]"
                onClick={() => navigate(`/agenda?patient_id=${patient.id}`)}
              >
                Novo Agendamento
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">
                Ações Rápidas
              </h2>
              <Button
                variant="outline"
                className="w-full h-10 text-[13px] gap-2 mb-2 justify-start font-medium"
              >
                <LayoutGrid className="w-4 h-4" /> Estágio: {patient.pipeline_stage}
              </Button>
              <Button
                className="w-full h-10 text-[13px] gap-2 mb-2 bg-success hover:bg-success/90 text-white justify-start font-medium"
                onClick={() => navigate(`/whatsapp`)}
              >
                <MessageCircle className="w-4 h-4" /> Enviar Mensagem
              </Button>
              <Button
                className="w-full h-10 text-[13px] gap-2 mb-2 bg-accent hover:bg-accent/90 text-white justify-start font-medium"
                onClick={() => navigate(`/agenda?patient_id=${patient.id}`)}
              >
                <CalendarPlus className="w-4 h-4" /> Agendar Consulta
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-[13px] gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive justify-start font-medium mt-2"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Paciente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir {patient.full_name}? Esta ação pode ser
                      desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">Tags</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {patient.tags?.map((t: string) => (
                  <div
                    key={t}
                    className="text-[12px] px-2.5 py-[3px] rounded-md bg-accent/10 text-accent flex items-center gap-1"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border rounded-md p-6">
              <h2 className="text-[15px] font-semibold mb-4 pb-3 border-b border-border">
                Observações
              </h2>
              <div className="text-[14px] leading-[1.6] whitespace-pre-wrap text-muted-foreground">
                {patient.notes || 'Nenhuma observação registrada.'}
              </div>
            </div>
          </div>
        </div>
        {tenant && (
          <PatientDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            tenantId={tenant.id}
            patient={patient}
            onSuccess={loadData}
          />
        )}
      </div>
    </ModuleGate>
  )
}
