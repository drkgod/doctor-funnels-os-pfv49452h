import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { emailService, EmailTemplate, EmailCampaign } from '@/services/emailService'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign?: EmailCampaign
  tenantId: string
  onSaved: () => void
}

export function CampaignDialog({ open, onOpenChange, campaign, tenantId, onSaved }: Props) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  const [stages, setStages] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const [schedule, setSchedule] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)

  const [estimate, setEstimate] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    emailService.fetchTemplates(tenantId).then(setTemplates)
  }, [tenantId])

  useEffect(() => {
    if (campaign) {
      setName(campaign.name)
      setTemplateId(campaign.template_id)
      const filters = (campaign.segment_filter as any) || {}
      setStages(filters.pipeline_stage || [])
      setSources(filters.source || [])
      setTags(filters.tags || [])
      if (campaign.scheduled_at) {
        setSchedule(true)
        setScheduledAt(new Date(campaign.scheduled_at).toISOString().slice(0, 16))
      }
    } else {
      setName('')
      setTemplateId('')
      setStages([])
      setSources([])
      setTags([])
      setSchedule(false)
      setScheduledAt('')
    }
  }, [campaign, open])

  useEffect(() => {
    if (!open) return
    const fetchEstimate = async () => {
      setEstimating(true)
      try {
        const filters: any = {}
        if (stages.length > 0) filters.pipeline_stage = stages
        if (sources.length > 0) filters.source = sources
        if (tags.length > 0) filters.tags = tags
        const count = await emailService.fetchRecipientEstimate(tenantId, filters)
        setEstimate(count)
      } catch (err) {
        setEstimate(null)
      } finally {
        setEstimating(false)
      }
    }
    const timeoutId = setTimeout(fetchEstimate, 500)
    return () => clearTimeout(timeoutId)
  }, [stages, sources, tags, tenantId, open])

  const handleStageToggle = (s: string) => {
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const handleSourceToggle = (s: string) => {
    setSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const selectedTemplate = templates.find((t) => t.id === templateId)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (stages.length > 0) filters.pipeline_stage = stages
      if (sources.length > 0) filters.source = sources
      if (tags.length > 0) filters.tags = tags

      const data = {
        name,
        template_id: templateId,
        segment_filter: Object.keys(filters).length > 0 ? filters : null,
        scheduled_at: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }

      if (campaign) {
        await emailService.updateCampaign(campaign.id, data)
        toast.success('Campanha atualizada')
      } else {
        await emailService.createCampaign(tenantId, data)
        toast.success('Campanha criada')
      }
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[580px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {campaign ? 'Editar Campanha' : 'Nova Campanha'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-muted-foreground">
              Nome da campanha *
            </Label>
            <Input
              className="h-10 text-[14px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-muted-foreground">Template *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="h-10 text-[14px]">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      {t.name}
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 rounded-full ml-1',
                          t.category === 'transacional'
                            ? 'bg-primary/10 text-primary'
                            : t.category === 'marketing'
                              ? 'bg-accent/10 text-accent-foreground'
                              : 'bg-success/10 text-success',
                        )}
                      >
                        {t.category}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="mt-3 border border-border rounded-md p-3 bg-white max-h-[200px] overflow-hidden relative">
                <div
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }}
                  className="scale-[0.8] origin-top-left w-[125%] pointer-events-none text-black text-xs"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/90" />
              </div>
            )}
          </div>

          <div className="mt-5 p-4 bg-secondary/30 border border-border rounded-md">
            <h4 className="text-[14px] font-semibold mb-3">Segmentar pacientes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label className="text-[12px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Estágio do Funil
                </Label>
                <div className="flex flex-wrap gap-3">
                  {['lead', 'contato', 'agendado', 'consulta', 'retorno', 'procedimento'].map(
                    (s) => (
                      <label
                        key={s}
                        className="flex items-center gap-1.5 text-[13px] cursor-pointer"
                      >
                        <Checkbox
                          checked={stages.includes(s)}
                          onCheckedChange={() => handleStageToggle(s)}
                        />
                        <span className="capitalize">{s}</span>
                      </label>
                    ),
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[12px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Origem
                </Label>
                <div className="flex flex-wrap gap-3">
                  {['whatsapp', 'formulario', 'telefone', 'indicacao', 'manual'].map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                      <Checkbox
                        checked={sources.includes(s)}
                        onCheckedChange={() => handleSourceToggle(s)}
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 mt-5">
              <Label className="text-[12px] text-muted-foreground uppercase tracking-wider font-semibold">
                Tags
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[12px] flex items-center gap-1 font-medium"
                  >
                    {t}{' '}
                    <button
                      onClick={() => removeTag(t)}
                      className="hover:text-destructive text-muted-foreground ml-1"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <Input
                className="h-9 text-[13px] rounded-full px-4 bg-background"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagAdd}
                placeholder="Pressione Enter para adicionar tag..."
              />
            </div>

            <div className="text-[13px] font-medium text-primary mt-4 flex items-center gap-1.5 bg-primary/5 p-2 rounded-md">
              {estimating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              Aproximadamente {estimate !== null ? estimate : '...'} destinatários
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Switch checked={schedule} onCheckedChange={setSchedule} />
              <Label className="text-[14px]">Agendar envio</Label>
            </div>
            {schedule && (
              <Input
                type="datetime-local"
                className="h-10 mt-3 text-[14px]"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {campaign ? 'Salvar' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
