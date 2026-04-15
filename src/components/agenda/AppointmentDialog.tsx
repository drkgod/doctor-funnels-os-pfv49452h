import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('09:30')
  const [type, setType] = useState('consultation')
  const [status, setStatus] = useState('pending')
  const [notes, setNotes] = useState('')

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
      if (open) fetchPatients(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId) {
      toast({ title: 'Erro', description: 'Selecione um paciente', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const startIso = `${date}T${timeStart}:00.000Z`
      const endIso = `${date}T${timeEnd}:00.000Z`
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
      toast({ title: 'Erro', description: e.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const timeOpts = []
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15)
      timeOpts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{appointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={!!appointment}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione ou busque um paciente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Buscar paciente..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {patients.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum paciente encontrado.{' '}
                      <Link to="/crm?action=new" className="text-primary hover:underline">
                        Crie um primeiro.
                      </Link>
                    </div>
                  ) : (
                    patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} {p.phone ? `(${p.phone})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consulta</SelectItem>
                    <SelectItem value="return">Retorno</SelectItem>
                    <SelectItem value="procedure">Procedimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário início *</Label>
                <Select value={timeStart} onValueChange={setTimeStart}>
                  <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label>Horário fim *</Label>
                <Select value={timeEnd} onValueChange={setTimeEnd}>
                  <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Anotações sobre o agendamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Agendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
