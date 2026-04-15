import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Plus,
  MoreHorizontal,
  Send,
  Edit,
  Trash2,
  Loader2,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { emailService, EmailCampaign } from '@/services/emailService'
import { toast } from 'sonner'
import { CampaignDialog } from './CampaignDialog'
import { cn } from '@/lib/utils'

interface Props {
  tenantId: string
  loading: boolean
  error: string | null
  onUsageUpdate: () => void
}

export function CampaignsTab({
  tenantId,
  loading: initLoading,
  error: initError,
  onUsageUpdate,
}: Props) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | undefined>()
  const [sendingId, setSendingId] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [confirmDialog, setConfirmDialog] = useState<EmailCampaign | null>(null)
  const itemsPerPage = 20

  const loadData = async () => {
    if (!tenantId) return
    try {
      setLoading(true)
      const data = await emailService.fetchCampaigns(tenantId)
      setCampaigns(data)
    } catch (err: any) {
      toast.error('Erro ao carregar campanhas: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenantId])

  const filtered = useMemo(
    () =>
      campaigns.filter((c) => {
        if (
          status !== 'Todas' &&
          c.status !== status.toLowerCase() &&
          !(status === 'Enviando' && c.status === 'sending')
        ) {
          if (status === 'Rascunho' && c.status !== 'draft') return false
          if (status === 'Agendada' && c.status !== 'scheduled') return false
          if (status === 'Enviada' && c.status !== 'sent') return false
          if (status === 'Falha' && c.status !== 'failed') return false
        }
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [campaigns, search, status],
  )

  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza?')) return
    try {
      await emailService.deleteCampaign(id)
      setCampaigns(campaigns.filter((c) => c.id !== id))
      toast.success('Campanha removida')
    } catch (err: any) {
      toast.error('Erro ao excluir')
    }
  }

  const handleSendNow = async (campaign: EmailCampaign) => {
    try {
      setSendingId(campaign.id)
      const res = await emailService.sendCampaign(campaign.id)
      toast.success(`Campanha enviada com sucesso! ${res.sent_count} emails enviados.`)
      onUsageUpdate()
      loadData()
      setConfirmDialog(null)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar campanha')
    } finally {
      setSendingId(null)
    }
  }

  const getStatusBadge = (c: EmailCampaign) => {
    switch (c.status) {
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
            Rascunho
          </span>
        )
      case 'scheduled':
        return (
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              Agendada
            </span>
            {c.scheduled_at && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(c.scheduled_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )
      case 'sending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500">
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Enviando
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success">
            Enviada
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">
            Falha
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
            {c.status}
          </span>
        )
    }
  }

  const renderPercent = (count: number, total: number) => {
    if (total === 0) return '0%'
    return `${((count / total) * 100).toFixed(1)}%`
  }

  if (initError) return <div className="p-4 text-destructive">{initError}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-5">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 w-full bg-input border-border rounded-md text-[14px]"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 min-w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas</SelectItem>
              <SelectItem value="Rascunho">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground"></div> Rascunho
                </div>
              </SelectItem>
              <SelectItem value="Agendada">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div> Agendada
                </div>
              </SelectItem>
              <SelectItem value="Enviando">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div> Enviando
                </div>
              </SelectItem>
              <SelectItem value="Enviada">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div> Enviada
                </div>
              </SelectItem>
              <SelectItem value="Falha">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive"></div> Falha
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="h-10 font-semibold"
          onClick={() => {
            setSelectedCampaign(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Campanha
        </Button>
      </div>

      {initLoading || loading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full animate-pulse" />
          <Skeleton className="h-[200px] w-full animate-pulse" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-[60px]">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-[16px] font-semibold text-foreground mt-4">
            Nenhuma campanha criada
          </h3>
          <p className="text-[14px] text-muted-foreground mt-2 text-center">
            Crie uma campanha para enviar emails aos seus pacientes.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              setSelectedCampaign(undefined)
              setDialogOpen(true)
            }}
          >
            Criar Campanha
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary">
              <TableRow className="border-b-border">
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Template
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Enviados
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Abertos
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Cliques
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Criada em
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((c) => (
                <TableRow
                  key={c.id}
                  className="px-4 py-2.5 text-[13px] border-b border-border hover:bg-secondary/50"
                >
                  <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {c.template ? (
                      c.template.name
                    ) : (
                      <span className="italic text-destructive/60">Template removido</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(c)}</TableCell>
                  <TableCell className="text-right font-medium">{c.sent_count}</TableCell>
                  <TableCell className="text-right font-medium">
                    {c.opened_count}{' '}
                    {c.sent_count > 0 && (
                      <span
                        className={cn(
                          'text-[11px] block mt-0.5',
                          c.opened_count / c.sent_count > 0.3
                            ? 'text-success'
                            : 'text-muted-foreground',
                        )}
                      >
                        {renderPercent(c.opened_count, c.sent_count)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {c.clicked_count}{' '}
                    {c.sent_count > 0 && (
                      <span
                        className={cn(
                          'text-[11px] block mt-0.5',
                          c.clicked_count / c.sent_count > 0.1
                            ? 'text-success'
                            : 'text-muted-foreground',
                        )}
                      >
                        {renderPercent(c.clicked_count, c.sent_count)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(c.status === 'draft' || c.status === 'scheduled') && (
                          <>
                            <DropdownMenuItem
                              className="text-success focus:text-success cursor-pointer"
                              onClick={() => setConfirmDialog(c)}
                            >
                              <Send className="mr-2 h-4 w-4" /> Enviar Agora
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedCampaign(c)
                                setDialogOpen(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma campanha encontrada com esses filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {dialogOpen && (
        <CampaignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          campaign={selectedCampaign}
          tenantId={tenantId}
          onSaved={loadData}
        />
      )}

      {confirmDialog && (
        <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <DialogContent className="max-w-[420px] text-center p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <DialogTitle className="text-[16px] font-semibold text-foreground text-center">
              Enviar campanha
            </DialogTitle>
            <p className="text-[14px] text-muted-foreground mt-2 mb-6 leading-relaxed">
              Enviar campanha <strong>{confirmDialog.name}</strong> para os destinatários agora?
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1 h-[44px]"
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-[44px] font-semibold"
                onClick={() => handleSendNow(confirmDialog)}
                disabled={sendingId === confirmDialog.id}
              >
                {sendingId === confirmDialog.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Enviar'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
