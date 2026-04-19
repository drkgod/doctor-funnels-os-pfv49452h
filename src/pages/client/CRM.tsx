import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users, Filter, RefreshCw, LayoutGrid, List, Star } from 'lucide-react'
import { ModuleGate } from '@/components/ModuleGate'
import { cn } from '@/lib/utils'
import { useDataCache } from '@/contexts/DataCacheContext'
import { useTenant } from '@/hooks/useTenant'
import { pipelineService } from '@/services/pipelineService'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { PatientDialog } from '@/components/crm/PatientDialog'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

export default function CRM() {
  const { tenant, loading: tenantLoading } = useTenant()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('Todas as origens')
  const [isDialogOpen, setIsDialogOpen] = useState(searchParams.get('action') === 'new')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  const [pipelines, setPipelines] = useState<any[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])

  const [patientsByStage, setPatientsByStage] = useState<Record<string, any[]>>({})
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadData = async (forceRefresh = false, activePipelineOverride?: any) => {
    if (!tenant) return
    setLoading(true)
    setError(null)

    try {
      let currentPipelines = pipelines
      if (currentPipelines.length === 0 || forceRefresh) {
        currentPipelines = await pipelineService.getPipelines(tenant.id)
        setPipelines(currentPipelines)
      }

      let activePipeline = activePipelineOverride || selectedPipeline
      if (!activePipeline && currentPipelines.length > 0) {
        const savedId = localStorage.getItem('crm_selected_pipeline')
        activePipeline =
          currentPipelines.find((p: any) => p.id === savedId) ||
          currentPipelines.find((p: any) => p.is_default) ||
          currentPipelines[0]
        setSelectedPipeline(activePipeline)
        if (activePipeline) localStorage.setItem('crm_selected_pipeline', activePipeline.id)
      }

      if (!activePipeline) {
        setLoading(false)
        return
      }

      const pWithStages = await pipelineService.getPipelineWithStages(activePipeline.id)
      const currentStages = pWithStages.stages || []
      setStages(currentStages)

      let q = supabase
        .from('patients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (debouncedSearch) {
        q = q.ilike('full_name', `%${debouncedSearch}%`)
      }
      if (sourceFilter !== 'Todas as origens') {
        q = q.eq('source', sourceFilter)
      }

      q = q.or(`pipeline_id.eq.${activePipeline.id},pipeline_id.is.null`)

      const { data: pats, error: patsErr } = await q
      if (patsErr) throw patsErr

      const finalPatients = pats || []

      if (debouncedSearch) {
        setSearchResults(finalPatients)
      } else {
        const grouped: Record<string, any[]> = {}
        currentStages.forEach((s: any) => {
          grouped[s.id] = []
        })

        const defaultStage = currentStages.find((s: any) => s.is_default) || currentStages[0]

        finalPatients.forEach((p) => {
          let stageId = p.pipeline_stage_id
          if (!stageId && p.pipeline_stage) {
            const match = currentStages.find((s: any) => s.slug === p.pipeline_stage)
            if (match) stageId = match.id
          }
          if (!stageId && defaultStage) {
            stageId = defaultStage.id
          }
          if (stageId && grouped[stageId]) {
            grouped[stageId].push(p)
          } else if (defaultStage && grouped[defaultStage.id]) {
            grouped[defaultStage.id].push(p)
          }
        })
        setPatientsByStage(grouped)
      }

      if (!forceRefresh && !debouncedSearch) {
        console.log(
          `CRM: loaded pipeline ${activePipeline.name} with ${currentStages.length} stages.`,
        )
      }
    } catch (err) {
      console.error(err)
      setError('Erro ao carregar pipeline. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant, debouncedSearch, sourceFilter])

  useEffect(() => {
    if (!tenant || !selectedPipeline) return

    const channel = supabase
      .channel('crm_patients_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `tenant_id=eq.${tenant.id}` },
        () => {
          loadData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant, selectedPipeline, stages])

  const handlePipelineChange = (val: string) => {
    const p = pipelines.find((x) => x.id === val)
    if (p) {
      setSelectedPipeline(p)
      localStorage.setItem('crm_selected_pipeline', p.id)
      loadData(false, p)
    }
  }

  const handleMove = async (id: string, from: string, to: string) => {
    const fromArr = patientsByStage[from] || []
    const toArr = patientsByStage[to] || []

    const p = fromArr.find((x) => x.id === id)
    if (!p) return

    setPatientsByStage((prev) => ({
      ...prev,
      [from]: prev[from].filter((x) => x.id !== id),
      [to]: [p, ...prev[to]],
    }))

    try {
      await pipelineService.movePatientStage(id, to)

      const oldStage = stages.find((s) => s.id === from)?.slug || 'unknown'
      const newStage = stages.find((s) => s.id === to)?.slug || 'unknown'
      const oldStageName = stages.find((s) => s.id === from)?.name || 'unknown'
      const newStageName = stages.find((s) => s.id === to)?.name || 'unknown'

      supabase.functions
        .invoke('process-automations', {
          body: {
            event_type: 'stage_change',
            tenant_id: tenant?.id,
            patient_id: id,
            context: { old_stage: oldStage, new_stage: newStage },
          },
        })
        .catch((e) => console.error(e))

      console.log(
        `CRM: moved patient ${id.substring(0, 8)} from ${oldStageName} to ${newStageName}`,
      )
      toast({ title: 'Sucesso', description: 'Paciente movido com sucesso.' })
    } catch (e) {
      setPatientsByStage((prev) => ({
        ...prev,
        [from]: [p, ...prev[from]],
        [to]: prev[to].filter((x) => x.id !== id),
      }))
      toast({ title: 'Erro', description: 'Erro ao mover paciente.', variant: 'destructive' })
    }
  }

  const hasPatients = Object.values(patientsByStage).some((arr) => arr.length > 0)
  const initialStageSlug =
    searchParams.get('stage') || stages.find((s) => s.is_default)?.slug || 'lead'

  return (
    <ModuleGate moduleKey="crm">
      <div className="flex flex-col h-full p-6 pb-[100px] md:pb-6 page-transition-enter">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">CRM</h1>

            {pipelines.length > 0 && (
              <Select value={selectedPipeline?.id || ''} onValueChange={handlePipelineChange}>
                <SelectTrigger className="w-[220px] h-9 rounded-md font-medium text-[14px]">
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.name}
                        {p.is_default && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex border rounded-md overflow-hidden ml-2">
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'px-3.5 py-2 text-[13px] transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary bg-transparent',
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3.5 py-2 text-[13px] transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary bg-transparent',
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto relative">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                className="h-10 pl-9 text-[14px] rounded-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {debouncedSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full max-h-[320px] overflow-y-auto bg-card border rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/crm/patients/${p.id}`)}
                      className="p-2.5 px-4 flex items-center gap-3 cursor-pointer hover:bg-secondary transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-[14px] font-medium text-foreground">{p.full_name}</div>
                        <div className="text-[12px] text-muted-foreground font-mono mt-0.5">
                          {p.phone || 'Sem telefone'}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.pipeline_stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {debouncedSearch && searchResults.length === 0 && (
                <div className="absolute top-full left-0 mt-1 w-full p-4 text-center text-[13px] text-muted-foreground bg-card border rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50">
                  Nenhum paciente encontrado.
                </div>
              )}
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px] h-10 rounded-md">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas as origens">Todas as origens</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Formulario">Formulário</SelectItem>
                <SelectItem value="Telefone">Telefone</SelectItem>
                <SelectItem value="Indicacao">Indicação</SelectItem>
                <SelectItem value="Doctoralia">Doctoralia</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsDialogOpen(true)} className="h-10 px-4 font-semibold gap-2">
              <UserPlus className="w-4 h-4" />
              Novo Paciente
            </Button>
          </div>
        </div>

        {loading || tenantLoading ? (
          <div className="flex gap-4 overflow-hidden" role="status">
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => loadData(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 text-center">
            <LayoutGrid className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-[18px] font-semibold mt-4">Nenhum pipeline configurado</h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
              Configure seu pipeline para começar a usar o CRM.
            </p>
            <Button onClick={() => navigate('/pipelines')} className="mt-6">
              Configurar Pipelines
            </Button>
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 text-center">
            <LayoutGrid className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-[18px] font-semibold mt-4">Nenhuma etapa configurada</h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
              Configure seu pipeline em Configurações para continuar.
            </p>
            <Button onClick={() => navigate('/pipelines')} className="mt-6">
              Adicionar Etapas
            </Button>
          </div>
        ) : !hasPatients && sourceFilter === 'Todas as origens' && !debouncedSearch ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-[18px] font-semibold mt-4">Nenhum paciente neste pipeline</h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
              Adicione seu primeiro paciente para começar a usar o CRM.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-6">
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar paciente
            </Button>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard patientsByStage={patientsByStage} stages={stages} onMove={handleMove} />
        ) : (
          <div className="bg-card rounded-md border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-secondary text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                <tr>
                  <th className="px-4 py-2.5">Nome</th>
                  <th className="px-4 py-2.5">Telefone</th>
                  <th className="px-4 py-2.5">Estágio</th>
                  <th className="px-4 py-2.5">Origem</th>
                  <th className="px-4 py-2.5">Última att.</th>
                </tr>
              </thead>
              <tbody className="text-[13px] divide-y divide-border">
                {Object.values(patientsByStage)
                  .flat()
                  .map((p) => {
                    const stageInfo =
                      stages.find((s) => s.id === p.pipeline_stage_id) ||
                      stages.find((s) => s.slug === p.pipeline_stage) ||
                      stages[0]
                    return (
                      <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span
                            onClick={() => navigate(`/crm/patients/${p.id}`)}
                            className="font-medium text-primary cursor-pointer hover:underline"
                          >
                            {p.full_name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">
                          {p.phone || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="text-[10px] font-semibold px-[8px] py-[2px] rounded-full border"
                            style={{
                              borderColor: stageInfo?.color || '#ccc',
                              color: stageInfo?.color || '#ccc',
                              backgroundColor: `${stageInfo?.color || '#ccc'}1A`,
                            }}
                          >
                            {stageInfo?.name || p.pipeline_stage}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{p.source}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}

        {tenant && (
          <PatientDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            tenantId={tenant.id}
            initialStage={initialStageSlug}
            onSuccess={() => {
              loadData(true)
            }}
          />
        )}
      </div>
    </ModuleGate>
  )
}
