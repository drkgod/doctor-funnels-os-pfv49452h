import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, MoreHorizontal, Loader2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'

const RECORD_TYPES: Record<string, string> = {
  consultation: 'Consulta',
  return: 'Retorno',
  procedure: 'Procedimento',
  emergency: 'Emergencia',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'Em andamento', color: 'bg-primary' },
  review: { label: 'Em revisao', color: 'bg-amber-500' },
  completed: { label: 'Concluido', color: 'bg-green-500' },
  signed: { label: 'Assinado', color: 'bg-purple-500' },
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

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
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
  }, [tenantId, page, debouncedSearch, statusFilter, userProfile])

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

  return (
    <ModuleGate moduleKey="prontuarios">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Prontuarios</h1>
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Atendimento
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
        </div>

        {error && <div className="text-red-500">{error}</div>}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-lg border">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum prontuario</h3>
            <p className="text-muted-foreground mb-4">
              Inicie seu primeiro atendimento para comecar a registrar prontuarios.
            </p>
            <Button onClick={() => setIsNewDialogOpen(true)}>Novo Atendimento</Button>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Medico</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Queixa Principal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/prontuarios/${r.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{r.patient_name}</div>
                      <div className="text-xs text-muted-foreground">{r.patient_phone || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">Dr(a). {r.doctor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.doctor_specialty || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{RECORD_TYPES[r.record_type] || r.record_type}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.chief_complaint || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_CONFIG[r.status]?.color || 'bg-gray-500'}
                        variant="secondary"
                      >
                        {STATUS_CONFIG[r.status]?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Iniciar Novo Atendimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {!selectedPatient ? (
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente pelo nome..."
                    className="pl-9"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                      {patientResults.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                          onClick={() => setSelectedPatient(p)}
                        >
                          <div>
                            <div className="font-medium">{p.full_name}</div>
                            <div className="text-xs text-muted-foreground">{p.phone}</div>
                          </div>
                          <Badge variant="outline">{p.pipeline_stage}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 border rounded-md flex justify-between items-center bg-muted/20">
                  <div>
                    <div className="font-medium">{selectedPatient.full_name}</div>
                    <div className="text-xs text-muted-foreground">{selectedPatient.phone}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedPatient(null)}>
                    Trocar
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={newRecordData.record_type}
                    onValueChange={(v) => setNewRecordData((prev) => ({ ...prev, record_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consulta</SelectItem>
                      <SelectItem value="return">Retorno</SelectItem>
                      <SelectItem value="procedure">Procedimento</SelectItem>
                      <SelectItem value="emergency">Emergencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Especialidade</label>
                  <Select
                    value={newRecordData.specialty}
                    onValueChange={(v) => setNewRecordData((prev) => ({ ...prev, specialty: v }))}
                  >
                    <SelectTrigger>
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Queixa Principal (Opcional)</label>
                <Textarea
                  placeholder="Descreva brevemente o motivo da consulta..."
                  value={newRecordData.chief_complaint}
                  onChange={(e) =>
                    setNewRecordData((prev) => ({ ...prev, chief_complaint: e.target.value }))
                  }
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!selectedPatient || creating}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Atendimento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGate>
  )
}
