import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Loader2,
  Mic,
  FileText,
  Shield,
  ShieldCheck,
  Clock,
  X,
  Sparkles,
  Pencil,
} from 'lucide-react'
import { medicalRecordService } from '@/services/medicalRecordService'
import { specialtyTemplateService } from '@/services/specialtyTemplateService'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Map as MapIcon, Stethoscope, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { BodyMapEditor, BodyMapPreview } from '@/components/medical/BodyMapEditor'

const CATEGORY_COLORS = [
  'bg-primary',
  'bg-[hsl(189,100%,42%)]',
  'bg-[hsl(45,93%,47%)]',
  'bg-[hsl(270,60%,50%)]',
  'bg-[hsl(330,60%,50%)]',
  'bg-[hsl(152,68%,40%)]',
]

const STATUS_CONFIG: Record<string, { label: string; color: string; dot?: boolean; icon?: any }> = {
  in_progress: { label: 'Em andamento', color: 'bg-primary/12 text-primary', dot: true },
  review: { label: 'Em revisao', color: 'bg-[#eab308]/12 text-[#eab308]' },
  completed: { label: 'Concluido', color: 'bg-[#20b26c]/12 text-[#20b26c]' },
  signed: { label: 'Assinado', color: 'bg-[#8b31ff]/12 text-[#8b31ff]', icon: Shield },
}

const RECORD_TYPES_CONFIG: Record<string, { label: string; color: string }> = {
  consultation: { label: 'Consulta', color: 'bg-primary/10 text-primary' },
  return: { label: 'Retorno', color: 'bg-accent/10 text-accent-foreground' },
  procedure: { label: 'Procedimento', color: 'bg-[#8b31ff]/10 text-[#8b31ff]' },
  emergency: { label: 'Emergencia', color: 'bg-destructive/10 text-destructive' },
}

