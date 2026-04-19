import { useEffect, useState } from 'react'
import { pipelineService, Pipeline, PipelineStage } from '@/services/pipelineService'
import { supabase } from '@/lib/supabase/client'
import { useAuthContext } from '@/hooks/use-auth'
import { useToast } from '@/components/ui/use-toast'
import { GitBranch, Plus, Pencil, Trash2, GripVertical, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  '#6366F1',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#22C55E',
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
]

export default function PipelineConfig() {
  const { user } = useAuthContext()
  const { toast } = useToast()
  const [tenantId, setTenantId] = useState<string | null>(null)

  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>([])

  const [loadingPipelines, setLoadingPipelines] = useState(true)
  const [loadingStages, setLoadingStages] = useState(false)
  const [saving, setSaving] = useState(false)

  const [isPipeModalOpen, setPipeModalOpen] = useState(false)
  const [pipeForm, setPipeForm] = useState({ name: '', description: '', is_default: false })

  const [isStageModalOpen, setStageModalOpen] = useState(false)
  const [stageForm, setStageForm] = useState({
    id: '',
    name: '',
    slug: '',
    color: '#6366F1',
    description: '',
    semantic_type: '',
    is_default: false,
  })

  const [deletePipeId, setDeletePipeId] = useState<string | null>(null)
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null)

  const [editingPipeHeader, setEditingPipeHeader] = useState(false)
  const [headerName, setHeaderName] = useState('')
  const [headerDesc, setHeaderDesc] = useState('')

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.tenant_id) setTenantId(data.tenant_id)
        })
    }
  }, [user])

  useEffect(() => {
    if (tenantId) loadPipelines()
  }, [tenantId])

  useEffect(() => {
    if (selectedPipelineId) loadStages()
  }, [selectedPipelineId])

  const loadPipelines = async () => {
    if (!tenantId) return
    setLoadingPipelines(true)
    try {
      const data = await pipelineService.getPipelines(tenantId)
      setPipelines(data)

      const { data: stgCount } = await supabase
        .from('pipeline_stages')
        .select('pipeline_id, id')
        .eq('tenant_id', tenantId)
      if (stgCount) {
        const counts: Record<string, number> = {}
        stgCount.forEach((s) => {
          counts[s.pipeline_id] = (counts[s.pipeline_id] || 0) + 1
        })
        setStageCounts(counts)
      }

      if (
        data.length > 0 &&
        (!selectedPipelineId || !data.find((p) => p.id === selectedPipelineId))
      ) {
        setSelectedPipelineId(data[0].id)
      } else if (data.length === 0) {
        setSelectedPipelineId(null)
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao carregar pipelines.', variant: 'destructive' })
    } finally {
      setLoadingPipelines(false)
    }
  }

  const loadStages = async () => {
    if (!selectedPipelineId) {
      setStages([])
      return
    }
    setLoadingStages(true)
    try {
      const data = await pipelineService.getStages(selectedPipelineId)
      setStages(data)
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro ao carregar etapas.', variant: 'destructive' })
    } finally {
      setLoadingStages(false)
    }
  }

  const handleCreatePipeline = async () => {
    if (!pipeForm.name) return
    setSaving(true)
    try {
      const newPipe = await pipelineService.createPipeline(
        tenantId!,
        pipeForm.name,
        pipeForm.description || null,
      )
      if (pipeForm.is_default) {
        await pipelineService.updatePipeline(newPipe.id, { is_default: true })
      }
      const stg = await pipelineService.createStage(
        newPipe.id,
        tenantId!,
        'Novo Lead',
        'lead',
        '#6366F1',
        'Paciente acabou de entrar em contato pela primeira vez. Ainda nao demonstrou interesse especifico.',
        'entry',
      )
      await pipelineService.updateStage(stg.id, { is_default: true })

      toast({ description: 'Pipeline criado com sucesso!' })
      setPipeModalOpen(false)
      setPipeForm({ name: '', description: '', is_default: false })
      await loadPipelines()
      setSelectedPipelineId(newPipe.id)
    } catch (e) {
      toast({ description: 'Erro ao criar pipeline.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefaultPipeline = async () => {
    if (!selectedPipelineId) return
    setSaving(true)
    try {
      await pipelineService.updatePipeline(selectedPipelineId, { is_default: true })
      toast({ description: 'Pipeline definido como padrao.' })
      loadPipelines()
    } catch (e) {
      toast({ description: 'Erro ao atualizar pipeline.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePipeline = async () => {
    if (!deletePipeId) return
    setSaving(true)
    try {
      const res = await pipelineService.deletePipeline(deletePipeId)
      if (res.success) {
        toast({ description: 'Pipeline excluido.' })
        if (selectedPipelineId === deletePipeId) setSelectedPipelineId(null)
        loadPipelines()
      } else {
        toast({ description: res.error || 'Erro ao excluir.', variant: 'destructive' })
      }
    } catch (e) {
      toast({ description: 'Erro ao excluir pipeline.', variant: 'destructive' })
    } finally {
      setSaving(false)
      setDeletePipeId(null)
    }
  }

  const savePipelineHeader = async () => {
    if (!selectedPipelineId || !headerName) {
      setEditingPipeHeader(false)
      return
    }
    setSaving(true)
    try {
      await pipelineService.updatePipeline(selectedPipelineId, {
        name: headerName,
        description: headerDesc,
      })
      toast({ description: 'Pipeline atualizado!' })
      setEditingPipeHeader(false)
      loadPipelines()
    } catch (e) {
      toast({ description: 'Erro ao atualizar pipeline.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleHeaderBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      savePipelineHeader()
    }
  }

  const handleStageNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    setStageForm((prev) => ({
      ...prev,
      name: val,
      slug: prev.id ? prev.slug : slug,
    }))
  }

  const handleSaveStage = async () => {
    if (!stageForm.name || !stageForm.slug) {
      toast({ description: 'Nome e identificador sao obrigatorios.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (stageForm.id) {
        await pipelineService.updateStage(stageForm.id, {
          name: stageForm.name,
          slug: stageForm.slug,
          color: stageForm.color,
          description: stageForm.description || null,
          semantic_type: stageForm.semantic_type || null,
          is_default: stageForm.is_default,
        })
        toast({ description: 'Etapa atualizada!' })
      } else {
        const created = await pipelineService.createStage(
          selectedPipelineId!,
          tenantId!,
          stageForm.name,
          stageForm.slug,
          stageForm.color,
          stageForm.description || null,
          stageForm.semantic_type || null,
        )
        if (stageForm.is_default) {
          await pipelineService.updateStage(created.id, { is_default: true })
        }
        toast({ description: 'Etapa adicionada!' })
        setStageCounts((prev) => ({
          ...prev,
          [selectedPipelineId!]: (prev[selectedPipelineId!] || 0) + 1,
        }))
      }
      setStageModalOpen(false)
      loadStages()
    } catch (e) {
      toast({ description: 'Erro ao salvar etapa.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStage = async () => {
    if (!deleteStageId) return
    setSaving(true)
    try {
      const res = await pipelineService.deleteStage(deleteStageId)
      if (res.success) {
        toast({ description: 'Etapa excluida.' })
        loadStages()
        setStageCounts((prev) => ({
          ...prev,
          [selectedPipelineId!]: Math.max(0, (prev[selectedPipelineId!] || 1) - 1),
        }))
      } else {
        toast({ description: res.error || 'Erro ao excluir.', variant: 'destructive' })
      }
    } catch (e) {
      toast({ description: 'Erro ao excluir etapa.', variant: 'destructive' })
    } finally {
      setSaving(false)
      setDeleteStageId(null)
    }
  }

  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    const target = e.currentTarget as HTMLElement
    e.dataTransfer.setData('text/html', target.outerHTML)
  }

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIdx === null || draggedIdx === idx) return

    const newStages = [...stages]
    const draggedItem = newStages[draggedIdx]
    newStages.splice(draggedIdx, 1)
    newStages.splice(idx, 0, draggedItem)
    setStages(newStages)
    setDraggedIdx(idx)
  }

  const onDragEnd = async () => {
    if (draggedIdx === null) return
    setDraggedIdx(null)
    const stageIds = stages.map((s) => s.id)
    try {
      await pipelineService.reorderStages(selectedPipelineId!, stageIds)
    } catch (e) {
      toast({ description: 'Erro ao reordenar etapas.', variant: 'destructive' })
      loadStages()
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)

  return (
    <div className="flex-1 p-6 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GitBranch className="h-8 w-8 text-primary" /> Pipelines
        </h1>
        <Button
          onClick={() => {
            setPipeForm({ name: '', description: '', is_default: false })
            setPipeModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Criar Pipeline
        </Button>
      </div>

      {loadingPipelines ? (
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <div className="w-full md:w-2/3 flex flex-col gap-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center bg-card rounded-lg border border-dashed p-8">
          <GitBranch className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Nenhum pipeline configurado.</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Crie seu primeiro pipeline para organizar o fluxo de atendimento dos seus pacientes.
          </p>
          <Button
            onClick={() => {
              setPipeForm({ name: '', description: '', is_default: false })
              setPipeModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Pipeline
          </Button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          <div className="w-full md:w-1/3 flex flex-col bg-card border rounded-lg overflow-hidden flex-shrink-0 md:flex-shrink">
            <div className="p-4 border-b font-semibold bg-muted/30">Seus Pipelines</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {pipelines.map((pipe) => (
                <button
                  key={pipe.id}
                  onClick={() => setSelectedPipelineId(pipe.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-all duration-200 flex flex-col gap-2',
                    selectedPipelineId === pipe.id
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'hover:bg-muted/50 border-transparent hover:border-border',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={cn(
                        'font-semibold truncate pr-2',
                        selectedPipelineId === pipe.id ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {pipe.name}
                    </span>
                    {pipe.is_default && (
                      <Badge
                        variant="default"
                        className="bg-emerald-500 hover:bg-emerald-600 text-[10px] shrink-0"
                      >
                        Padrao
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Badge variant="secondary" className="font-normal text-[10px]">
                      {stageCounts[pipe.id] || 0} etapas
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-2/3 flex flex-col bg-card border rounded-lg overflow-hidden flex-shrink-0 md:flex-shrink">
            {selectedPipeline ? (
              <>
                <div className="p-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/10 shrink-0 min-h-[96px]">
                  {editingPipeHeader ? (
                    <div
                      className="space-y-3 w-full max-w-md"
                      onBlur={handleHeaderBlur}
                      tabIndex={-1}
                    >
                      <Input
                        autoFocus
                        value={headerName}
                        onChange={(e) => setHeaderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && savePipelineHeader()}
                        placeholder="Nome do Pipeline"
                      />
                      <Input
                        value={headerDesc}
                        onChange={(e) => setHeaderDesc(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && savePipelineHeader()}
                        placeholder="Descricao (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={savePipelineHeader} disabled={saving}>
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPipeHeader(false)}
                          disabled={saving}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-start gap-3 group cursor-pointer flex-1"
                      onClick={() => {
                        setHeaderName(selectedPipeline.name)
                        setHeaderDesc(selectedPipeline.description || '')
                        setEditingPipeHeader(true)
                      }}
                    >
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                          {selectedPipeline.name}
                          <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h2>
                        {selectedPipeline.description && (
                          <p className="text-muted-foreground mt-1">
                            {selectedPipeline.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!editingPipeHeader && (
                    <div className="flex items-center gap-2 shrink-0 mt-4 sm:mt-0">
                      {!selectedPipeline.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSetDefaultPipeline}
                          disabled={saving}
                        >
                          <Check className="h-4 w-4 mr-2" /> Definir como Padrao
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletePipeId(selectedPipeline.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
                  {loadingStages ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  ) : stages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-center p-8 border border-dashed rounded-lg">
                      <GitBranch className="h-12 w-12 text-muted-foreground mb-3 opacity-30" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma etapa neste pipeline.</h3>
                      <Button
                        onClick={() => {
                          setStageForm({
                            id: '',
                            name: '',
                            slug: '',
                            color: '#6366F1',
                            description: '',
                            semantic_type: '',
                            is_default: false,
                          })
                          setStageModalOpen(true)
                        }}
                        className="mt-4"
                      >
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Primeira Etapa
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {stages.map((stage, index) => (
                        <div
                          key={stage.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, index)}
                          onDragOver={(e) => onDragOver(e, index)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            'flex items-center justify-between p-4 bg-background border rounded-lg shadow-sm transition-all group',
                            draggedIdx === index
                              ? 'opacity-50 scale-[1.02] shadow-md z-10 relative'
                              : 'hover:border-primary/50',
                          )}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground">
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stage.color || '#6B7A99' }}
                            ></div>
                            <div className="flex flex-col">
                              <span className="font-medium flex items-center gap-2">
                                {stage.name}
                                {stage.is_default && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    Padrao
                                  </Badge>
                                )}
                                {stage.semantic_type === 'entry' && (
                                  <Badge className="bg-blue-500 hover:bg-blue-600 text-[10px] h-4 px-1 text-white border-transparent">
                                    Entrada
                                  </Badge>
                                )}
                                {stage.semantic_type === 'booked' && (
                                  <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-4 px-1 text-white border-transparent">
                                    Agendamento
                                  </Badge>
                                )}
                                {stage.semantic_type === 'completed' && (
                                  <Badge className="bg-purple-500 hover:bg-purple-600 text-[10px] h-4 px-1 text-white border-transparent">
                                    Concluida
                                  </Badge>
                                )}
                                {stage.semantic_type === 'cancelled' && (
                                  <Badge className="bg-red-500 hover:bg-red-600 text-[10px] h-4 px-1 text-white border-transparent">
                                    Cancelamento
                                  </Badge>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">{stage.slug}</span>
                              {stage.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[300px] mt-1">
                                  {stage.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setStageForm({
                                  id: stage.id,
                                  name: stage.name,
                                  slug: stage.slug,
                                  color: stage.color || '#6B7A99',
                                  description: stage.description || '',
                                  semantic_type: stage.semantic_type || '',
                                  is_default: stage.is_default || false,
                                })
                                setStageModalOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive"
                              onClick={() => setDeleteStageId(stage.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {stages.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          setStageForm({
                            id: '',
                            name: '',
                            slug: '',
                            color: '#6366F1',
                            description: '',
                            semantic_type: '',
                            is_default: false,
                          })
                          setStageModalOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Etapa
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={isPipeModalOpen} onOpenChange={setPipeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Pipeline</Label>
              <Input
                placeholder="Ex: Pacientes Particulares"
                maxLength={50}
                value={pipeForm.name}
                onChange={(e) => setPipeForm({ ...pipeForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao (opcional)</Label>
              <Input
                placeholder="Ex: Pipeline para pacientes de consulta particular"
                maxLength={200}
                value={pipeForm.description}
                onChange={(e) => setPipeForm({ ...pipeForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="default-pipe"
                checked={pipeForm.is_default}
                onCheckedChange={(c) => setPipeForm({ ...pipeForm, is_default: !!c })}
              />
              <Label htmlFor="default-pipe" className="font-normal">
                Definir como pipeline padrao
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPipeModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePipeline} disabled={saving}>
              Criar Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStageModalOpen} onOpenChange={setStageModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stageForm.id ? 'Editar Etapa' : 'Adicionar Etapa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Etapa</Label>
              <Input
                placeholder="Ex: Avaliacao Inicial"
                maxLength={30}
                value={stageForm.name}
                onChange={(e) => handleStageNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Identificador (slug)</Label>
              <Input
                placeholder="Ex: avaliacao_inicial"
                value={stageForm.slug}
                onChange={(e) => setStageForm({ ...stageForm, slug: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Usado internamente. Sem espacos ou caracteres especiais.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110',
                      stageForm.color === c ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setStageForm({ ...stageForm, color: c })}
                  >
                    {stageForm.color === c && (
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instrucao para a IA</Label>
              <Textarea
                placeholder="Descreva quando um paciente deve estar nesta etapa. A IA usa essa descricao para decidir movimentacoes."
                value={stageForm.description}
                onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                rows={3}
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">
                A IA do WhatsApp usa esta descricao para saber quando mover o paciente para esta
                etapa.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Comportamento automatico</Label>
              <Select
                value={stageForm.semantic_type || 'none'}
                onValueChange={(val) =>
                  setStageForm({ ...stageForm, semantic_type: val === 'none' ? '' : val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o comportamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (a IA decide pelo contexto)</SelectItem>
                  <SelectItem value="entry">Entrada (novos pacientes caem aqui)</SelectItem>
                  <SelectItem value="booked">Agendado (apos agendar consulta)</SelectItem>
                  <SelectItem value="completed">
                    Consulta concluida (apos finalizar consulta)
                  </SelectItem>
                  <SelectItem value="cancelled">Cancelamento (apos cancelar)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Se definido, o sistema move o paciente automaticamente. Apenas UMA etapa por
                pipeline pode ter cada tipo.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="default-stage"
                checked={stageForm.is_default}
                onCheckedChange={(c) => setStageForm({ ...stageForm, is_default: !!c })}
              />
              <Label htmlFor="default-stage" className="font-normal">
                Etapa padrao para novos pacientes
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStageModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStage} disabled={saving}>
              {stageForm.id ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePipeId} onOpenChange={(o) => !o && setDeletePipeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pipeline '
              {pipelines.find((p) => p.id === deletePipeId)?.name}'? Esta acao nao pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePipeline}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteStageId} onOpenChange={(o) => !o && setDeleteStageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etapa '
              {stages.find((s) => s.id === deleteStageId)?.name}'?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
