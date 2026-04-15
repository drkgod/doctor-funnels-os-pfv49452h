import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, Mail } from 'lucide-react'
import { emailService, EmailTemplate } from '@/services/emailService'
import { toast } from 'sonner'
import { TemplateDialog } from './TemplateDialog'
import { cn } from '@/lib/utils'

interface Props {
  tenantId: string
  loading: boolean
  error: string | null
}

export function TemplatesTab({ tenantId, loading: initLoading, error: initError }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | undefined>()

  const loadData = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const data = await emailService.fetchTemplates(tenantId)
      setTemplates(data)
    } catch (err: any) {
      toast.error('Erro ao carregar templates: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  const filtered = templates.filter((t) => {
    if (category !== 'Todas' && t.category !== category.toLowerCase()) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Campanhas usando este template não serão afetadas.')) return
    try {
      await emailService.deleteTemplate(id)
      setTemplates(templates.filter((t) => t.id !== id))
      toast.success('Template removido')
    } catch (err: any) {
      toast.error('Erro ao excluir')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await emailService.duplicateTemplate(id, tenantId)
      toast.success('Template duplicado')
      loadData()
    } catch (err: any) {
      toast.error('Erro ao duplicar')
    }
  }

  if (initError) return <div className="p-4 text-destructive">{initError}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-5">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 w-full bg-input border-border rounded-md text-[14px]"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 min-w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas</SelectItem>
              <SelectItem value="transacional">Transacional</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="automacao">Automação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="h-10 font-semibold"
          onClick={() => {
            setSelectedTemplate(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Template
        </Button>
      </div>

      {initLoading || loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-md animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-[60px]">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-[16px] font-semibold text-foreground mt-4">Nenhum template criado</h3>
          <p className="text-[14px] text-muted-foreground mt-2 text-center">
            Crie seu primeiro template para começar a enviar emails.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              setSelectedTemplate(undefined)
              setDialogOpen(true)
            }}
          >
            Criar Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-card border border-border rounded-md p-5 transition-all duration-150 hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col"
            >
              <div className="flex-1">
                <div
                  className="text-[15px] font-semibold text-foreground line-clamp-1"
                  title={t.name}
                >
                  {t.name}
                </div>
                <div className="text-[13px] text-muted-foreground mt-1 truncate" title={t.subject}>
                  {t.subject}
                </div>

                <div className="flex items-center mt-3">
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                      t.category === 'transacional'
                        ? 'bg-primary/10 text-primary'
                        : t.category === 'marketing'
                          ? 'bg-accent/10 text-accent-foreground'
                          : 'bg-success/10 text-success',
                    )}
                  >
                    {t.category === 'transacional'
                      ? 'Transacional'
                      : t.category === 'marketing'
                        ? 'Marketing'
                        : 'Automação'}
                  </span>
                  {t.is_global && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground ml-[6px]">
                      Global
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground mt-2">
                  Atualizado em {new Date(t.updated_at).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
                <Button
                  variant="outline"
                  className="h-8 text-[12px] px-3"
                  onClick={() => {
                    setSelectedTemplate(t)
                    setDialogOpen(true)
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 text-[12px] px-3"
                  onClick={() => handleDuplicate(t.id)}
                >
                  Duplicar
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 text-[12px] px-3 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(t.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <TemplateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          template={selectedTemplate}
          tenantId={tenantId}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
