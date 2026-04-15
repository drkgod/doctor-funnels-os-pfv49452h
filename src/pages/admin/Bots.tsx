import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { botService } from '@/services/botService'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
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
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, Search, MoreHorizontal, Settings, Play, Pause, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

const modelLabels: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-sonnet': 'Claude Sonnet',
  'claude-haiku': 'Claude Haiku',
}

export default function Bots() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [bots, setBots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-4o')
  const [isCreating, setIsCreating] = useState(false)

  const [botToDelete, setBotToDelete] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadBots = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await botService.fetchBotConfigs()
      setBots(data)
    } catch (err: any) {
      setError('Não foi possível carregar os chatbots. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBots()
  }, [])

  const loadTenantsForCreate = async () => {
    try {
      const { data } = await supabase.from('tenants').select('id, name, plan')
      if (data) {
        const usedTenantIds = new Set(bots.map((b) => b.tenant_id))
        setTenants(data.filter((t) => !usedTenantIds.has(t.id)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreate = async () => {
    if (!selectedTenant) return
    setIsCreating(true)
    try {
      await botService.createBotConfig(selectedTenant, selectedModel)
      toast({ description: 'Bot criado com sucesso' })
      setIsCreateDialogOpen(false)
      loadBots()
    } catch (e) {
      toast({ description: 'Erro ao criar bot', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleStatus = async (id: string, current: string) => {
    try {
      const newStatus = current === 'active' ? 'paused' : 'active'
      await botService.toggleBotStatus(id, newStatus)
      toast({ description: `Bot ${newStatus === 'active' ? 'ativado' : 'pausado'} com sucesso` })
      loadBots()
    } catch (e) {
      toast({ description: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!botToDelete) return
    try {
      await botService.deleteBotConfig(botToDelete.id)
      toast({ description: 'Bot excluído com sucesso' })
      setBotToDelete(null)
      loadBots()
    } catch (e) {
      toast({ description: 'Erro ao excluir bot', variant: 'destructive' })
    }
  }

  const filteredBots = useMemo(() => {
    return bots.filter((b) => {
      const matchSearch = b.tenant_name.toLowerCase().includes(debouncedSearch.toLowerCase())
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      const matchModel = modelFilter === 'all' || b.model === modelFilter
      return matchSearch && matchStatus && matchModel
    })
  }, [bots, debouncedSearch, statusFilter, modelFilter])

  const paginatedBots = filteredBots.slice((page - 1) * 20, page * 20)
  const totalPages = Math.ceil(filteredBots.length / 20)

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chatbots WhatsApp</h1>
        <p className="text-muted-foreground">Gerenciar bots e prompts por tenant</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tenant..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 h-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full md:w-[160px] h-10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={modelFilter}
          onValueChange={(v) => {
            setModelFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full md:w-[180px] h-10">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
            <SelectItem value="claude-haiku">Claude Haiku</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          onClick={() => {
            setIsCreateDialogOpen(true)
            loadTenantsForCreate()
          }}
          className="w-full md:w-auto h-10 px-4 font-semibold"
        >
          Criar Bot
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                Tenant
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                Modelo
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                RAG
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                Prompt
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                Atualizado
              </TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedBots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  {error ? (
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-10 h-10 text-destructive mb-2" />
                      <p className="text-destructive font-medium">{error}</p>
                      <Button variant="outline" onClick={loadBots} className="mt-2">
                        Tentar novamente
                      </Button>
                    </div>
                  ) : bots.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 justify-center h-full">
                      <Bot className="w-12 h-12 text-muted-foreground/50" />
                      <div className="text-lg font-semibold mt-2">Nenhum chatbot configurado</div>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Crie o primeiro chatbot para um tenant.
                      </p>
                      <Button
                        onClick={() => {
                          setIsCreateDialogOpen(true)
                          loadTenantsForCreate()
                        }}
                        className="mt-4"
                      >
                        Criar Bot
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-10">
                      Nenhum chatbot encontrado para os filtros atuais.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBots.map((bot) => (
                <TableRow key={bot.id} className="hover:bg-secondary/50 transition-colors">
                  <TableCell>
                    <Link
                      to={`/admin/tenants/${bot.tenant_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {bot.tenant_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium bg-background shadow-sm">
                      {modelLabels[bot.model] || bot.model}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        bot.status === 'active'
                          ? 'bg-success/10 text-success border-success/20 hover:bg-success/20'
                          : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                      }
                      variant="outline"
                    >
                      {bot.status === 'active' ? 'Ativo' : 'Pausado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {bot.rag_enabled ? 'Sim' : 'Não'}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm">
                    {bot.system_prompt ? (
                      <span className="text-muted-foreground">
                        {bot.system_prompt.substring(0, 60)}
                        {bot.system_prompt.length > 60 ? '...' : ''}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/70">
                        Sem prompt configurado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(bot.updated_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => navigate(`/admin/bots/${bot.id}`)}
                          className="cursor-pointer"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configurar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(bot.id, bot.status)}
                          className="cursor-pointer"
                        >
                          {bot.status === 'active' ? (
                            <Pause className="w-4 h-4 mr-2" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          {bot.status === 'active' ? 'Pausar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setBotToDelete(bot)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex justify-between items-center py-3 px-6 border-t bg-card/50">
            <span className="text-sm text-muted-foreground">
              Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, filteredBots.length)} de{' '}
              {filteredBots.length} chatbots
            </span>
            <div className="flex gap-2">
              <Button
                variant={page === 1 ? 'ghost' : 'outline'}
                size="icon"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                &lt;
              </Button>
              <Button
                variant={page === totalPages ? 'ghost' : 'outline'}
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                &gt;
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Chatbot IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Todos os tenants já possuem um chatbot.
                    </div>
                  ) : (
                    tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{' '}
                        <span className="text-muted-foreground ml-1 text-xs">({t.plan})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!selectedTenant || isCreating}>
              {isCreating ? 'Criando...' : 'Criar Bot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!botToDelete} onOpenChange={(o) => !o && setBotToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir chatbot</DialogTitle>
            <DialogDescription className="text-base text-foreground leading-relaxed mt-2">
              Tem certeza? O bot do tenant{' '}
              <span className="font-semibold">{botToDelete?.tenant_name}</span> e todos os
              documentos RAG serão excluídos. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setBotToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
