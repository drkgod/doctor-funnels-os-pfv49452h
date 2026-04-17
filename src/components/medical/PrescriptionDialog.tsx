import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Pill, ShieldAlert, Bug, Plus, Trash2, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { prescriptionService } from '@/services/prescriptionService'
import { aiPrescriptionService } from '@/services/aiPrescriptionService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'

export function PrescriptionDialog({
  recordId,
  tenantId,
  doctorId,
  patientId,
  patientName,
  specialty,
  assessmentText,
  existingPrescription,
  onSaved,
  open,
  onOpenChange,
}: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [type, setType] = useState('simple')
  const [medications, setMedications] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [aiNotes, setAiNotes] = useState('')
  const [aiDisclaimer, setAiDisclaimer] = useState('')
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    if (open) {
      setAiNotes('')
      setAiDisclaimer('')
      if (existingPrescription) {
        setType(existingPrescription.prescription_type || 'simple')
        setMedications(
          existingPrescription.medications?.map((m: any) => ({
            ...m,
            expanded: false,
            ai_suggested: false,
          })) || [],
        )
        setNotes(existingPrescription.notes || existingPrescription.general_instructions || '')
        setValidUntil(existingPrescription.valid_until ? existingPrescription.valid_until : '')
      } else {
        setType('simple')
        setMedications([
          {
            name: '',
            dosage: '',
            frequency: '',
            duration: '',
            route: 'Via oral',
            instructions: '',
            quantity: '',
            expanded: true,
            ai_suggested: false,
          },
        ])
        setNotes('')
        setValidUntil(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
      }
    }
  }, [open, existingPrescription])

  useEffect(() => {
    if (!existingPrescription && open) {
      const days = type === 'special_control' ? 60 : type === 'antimicrobial' ? 10 : 30
      setValidUntil(format(addDays(new Date(), days), 'yyyy-MM-dd'))
    }
  }, [type])

  const handleAddMedication = () => {
    setMedications([
      ...medications,
      {
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        route: 'Via oral',
        instructions: '',
        quantity: '',
        expanded: true,
        ai_suggested: false,
      },
    ])
  }

  const handleRemoveMedication = (index: number) => {
    const newMeds = [...medications]
    newMeds.splice(index, 1)
    setMedications(newMeds)
  }

  const updateMedication = (index: number, field: string, value: string | boolean) => {
    const newMeds = [...medications]
    newMeds[index] = { ...newMeds[index], [field]: value }
    if (field !== 'expanded') {
      newMeds[index].ai_suggested = false
    }
    setMedications(newMeds)
  }

  const handleSuggestWithAI = async () => {
    if (!assessmentText?.trim()) {
      toast({
        title: 'Preencha a Avaliação primeiro',
        description: 'A IA precisa do raciocínio clínico (Avaliação) para sugerir a prescrição.',
        variant: 'destructive',
      })
      return
    }
    setAiLoading(true)
    try {
      const patientContext = medications
        .map((m) => m.name)
        .filter(Boolean)
        .join(', ')

      const data = await aiPrescriptionService.suggestPrescription(
        tenantId,
        assessmentText,
        specialty || 'Geral',
        patientContext ? `Medicamentos atuais na lista: ${patientContext}` : undefined,
        'prescription',
      )

      if (data.medications && data.medications.length > 0) {
        const newMeds = data.medications.map((m: any) => ({
          name: m.name || '',
          dosage: m.dosage || '',
          frequency: m.frequency || '',
          duration: m.duration || '',
          route: m.route || 'Via oral',
          instructions: m.instructions || '',
          quantity: m.quantity || '',
          expanded: true,
          ai_suggested: true,
        }))
        setMedications((prev) => {
          const filtered = prev.filter((m) => m.name.trim() !== '' || m.dosage.trim() !== '')
          return [...filtered, ...newMeds]
        })
        toast({ title: `IA sugeriu ${newMeds.length} medicamentos. Revise antes de salvar.` })
      }
      if (data.notes) setAiNotes(data.notes)
      if (data.disclaimer) setAiDisclaimer(data.disclaimer)
    } catch (error: any) {
      toast({
        title: 'Erro ao sugerir prescrição',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (medications.length === 0) {
      toast({ title: 'Adicione pelo menos um medicamento', variant: 'destructive' })
      return
    }
    const hasEmptyName = medications.some((m) => !m.name.trim())
    if (hasEmptyName) {
      toast({ title: 'Preencha o nome de todos os medicamentos', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const cleanMeds = medications.map((m) => {
        const { expanded, ai_suggested, ...rest } = m
        return rest
      })

      const data = {
        type,
        medications: cleanMeds,
        notes,
        valid_until: validUntil || null,
      }

      if (existingPrescription) {
        await prescriptionService.updatePrescription(existingPrescription.id, data)
        toast({ title: 'Receita atualizada com sucesso' })
      } else {
        await prescriptionService.createPrescription(recordId, tenantId, doctorId, patientId, data)
        toast({ title: 'Receita criada com sucesso' })
      }

      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'Erro ao salvar receita', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-w-[100vw] w-full p-0 rounded-none sm:rounded-[var(--radius)] overflow-hidden flex flex-col min-h-[100dvh] sm:min-h-0 sm:max-h-[90vh] border-0 sm:border">
        <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
          <DialogTitle className="text-[18px] font-bold flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            {existingPrescription ? 'Editar Receita' : 'Nova Receita'}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col pb-4">
          <div className="flex overflow-x-auto sm:overflow-visible gap-2 px-6 mt-4 pb-2 sm:pb-0 shrink-0">
            {[
              { id: 'simple', label: 'Receita Simples', icon: Pill, color: 'text-primary' },
              {
                id: 'special_control',
                label: 'Controle Especial',
                icon: ShieldAlert,
                color: 'text-[hsl(45,93%,47%)]',
              },
              {
                id: 'antimicrobial',
                label: 'Antimicrobiano',
                icon: Bug,
                color: 'text-[hsl(270,60%,50%)]',
              },
            ].map((t) => {
              const Icon = t.icon
              const isSelected = type === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    'flex-1 p-3 border-2 rounded-[var(--radius)] text-center cursor-pointer transition-all duration-150 min-w-[120px] sm:min-w-0',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <Icon className={cn('h-6 w-6 mx-auto mb-1.5', t.color)} />
                  <div className="text-[12px] font-semibold leading-tight">{t.label}</div>
                </div>
              )
            })}
          </div>

          <div className="px-6 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-[13px] font-bold">Medicamentos</h4>
                <span className="bg-primary/10 text-primary font-bold text-[11px] px-2 py-0.5 rounded-full">
                  {medications.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px] gap-1.5"
                onClick={handleSuggestWithAI}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
                Sugerir com IA
              </Button>
            </div>

            {aiLoading && (
              <div className="space-y-3 mb-3">
                <div className="h-[60px] w-full bg-secondary/20 animate-pulse rounded-[var(--radius)]" />
                <div className="h-[60px] w-full bg-secondary/20 animate-pulse rounded-[var(--radius)]" />
              </div>
            )}

            {aiNotes && (
              <div className="p-3 bg-primary/5 border border-primary/15 rounded-[var(--radius)] mb-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[12px] text-foreground leading-[1.5]">{aiNotes}</span>
                    {aiDisclaimer && (
                      <span className="text-[11px] text-muted-foreground italic mt-1">
                        {aiDisclaimer}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {medications.map((med, index) => (
                <div
                  key={index}
                  className="border border-border rounded-[var(--radius)] overflow-hidden transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div
                    className="p-3 px-4 flex items-center justify-between cursor-pointer bg-secondary/20 group"
                    onClick={() => updateMedication(index, 'expanded', !med.expanded)}
                  >
                    <div className="flex items-center gap-2 truncate pr-4">
                      {med.ai_suggested && (
                        <Sparkles className="h-2.5 w-2.5 text-primary flex-shrink-0" />
                      )}
                      {med.name ? (
                        <span className="text-[14px] font-semibold text-foreground truncate">
                          {med.name}
                        </span>
                      ) : (
                        <span className="text-[14px] font-medium italic text-muted-foreground">
                          Medicamento sem nome
                        </span>
                      )}
                      {med.dosage && (
                        <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                          {med.dosage}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveMedication(index)
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          med.expanded && 'rotate-180',
                        )}
                      />
                    </div>
                  </div>

                  {med.expanded && (
                    <div className="p-4 border-t border-border bg-card grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Medicamento *
                        </label>
                        <Input
                          placeholder="Nome do medicamento"
                          value={med.name}
                          onChange={(e) => updateMedication(index, 'name', e.target.value)}
                          className="h-[38px] text-[13px] rounded-[var(--radius)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Dosagem
                        </label>
                        <Input
                          placeholder="Ex: 500mg"
                          value={med.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                          className="h-[38px] text-[13px] rounded-[var(--radius)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Posologia
                        </label>
                        <Input
                          placeholder="Ex: 8 em 8 horas"
                          value={med.frequency}
                          onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                          className="h-[38px] text-[13px] rounded-[var(--radius)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Duração
                        </label>
                        <Input
                          placeholder="Ex: 7 dias"
                          value={med.duration}
                          onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                          className="h-[38px] text-[13px] rounded-[var(--radius)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Via
                        </label>
                        <Select
                          value={med.route}
                          onValueChange={(v) => updateMedication(index, 'route', v)}
                        >
                          <SelectTrigger className="h-[38px] text-[13px] rounded-[var(--radius)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              'Via oral',
                              'Sublingual',
                              'Intramuscular',
                              'Intravenosa',
                              'Tópica',
                              'Oftálmica',
                              'Inalatória',
                              'Retal',
                            ].map((o) => (
                              <SelectItem key={o} value={o} className="text-[13px]">
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Quantidade
                        </label>
                        <Input
                          placeholder="Ex: 21 comprimidos"
                          value={med.quantity}
                          onChange={(e) => updateMedication(index, 'quantity', e.target.value)}
                          className="h-[38px] text-[13px] rounded-[var(--radius)]"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                          Instruções
                        </label>
                        <Textarea
                          placeholder="Ex: Tomar após as refeições. Não ingerir com álcool."
                          value={med.instructions}
                          onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                          className="min-h-[64px] text-[13px] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full h-10 border-dashed border-border mt-2 text-[13px] gap-1.5 text-primary hover:bg-primary/5 hover:border-primary"
              onClick={handleAddMedication}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Medicamento
            </Button>
          </div>

          <div className="px-6 mt-4">
            <div className="space-y-1 mb-3">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                Observações Gerais
              </label>
              <Textarea
                placeholder="Instruções adicionais para o paciente..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                Validade da Receita
              </label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-[38px] text-[13px] w-[200px]"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button
            variant="ghost"
            className="h-10 text-[13px] w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="h-10 text-[13px] font-semibold gap-1.5 hover:bg-primary/90 active:scale-97 w-full sm:w-auto"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar Receita'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
