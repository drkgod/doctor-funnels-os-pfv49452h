import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  FileText,
  ChevronDown,
  Check,
  Loader2,
  User,
  Stethoscope,
  ArrowLeftRight,
  Syringe,
  AlertCircle,
  Shield,
  MoreVertical,
} from 'lucide-react'
import { medicalRecordService } from '@/services/medicalRecordService'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ModuleGate } from '@/components/ModuleGate'
import { useDataCache } from '@/contexts/DataCacheContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const SPECIALTIES = [
  'Geral',
  'Dermatologia',
  'Psiquiatria',
  'Cardiologia',
  'Endocrinologia',
  'Ortopedia',
  'Ginecologia e Obstetricia',
  'Oftalmologia',
  'Pediatria',
  'Neurologia',
  'Urologia',
  'Otorrinolaringologia',
  'Gastroenterologia',
  'Pneumologia',
]

export default function Prontuarios() {
  const { user, profile, tenantId: authTenantId } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPatientId = searchParams.get('patient_id')

  const tenantId = authTenantId || ''
  const initialSpecialty = profile?.specialty || 'Geral'

  const { getCachedData, setCachedData, invalidateCache } = useDataCache()

  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [page, setPage] = useState(1)

  const getCacheKey = (searchTerm: string, pageNum: number) =>
    `prontuarios-${searchTerm}-${filterStatus}-${filterDateFrom}-${filterDateTo}-${pageNum}`

  const [records, setRecords] = useState<any[]>(() => {
    const cached = getCachedData('prontuarios--Todos---1', 300000)
    return cached?.records || []
  })
  const [total, setTotal] = useState(() => {
    const cached = getCachedData('prontuarios--Todos---1', 300000)
    return cached?.total || 0
  })
  const [totalPages, setTotalPages] = useState(() => {
    const cached = getCachedData('prontuarios--Todos---1', 300000)
    return cached?.totalPages || 1
  })
  const [loading, setLoading] = useState(!getCachedData('prontuarios--Todos---1', 300000))
  const [error, setError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [patients, setPatients] = useState<any[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  const [recordType, setRecordType] = useState('consultation')
  const [specialty, setSpecialty] = useState(initialSpecialty)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const searchRef = useRef<NodeJS.Timeout>()
  const listSearchRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (tenantId && tenantId.trim().length > 0) {
      loadRecords(filterSearch, false)
    }
  }, [tenantId, page, filterStatus, filterDateFrom, filterDateTo])

  useEffect(() => {
    if (initialPatientId && tenantId && dialogOpen) {
      loadInitialPatient(initialPatientId)
    }
  }, [initialPatientId, tenantId, dialogOpen])

  const loadRecords = async (searchTerm = filterSearch, forceRefresh = false) => {
    if (!tenantId || tenantId.trim().length === 0) return

    const key = getCacheKey(searchTerm, page)

    if (!forceRefresh) {
      const cached = getCachedData(key, 300000)
      if (cached) {
        setRecords(cached.records)
        setTotal(cached.total)
        setTotalPages(cached.totalPages)
        setLoading(false)
        setError('')
        return
      }
    }

    try {
      setLoading(true)
      setError('')
      const filters: any = { status: filterStatus }
      if (searchTerm) filters.patient_search = searchTerm
      if (filterDateFrom) filters.date_from = filterDateFrom
      if (filterDateTo) filters.date_to = filterDateTo
      if (profile?.role === 'doctor') filters.doctor_id = profile.id

      const res = await medicalRecordService.fetchRecords(tenantId, page, 20, filters)
      setRecords(res.records)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setCachedData(key, { records: res.records, total: res.total, totalPages: res.total_pages })
    } catch (e: any) {
      setError('Erro ao carregar prontuários.')
    } finally {
      setLoading(false)
    }
  }

  const handleListSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFilterSearch(val)
    if (listSearchRef.current) clearTimeout(listSearchRef.current)
    listSearchRef.current = setTimeout(() => {
      setPage(1)
      loadRecords(val, false)
    }, 300)
  }

  const handleSearchPatients = async (query: string) => {
    if (!tenantId || tenantId.trim().length === 0) {
      setPatients([])
      return
    }
    if (!query) {
      setPatients([])
      return
    }
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, phone, pipeline_stage')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${query}%`)
      .is('deleted_at', null)
      .limit(10)
    setPatients(data || [])
  }

  const onPatientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPatientSearch(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      handleSearchPatients(val)
    }, 300)
  }

  const loadInitialPatient = async (id: string) => {
    const { data } = await supabase
      .from('patients')
      .select('id, full_name, phone, pipeline_stage')
      .eq('id', id)
      .single()
    if (data) {
      setSelectedPatient(data)
      setStep(2)
      searchParams.delete('patient_id')
      setSearchParams(searchParams)
    }
  }

  const handleCreateRecord = async () => {
    if (!selectedPatient) return toast({ title: 'Selecione um paciente.', variant: 'destructive' })
    try {
      setIsCreating(true)
      const res = await medicalRecordService.createRecord(
        tenantId,
        selectedPatient.id,
        profile.id,
        recordType,
        specialty,
        chiefComplaint,
      )
      toast({ title: 'Atendimento iniciado' })
      invalidateCache('prontuarios-', true)
      navigate(`/prontuarios/${res.id}`)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este prontuário em andamento?')) return
    try {
      await medicalRecordService.deleteRecord(id)
      toast({ title: 'Prontuário excluído' })
      invalidateCache('prontuarios-', true)
      loadRecords(filterSearch, true)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-primary/12 text-primary'
      case 'review':
        return 'bg-[#eab308]/12 text-[#eab308]'
      case 'completed':
        return 'bg-[#20b26c]/12 text-[#20b26c]'
      case 'signed':
        return 'bg-[#8b31ff]/12 text-[#8b31ff]'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusName = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'Em andamento'
      case 'review':
        return 'Em revisão'
      case 'completed':
        return 'Concluído'
      case 'signed':
        return 'Assinado'
      default:
        return status
    }
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'bg-primary/10 text-primary'
      case 'return':
        return 'bg-accent/10 text-accent-foreground'
      case 'procedure':
        return 'bg-[#8b31ff]/10 text-[#8b31ff]'
      case 'emergency':
        return 'bg-destructive/10 text-destructive'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'Consulta'
      case 'return':
        return 'Retorno'
      case 'procedure':
        return 'Procedimento'
      case 'emergency':
        return 'Emergência'
      default:
        return type
    }
  }

  return (
    <ModuleGate moduleKey="prontuarios">
      <div className="p-6 max-w-7xl mx-auto pb-[100px] md:pb-6 page-transition-enter">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-[24px] font-bold">Prontuarios</h1>
          <Button onClick={() => setDialogOpen(true)} className="h-[42px] font-semibold gap-1.5">
            <Plus className="h-4 w-4" /> Novo Atendimento
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative w-full md:w-auto flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="h-10 min-w-[280px] w-full bg-input border-border pl-9 text-[14px]"
              onChange={handleListSearch}
              value={filterSearch}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-10 min-w-[160px] md:flex-none">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="review">Em revisão</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="signed">Assinado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-10 w-[150px] text-[13px]"
            title="De"
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-10 w-[150px] text-[13px]"
            title="Até"
          />
        </div>

        {loading ? (
          <div className="space-y-4" role="status" aria-label="Carregando prontuários">
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-muted-foreground" role="alert">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div className="text-[18px] font-semibold text-foreground/80 mb-2">{error}</div>
            <Button variant="outline" onClick={() => loadRecords(filterSearch, true)}>
              Tentar Novamente
            </Button>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-14 w-14 mx-auto mb-5 text-muted-foreground/30" />
            <h3 className="text-[18px] font-semibold mb-2">Nenhum prontuário</h3>
            <p className="text-[14px] text-muted-foreground max-w-[360px] mx-auto mb-6">
              Inicie seu primeiro atendimento para começar a registrar prontuários.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="h-10 font-semibold gap-1.5">
              <Plus className="h-4 w-4" /> Novo Atendimento
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-card border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Paciente
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Médico
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Queixa Principal
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto">
                      Data
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-4 h-auto w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow
                      key={record.id}
                      className="py-3 text-[13px] border-b border-border hover:bg-secondary/30 cursor-pointer"
                      onClick={() => navigate(`/prontuarios/${record.id}`)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="font-semibold text-foreground">{record.patient_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {record.patient_phone || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="text-[13px]">Dr(a). {record.doctor_name}</div>
                        <div className="text-[11px] text-muted-foreground italic mt-0.5">
                          {record.doctor_specialty}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                            getTypeStyle(record.record_type),
                          )}
                        >
                          {getTypeName(record.record_type)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 max-w-[200px] truncate">
                        {record.chief_complaint || (
                          <span className="text-muted-foreground italic">Não informada</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                            getStatusStyle(record.status),
                          )}
                        >
                          {record.status === 'in_progress' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          {record.status === 'signed' && <Shield className="h-3 w-3" />}
                          {getStatusName(record.status)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {format(new Date(record.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              aria-label="Opções"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/prontuarios/${record.id}`)}>
                              Abrir
                            </DropdownMenuItem>
                            {record.status === 'in_progress' && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(record.id)}
                              >
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-card border rounded-md"
                  onClick={() => navigate(`/prontuarios/${record.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-[14px]">{record.patient_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {record.patient_phone || '-'}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                        getStatusStyle(record.status),
                      )}
                    >
                      {record.status === 'in_progress' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                      {record.status === 'signed' && <Shield className="h-3 w-3" />}
                      {getStatusName(record.status)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="text-[13px]">Dr(a). {record.doctor_name}</div>
                      <div className="text-[11px] text-muted-foreground italic">
                        {record.doctor_specialty}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        getTypeStyle(record.record_type),
                      )}
                    >
                      {getTypeName(record.record_type)}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-2 border-t pt-2">
                    {format(new Date(record.created_at), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) {
            setStep(1)
            setSelectedPatient(null)
            setPatientSearch('')
            setPatients([])
            setChiefComplaint('')
          }
        }}
      >
        <DialogContent className="max-w-[560px] p-7">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">Iniciar Novo Atendimento</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center mb-6 mt-2">
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-[13px] font-bold transition-colors',
                step >= 1
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              1
            </div>
            <div className="h-[2px] w-12 bg-secondary mx-2" />
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-[13px] font-bold transition-colors',
                step >= 2
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              2
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4 min-h-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente pelo nome..."
                  className="h-11 text-[15px] border-2 pl-10"
                  value={patientSearch}
                  onChange={onPatientSearchChange}
                  autoFocus
                />
              </div>

              {patients.length > 0 && (
                <div className="max-h-[240px] overflow-y-auto bg-card border rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08)] mt-2">
                  {patients.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 px-4 flex items-center gap-3 hover:bg-secondary/50 cursor-pointer border-b last:border-0"
                      onClick={() => {
                        setSelectedPatient(p)
                        setStep(2)
                      }}
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-bold shrink-0">
                        {p.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium">{p.full_name}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {p.phone || 'Sem telefone'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {patientSearch && patients.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-[14px]">
                  Nenhum paciente encontrado.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {selectedPatient && (
                <div className="p-3.5 px-4 bg-secondary/30 border border-border rounded-md flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[14px] font-bold">
                      {selectedPatient.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold">{selectedPatient.full_name}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {selectedPatient.phone || 'Sem telefone'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12px] text-primary h-8"
                    onClick={() => setStep(1)}
                  >
                    Trocar
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'consultation',
                    label: 'Consulta',
                    desc: 'Atendimento inicial',
                    icon: Stethoscope,
                  },
                  {
                    id: 'return',
                    label: 'Retorno',
                    desc: 'Avaliação de exames',
                    icon: ArrowLeftRight,
                  },
                  {
                    id: 'procedure',
                    label: 'Procedimento',
                    desc: 'Intervenção clínica',
                    icon: Syringe,
                  },
                  {
                    id: 'emergency',
                    label: 'Emergência',
                    desc: 'Atendimento urgente',
                    icon: AlertCircle,
                  },
                ].map((type) => (
                  <div
                    key={type.id}
                    className={cn(
                      'p-3.5 px-4 border rounded-md text-center cursor-pointer transition-colors',
                      recordType === type.id
                        ? 'border-2 border-primary bg-primary/5'
                        : 'border-border hover:bg-secondary/50',
                    )}
                    onClick={() => setRecordType(type.id)}
                  >
                    <type.icon
                      className={cn(
                        'h-5 w-5 mx-auto mb-2',
                        recordType === type.id ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <div className="text-[13px] font-medium">{type.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{type.desc}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium">Especialidade</label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-medium">Queixa Principal (Opcional)</label>
                <Textarea
                  placeholder="Descreva brevemente o motivo da consulta..."
                  className="min-h-[80px] text-[14px] resize-none"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleCreateRecord} className="h-10 px-8" disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Iniciar Atendimento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleGate>
  )
}
