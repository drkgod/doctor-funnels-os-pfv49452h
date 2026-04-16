import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Loader2,
  Shield,
  Stethoscope,
  RotateCcw,
  Syringe,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { medicalRecordService } from '@/services/medicalRecordService'
import { ModuleGate } from '@/components/ModuleGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const RECORD_TYPES_CONFIG: Record<
  string,
  { label: string; color: string; icon: any; desc: string }
> = {
  consultation: {
    label: 'Consulta',
    color: 'bg-primary/10 text-primary',
    icon: Stethoscope,
    desc: 'Atendimento inicial',
  },
  return: {
    label: 'Retorno',
    color: 'bg-accent/10 text-accent-foreground',
    icon: RotateCcw,
    desc: 'Acompanhamento',
  },
  procedure: {
    label: 'Procedimento',
    color: 'bg-[#8b31ff]/10 text-[#8b31ff]',
    icon: Syringe,
    desc: 'Intervencao',
  },
  emergency: {
    label: 'Emergencia',
    color: 'bg-destructive/10 text-destructive',
    icon: Activity,
    desc: 'Pronto atendimento',
  },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot?: boolean; icon?: any }> = {
  in_progress: { label: 'Em andamento', color: 'bg-primary/12 text-primary', dot: true },
  review: { label: 'Em revisao', color: 'bg-[#eab308]/12 text-[#eab308]' },
  completed: { label: 'Concluido', color: 'bg-[#20b26c]/12 text-[#20b26c]' },
  signed: { label: 'Assinado', color: 'bg-[#8b31ff]/12 text-[#8b31ff]', icon: Shield },
}

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [tenantId, setTenantId] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)

  const [statusFilter, setStatusFilter] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [patientSearch, setPatientSearch] = useState('')
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  const [newRecordData, setNewRecordData] = useState({
    record_type: 'consultation',
    specialty: 'Geral',
    chief_complaint: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPatientSearch(patientSearch), 300)
    return () => clearTimeout(timer)
  }, [patientSearch])

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserProfile(data)
            setTenantId(data.tenant_id)
            setNewRecordData((prev) => ({ ...prev, specialty: data.specialty || 'Geral' }))
          }
        })
    }
  }, [user])

  useEffect(() => {
    if (tenantId && userProfile) {
      loadRecords()
    }
  }, [tenantId, page, debouncedSearch, statusFilter, dateFrom, dateTo, userProfile])

  useEffect(() => {
    if (debouncedPatientSearch && tenantId && !selectedPatient) {
      supabase
        .from('patients')
        .select('id, full_name, phone, pipeline_stage')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${debouncedPatientSearch}%`)
        .limit(10)
        .then(({ data }) => setPatientResults(data || []))
    } else {
      setPatientResults([])
    }
  }, [debouncedPatientSearch, tenantId, selectedPatient])

  useEffect(() => {
    const pId = searchParams.get('patient_id')
    if (pId && tenantId) {
      supabase
        .from('patients')
        .select('*')
        .eq('id', pId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedPatient(data)
            setIsNewDialogOpen(true)
            setStep(2)
          }
        })
    }
  }, [searchParams, tenantId])

  const loadRecords = async () => {
    setLoading(true)
    setError('')
    try {
      const filters: any = {
        status: statusFilter,
        patient_search: debouncedSearch,
        date_from: dateFrom,
        date_to: dateTo,
      }
      if (userProfile.role === 'doctor') {
        filters.doctor_id = userProfile.id
      }

      const res = await medicalRecordService.fetchRecords(tenantId, page, 20, filters)
      setRecords(res.records)
      setTotal(res.total)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar prontuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este prontuario?')) return
    try {
      await medicalRecordService.deleteRecord(id)
      toast({ title: 'Prontuario excluido', variant: 'default' })
      loadRecords()
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' })
    }
  }

  const handleCreate = async () => {
    if (!selectedPatient) {
      toast({ title: 'Selecione um paciente', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await medicalRecordService.createRecord(
        tenantId,
        selectedPatient.id,
        userProfile.id,
        newRecordData.record_type,
        newRecordData.specialty,
        newRecordData.chief_complaint,
      )
      toast({ title: 'Atendimento iniciado', variant: 'default' })
      navigate(`/prontuarios/${res.id}`)
    } catch (e: any) {
      toast({
        title: 'Erro ao iniciar atendimento',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const getInitials = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || 'PA'
  }

  return (
    <ModuleGate moduleKey="prontuarios">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-[24px] font-bold">Prontuarios</h1>
          <Button
            onClick={() => {
              setIsNewDialogOpen(true)
              setStep(1)
              setSelectedPatient(null)
            }}
            className="h-[42px] font-semibold gap-1.5"
          >
            <Plus className="h-4 w-4" /> Novo Atendimento
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 md:flex-none md:min-w-[280px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="h-[40px] pl-9 bg-input border-input rounded-md text-[14px] w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-[40px] min-w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="review">Em revisao</SelectItem>
              <SelectItem value="completed">Concluido</SelectItem>
              <SelectItem value="signed">Assinado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-3">
            <Input
              type="date"
              placeholder="De"
              className="h-[40px] w-[150px] text-[13px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="Ate"
              className="h-[40px] w-[150px] text-[13px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center pt-20 pb-10">
            <FileText className="mx-auto h-[56px] w-[56px] text-muted-foreground/30" />
            <h3 className="mt-5 text-[18px] font-semibold">Nenhum prontuario</h3>
            <p className="text-[14px] text-muted-foreground mt-2 max-w-[360px] mx-auto">
              Inicie seu primeiro atendimento para comecar a registrar prontuarios.
            </p>
            <Button onClick={() => setIsNewDialogOpen(true)} className="mt-6">
              Novo Atendimento
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-card border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Paciente
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Medico
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Queixa Principal
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                      Data
                    </TableHead>
                    <TableHead className="w-[80px] px-4 py-2.5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const typeConfig = RECORD_TYPES_CONFIG[r.record_type] || {
                      label: r.record_type,
                      color: 'bg-muted text-muted-foreground',
                    }
                    const statusConfig = STATUS_CONFIG[r.status] || {
                      label: r.status,
                      color: 'bg-muted text-muted-foreground',
                    }
                    return (
                      <TableRow
                        key={r.id}
                        className="hover:bg-secondary/30 cursor-pointer border-b"
                        onClick={() => navigate(`/prontuarios/${r.id}`)}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="font-semibold text-foreground">{r.patient_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.patient_phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-[13px]">Dr(a). {r.doctor_name}</div>
                          <div className="text-[11px] text-muted-foreground italic">
                            {r.doctor_specialty || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span
                            className={cn(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                              typeConfig.color,
                            )}
                          >
                            {typeConfig.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] max-w-[200px] truncate">
                          {r.chief_complaint || '-'}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                              statusConfig.color,
                            )}
                          >
                            {statusConfig.dot && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                            {statusConfig.icon && <statusConfig.icon className="h-3 w-3" />}
                            {statusConfig.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px]">
                          {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/prontuarios/${r.id}`)}>
                                Abrir
                              </DropdownMenuItem>
                              {r.status === 'in_progress' && (
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => handleDelete(r.id)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-3">
              {records.map((r) => {
                const typeConfig = RECORD_TYPES_CONFIG[r.record_type] || {
                  label: r.record_type,
                  color: 'bg-muted text-muted-foreground',
                }
                const statusConfig = STATUS_CONFIG[r.status] || {
                  label: r.status,
                  color: 'bg-muted text-muted-foreground',
                }
                return (
                  <div
                    key={r.id}
                    className="p-4 bg-card border rounded-md mb-3"
                    onClick={() => navigate(`/prontuarios/${r.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-foreground">{r.patient_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.patient_phone || '-'}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                          statusConfig.color,
                        )}
                      >
                        {statusConfig.dot && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                        {statusConfig.icon && <statusConfig.icon className="h-3 w-3" />}
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span
                        className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          typeConfig.color,
                        )}
                      >
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[13px]">Dr(a). {r.doctor_name}</div>
                        <div className="text-[11px] text-muted-foreground italic">
                          {r.doctor_specialty || '-'}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogContent className="max-w-[560px] p-7">
            <DialogHeader>
              <DialogTitle className="text-[18px] font-bold">Iniciar Novo Atendimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-6">
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold',
                    step >= 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  1
                </div>
                <div className={cn('h-[2px] flex-1', step >= 2 ? 'bg-primary' : 'bg-secondary')} />
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold',
                    step >= 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  2
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-[14px] h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar paciente pelo nome..."
                      className="h-[44px] pl-10 text-[15px] border-2"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    {patientResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-50 max-h-[240px] overflow-y-auto">
                        {patientResults.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 px-4 hover:bg-secondary/50 cursor-pointer flex items-center gap-3"
                            onClick={() => {
                              setSelectedPatient(p)
                              setStep(2)
                            }}
                          >
                            <div className="h-[36px] w-[36px] rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                              {getInitials(p.full_name)}
                            </div>
                            <div>
                              <div className="text-[14px] font-medium">{p.full_name}</div>
                              <div className="text-[12px] text-muted-foreground">
                                {p.phone || '-'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  {selectedPatient && (
                    <div className="p-3.5 px-4 bg-secondary/30 border rounded-md flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-[40px] w-[40px] rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                          {getInitials(selectedPatient.full_name)}
                        </div>
                        <div>
                          <div className="text-[15px] font-semibold">
                            {selectedPatient.full_name}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            {selectedPatient.phone || '-'}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="text-[12px] text-primary h-8"
                        onClick={() => setStep(1)}
                      >
                        Trocar
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(RECORD_TYPES_CONFIG).map(([key, config]) => {
                      const isSelected = newRecordData.record_type === key
                      return (
                        <div
                          key={key}
                          onClick={() =>
                            setNewRecordData((prev) => ({ ...prev, record_type: key }))
                          }
                          className={cn(
                            'p-3.5 px-4 border rounded-md text-center cursor-pointer transition-colors',
                            isSelected
                              ? 'border-2 border-primary bg-primary/5'
                              : 'border-border hover:bg-secondary/20',
                          )}
                        >
                          <config.icon
                            className={cn(
                              'h-5 w-5 mx-auto mb-2',
                              isSelected ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                          <div className="text-[13px] font-medium">{config.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {config.desc}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-medium">Especialidade</label>
                    <Select
                      value={newRecordData.specialty}
                      onValueChange={(v) => setNewRecordData((prev) => ({ ...prev, specialty: v }))}
                    >
                      <SelectTrigger className="h-[42px]">
                        <SelectValue />
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
                      className="min-h-[80px] resize-y text-[14px]"
                      placeholder="Descreva brevemente o motivo da consulta..."
                      value={newRecordData.chief_complaint}
                      onChange={(e) =>
                        setNewRecordData((prev) => ({ ...prev, chief_complaint: e.target.value }))
                      }
                    />
                  </div>

                  <Button
                    className="w-full h-[42px]"
                    onClick={handleCreate}
                    disabled={!selectedPatient || creating}
                  >
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Iniciar Atendimento
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGate>
  )
}
