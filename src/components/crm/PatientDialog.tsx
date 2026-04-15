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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { patientService, type Patient } from '@/services/patientService'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  tenantId: string
  initialStage?: string
  patient?: any
  onSuccess: (p: Patient) => void
}

export function maskPhone(v: string) {
  let r = v.replace(/\D/g, '')
  if (r.length > 11) r = r.slice(0, 11)
  if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3')
  if (r.length > 5) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
  if (r.length > 2) return r.replace(/^(\d{2})(\d{0,5})/, '($1) $2')
  return r
}

export function maskCpf(v: string) {
  let r = v.replace(/\D/g, '')
  if (r.length > 11) r = r.slice(0, 11)
  return r
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
    .replace(/(\d{3})(\d{1,3})/, '$1.$2')
}

export function PatientDialog({
  open,
  onOpenChange,
  tenantId,
  initialStage,
  patient,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [formData, setFormData] = useState<Partial<Patient>>({
    full_name: '',
    phone: '',
    email: '',
    cpf: '',
    date_of_birth: '',
    gender: '',
    address: '',
    source: 'Manual',
    pipeline_stage: initialStage || 'lead',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      setTags(patient?.tags || [])
      setFormData({
        full_name: patient?.full_name || '',
        phone: patient?.phone || '',
        email: patient?.email || '',
        cpf: patient?.cpf || '',
        date_of_birth: patient?.date_of_birth || '',
        gender: patient?.gender || '',
        address: patient?.address || '',
        source: patient?.source || 'Manual',
        pipeline_stage: patient?.pipeline_stage || initialStage || 'lead',
        notes: patient?.notes || '',
      })
    }
  }, [open, patient, initialStage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.full_name)
      return toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' })
    try {
      setLoading(true)
      const dataToSave = { ...formData, tags }
      let saved
      if (patient) saved = await patientService.updatePatient(patient.id, dataToSave)
      else saved = await patientService.createPatient(tenantId, dataToSave)
      toast({ title: patient ? 'Paciente atualizado' : 'Paciente criado com sucesso' })
      onSuccess(saved)
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = e.currentTarget.value.trim()
      if (val && tags.length < 10 && !tags.includes(val)) {
        setTags([...tags, val])
        e.currentTarget.value = ''
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            {patient ? 'Editar Paciente' : 'Novo Paciente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Nome completo *</Label>
            <Input
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Nome do paciente"
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Telefone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
              placeholder="(11) 98765-4321"
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@paciente.com"
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">CPF</Label>
            <Input
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
              placeholder="123.456.789-00"
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">
              Data de nascimento
            </Label>
            <Input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Gênero</Label>
            <Select
              value={formData.gender}
              onValueChange={(v) => setFormData({ ...formData, gender: v })}
            >
              <SelectTrigger className="h-10 rounded-md">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Origem</Label>
            <Select
              value={formData.source}
              onValueChange={(v) => setFormData({ ...formData, source: v })}
            >
              <SelectTrigger className="h-10 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Formulario">Formulário</SelectItem>
                <SelectItem value="Telefone">Telefone</SelectItem>
                <SelectItem value="Indicacao">Indicação</SelectItem>
                <SelectItem value="Doctoralia">Doctoralia</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Endereço</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Endereço completo"
              className="h-10 text-[14px] rounded-md"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Estágio inicial</Label>
            <Select
              value={formData.pipeline_stage}
              onValueChange={(v) => setFormData({ ...formData, pipeline_stage: v })}
              disabled={!!patient}
            >
              <SelectTrigger className="h-10 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="contact">Contato</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="return">Retorno</SelectItem>
                <SelectItem value="procedure">Procedimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">
              Tags (pressione Enter)
            </Label>
            <div className="flex flex-wrap gap-1.5 border border-border rounded-md p-2 min-h-[40px] bg-background focus-within:ring-1 focus-within:ring-ring">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[12px] px-2 py-0.5 rounded-[6px] bg-accent/15 text-accent flex items-center gap-1"
                >
                  {t}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-destructive transition-colors"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                  />
                </span>
              ))}
              <input
                type="text"
                onKeyDown={handleAddTag}
                placeholder="Adicionar tag..."
                className="flex-1 bg-transparent outline-none border-none min-w-[100px] text-[14px] text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label className="text-[13px] font-medium text-muted-foreground">Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              maxLength={500}
              className="min-h-[80px] text-[14px] rounded-md"
            />
          </div>
          <DialogFooter className="col-span-2 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="font-semibold px-4">
              {loading ? 'Salvando...' : patient ? 'Salvar' : 'Criar Paciente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
