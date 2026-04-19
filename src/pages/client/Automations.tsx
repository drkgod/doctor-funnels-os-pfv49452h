import { useState, useEffect } from 'react'
import { ModuleGate } from '@/components/ModuleGate'
import { useAuth } from '@/hooks/use-auth'
import { automationService } from '@/services/automationService'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  ArrowRight,
  Clock,
  UserPlus,
  Hand,
  MessageCircle,
  Mail,
  CheckSquare,
  Zap,
  Trash2,
  Edit,
  List,
  Play,
  Loader2,
} from 'lucide-react'

const STAGES: Record<string, string> = {
  any: 'Qualquer estagio',
  lead: 'Lead',
  contact: 'Contato',
  scheduled: 'Agendado',
  consultation: 'Consulta',
  return: 'Retorno',
  procedure: 'Procedimento',
}

const EVENTS: Record<string, string> = {
  appointment_completed: 'Consulta realizada',
  appointment_created: 'Agendamento criado',
  patient_created: 'Cadastro do paciente',
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return 'Nunca executada'
  const date = new Date(dateString)
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffInSeconds < 60) return 'Agora mesmo'
  if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`
  if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} horas`
  return `Há ${Math.floor(diffInSeconds / 86400)} dias`
}

export default function Automations() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tenantId, setTenantId] = useState<string | null>(null)

  const [automations, setAutomations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'stage_change',
    trigger_config: {
      from_stage: 'any',
      target_stage: 'lead',
      days_after: 30,
      event_type: 'appointment_completed',
    },
    action_type: 'send_whatsapp',
    action_config: {
      message: '',
      template_id: '',
      template_name: '',
      target_stage: 'contact',
      task_name: '',
      task_description: '',
    },
  })

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [detailLogs, setDetailLogs] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const [isManualOpen, setIsManualOpen] = useState(false)
  const [searchPatient, setSearchPatient] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.tenant_id) {
            setTenantId(data.tenant_id)
            fetchData(data.tenant_id)
            fetchTemplates(data.tenant_id)
          }
        })
    }
  }, [user])

  const fetchData = async (tId: string) => {
    try {
      setLoading(true)
      const data = await automationService.fetchAutomations(tId)
      setAutomations(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar automações')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async (tId: string) => {
    const { data } = await supabase
      .from('email_templates')
      .select('id, name, category')
      .or(`tenant_id.eq.${tId},is_global.eq.true`)
    if (data) setEmailTemplates(data)
  }

  const handleSearchPatients = async (term: string) => {
    setSearchPatient(term)
    if (!term || term.length < 2 || !tenantId) {
      setPatientResults([])
      return
    }
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${term}%`)
      .limit(10)
    if (data) setPatientResults(data)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      name: '',
      trigger_type: 'stage_change',
      trigger_config: {
        from_stage: 'any',
        target_stage: 'lead',
        days_after: 30,
        event_type: 'appointment_completed',
      },
      action_type: 'send_whatsapp',
      action_config: {
        message: '',
        template_id: '',
        template_name: '',
        target_stage: 'contact',
        task_name: '',
        task_description: '',
      },
    })
    setIsDialogOpen(true)
  }

  const openEdit = (auto: any) => {
    setEditingId(auto.id)
    setForm({
      name: auto.name,
      trigger_type: auto.trigger_type,
      trigger_config: {
        from_stage: auto.trigger_config.from_stage || 'any',
        target_stage: auto.trigger_config.target_stage || 'lead',
        days_after: auto.trigger_config.days_after || 30,
        event_type: auto.trigger_config.event_type || 'appointment_completed',
      },
      action_type: auto.action_type,
      action_config: {
        message: auto.action_config.message || '',
        template_id: auto.action_config.template_id || '',
        template_name: auto.action_config.template_name || '',
        target_stage: auto.action_config.target_stage || 'contact',
        task_name: auto.action_config.task_name || '',
        task_description: auto.action_config.task_description || '',
      },
    })
    setIsDialogOpen(true)
  }

  const openDetails = async (id: string) => {
    setDetailOpen(true)
    setLoadingDetails(true)
    try {
      const { automation, logs } = await automationService.fetchAutomationById(id)
      setDetailData(automation)
      setDetailLogs(logs)
    } catch (e) {
      toast({ title: 'Erro ao carregar detalhes', variant: 'destructive' })
    } finally {
      setLoadingDetails(false)
    }
  }

  const saveAutomation = async () => {
    if (!tenantId) return
    try {
      if (editingId) {
        await automationService.updateAutomation(editingId, form)
        toast({ title: 'Automação atualizada com sucesso' })
      } else {
        await automationService.createAutomation(tenantId, form)
        toast({ title: 'Automação criada com sucesso' })
      }
      setIsDialogOpen(false)
      fetchData(tenantId)
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const toggleStatus = async (id: string, active: boolean) => {
    try {
      await automationService.toggleAutomation(id, active)
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: active } : a)))
      toast({ title: active ? 'Automação ativada' : 'Automação pausada' })
    } catch (e) {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Os logs desta automacao tambem serao excluidos.')) return
    try {
      await automationService.deleteAutomation(id)
      toast({ title: 'Automação excluída' })
      fetchData(tenantId!)
    } catch (e) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const executeManual = async () => {
    if (!tenantId || !detailData) return
    setExecuting(true)
    try {
      const result = await automationService.executeManualAutomation(
        detailData.id,
        tenantId,
        selectedPatients,
      )
      toast({
        title: `Automacao executada: ${result.success_count} sucessos, ${result.failure_count} falhas`,
      })
      setIsManualOpen(false)
      openDetails(detailData.id)
      fetchData(tenantId)
    } catch (e) {
      toast({ title: 'Erro ao executar automacao. Tente novamente.', variant: 'destructive' })
    } finally {
      setExecuting(false)
    }
  }

  const getTriggerDesc = (t: string, c: any) => {
    if (t === 'stage_change')
      return `paciente muda para ${STAGES[c.target_stage] || c.target_stage}`
    if (t === 'time_after_event')
      return `${c.days_after} dias após ${EVENTS[c.event_type] || c.event_type}`
    if (t === 'new_lead') return 'novo lead entra no pipeline'
    if (t === 'manual') return 'executado manualmente'
    return ''
  }

  const getActionDesc = (t: string, c: any) => {
    if (t === 'send_whatsapp') return `enviar WhatsApp: ${c.message?.substring(0, 40) || ''}...`
    if (t === 'send_email') return `enviar email: ${c.template_name || 'Template'}`
    if (t === 'move_pipeline') return `mover para ${STAGES[c.target_stage] || c.target_stage}`
    if (t === 'create_task') return `criar tarefa: ${c.task_name}`
    return ''
  }

  return (
    <ModuleGate moduleKey="automations">
      <div className="flex-1 space-y-6 p-6 pb-[100px] md:pb-6 page-transition-enter">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Automações</h1>
          <Button onClick={openCreate} className="h-10 font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Nova Automação
          </Button>
        </div>

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center" role="alert">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => tenantId && fetchData(tenantId)} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        )}

        {loading ? (
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-label="Carregando"
          >
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : !loading && automations.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhuma automação criada</h3>
            <p className="text-muted-foreground mb-6">
              Crie sua primeira automação para automatizar tarefas repetitivas.
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nova Automação
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {automations.map((auto) => (
              <Card
                key={auto.id}
                className="flex flex-col transition-all hover:border-primary/30 hover:shadow-md cursor-default"
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1 flex-1 pr-4">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {auto.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      Quando {getTriggerDesc(auto.trigger_type, auto.trigger_config)}, então{' '}
                      {getActionDesc(auto.action_type, auto.action_config)}.
                    </p>
                  </div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={auto.is_active}
                      onCheckedChange={(c) => toggleStatus(auto.id, c)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pb-4" onClick={() => openDetails(auto.id)}>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-2">
                    <span>Executada {auto.execution_count || 0} vezes</span>
                    <span>Última execução: {formatRelativeTime(auto.last_executed_at)}</span>
                  </div>
                </CardContent>
                <div
                  className="mt-auto border-t border-border/50 p-4 flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openEdit(auto)}
                    aria-label="Editar"
                  >
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => openDetails(auto.id)}
                    aria-label="Ver logs"
                  >
                    <List className="h-3 w-3 mr-1" /> Ver Logs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(auto.id)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">1. Informações Básicas</Label>
                <Input
                  placeholder="Ex: Lembrete de retorno"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold">2. Quando isso acontecer:</Label>
                <Select
                  value={form.trigger_type}
                  onValueChange={(v) => setForm({ ...form, trigger_type: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stage_change">
                      <div className="flex items-center">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Mudança de estágio
                      </div>
                    </SelectItem>
                    <SelectItem value="time_after_event">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Tempo após evento
                      </div>
                    </SelectItem>
                    <SelectItem value="new_lead">
                      <div className="flex items-center">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Novo lead
                      </div>
                    </SelectItem>
                    <SelectItem value="manual">
                      <div className="flex items-center">
                        <Hand className="w-4 h-4 mr-2" />
                        Manual
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {form.trigger_type === 'stage_change' && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">De estágio</Label>
                      <Select
                        value={form.trigger_config.from_stage}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            trigger_config: { ...form.trigger_config, from_stage: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STAGES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Para estágio</Label>
                      <Select
                        value={form.trigger_config.target_stage}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            trigger_config: { ...form.trigger_config, target_stage: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STAGES)
                            .filter(([k]) => k !== 'any')
                            .map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {form.trigger_type === 'time_after_event' && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Dias após</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.trigger_config.days_after}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            trigger_config: {
                              ...form.trigger_config,
                              days_after: parseInt(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Evento</Label>
                      <Select
                        value={form.trigger_config.event_type}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            trigger_config: { ...form.trigger_config, event_type: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(EVENTS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold">3. Então fazer isso:</Label>
                <Select
                  value={form.action_type}
                  onValueChange={(v) => setForm({ ...form, action_type: v })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_whatsapp">
                      <div className="flex items-center">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Enviar WhatsApp
                      </div>
                    </SelectItem>
                    <SelectItem value="send_email">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Email
                      </div>
                    </SelectItem>
                    <SelectItem value="move_pipeline">
                      <div className="flex items-center">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Mover no Pipeline
                      </div>
                    </SelectItem>
                    <SelectItem value="create_task">
                      <div className="flex items-center">
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Criar Tarefa
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {form.action_type === 'send_whatsapp' && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      className="min-h-[100px]"
                      placeholder="Olá PATIENT_NAME..."
                      value={form.action_config.message}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          action_config: { ...form.action_config, message: e.target.value },
                        })
                      }
                    />
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">PATIENT_NAME</Badge>
                      <Badge variant="secondary">CLINIC_NAME</Badge>
                      <Badge variant="secondary">DOCTOR_NAME</Badge>
                    </div>
                  </div>
                )}
                {form.action_type === 'send_email' && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs">Template de Email</Label>
                    <Select
                      value={form.action_config.template_id}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          action_config: {
                            ...form.action_config,
                            template_id: v,
                            template_name: emailTemplates.find((t) => t.id === v)?.name || '',
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.action_type === 'move_pipeline' && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs">Para qual estágio?</Label>
                    <Select
                      value={form.action_config.target_stage}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          action_config: { ...form.action_config, target_stage: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STAGES)
                          .filter(([k]) => k !== 'any')
                          .map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.action_type === 'create_task' && (
                  <div className="space-y-2 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome da tarefa</Label>
                      <Input
                        value={form.action_config.task_name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            action_config: { ...form.action_config, task_name: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descrição (opcional)</Label>
                      <Textarea
                        value={form.action_config.task_description}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            action_config: {
                              ...form.action_config,
                              task_description: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAutomation} disabled={!form.name}>
                {editingId ? 'Salvar' : 'Criar Automação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Details Sheet */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="sm:max-w-[700px] w-full overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>{detailData?.name || 'Detalhes'}</SheetTitle>
              <SheetDescription>
                Configurações e histórico de execução desta automação.
              </SheetDescription>
            </SheetHeader>
            {loadingDetails ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detailData ? (
              <Tabs defaultValue="logs" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="config" className="flex-1">
                    Configuração
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="flex-1">
                    Logs de Execução
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="config" className="space-y-6">
                  <div className="p-4 rounded-lg border bg-card space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                        Gatilho (Quando)
                      </h4>
                      <p className="text-sm font-medium">
                        {getTriggerDesc(detailData.trigger_type, detailData.trigger_config)}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                        Ação (Então)
                      </h4>
                      <p className="text-sm font-medium">
                        {getActionDesc(detailData.action_type, detailData.action_config)}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Status</h4>
                      <Badge variant={detailData.is_active ? 'default' : 'secondary'}>
                        {detailData.is_active ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setDetailOpen(false)
                      openEdit(detailData)
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <Edit className="h-4 w-4 mr-2" /> Editar Configuração
                  </Button>
                </TabsContent>
                <TabsContent value="logs">
                  {detailData.trigger_type === 'manual' && (
                    <Button
                      onClick={() => setIsManualOpen(true)}
                      className="w-full mb-4"
                      variant="default"
                    >
                      <Play className="h-4 w-4 mr-2" /> Executar Agora
                    </Button>
                  )}
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Paciente</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailLogs.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center py-6 text-muted-foreground"
                            >
                              Nenhum log encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          detailLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {new Date(log.executed_at).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.patients?.full_name || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === 'success'
                                      ? 'default'
                                      : log.status === 'failed'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className="text-[10px] uppercase"
                                >
                                  {log.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* Manual Execution Dialog */}
        <Dialog
          open={isManualOpen}
          onOpenChange={(o) => {
            setIsManualOpen(o)
            if (!o) setSelectedPatients([])
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Executar Automação</DialogTitle>
              <DialogDescription>
                Pesquise e selecione os pacientes para executar esta ação agora.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Buscar paciente por nome..."
                value={searchPatient}
                onChange={(e) => handleSearchPatients(e.target.value)}
              />
              <div className="border rounded-md p-2 h-[240px] overflow-y-auto space-y-1">
                {patientResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Busque pacientes para selecionar.
                  </p>
                ) : (
                  patientResults.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-2 hover:bg-secondary/50 rounded-md"
                    >
                      <Checkbox
                        id={`p-${p.id}`}
                        checked={selectedPatients.includes(p.id)}
                        onCheckedChange={(c) => {
                          if (c) setSelectedPatients([...selectedPatients, p.id])
                          else setSelectedPatients(selectedPatients.filter((id) => id !== p.id))
                        }}
                      />
                      <Label htmlFor={`p-${p.id}`} className="flex-1 cursor-pointer">
                        {p.full_name}{' '}
                        <span className="text-muted-foreground text-xs ml-1">{p.phone}</span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-sm font-medium text-primary">
                {selectedPatients.length} selecionado(s)
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsManualOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={executeManual} disabled={selectedPatients.length === 0 || executing}>
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Executar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGate>
  )
}
