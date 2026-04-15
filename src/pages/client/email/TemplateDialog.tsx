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
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Eye } from 'lucide-react'
import { emailService, EmailTemplate } from '@/services/emailService'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate
  tenantId: string
  onSaved: () => void
}

export function TemplateDialog({ open, onOpenChange, template, tenantId, onSaved }: Props) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('marketing')
  const [htmlContent, setHtmlContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (template) {
      setName(template.name)
      setSubject(template.subject)
      setCategory(template.category)
      setHtmlContent(template.html_content)
    } else {
      setName('')
      setSubject('')
      setCategory('marketing')
      setHtmlContent(
        '<html>\n<body>\n  <h1>Olá PATIENT_NAME,</h1>\n  <p>Sua mensagem aqui.</p>\n</body>\n</html>',
      )
    }
  }, [template, open])

  const handleCopy = (variable: string) => {
    navigator.clipboard.writeText(variable)
    toast.success('Variável copiada')
  }

  const getPreviewHtml = () => {
    let content = htmlContent
    content = content.replace(/PATIENT_NAME/g, 'Ana Silva')
    content = content.replace(/PATIENT_EMAIL/g, 'ana@email.com')
    content = content.replace(/CLINIC_NAME/g, 'Clínica Exemplo')
    content = content.replace(/DOCTOR_NAME/g, 'Dr. Exemplo')
    return content
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const data = { name, subject, category: category as any, html_content: htmlContent }
      if (template) {
        await emailService.updateTemplate(template.id, data)
        toast.success('Template atualizado com sucesso')
      } else {
        await emailService.createTemplate(tenantId, data)
        toast.success('Template criado com sucesso')
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
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            {template ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">
                Nome do template *
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Confirmação de consulta"
                className="h-10 text-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transacional">Transacional</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="automacao">Automação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-muted-foreground">Assunto *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Sua consulta está confirmada, PATIENT_NAME"
              className="h-10 text-[14px]"
            />
          </div>
          <Collapsible className="mt-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              Variáveis disponíveis <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 flex flex-wrap gap-2">
              {['PATIENT_NAME', 'PATIENT_EMAIL', 'CLINIC_NAME', 'DOCTOR_NAME'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="text-[12px] font-mono px-2.5 py-1 rounded-md bg-secondary border border-border cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleCopy(v)}
                >
                  {v}
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[13px] font-medium text-muted-foreground">
                Conteúdo HTML *
              </Label>
              <Button
                variant={preview ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-[12px] gap-1.5"
                onClick={() => setPreview(!preview)}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
            </div>
            {preview ? (
              <div
                className="border border-border rounded-md p-4 min-h-[400px] max-h-[400px] overflow-y-auto bg-white text-black"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            ) : (
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="font-mono text-[13px] min-h-[400px] leading-relaxed p-4 border border-border rounded-md bg-input focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder="<html>...</html>"
              />
            )}
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {template ? 'Salvar' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
