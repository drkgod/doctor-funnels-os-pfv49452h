import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users, Filter, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { ModuleGate } from '@/components/ModuleGate'
import { cn } from '@/lib/utils'
import { useDataCache } from '@/contexts/DataCacheContext'
import { useTenant } from '@/hooks/useTenant'
import { patientService, type Patient } from '@/services/patientService'
import { Input } from '@/components/ui/input'
import { STAGE_COLORS } from '@/components/crm/KanbanBoard'
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

export default function CRM() {
  const { tenant, loading: tenantLoading } = useTenant()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const { getCachedData, setCachedData, invalidateCache } = useDataCache()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('Todas as origens')
  const [isDialogOpen, setIsDialogOpen] = useState(searchParams.get('action') === 'new')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  const initialStage = searchParams.get('stage') || 'lead'

  const cacheKey = `crm-patients-${debouncedSearch}-${sourceFilter}`

  const [patientsByStage, setPatientsByStage] = useState<Record<string, any[]>>(() => {
    const cached = getCachedData('crm-patients--Todas as origens', 300000)
    return cached?.patientsByStage || {}
  })
  const [searchResults, setSearchResults] = useState<any[]>(() => {
    const cached = getCachedData('crm-patients--Todas as origens', 300000)
    return cached?.searchResults || []
  })
  const [loading, setLoading] = useState(!getCachedData('crm-patients--Todas as origens', 300000))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadData = async (forceRefresh = false) => {
    if (!tenant) return
    const key = `crm-patients-${debouncedSearch}-${sourceFilter}`

    if (!forceRefresh) {
      const cached = getCachedData(key, 300000)
      if (cached) {
        if (debouncedSearch) {
          setSearchResults(cached.searchResults)
        } else {
          setPatientsByStage(cached.patientsByStage)
        }
        setLoading(false)
        setError(null)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      if (debouncedSearch) {
        const res = await patientService.fetchPatients(tenant.id, {
          search: debouncedSearch,
          source: sourceFilter,
        })
        setSearchResults(res)
        setCachedData(key, { searchResults: res, patientsByStage: {} })
      } else {
        const grouped = await patientService.fetchPatientsByStage(tenant.id)
        if (sourceFilter !== 'Todas as origens') {
          Object.keys(grouped).forEach(
            (k) => (grouped[k] = grouped[k].filter((p: any) => p.source === sourceFilter)),
          )
        }
        setPatientsByStage(grouped)
        setCachedData(key, { searchResults: [], patientsByStage: grouped })
      }
    } catch (err) {
      setError('Não foi possível carregar o CRM. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant, debouncedSearch, sourceFilter])

  const handleMoveOptimistic = (id: string, from: string, to: string) => {
    setPatientsByStage((prev) => {
      const p = prev[from].find((x) => x.id === id)
      if (!p) return prev
      return { ...prev, [from]: prev[from].filter((x) => x.id !== id), [to]: [p, ...prev[to]] }
    })
    invalidateCache('crm-', true)
  }

  const hasPatients = Object.values(patientsByStage).some((arr) => arr.length > 0)

  return (
    <ModuleGate moduleKey="crm">
      <div className="flex flex-col h-full p-6 pb-[100px] md:pb-6 page-transition-enter">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
            <div className="flex border rounded-md overflow-hidden">
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
          <div
            className="flex gap-4 overflow-hidden"
            role="status"
            aria-label="Carregando pacientes"
          >
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
            <Skeleton className="min-w-[240px] flex-1 h-[500px] rounded-md hidden sm:block" />
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center flex-1 py-20 text-center"
            role="alert"
          >
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => loadData(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : !hasPatients && sourceFilter === 'Todas as origens' && !debouncedSearch ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-[18px] font-semibold mt-4">Nenhum paciente cadastrado</h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
              Adicione seu primeiro paciente para começar a usar o CRM.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-6">
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar paciente
            </Button>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            patientsByStage={patientsByStage}
            onMoveOptimistic={handleMoveOptimistic}
            onMoveRevert={(id, f, t) => handleMoveOptimistic(id, f, t)}
          />
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
                  .map((p) => (
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
                            borderColor: STAGE_COLORS[p.pipeline_stage],
                            color: STAGE_COLORS[p.pipeline_stage],
                            backgroundColor: `${STAGE_COLORS[p.pipeline_stage].replace('hsl', 'hsla').replace(')', ', 0.1)')}`,
                          }}
                        >
                          {p.pipeline_stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{p.source}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {tenant && (
          <PatientDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            tenantId={tenant.id}
            initialStage={initialStage}
            onSuccess={() => {
              invalidateCache('crm-', true)
              loadData(true)
            }}
          />
        )}
      </div>
    </ModuleGate>
  )
}
