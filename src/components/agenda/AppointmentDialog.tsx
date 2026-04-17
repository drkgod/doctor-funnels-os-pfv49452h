import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { AlertTriangle, X } from 'lucide-react'

interface AppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: Date | null
  initialTime: string | null // HH:mm
  initialPatientId?: string | null
  tenantId: string
  onSave: (data: any) => Promise<void>
  appointment?: any
}

export function AppointmentDialog({
  open,
  onOpenChange,
  initialDate,
  initialTime,
  initialPatientId,
  tenantId,
  onSave,
  appointment,
}: AppointmentDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('09:30')
  const [type, setType] = useState('consultation')
  const [status, setStatus] = useState('pending')
  const [notes, setNotes] = useState('')
  const [conflictError, setConflictError] = useState('')

  const fetchPatients = async (q: string) => {
    try {
      let query = supabase
        .from('patients')
        .select('id, full_name, phone')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      }
      const { data } = await query.order('updated_at', { ascending: false }).limit(10)
      setPatients(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (open) {
      setConflictError('')
      if (appointment) {
        setPatientId(appointment.patient_id)
        setDate(format(new Date(appointment.datetime_start), 'yyyy-MM-dd'))
        setTimeStart(format(new Date(appointment.datetime_start), 'HH:mm'))
        setTimeEnd(format(new Date(appointment.datetime_end), 'HH:mm'))
        setType(appointment.type)
        setStatus(appointment.status)
        setNotes(appointment.notes || '')

        // Ensure patient is in the list
        supabase
          .from('patients')
          .select('id, full_name, phone')
          .eq('id', appointment.patient_id)
          .single()
          .then(({ data }) => {
            if (data)
              setPatients((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]))
          })
      } else {
        setPatientId(initialPatientId || '')
        setDate(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
        setTimeStart(initialTime || '09:00')
        if (initialTime) {
          const [h, m] = initialTime.split(':').map(Number)
          const endD = new Date()
          endD.setHours(h, m + 30, 0)
          setTimeEnd(format(endD, 'HH:mm'))
        } else {
          setTimeEnd('09:30')
        }
        setType('consultation')
        setStatus('pending')
        setNotes('')

        if (initialPatientId) {
          supabase
            .from('patients')
            .select('id, full_name, phone')
            .eq('id', initialPatientId)
            .single()
            .then(({ data }) => {
              if (data)
                setPatients((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]))
            })
        }
      }
      fetchPatients('')
    }
  }, [open, initialDate, initialTime, initialPatientId, appointment, tenantId])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open && !patientId) fetchPatients(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, open, patientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setConflictError('')
    if (!patientId) {
      toast({ title: 'Erro', description: 'Selecione um paciente', variant: 'destructive' })
      return
    }

    const startIso = `${date}T${timeStart}:00.000Z`
    const endIso = `${date}T${timeEnd}:00.000Z`

    if (new Date(endIso) <= new Date(startIso)) {
      setConflictError('Horário final deve ser após o início')
      return
    }

    setLoading(true)
    try {
      await onSave({
        patient_id: patientId,
        datetime_start: startIso,
        datetime_end: endIso,
        type,
        status,
        notes,
      })
      onOpenChange(false)
    } catch (e: any) {
      const msg = e.message || ''
      if (msg.toLowerCase().includes('conflito') || msg.toLowerCase().includes('já existe')) {
        setConflictError(msg)
      } else {
        toast({ title: 'Erro', description: msg || 'Erro ao salvar', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }

  const timeOpts = []
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15)
      timeOpts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }

  const selectedPatientName = patients.find((p) => p.id === patientId)?.full_name || 'Paciente'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-6">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            {appointment ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1.5 relative">
            <Label className="text-[13px] font-medium text-muted-foreground">Paciente</Label>
            {!patientId ? (
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="h-10 text-[14px]"
                disabled={!!appointment}
              />
            ) : (
              <div className="flex items-center justify-between border border-border rounded-md h-10 px-3 bg-secondary/20">
                <span className="text-[14px] font-medium">{selectedPatientName}</span>
                {!appointment && (
                  <button
                    type="button"
                    onClick={() => {
                      setPatientId('')
                      setSearch('')
                    }}
                    className="p-1 hover:bg-muted rounded"
                    aria-label="Limpar paciente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {showDropdown && !patientId && !appointment && (
              <div className="absolute top-[64px] left-0 w-full max-h-[320px] overflow-y-auto bg-card border border-border rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50">
                {patients.length > 0 ? (
                  patients.map((p) => (
                    <div
                      key={p.id}
                      className="p-[10px_16px] flex items-center gap-3 cursor-pointer hover:bg-secondary"
                      onClick={() => {
                        setPatientId(p.id)
                        setShowDropdown(false)
                      }}
                    >
                      <span className="text-[14px] font-medium">{p.full_name}</span>
                      <span className="text-[12px] text-muted-foreground">{p.phone}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum paciente encontrado.{' '}
                    <Link to="/crm?action=new" className="text-primary hover:underline">
                      Crie um primeiro.
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-muted-foreground">Data e Horário</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 text-[14px] flex-1"
              />

              <div className="flex items-center gap-2">
                <Select value={timeStart} onValueChange={setTimeStart} aria-label="Horário inicial">
                  {' '}
                  <SelectTrigger className="h-10 text-[14px] font-mono w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {timeOpts.map((t) => (
                      <SelectItem key={`start-${t}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-[13px] text-muted-foreground">até</span>

                <Select value={timeEnd} onValueChange={setTimeEnd} aria-label="Horário final">
                  <SelectTrigger className="h-10 text-[14px] font-mono w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {timeOpts.map((t) => (
                      <SelectItem key={`end-${t}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {conflictError && (
            <div className="bg-destructive/10 border border-destructive p-[8px_12px] rounded-md flex items-center gap-2 text-[13px] text-destructive">
              <AlertTriangle className="w-[14px] h-[14px] shrink-0" />
              {conflictError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta</SelectItem>
                  <SelectItem value="return">Retorno</SelectItem>
                  <SelectItem value="procedure">Procedimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-muted-foreground">Observações</Label>
            <Textarea
              placeholder="Anotações sobre o agendamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] rounded-md"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-[44px] font-semibold mt-2">
            {loading ? 'Salvando...' : 'Agendar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
