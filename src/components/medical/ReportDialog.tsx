import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FileCheck,
  FileText,
  Forward,
  FlaskConical,
  MapPin,
  Tag,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { medicalReportService } from '@/services/medicalReportService'
import { aiPrescriptionService } from '@/services/aiPrescriptionService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function ReportDialog({
  recordId,
  tenantId,
  doctorId,
  patientId,
  patientName,
  specialty,
  assessmentText,
  existingReport,
  onSaved,
  open,
  onOpenChange,
  defaultType = 'laudo',
}: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDisclaimer, setAiDisclaimer] = useState('')
  const [reportType, setReportType] = useState(defaultType)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [cid10, setCid10] = useState('')
  const [daysOff, setDaysOff] = useState('1')
  const [destination, setDestination] = useState('')

  useEffect(() => {
    if (open) {
      setAiDisclaimer('')
      if (existingReport) {
        setReportType(existingReport.report_type || 'laudo')
        setTitle(existingReport.title || '')
        setContent(existingReport.content || '')
        setCid10(existingReport.metadata?.cid10 || '')
        setDaysOff(existingReport.metadata?.days_off?.toString() || '1')
        setDestination(existingReport.metadata?.destination || '')
      } else {
        setReportType(defaultType)
        applyTemplate(defaultType)
      }
    }
  }, [open, existingReport, defaultType])

  const applyTemplate = (type: string) => {
    setCid10('')
    setDaysOff('1')
    setDestination('')

    if (type === 'atestado') {
      setTitle('Atestado Médico')
      setContent(
        `Atesto para os devidos fins que o(a) paciente ${patientName || '______________'}, compareceu à consulta médica nesta data, necessitando de 1 dia(s) de afastamento de suas atividades.`,
      )
    } else if (type === 'laudo') {
      setTitle('')
      setContent('')
    } else if (type === 'encaminhamento') {
      setTitle('Encaminhamento Médico')
      setContent(
        `Encaminho o(a) paciente ${patientName || '______________'} para avaliação de [ESPECIALIDADE]. Motivo: `,
      )
    } else if (type === 'solicitacao_exames') {
      setTitle('Solicitação de Exames')
      setContent('Exames Solicitados:\n- ')
    }
  }

  const handleTypeChange = (t: string) => {
    if (existingReport && existingReport.report_type !== t) {
      if (!confirm('Mudar o tipo de documento apagará o conteúdo atual. Deseja continuar?')) return
    } else if (content.length > 50 && !existingReport) {
      if (!confirm('Mudar o tipo de documento aplicará um novo template. Deseja continuar?')) return
    }
    setReportType(t)
    if (!existingReport || existingReport.report_type !== t) {
      applyTemplate(t)
    }
  }

  useEffect(() => {
    if (reportType === 'atestado' && !existingReport && !aiDisclaimer) {
      setContent(
        `Atesto para os devidos fins que o(a) paciente ${patientName || '______________'}, compareceu à consulta médica nesta data, necessitando de ${daysOff} dia(s) de afastamento de suas atividades.`,
      )
    }
  }, [daysOff])

  const handleSuggestWithAI = async () => {
    if (!assessmentText?.trim()) {
      toast({
        title: 'Preencha a Avaliação primeiro',
        description: 'A IA precisa do raciocínio clínico (Avaliação) para sugerir o documento.',
        variant: 'destructive',
      })
      return
    }
    setAiLoading(true)
    try {
      const data = await aiPrescriptionService.suggestPrescription(
        tenantId,
        assessmentText,
        specialty || 'Geral',
        undefined,
        reportType,
      )

      if (data.content) setContent(data.content)
      if (data.days_off) setDaysOff(data.days_off.toString())
      if (data.cid10) setCid10(data.cid10)
      if (data.disclaimer) setAiDisclaimer(data.disclaimer)
      toast({ title: 'Documento sugerido pela IA. Revise antes de salvar.' })
    } catch (error: any) {
      toast({
        title: 'Erro ao sugerir documento',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() && reportType === 'laudo') {
      toast({ title: 'Preencha o título do laudo', variant: 'destructive' })
      return
    }
    if (!content.trim()) {
      toast({ title: 'Preencha o conteúdo do documento', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const data = {
        report_type: reportType,
        title:
          title ||
          (reportType === 'atestado'
            ? 'Atestado Médico'
            : reportType === 'encaminhamento'
              ? 'Encaminhamento Médico'
              : 'Solicitação de Exames'),
        content,
        cid10: cid10 || null,
        days_off: reportType === 'atestado' ? parseInt(daysOff) : null,
        destination: reportType === 'encaminhamento' ? destination : null,
      }

      if (existingReport) {
        await medicalReportService.updateReport(existingReport.id, data)
        toast({ title: 'Documento atualizado com sucesso' })
      } else {
        await medicalReportService.createReport(recordId, tenantId, doctorId, patientId, data)
        toast({ title: 'Documento criado com sucesso' })
      }

      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'Erro ao salvar documento', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[100vw] w-full p-0 rounded-none sm:rounded-[var(--radius)] overflow-hidden flex flex-col min-h-[100dvh] sm:min-h-0 sm:max-h-[90vh] border-0 sm:border">
        <DialogHeader className="px-6 py-5 border-b border-border shrink-0">
          <DialogTitle className="text-[18px] font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {existingReport ? 'Editar Documento' : 'Novo Documento'}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 mt-4 shrink-0">
            {[
              {
                id: 'atestado',
                label: 'Atestado',
                icon: FileCheck,
                color: 'text-[hsl(152,68%,40%)]',
              },
              { id: 'laudo', label: 'Laudo', icon: FileText, color: 'text-primary' },
              {
                id: 'encaminhamento',
                label: 'Encaminhamento',
                icon: Forward,
                color: 'text-[hsl(270,60%,50%)]',
              },
              {
                id: 'solicitacao_exames',
                label: 'Solicitação de Exames',
                icon: FlaskConical,
                color: 'text-[hsl(45,93%,47%)]',
              },
            ].map((t) => {
              const Icon = t.icon
              const isSelected = reportType === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => handleTypeChange(t.id)}
                  className={cn(
                    'p-3.5 border-2 rounded-[var(--radius)] text-center cursor-pointer transition-all duration-150',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <Icon className={cn('h-6 w-6 mx-auto mb-1.5', t.color)} />
                  <div className="text-[11px] font-semibold leading-tight">{t.label}</div>
                </div>
              )
            })}
          </div>

          <div className="px-6 mt-5 space-y-4">
            <div className="flex items-center justify-between h-8">
              <span />
              {(reportType === 'atestado' || reportType === 'laudo') && (
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
              )}
            </div>

            {aiDisclaimer && (
              <div className="p-3 bg-primary/5 border border-primary/15 rounded-[var(--radius)] mb-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground italic mt-0.5">
                    {aiDisclaimer}
                  </span>
                </div>
              </div>
            )}

            {reportType === 'laudo' && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                  Título do Laudo *
                </label>
                <Input
                  placeholder="Ex: Laudo Médico para Procedimento Estético"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-[38px] text-[13px] rounded-[var(--radius)]"
                />
              </div>
            )}

            {reportType === 'atestado' && (
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] block">
                    Dias de Afastamento
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={daysOff}
                    onChange={(e) => setDaysOff(e.target.value)}
                    className="h-[38px] w-[100px] text-[14px] font-semibold text-center rounded-[var(--radius)]"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[160px] max-w-[160px]">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                    CID-10 (Opcional)
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-[12px] h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Ex: J06.9"
                      value={cid10}
                      onChange={(e) => setCid10(e.target.value)}
                      className="h-[38px] text-[13px] pl-9 font-mono placeholder:text-muted-foreground rounded-[var(--radius)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {reportType === 'encaminhamento' && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                  Encaminhar para
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-[12px] h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Ex: Ortopedista, Dr. Fulano"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="h-[38px] text-[13px] pl-9 rounded-[var(--radius)]"
                  />
                </div>
              </div>
            )}

            {(reportType === 'laudo' ||
              reportType === 'encaminhamento' ||
              reportType === 'solicitacao_exames') && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                  CID-10 (Opcional)
                </label>
                <div className="relative w-[160px]">
                  <Tag className="absolute left-3 top-[12px] h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Ex: J06.9"
                    value={cid10}
                    onChange={(e) => setCid10(e.target.value)}
                    className="h-[38px] text-[13px] pl-9 font-mono placeholder:text-muted-foreground rounded-[var(--radius)]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px]">
                {reportType === 'solicitacao_exames'
                  ? 'Exames Solicitados *'
                  : reportType === 'laudo'
                    ? 'Conteúdo do Laudo *'
                    : 'Conteúdo do Documento *'}
              </label>
              <Textarea
                placeholder={
                  reportType === 'solicitacao_exames'
                    ? 'Liste os exames, um por linha. Ex:\n- Hemograma completo\n- Glicemia de jejum'
                    : 'Digite o conteúdo...'
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={cn(
                  'min-h-[160px] text-[13px] leading-[1.6] resize-y rounded-[var(--radius)] font-mono bg-secondary/10 border-border',
                  content ? 'text-foreground' : 'text-muted-foreground',
                )}
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
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar Documento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
