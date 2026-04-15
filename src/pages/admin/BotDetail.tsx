import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { botService } from '@/services/botService'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, FileText, File, Trash2, UploadCloud, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const modelLabels: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-sonnet': 'Claude Sonnet',
  'claude-haiku': 'Claude Haiku',
}

const VARIABLES = ['TENANT_NAME', 'DOCTOR_NAME', 'SPECIALTY', 'BUSINESS_HOURS', 'ADDRESS', 'PHONE']

export default function BotDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [config, setConfig] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [ragEnabled, setRagEnabled] = useState(false)
  const [status, setStatus] = useState('paused')
  const [systemPrompt, setSystemPrompt] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [docToDelete, setDocToDelete] = useState<any>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { config: c, documents: d } = await botService.fetchBotConfigById(id)
      setConfig(c)
      setDocuments(d)
      setModel(c.model)
      setTemperature(c.temperature)
      setMaxTokens(c.max_tokens)
      setRagEnabled(c.rag_enabled)
      setStatus(c.status)
      setSystemPrompt(c.system_prompt || '')
    } catch (e) {
      setError('Não foi possível carregar o chatbot. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleSaveConfig = async () => {
    try {
      await botService.updateBotConfig(id!, {
        model,
        temperature,
        max_tokens: maxTokens,
        rag_enabled: ragEnabled,
        status,
      })
      toast({ description: 'Configurações salvas com sucesso' })
      loadData()
    } catch (e) {
      toast({ description: 'Erro ao salvar configurações', variant: 'destructive' })
    }
  }

  const handleSavePrompt = async () => {
    try {
      await botService.updateBotConfig(id!, { system_prompt: systemPrompt })
      toast({ description: 'Prompt salvo com sucesso' })
      loadData()
    } catch (e) {
      toast({ description: 'Erro ao salvar prompt', variant: 'destructive' })
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const validExts = ['pdf', 'txt', 'doc', 'docx']

    if (!validExts.includes(fileExt || '')) {
      toast({
        description: 'Formato não suportado. Use PDF, TXT, DOC ou DOCX.',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ description: 'Arquivo muito grande. Máximo 10MB.', variant: 'destructive' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadProgress(10)
    try {
      const interval = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 10 : p))
      }, 200)

      await botService.uploadBotDocument(config.tenant_id, config.id, file)

      clearInterval(interval)
      setUploadProgress(100)
      toast({
        description: 'Documento enviado com sucesso. O processamento pode levar alguns minutos.',
      })
      loadData()
    } catch (err) {
      toast({ description: 'Erro ao enviar documento', variant: 'destructive' })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmDeleteDoc = async () => {
    if (!docToDelete) return
    try {
      await botService.deleteBotDocument(docToDelete.id, docToDelete.file_url)
      toast({ description: 'Documento excluído' })
      setDocToDelete(null)
      loadData()
    } catch (err) {
      toast({ description: 'Erro ao excluir documento', variant: 'destructive' })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: 'Variável copiada para a área de transferência.' })
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-48 mb-8" />

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-12 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto text-center mt-20">
        <p className="text-destructive mb-4 text-lg">{error || 'Bot não encontrado'}</p>
        <Button variant="outline" onClick={() => navigate('/admin/bots')}>
          Voltar aos bots
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <button
        onClick={() => navigate('/admin/bots')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos bots
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Configurar Chatbot</h1>
        <p className="text-muted-foreground mt-1">
          Tenant: <span className="font-semibold text-foreground">{config.tenant_name}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração do Bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
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
            <div className="space-y-2">
              <Label>Temperatura ({temperature})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                step="128"
                min="256"
                max="4096"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
            <div className="space-y-0.5">
              <Label className="text-base cursor-pointer" htmlFor="rag-toggle">
                Habilitar RAG (busca em documentos)
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite que o chatbot consulte os documentos enviados antes de responder.
              </p>
            </div>
            <Switch id="rag-toggle" checked={ragEnabled} onCheckedChange={setRagEnabled} />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
            <div className="space-y-0.5">
              <Label
                className={`text-base font-semibold cursor-pointer ${status === 'active' ? 'text-success' : 'text-muted-foreground'}`}
                htmlFor="status-toggle"
              >
                {status === 'active' ? 'Bot Ativo' : 'Bot Pausado'}
              </Label>
              <p className="text-sm text-muted-foreground">
                Determina se o bot responderá às mensagens dos pacientes.
              </p>
            </div>
            <Switch
              id="status-toggle"
              checked={status === 'active'}
              onCheckedChange={(c) => setStatus(c ? 'active' : 'paused')}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveConfig}>Salvar Configurações</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[300px] font-mono text-sm resize-y leading-relaxed bg-secondary/5"
            placeholder="Digite o prompt do sistema para este chatbot. Exemplo: Você é um assistente virtual da clínica do Dr. Silva. Responda dúvidas sobre horários, especialidades e agendamento."
          />
          <div className="text-sm text-muted-foreground font-mono">
            {systemPrompt.length} caracteres
          </div>

          <Collapsible className="border rounded-md p-4 bg-secondary/10">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Variáveis disponíveis</h4>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pt-4 flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="cursor-pointer font-mono hover:bg-primary/20 transition-colors text-xs"
                  onClick={() => copyToClipboard(`{{${v}}}`)}
                >
                  {v}
                </Badge>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSavePrompt}>Salvar Prompt</Button>
          </div>
        </CardContent>
      </Card>

      {ragEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos RAG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center bg-secondary/5 hover:bg-secondary/20 hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-base mb-1">
                Arraste um arquivo ou clique para enviar
              </h3>
              <p className="text-sm text-muted-foreground">Suporta PDF, TXT, DOC, DOCX até 10MB</p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
              />
            </div>

            {uploading && (
              <div className="space-y-2 px-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Enviando documento...</span>
                  <span className="text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {documents.length > 0 ? (
              <div className="border rounded-md overflow-hidden bg-card">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Chunks</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => {
                      const ext = doc.file_name.split('.').pop()?.toLowerCase()
                      const isPdf = ext === 'pdf'
                      const isTxt = ext === 'txt'
                      return (
                        <TableRow key={doc.id} className="hover:bg-secondary/50">
                          <TableCell className="flex items-center gap-3">
                            {isPdf ? (
                              <FileText className="w-5 h-5 text-red-500" />
                            ) : isTxt ? (
                              <FileText className="w-5 h-5 text-gray-500" />
                            ) : (
                              <File className="w-5 h-5 text-blue-500" />
                            )}
                            <span
                              className="font-medium truncate max-w-[250px]"
                              title={doc.file_name}
                            >
                              {doc.file_name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                doc.embedding_status === 'ready'
                                  ? 'default'
                                  : doc.embedding_status === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className={
                                doc.embedding_status === 'ready'
                                  ? 'bg-success/10 text-success hover:bg-success/20 shadow-none'
                                  : 'shadow-none'
                              }
                            >
                              {doc.embedding_status === 'pending'
                                ? 'Pendente'
                                : doc.embedding_status === 'processing'
                                  ? 'Processando'
                                  : doc.embedding_status === 'ready'
                                    ? 'Pronto'
                                    : 'Erro'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {doc.embedding_status === 'ready' ? `${doc.chunk_count} chunks` : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(doc.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDocToDelete(doc)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-secondary/5">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-lg text-foreground">Nenhum documento</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Envie documentos para que o bot possa consultar durante as conversas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir documento</DialogTitle>
            <DialogDescription className="mt-2 text-base text-foreground leading-relaxed">
              Tem certeza que deseja excluir o documento{' '}
              <span className="font-semibold">{docToDelete?.file_name}</span>? Ele não será mais
              usado pelo chatbot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDocToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDoc}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