export default function ProntuarioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [data, setData] = useState<any>(null)
  const [template, setTemplate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [fieldSaving, setFieldSaving] = useState<Record<string, boolean>>({})
  const [fieldSaved, setFieldSaved] = useState<Record<string, boolean>>({})
  const [elapsedTime, setElapsedTime] = useState(0)

  const [cidSearch, setCidSearch] = useState('')
  const [isBodyMapEditorOpen, setIsBodyMapEditorOpen] = useState(false)
  const [activeBodyMapType, setActiveBodyMapType] = useState('body_front')

  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({})
  const dataRef = useRef<any>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

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

      if (res.record?.specialty && res.record?.tenant_id) {
        const tpl = await specialtyTemplateService.getTemplateForSpecialty(
          res.record.specialty,
          res.record.tenant_id,
        )
        setTemplate(tpl)
      }
    } catch (err: any) {
      setError(err.message || 'Prontuario nao encontrado')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionChange = (sectionType: string, content: string, structured_data?: any) => {
    if (!data) return
    const section = data.sections.find((s: any) => s.section_type === sectionType)

    // If section doesn't exist (like specialty_fields from older records), we mock an ID to create it later
    const sectionId = section ? section.id : `new_${sectionType}`

    const newSections = section
      ? data.sections.map((s: any) =>
          s.id === sectionId
            ? {
                ...s,
                content,
                structured_data:
                  structured_data !== undefined ? structured_data : s.structured_data,
              }
            : s,
        )
      : [...data.sections, { id: sectionId, section_type: sectionType, content, structured_data }]

    setData({ ...data, sections: newSections })

    if (debounceRefs.current[sectionId]) clearTimeout(debounceRefs.current[sectionId])
    setSaving((prev) => ({ ...prev, [sectionId]: true }))
    setSaved((prev) => ({ ...prev, [sectionId]: false }))

    debounceRefs.current[sectionId] = setTimeout(async () => {
      try {
        if (section) {
          await medicalRecordService.updateSection(section.id, content, structured_data)
        } else {
          // Fallback if section didn't exist
          const created = await medicalRecordService.updateSection(
            'new',
            content,
            structured_data,
            data.record.id,
            sectionType,
          )
          setData((prev: any) => ({
            ...prev,
            sections: prev.sections.map((s: any) => (s.id === sectionId ? created : s)),
          }))
        }
        setSaved((prev) => ({ ...prev, [sectionId]: true }))
      } catch (e) {
        toast({ title: 'Erro ao salvar', variant: 'destructive' })
      } finally {
        setSaving((prev) => ({ ...prev, [sectionId]: false }))
        setTimeout(() => setSaved((prev) => ({ ...prev, [sectionId]: false })), 3000)
      }
    }, 1000)
  }

  const handleSpecialtyFieldChange = (key: string, value: any) => {
    setData((prevData: any) => {
      if (!prevData) return prevData
      const section = prevData.sections.find((s: any) => s.section_type === 'specialty_fields') || {
        id: 'new_specialty_fields',
        section_type: 'specialty_fields',
        content: '',
        structured_data: {},
      }
      const newStructuredData = { ...(section.structured_data || {}), [key]: value }
      const newSection = { ...section, structured_data: newStructuredData }

      return {
        ...prevData,
        sections: prevData.sections.some((s: any) => s.section_type === 'specialty_fields')
          ? prevData.sections.map((s: any) =>
              s.section_type === 'specialty_fields' ? newSection : s,
            )
          : [...prevData.sections, newSection],
      }
    })

    setFieldSaving((prev) => ({ ...prev, [key]: true }))
    setFieldSaved((prev) => ({ ...prev, [key]: false }))

    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key])
    debounceRefs.current[key] = setTimeout(async () => {
      try {
        const currentData = dataRef.current
        const currentSection = currentData?.sections.find(
          (s: any) => s.section_type === 'specialty_fields',
        )
        if (!currentSection) return

        if (currentSection.id && currentSection.id !== 'new_specialty_fields') {
          await medicalRecordService.updateSection(
            currentSection.id,
            currentSection.content || '',
            currentSection.structured_data,
          )
        } else {
          const created = await medicalRecordService.updateSection(
            'new',
            '',
            currentSection.structured_data,
            currentData.record.id,
            'specialty_fields',
          )
          setData((pd: any) => ({
            ...pd,
            sections: pd.sections.map((s: any) =>
              s.section_type === 'specialty_fields' ? created : s,
            ),
          }))
        }
        setFieldSaved((prev) => ({ ...prev, [key]: true }))
      } catch (e) {
        toast({ title: 'Erro ao salvar', variant: 'destructive' })
      } finally {
        setFieldSaving((prev) => ({ ...prev, [key]: false }))
        setTimeout(() => setFieldSaved((prev) => ({ ...prev, [key]: false })), 2000)
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

  const handleAddCid = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && cidSearch.trim()) {
      e.preventDefault()
      const section = data?.sections.find((s: any) => s.section_type === 'assessment')
      if (!section) return
      const currentCids = section.structured_data?.cid10 || []
      handleSectionChange('assessment', section.content || '', {
        ...section.structured_data,
        cid10: [...currentCids, cidSearch.trim()],
      })
      setCidSearch('')
    }
  }

  const handleRemoveCid = (index: number) => {
    const section = data?.sections.find((s: any) => s.section_type === 'assessment')
    if (!section) return
    const currentCids = [...(section.structured_data?.cid10 || [])]
    currentCids.splice(index, 1)
    handleSectionChange('assessment', section.content || '', {
      ...section.structured_data,
      cid10: currentCids,
    })
  }

  const handleSaveBodyMap = (points: any[], mapType: string) => {
    setData((prev: any) => {
      if (!prev) return prev
      const existingMaps = prev.body_maps || []
      const index = existingMaps.findIndex((m: any) => m.map_type === mapType)
      const newMap = {
        id: crypto.randomUUID(),
        record_id: prev.record.id,
        map_type: mapType,
        points,
        notes: '',
      }

      let nextMaps
      if (index >= 0) {
        nextMaps = [...existingMaps]
        nextMaps[index] = { ...nextMaps[index], points }
      } else {
        nextMaps = [...existingMaps, newMap]
      }
      return { ...prev, body_maps: nextMaps }
    })
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

  const renderSpecialtyField = (
    field: any,
    isEditing: boolean,
    index: number,
    catIndex: number,
  ) => {
    const section = data?.sections.find((s: any) => s.section_type === 'specialty_fields') || {}
    const value = section.structured_data?.[field.key]
    const delay = `${catIndex * 80 + index * 30}ms`

    const isSaving = fieldSaving[field.key]
    const isSaved = fieldSaved[field.key]

    return (
      <div
        key={field.key}
        className={cn(
          'relative flex flex-col gap-1 animate-specialty-field',
          field.type === 'toggle' && 'md:col-span-2',
          field.type === 'body_map' && 'md:col-span-2',
        )}
        style={{ animationDelay: delay }}
      >
        <div className="flex items-center gap-1.5">
          <label className="text-[12px] font-semibold text-muted-foreground">{field.label}</label>
          {field.ai_mappable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Sparkles className="h-3 w-3 text-primary/40 hover:text-primary transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="text-[11px]">
                Preenchido automaticamente pela transcricao
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="absolute top-0 right-0 -mt-[2px] flex items-center">
          {isSaving && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Salvando...
            </div>
          )}
          {isSaved && !isSaving && (
            <div className="flex items-center gap-1 text-[10px] text-[hsl(152,68%,40%)] animate-in fade-in duration-200">
              <Check className="h-2.5 w-2.5" /> Salvo
            </div>
          )}
        </div>

        {field.type === 'text' && (
          <Input
            className="h-[44px] md:h-10 text-[14px] bg-input border-border rounded-md px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50 placeholder:text-muted-foreground/40"
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => handleSpecialtyFieldChange(field.key, e.target.value)}
            disabled={!isEditing}
          />
        )}

        {field.type === 'number' && (
          <div className="relative">
            <Input
              type="number"
              className="h-[44px] md:h-10 text-[15px] font-medium text-left bg-input border-border rounded-md pl-3 pr-12 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
              placeholder={field.placeholder}
              value={value || ''}
              min={field.min}
              max={field.max}
              onChange={(e) => handleSpecialtyFieldChange(field.key, e.target.value)}
              disabled={!isEditing}
            />
            {field.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">
                {field.unit}
              </span>
            )}
          </div>
        )}

        {field.type === 'select' && (
          <div className="relative">
            <Select
              disabled={!isEditing}
              value={value || ''}
              onValueChange={(v) => handleSpecialtyFieldChange(field.key, v)}
            >
              <SelectTrigger className="h-[44px] md:h-10 text-[14px] bg-input border-border rounded-md font-medium">
                <SelectValue placeholder={field.placeholder || 'Selecione...'} />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {field.options?.map((opt: string) => (
                  <SelectItem
                    key={opt}
                    value={opt}
                    className="text-[13px] px-3 py-2 hover:bg-secondary/50"
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {field.type === 'multiselect' && (
          <Popover>
            <PopoverTrigger asChild disabled={!isEditing}>
              <div className="min-h-[44px] md:min-h-[40px] px-2.5 py-1.5 bg-input border border-border rounded-md flex flex-wrap gap-1 items-center cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:border-primary/50">
                {!value || value.length === 0 ? (
                  <span className="text-[13px] text-muted-foreground/40 py-1 px-1.5">
                    {field.placeholder || 'Clique para selecionar...'}
                  </span>
                ) : (
                  value.map((opt: string) => (
                    <span
                      key={opt}
                      className="inline-flex items-center gap-[3px] px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-medium rounded-full"
                    >
                      {opt}
                      {isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSpecialtyFieldChange(
                              field.key,
                              value.filter((i: string) => i !== opt),
                            )
                          }}
                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-destructive/15 hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[300px] p-1 max-h-[240px] overflow-y-auto bg-card border border-border shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-md"
              align="start"
            >
              {field.options?.map((opt: string) => {
                const isSelected = (value || []).includes(opt)
                return (
                  <div
                    key={opt}
                    onClick={() => {
                      if (!isEditing) return
                      const current = value || []
                      const next = isSelected
                        ? current.filter((i: string) => i !== opt)
                        : [...current, opt]
                      handleSpecialtyFieldChange(field.key, next)
                    }}
                    className={cn(
                      'px-3 py-2 text-[13px] flex items-center gap-2 rounded-[calc(var(--radius)-4px)] cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-secondary/50',
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors shrink-0',
                        isSelected ? 'bg-primary border-primary' : 'border-border',
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className={cn(isSelected && 'font-medium text-foreground')}>{opt}</span>
                  </div>
                )
              })}
            </PopoverContent>
          </Popover>
        )}

        {field.type === 'textarea' && (
          <Textarea
            className="min-h-[100px] text-[14px] leading-[1.6] p-3 border border-border rounded-md bg-input resize-y focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/40"
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => handleSpecialtyFieldChange(field.key, e.target.value)}
            disabled={!isEditing}
          />
        )}

        {field.type === 'toggle' && (
          <div className="flex items-center justify-between p-3 md:px-4 bg-secondary/20 hover:bg-secondary/35 transition-colors rounded-md w-full">
            <span className="text-[14px] font-medium">{field.label}</span>
            <Switch
              checked={value || false}
              onCheckedChange={(v) => handleSpecialtyFieldChange(field.key, v)}
              disabled={!isEditing}
            />
          </div>
        )}

        {field.type === 'scale' && (
          <div className="flex flex-col gap-2 w-full mt-1">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                className="w-20 h-[44px] md:h-10 text-[15px] font-medium text-center bg-input border-border rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
                value={value || ''}
                min={field.min}
                max={field.max}
                onChange={(e) => handleSpecialtyFieldChange(field.key, e.target.value)}
                disabled={!isEditing}
              />
              <span
                className={cn(
                  'text-[14px] font-semibold transition-colors',
                  value === undefined || value === ''
                    ? 'text-muted-foreground'
                    : (parseFloat(value) - field.min) / (field.max - field.min) <= 0.33
                      ? 'text-[hsl(152,68%,40%)]'
                      : (parseFloat(value) - field.min) / (field.max - field.min) <= 0.66
                        ? 'text-[hsl(45,93%,47%)]'
                        : 'text-destructive',
                )}
              >
                {value || '0'} {field.unit}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-200 ease-out',
                  value === undefined || value === ''
                    ? 'w-0'
                    : (parseFloat(value) - field.min) / (field.max - field.min) <= 0.33
                      ? 'bg-[hsl(152,68%,40%)]'
                      : (parseFloat(value) - field.min) / (field.max - field.min) <= 0.66
                        ? 'bg-[hsl(45,93%,47%)]'
                        : 'bg-destructive',
                )}
                style={{
                  width:
                    value !== undefined && value !== ''
                      ? `${Math.max(0, Math.min(100, ((parseFloat(value) - field.min) / (field.max - field.min)) * 100))}%`
                      : '0%',
                }}
              />
            </div>
            <div className="flex justify-between w-full">
              <span className="text-[10px] text-muted-foreground">{field.min}</span>
              <span className="text-[10px] text-muted-foreground">{field.max}</span>
            </div>
          </div>
        )}

        {field.type === 'body_map' && (
          <div className="w-full">
            {data?.body_maps?.length > 0 ? (
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium">Mapas Corporais Salvos</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveBodyMapType('body_front')
                      setIsBodyMapEditorOpen(true)
                    }}
                    disabled={!isEditing}
                  >
                    Editar Mapas
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.body_maps.map((bm: any) => (
                    <BodyMapPreview
                      key={bm.id}
                      map={bm}
                      specialty={data.record?.specialty || ''}
                      onEdit={() => {
                        if (!isEditing) return
                        setActiveBodyMapType(bm.map_type)
                        setIsBodyMapEditorOpen(true)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.preventDefault()
                  if (!isEditing) return
                  setActiveBodyMapType('body_front')
                  setIsBodyMapEditorOpen(true)
                }}
                className={cn(
                  'w-full p-4 bg-secondary/10 border-2 border-dashed border-border/50 rounded-md text-center transition-all duration-150',
                  isEditing
                    ? 'cursor-pointer hover:border-primary/30 hover:bg-primary/5 group'
                    : 'opacity-70 cursor-not-allowed',
                )}
              >
                <MapIcon
                  className={cn(
                    'h-8 w-8 mx-auto transition-colors',
                    isEditing
                      ? 'text-muted-foreground/40 group-hover:text-primary/60'
                      : 'text-muted-foreground/30',
                  )}
                />
                <div
                  className={cn(
                    'text-[14px] font-medium mt-2',
                    isEditing ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  Abrir Mapa Corporal
                </div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Marque pontos de injecao, areas de tratamento e mais
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[120px] w-full" />
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
  const isEditing = record.status === 'in_progress' || record.status === 'review'

  const subjective = sections.find((s: any) => s.section_type === 'subjective') || {}
  const objective = sections.find((s: any) => s.section_type === 'objective') || {}
  const assessment = sections.find((s: any) => s.section_type === 'assessment') || {}
  const plan = sections.find((s: any) => s.section_type === 'plan') || {}
  const vitalSigns = sections.find((s: any) => s.section_type === 'vital_signs') || {}
  const vsData = vitalSigns.structured_data || {}
  const specialtyFieldsSection =
    sections.find((s: any) => s.section_type === 'specialty_fields') || {}

  const typeConfig = RECORD_TYPES_CONFIG[record.record_type] || {
    label: record.record_type,
    color: 'bg-muted text-muted-foreground',
  }
  const statusConfig = STATUS_CONFIG[record.status] || {
    label: record.status,
    color: 'bg-muted text-muted-foreground',
  }

  const hasSpecialtyTab =
    template && template.specialty !== 'geral' && template.sections?.length > 0

  return (
    <div className="p-6 max-w-5xl mx-auto pb-32">
      <div
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer hover:text-foreground mb-5 w-fit"
        onClick={() => navigate('/prontuarios')}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos Prontuarios
      </div>

      <div className="p-6 bg-card border rounded-md mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold">{patient?.full_name}</h1>
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
        <div className="flex flex-wrap gap-4 mt-3">
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center',
              typeConfig.color,
            )}
          >
            {typeConfig.label}
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center">
            {record.specialty}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            Dr(a). {doctor?.full_name}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {format(new Date(record.created_at), 'dd/MM/yyyy')}
          </span>
          {record.chief_complaint && (
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground max-w-[300px] truncate">
              QP: {record.chief_complaint}
            </span>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="p-3.5 px-5 bg-[#8b31ff]/8 border border-[#8b31ff]/20 rounded-md mb-5 flex items-center text-[#8b31ff]">
          <ShieldCheck className="h-5 w-5 mr-2" />
          <span className="text-[13px] font-medium">
            Este prontuario foi assinado em {format(new Date(record.signed_at), 'dd/MM/yyyy HH:mm')}{' '}
            por Dr. {record.signature_name || doctor?.full_name}. Documento somente leitura.
          </span>
        </div>
      )}

      <Tabs defaultValue="anamnese" className="w-full">
        <TabsList className="bg-secondary/30 p-1 rounded-md flex gap-0.5 overflow-x-auto whitespace-nowrap w-full justify-start h-auto">
          <TabsTrigger
            value="anamnese"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Anamnese
          </TabsTrigger>
          <TabsTrigger
            value="exame"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Exame Fisico
          </TabsTrigger>

          {hasSpecialtyTab && (
            <TabsTrigger
              value="especialidade"
              className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Especialidade
            </TabsTrigger>
          )}

          <TabsTrigger
            value="avaliacao"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Avaliacao
          </TabsTrigger>
          <TabsTrigger
            value="conduta"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Conduta
          </TabsTrigger>
          <TabsTrigger
            value="transcricao"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Transcricao
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="p-2.5 px-4 text-[13px] font-medium rounded-[4px] text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Documentos
          </TabsTrigger>
        </TabsList>

        <div className="mt-0 p-6 bg-card border rounded-b-md rounded-tr-md min-h-[400px]">
          <TabsContent value="anamnese" className="mt-0 outline-none">
            <div className="relative">
              <h3 className="text-[16px] font-semibold mb-1">Anamnese (Subjetivo)</h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Queixa principal, historia da doenca atual, antecedentes.
              </p>

              {subjective.ai_generated && (
                <div
                  className={cn(
                    'absolute top-0 right-0 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1',
                    subjective.edited_after_ai
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/12 text-primary',
                  )}
                >
                  {subjective.edited_after_ai ? (
                    <Pencil className="h-2.5 w-2.5" />
                  ) : (
                    <Sparkles className="h-2.5 w-2.5" />
                  )}
                  {subjective.edited_after_ai ? 'Editado apos IA' : 'Gerado por IA'}
                </div>
              )}

              <div className="relative">
                <Textarea
                  className="min-h-[200px] text-[14px] leading-relaxed p-4 border rounded-md bg-input resize-y focus:ring-2 focus:ring-ring"
                  value={subjective.content || ''}
                  onChange={(e) => handleSectionChange('subjective', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Digite a anamnese do paciente..."
                />
                <div className="absolute top-2 right-2 text-[11px] flex items-center gap-1 bg-card/90 px-2 py-1 rounded">
                  {saving[subjective.id] && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />{' '}
                      <span className="text-muted-foreground">Salvando...</span>
                    </>
                  )}
                  {saved[subjective.id] && (
                    <>
                      <Check className="h-3 w-3 text-[#20b26c]" />{' '}
                      <span className="text-[#20b26c]">Salvo</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exame" className="mt-0 outline-none space-y-8">
            <div>
              <h3 className="text-[16px] font-semibold mb-1">Sinais Vitais</h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Medicoes fisiologicas e antropometricas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { id: 'pa_sistolica', label: 'PA Sistolica', unit: 'mmHg' },
                  { id: 'pa_diastolica', label: 'PA Diastolica', unit: 'mmHg' },
                  { id: 'fc', label: 'FC', unit: 'bpm' },
                  { id: 'fr', label: 'FR', unit: 'irpm' },
                  { id: 'temp', label: 'Temperatura', unit: '°C' },
                  { id: 'spo2', label: 'SpO2', unit: '%' },
                  { id: 'peso', label: 'Peso', unit: 'kg' },
                  { id: 'altura', label: 'Altura', unit: 'cm' },
                ].map((field) => (
                  <div key={field.id} className="space-y-1 relative">
                    <label className="text-[11px] font-semibold uppercase text-muted-foreground block">
                      {field.label}
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        disabled={!isEditing}
                        className="h-[42px] text-[16px] font-medium text-center pb-3"
                        value={vsData[field.id] || ''}
                        onChange={(e) => handleVitalSignChange(field.id, e.target.value)}
                      />
                      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-muted-foreground pointer-events-none">
                        {field.unit}
                      </span>
                    </div>
                  </div>
                ))}

                {vsData.imc && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-center justify-between gap-3 p-3 px-4 bg-secondary/30 rounded-md">
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        IMC Calculado
                      </div>
                      <div className="text-[20px] font-bold">{vsData.imc}</div>
                    </div>
                    <span
                      className={cn(
                        'text-[12px] font-semibold px-2.5 py-0.5 rounded-full',
                        vsData.imc_class?.includes('Normal')
                          ? 'bg-[#20b26c]/12 text-[#20b26c]'
                          : vsData.imc_class?.includes('Sobrepeso')
                            ? 'bg-[#eab308]/12 text-[#eab308]'
                            : 'bg-destructive/12 text-destructive',
                      )}
                    >
                      {vsData.imc_class}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <h3 className="text-[16px] font-semibold mb-1">Exame Fisico (Objetivo)</h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Descreva os achados do exame fisico.
              </p>

              <div className="relative">
                <Textarea
                  className="min-h-[200px] text-[14px] leading-relaxed p-4 border rounded-md bg-input resize-y focus:ring-2 focus:ring-ring"
                  value={objective.content || ''}
                  onChange={(e) => handleSectionChange('objective', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Descreva os achados do exame fisico..."
                />
                <div className="absolute top-2 right-2 text-[11px] flex items-center gap-1 bg-card/90 px-2 py-1 rounded">
                  {saving[objective.id] && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />{' '}
                      <span className="text-muted-foreground">Salvando...</span>
                    </>
                  )}
                  {saved[objective.id] && (
                    <>
                      <Check className="h-3 w-3 text-[#20b26c]" />{' '}
                      <span className="text-[#20b26c]">Salvo</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {hasSpecialtyTab && (
            <TabsContent value="especialidade" className="mt-0 outline-none">
              <style>{`
                @keyframes field-fade-in {
                  0% { opacity: 0; transform: translateY(8px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
                .animate-specialty-field {
                  animation: field-fade-in 200ms ease-out forwards;
                  opacity: 0;
                }
              `}</style>

              <div className="relative">
                <div className="mb-6">
                  <h3 className="text-[16px] font-semibold text-foreground mb-1">
                    {template.template_name} - Campos Especificos
                  </h3>
                  <p className="text-[13px] text-muted-foreground mb-6">
                    Campos adicionais para esta especialidade.
                  </p>
                </div>

                {!template.sections || template.sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <Stethoscope className="h-10 w-10 text-muted-foreground/30" />
                    <h3 className="text-[15px] font-medium mt-3">Sem campos adicionais</h3>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      A especialidade selecionada nao possui campos extras.
                    </p>
                  </div>
                ) : (
                  <div>
                    {Array.from(new Set(template.sections.map((s: any) => s.category))).map(
                      (category: any, catIndex: number) => {
                        const fields = template.sections.filter((s: any) => s.category === category)
                        const barColor = CATEGORY_COLORS[catIndex % CATEGORY_COLORS.length]
                        return (
                          <div key={category} className="mb-8 last:mb-0">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
                              <div className={cn('w-[3px] h-4 rounded-[2px]', barColor)} />
                              <h4 className="text-[13px] font-bold uppercase tracking-[0.6px] text-muted-foreground">
                                {category}
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {fields.map((field: any, index: number) =>
                                renderSpecialtyField(field, isEditing, index, catIndex),
                              )}
                            </div>
                          </div>
                        )
                      },
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="avaliacao" className="mt-0 outline-none">
            <div className="relative mb-6">
              <h3 className="text-[16px] font-semibold mb-1">Avaliacao (Assessment)</h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Raciocinio clinico e diagnosticos provaveis.
              </p>

              <div className="relative">
                <Textarea
                  className="min-h-[200px] text-[14px] leading-relaxed p-4 border rounded-md bg-input resize-y focus:ring-2 focus:ring-ring"
                  value={assessment.content || ''}
                  onChange={(e) => handleSectionChange('assessment', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Raciocinio clinico e diagnosticos provaveis..."
                />
                <div className="absolute top-2 right-2 text-[11px] flex items-center gap-1 bg-card/90 px-2 py-1 rounded">
                  {saving[assessment.id] && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />{' '}
                      <span className="text-muted-foreground">Salvando...</span>
                    </>
                  )}
                  {saved[assessment.id] && (
                    <>
                      <Check className="h-3 w-3 text-[#20b26c]" />{' '}
                      <span className="text-[#20b26c]">Salvo</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[13px] font-medium mb-2">CID-10</h4>
              <Input
                placeholder="Digite o CID e pressione Enter..."
                value={cidSearch}
                onChange={(e) => setCidSearch(e.target.value)}
                onKeyDown={handleAddCid}
                disabled={!isEditing}
                className="max-w-md"
              />
              {assessment.structured_data?.cid10?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {assessment.structured_data.cid10.map((cid: string, i: number) => (
                    <div
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 bg-secondary rounded-full text-[12px] font-medium"
                    >
                      {cid}
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveCid(i)}
                          className="ml-1.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="conduta" className="mt-0 outline-none">
            <div className="relative">
              <h3 className="text-[16px] font-semibold mb-1">Conduta (Plano)</h3>
              <p className="text-[13px] text-muted-foreground mb-5">
                Plano terapeutico, medicamentos, orientacoes.
              </p>

              <div className="relative">
                <Textarea
                  className="min-h-[200px] text-[14px] leading-relaxed p-4 border rounded-md bg-input resize-y focus:ring-2 focus:ring-ring"
                  value={plan.content || ''}
                  onChange={(e) => handleSectionChange('plan', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Plano terapeutico, medicamentos, orientacoes..."
                />
                <div className="absolute top-2 right-2 text-[11px] flex items-center gap-1 bg-card/90 px-2 py-1 rounded">
                  {saving[plan.id] && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />{' '}
                      <span className="text-muted-foreground">Salvando...</span>
                    </>
                  )}
                  {saved[plan.id] && (
                    <>
                      <Check className="h-3 w-3 text-[#20b26c]" />{' '}
                      <span className="text-[#20b26c]">Salvo</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t">
                <Button
                  variant="outline"
                  className="h-[38px] text-[13px] gap-1.5 hover:border-primary hover:text-primary"
                  disabled
                >
                  Nova Receita
                </Button>
                <Button
                  variant="outline"
                  className="h-[38px] text-[13px] gap-1.5 hover:border-primary hover:text-primary"
                  disabled
                >
                  Novo Laudo
                </Button>
                <Button
                  variant="outline"
                  className="h-[38px] text-[13px] gap-1.5 hover:border-primary hover:text-primary"
                  disabled
                >
                  Solicitar Exames
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transcricao" className="mt-0 outline-none">
            <div className="p-10 bg-secondary/20 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center">
              <Mic className="h-[40px] w-[40px] text-muted-foreground/40" />
              <h3 className="text-[15px] font-medium mt-4">
                A funcionalidade de transcricao sera implementada na proxima fase.
              </h3>
              <p className="text-[13px] text-muted-foreground mt-2 max-w-sm">
                Voce podera gravar o audio da consulta e a IA ira transcrever e preencher o
                prontuario automaticamente.
              </p>
            </div>
            {data.transcriptions?.length > 0 && (
              <div className="mt-6 space-y-4">
                <h4 className="font-medium text-[14px]">Transcrições Anteriores</h4>
                {data.transcriptions.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-4 bg-secondary/30 rounded-md text-[13px] leading-relaxed"
                  >
                    {t.processed_text || t.raw_text}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-0 outline-none space-y-8">
            <div>
              <h4 className="font-semibold text-[15px] mb-2">Receitas</h4>
              {data.prescriptions?.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nenhuma receita gerada para este atendimento.
                </p>
              ) : null}
            </div>
            <div>
              <h4 className="font-semibold text-[15px] mb-2">Laudos</h4>
              {data.reports?.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nenhum laudo gerado para este atendimento.
                </p>
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-[15px]">Mapa Corporal</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={() => {
                    setActiveBodyMapType('body_front')
                    setIsBodyMapEditorOpen(true)
                  }}
                  disabled={!isEditing}
                >
                  Adicionar Mapa Corporal
                </Button>
              </div>
              {data.body_maps?.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nenhum mapa corporal vinculado a este atendimento.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.body_maps.map((bm: any) => (
                    <BodyMapPreview
                      key={bm.id}
                      map={bm}
                      specialty={record.specialty}
                      variant="compact"
                      onEdit={() => {
                        if (!isEditing) return
                        setActiveBodyMapType(bm.map_type)
                        setIsBodyMapEditorOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="fixed bottom-0 left-0 md:left-[240px] right-0 h-[72px] md:h-[64px] bg-card border-t px-6 flex flex-wrap items-center justify-between z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] gap-y-2">
        <div className="flex items-center gap-2">
          {statusConfig.dot && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
          <span className="font-medium text-[13px]">{statusConfig.label}</span>
        </div>
        <div className="text-[13px] text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Tempo de consulta: {elapsedTime}min
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {record.status === 'in_progress' && (
            <Button
              variant="outline"
              className="h-[38px] flex-1 md:flex-none"
              onClick={handleComplete}
            >
              Finalizar Atendimento
            </Button>
          )}
          {record.status === 'review' && (
            <Button
              className="h-[38px] flex-1 md:flex-none"
              disabled
              title="Funcionalidade de assinatura em desenvolvimento."
            >
              <Shield className="w-4 h-4 mr-2" /> Assinar Prontuario
            </Button>
          )}
        </div>
      </div>

      {isBodyMapEditorOpen && (
        <BodyMapEditor
          recordId={record.id}
          mapType={activeBodyMapType}
          specialty={record.specialty}
          bodyMaps={data.body_maps || []}
          onSave={handleSaveBodyMap}
          onClose={() => setIsBodyMapEditorOpen(false)}
        />
      )}
    </div>
  )
}
