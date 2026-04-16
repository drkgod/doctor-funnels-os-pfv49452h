import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Mic, FileText } from 'lucide-react'
import { medicalRecordService } from '@/services/medicalRecordService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'Em andamento', color: 'bg-primary' },
  review: { label: 'Em revisao', color: 'bg-amber-500' },
  completed: { label: 'Concluido', color: 'bg-green-500' },
  signed: { label: 'Assinado', color: 'bg-purple-500' },
}

const RECORD_TYPES: Record<string, string> = {
  consultation: 'Consulta',
  return: 'Retorno',
  procedure: 'Procedimento',
  emergency: 'Emergencia',
}

export default function ProntuarioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [elapsedTime, setElapsedTime] = useState(0)

  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    if (id) loadData(id)
  }, [id])

  useEffect(() => {
    if (data?.record?.started_at && data.record.status === 'in_progress') {
      const interval = setInterval(() => {
        const start = new Date(data.record.started_at).getTime()
        const now = new Date().getTime()
        setElapsedTime(Math.floor((now - start) / 60000))
      }, 60000)
      const start = new Date(data.record.started_at).getTime()
      const now = new Date().getTime()
      setElapsedTime(Math.floor((now - start) / 60000))
      return () => clearInterval(interval)
    }
  }, [data])

  const loadData = async (recordId: string) => {
    try {
      setLoading(true)
      const res = await medicalRecordService.fetchRecordById(recordId)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Prontuario nao encontrado')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionChange = (sectionType: string, content: string, structured_data?: any) => {
    if (!data) return
    const section = data.sections.find((s: any) => s.section_type === sectionType)
    if (!section) return

    const newSections = data.sections.map((s: any) =>
      s.id === section.id
        ? {
            ...s,
            content,
            structured_data: structured_data !== undefined ? structured_data : s.structured_data,
          }
        : s,
    )
    setData({ ...data, sections: newSections })

    if (debounceRefs.current[section.id]) clearTimeout(debounceRefs.current[section.id])
    setSaving((prev) => ({ ...prev, [section.id]: true }))
    setSaved((prev) => ({ ...prev, [section.id]: false }))

    debounceRefs.current[section.id] = setTimeout(async () => {
      try {
        await medicalRecordService.updateSection(section.id, content, structured_data)
        setSaved((prev) => ({ ...prev, [section.id]: true }))
      } catch (e) {
        toast({ title: 'Erro ao salvar', variant: 'destructive' })
      } finally {
        setSaving((prev) => ({ ...prev, [section.id]: false }))
        setTimeout(() => setSaved((prev) => ({ ...prev, [section.id]: false })), 3000)
      }
    }, 1000)
  }

  const calculateIMC = (peso: string, altura: string) => {
    const p = parseFloat(peso)
    const a = parseFloat(altura) / 100
    if (!p || !a) return { value: '', class: '' }
    const imc = p / (a * a)
    let c = ''
    if (imc < 18.5) c = 'Abaixo do peso'
    else if (imc <= 24.9) c = 'Normal'
    else if (imc <= 29.9) c = 'Sobrepeso'
    else if (imc <= 34.9) c = 'Obesidade I'
    else if (imc <= 39.9) c = 'Obesidade II'
    else c = 'Obesidade III'
    return { value: imc.toFixed(1), class: c }
  }

  const handleVitalSignChange = (key: string, value: string) => {
    const section = data?.sections.find((s: any) => s.section_type === 'vital_signs')
    if (!section) return
    const newStructuredData = { ...(section.structured_data || {}), [key]: value }
    if (key === 'peso' || key === 'altura') {
      const imcData = calculateIMC(newStructuredData.peso || '', newStructuredData.altura || '')
      newStructuredData.imc = imcData.value
      newStructuredData.imc_class = imcData.class
    }
    handleSectionChange('vital_signs', section.content || '', newStructuredData)
  }

  const handleComplete = async () => {
    if (!confirm('Finalizar este atendimento? O prontuario ficara em revisao para conferencia.'))
      return
    try {
      await medicalRecordService.completeRecord(data.record.id)
      toast({ title: 'Atendimento finalizado. Prontuario em revisao.', variant: 'default' })
      loadData(data.record.id)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 text-center pt-20">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium">{error || 'Prontuario nao encontrado'}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/prontuarios')}>
          Voltar
        </Button>
      </div>
    )
  }

  const { record, patient, doctor, sections } = data
  const isReadOnly = record.status === 'signed'

  const subjective = sections.find((s: any) => s.section_type === 'subjective') || {}
  const objective = sections.find((s: any) => s.section_type === 'objective') || {}
  const assessment = sections.find((s: any) => s.section_type === 'assessment') || {}
  const plan = sections.find((s: any) => s.section_type === 'plan') || {}
  const vitalSigns = sections.find((s: any) => s.section_type === 'vital_signs') || {}
  const vsData = vitalSigns.structured_data || {}

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-32">
      <Button
        variant="ghost"
        className="pl-0 hover:bg-transparent"
        onClick={() => navigate('/prontuarios')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos Prontuarios
      </Button>

      {isReadOnly && (
        <div className="bg-green-500/15 text-green-700 p-4 rounded-md flex items-center">
          <Check className="h-5 w-5 mr-2" />
          Este prontuario foi assinado em {format(
            new Date(record.signed_at),
            'dd/MM/yyyy HH:mm',
          )}{' '}
          por Dr. {record.signature_name || doctor?.full_name}. Documento somente leitura.
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{patient?.full_name}</h1>
            <Badge
              className={STATUS_CONFIG[record.status]?.color || 'bg-gray-500'}
              variant="secondary"
            >
              {STATUS_CONFIG[record.status]?.label || record.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {RECORD_TYPES[record.record_type] || record.record_type}
            </Badge>
            <Badge variant="outline">{record.specialty}</Badge>
            <span>Dr. {doctor?.full_name}</span>
            <span>&bull;</span>
            <span>{format(new Date(record.created_at), 'dd/MM/yyyy')}</span>
            {record.chief_complaint && (
              <>
                <span>&bull;</span>
                <span className="truncate max-w-[300px]">QP: {record.chief_complaint}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="anamnese" className="w-full">
        <TabsList className="w-full flex justify-start overflow-x-auto h-auto p-1">
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
          <TabsTrigger value="exame">Exame Fisico</TabsTrigger>
          <TabsTrigger value="avaliacao">Avaliacao</TabsTrigger>
          <TabsTrigger value="conduta">Conduta</TabsTrigger>
          <TabsTrigger value="transcricao">Transcricao</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
        </TabsList>

        <div className="mt-6 border rounded-lg p-6 bg-card">
          <TabsContent value="anamnese" className="mt-0 outline-none space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Anamnese (Subjetivo)</h3>
                <p className="text-sm text-muted-foreground">
                  Queixa principal, historia da doenca atual, antecedentes.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {subjective.ai_generated && (
                  <Badge variant="default" className="bg-primary">
                    {subjective.edited_after_ai ? 'Editado apos IA' : 'Gerado por IA'}
                  </Badge>
                )}
                {saving[subjective.id] && (
                  <span className="text-muted-foreground flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...
                  </span>
                )}
                {saved[subjective.id] && (
                  <span className="text-green-500 flex items-center">
                    <Check className="h-3 w-3 mr-1" /> Salvo
                  </span>
                )}
              </div>
            </div>
            <Textarea
              className="min-h-[250px] resize-y text-base p-4"
              value={subjective.content || ''}
              onChange={(e) => handleSectionChange('subjective', e.target.value)}
              disabled={isReadOnly}
              placeholder="Digite a anamnese do paciente..."
            />
          </TabsContent>

          <TabsContent value="exame" className="mt-0 outline-none space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Sinais Vitais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md bg-muted/20">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">PA Sistolica (mmHg)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.pa_sistolica || ''}
                    onChange={(e) => handleVitalSignChange('pa_sistolica', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">PA Diastolica (mmHg)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.pa_diastolica || ''}
                    onChange={(e) => handleVitalSignChange('pa_diastolica', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">FC (bpm)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.fc || ''}
                    onChange={(e) => handleVitalSignChange('fc', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">FR (irpm)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.fr || ''}
                    onChange={(e) => handleVitalSignChange('fr', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Temp (C)</label>
                  <Input
                    type="number"
                    step="0.1"
                    disabled={isReadOnly}
                    value={vsData.temp || ''}
                    onChange={(e) => handleVitalSignChange('temp', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">SpO2 (%)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.spo2 || ''}
                    onChange={(e) => handleVitalSignChange('spo2', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Peso (kg)</label>
                  <Input
                    type="number"
                    step="0.1"
                    disabled={isReadOnly}
                    value={vsData.peso || ''}
                    onChange={(e) => handleVitalSignChange('peso', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Altura (cm)</label>
                  <Input
                    type="number"
                    disabled={isReadOnly}
                    value={vsData.altura || ''}
                    onChange={(e) => handleVitalSignChange('altura', e.target.value)}
                  />
                </div>
                {vsData.imc && (
                  <div className="col-span-2 md:col-span-4 mt-2 p-2 bg-primary/10 rounded flex justify-between items-center">
                    <span className="text-sm font-medium">IMC Calculado: {vsData.imc}</span>
                    <Badge variant="outline">{vsData.imc_class}</Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Exame Fisico (Objetivo)</h3>
                <div className="flex items-center gap-2 text-sm">
                  {saving[objective.id] && (
                    <span className="text-muted-foreground flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...
                    </span>
                  )}
                  {saved[objective.id] && (
                    <span className="text-green-500 flex items-center">
                      <Check className="h-3 w-3 mr-1" /> Salvo
                    </span>
                  )}
                </div>
              </div>
              <Textarea
                className="min-h-[200px] resize-y text-base p-4"
                value={objective.content || ''}
                onChange={(e) => handleSectionChange('objective', e.target.value)}
                disabled={isReadOnly}
                placeholder="Descreva os achados do exame fisico..."
              />
            </div>
          </TabsContent>

          <TabsContent value="avaliacao" className="mt-0 outline-none space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Avaliacao (Assessment)</h3>
              <div className="flex items-center gap-2 text-sm">
                {saving[assessment.id] && (
                  <span className="text-muted-foreground flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...
                  </span>
                )}
                {saved[assessment.id] && (
                  <span className="text-green-500 flex items-center">
                    <Check className="h-3 w-3 mr-1" /> Salvo
                  </span>
                )}
              </div>
            </div>
            <Textarea
              className="min-h-[150px] resize-y text-base p-4"
              value={assessment.content || ''}
              onChange={(e) => handleSectionChange('assessment', e.target.value)}
              disabled={isReadOnly}
              placeholder="Raciocinio clinico e diagnosticos provaveis..."
            />
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-medium">CID-10</h4>
              <Input
                placeholder="Ex: F32.1 - Episodio depressivo moderado"
                value={(assessment.structured_data?.cid10 || [])[0] || ''}
                onChange={(e) =>
                  handleSectionChange('assessment', assessment.content || '', {
                    ...assessment.structured_data,
                    cid10: [e.target.value],
                  })
                }
                disabled={isReadOnly}
              />
            </div>
          </TabsContent>

          <TabsContent value="conduta" className="mt-0 outline-none space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Conduta (Plano)</h3>
              <div className="flex items-center gap-2 text-sm">
                {saving[plan.id] && (
                  <span className="text-muted-foreground flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...
                  </span>
                )}
                {saved[plan.id] && (
                  <span className="text-green-500 flex items-center">
                    <Check className="h-3 w-3 mr-1" /> Salvo
                  </span>
                )}
              </div>
            </div>
            <Textarea
              className="min-h-[150px] resize-y text-base p-4"
              value={plan.content || ''}
              onChange={(e) => handleSectionChange('plan', e.target.value)}
              disabled={isReadOnly}
              placeholder="Plano terapeutico, medicamentos, orientacoes..."
            />
            <div className="flex gap-2 pt-4">
              <Button variant="outline" disabled>
                Nova Receita
              </Button>
              <Button variant="outline" disabled>
                Novo Laudo
              </Button>
              <Button variant="outline" disabled>
                Solicitar Exames
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="transcricao" className="mt-0 outline-none">
            <div className="p-12 border border-dashed rounded-lg flex flex-col items-center justify-center text-center text-muted-foreground">
              <Mic className="h-10 w-10 mb-4" />
              <p>A funcionalidade de transcricao sera implementada na proxima fase.</p>
            </div>
            {data.transcriptions?.length > 0 && (
              <div className="mt-6 space-y-4">
                <h4 className="font-medium">Transcrições Anteriores</h4>
                {data.transcriptions.map((t: any) => (
                  <div key={t.id} className="p-4 bg-muted/30 rounded text-sm">
                    {t.processed_text || t.raw_text}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-0 outline-none space-y-8">
            <div>
              <h4 className="font-medium mb-3">Receitas</h4>
              {data.prescriptions?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma receita</p>
              ) : null}
            </div>
            <div>
              <h4 className="font-medium mb-3">Laudos</h4>
              {data.reports?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum laudo</p>
              ) : null}
            </div>
            <div>
              <h4 className="font-medium mb-3 flex items-center justify-between">
                Mapa Corporal{' '}
                <Button variant="outline" size="sm" disabled>
                  Adicionar Mapa Corporal
                </Button>
              </h4>
              {data.body_maps?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum mapa corporal</p>
              ) : null}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 z-40 flex items-center justify-between">
        <div className="font-medium">{STATUS_CONFIG[record.status]?.label || record.status}</div>
        <div className="text-sm text-muted-foreground">Tempo de consulta: {elapsedTime}min</div>
        <div className="flex items-center gap-2">
          {record.status === 'in_progress' && (
            <Button variant="outline" onClick={handleComplete}>
              Finalizar Atendimento
            </Button>
          )}
          {record.status === 'review' && (
            <Button disabled title="Funcionalidade de assinatura em desenvolvimento.">
              Assinar Prontuario
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
