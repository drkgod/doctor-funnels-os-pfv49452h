import { useState, useEffect, useRef, useCallback } from 'react'
import { GenericPage } from '@/components/GenericPage'
import { ModuleGate } from '@/components/ModuleGate'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  MessageCircle,
  Bot,
  User as UserIcon,
  Check,
  CheckCheck,
  ArrowUp,
  ArrowLeft,
  AlertCircle,
  Phone,
  Hand,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  Copy,
  Unplug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { whatsappClientService } from '@/services/whatsappClientService'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function Whatsapp() {
  return (
    <ModuleGate moduleKey="whatsapp">
      <GenericPage title="WhatsApp" subtitle="Atendimento centralizado multicanal">
        <div className="h-[calc(100vh-140px)] -mt-4">
          <WhatsappInterface />
        </div>
      </GenericPage>
    </ModuleGate>
  )
}

function WhatsappInterface() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState<any>(null)

  const intervalRef = useRef<any>(null)

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setTenantId(data?.tenant_id || null)
        })
    }
  }, [user])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const data = await whatsappClientService.getMyWhatsAppStatus()
      if (data?.error) throw new Error(data.error)
      setConnectionStatus(data)
    } catch (e) {
      setConnectionStatus({ connected: false, configured: false, status: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const generateQrCode = async () => {
    setQrLoading(true)
    try {
      const data = await whatsappClientService.connectMyWhatsApp()
      if (data?.error) throw new Error(data.error)
      setQrData(data)
    } catch (e: any) {
      toast({ description: 'Erro ao gerar QR Code. Tente novamente.', variant: 'destructive' })
    } finally {
      setQrLoading(false)
    }
  }

  useEffect(() => {
    if (qrData && connectionStatus && !connectionStatus.connected) {
      intervalRef.current = setInterval(async () => {
        try {
          const data = await whatsappClientService.getMyWhatsAppStatus()
          if (data?.connected) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            setQrData(null)
            setConnectionStatus(data)
            toast({ description: 'WhatsApp conectado com sucesso!' })
          }
        } catch (err) {
          // silent ignore
        }
      }, 15000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [qrData, connectionStatus, toast])

  if (loading) {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center min-h-[200px] gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <p className="text-[15px] font-medium text-muted-foreground">Verificando conexao...</p>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus?.status === 'error') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-xl font-semibold">Erro ao verificar WhatsApp</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Nao foi possivel verificar o status da conexao.
          </p>
          <Button onClick={fetchStatus} variant="outline" className="w-full mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!connectionStatus?.configured || connectionStatus?.status === 'not_configured') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center gap-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold">WhatsApp nao configurado</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Sua integracao com WhatsApp ainda nao foi ativada. Entre em contato com o administrador
            para configurar.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus?.configured && !connectionStatus?.connected) {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center">
          <h3 className="text-xl font-semibold">Conectar WhatsApp</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Escaneie o QR Code abaixo com o WhatsApp do seu celular para conectar.
          </p>

          {!qrData ? (
            <Button
              onClick={generateQrCode}
              disabled={qrLoading}
              className="w-full mt-6 h-12 text-base gap-2"
            >
              {qrLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Smartphone className="h-5 w-5" />
              )}
              Gerar QR Code
            </Button>
          ) : (
            <div className="w-full flex flex-col items-center mt-6">
              {qrData.base64 && (
                <>
                  <div className="p-2 bg-white rounded-xl border border-border shadow-sm">
                    <img
                      src={`data:image/png;base64,${qrData.base64}`}
                      alt="QR Code"
                      style={{ width: 280, height: 280 }}
                      className="object-contain"
                    />
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed">
                    Abra o WhatsApp no celular, va em Dispositivos Conectados e escaneie o codigo
                    acima.
                  </p>
                </>
              )}
              {qrData.pairingCode && (
                <div className="mt-6 w-full text-left">
                  <p className="text-[13px] font-medium text-foreground mb-2">
                    Ou use o codigo de pareamento:
                  </p>
                  <div className="flex items-center justify-between bg-secondary p-3 px-4 rounded-lg border border-border">
                    <span className="font-mono text-[18px] font-bold tracking-widest">
                      {qrData.pairingCode}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(qrData.pairingCode)
                        toast({ description: 'Codigo copiado!' })
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <Button
                onClick={generateQrCode}
                disabled={qrLoading}
                variant="outline"
                className="w-full mt-6 gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', qrLoading && 'animate-spin')} />
                Gerar Novo QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus?.connected && tenantId) {
    return (
      <div className="flex flex-col h-full w-full bg-background border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="h-[48px] border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[13px] text-muted-foreground font-medium">
              WhatsApp conectado {connectionStatus.phone ? `(${connectionStatus.phone})` : ''}
            </span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-2 h-8 text-[13px]"
              >
                <Unplug className="h-3.5 w-3.5" />
                Desconectar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza? Voce precisara escanear o QR Code novamente para reconectar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => {
                    toast({
                      description: 'Para desconectar, entre em contato com o administrador.',
                    })
                  }}
                >
                  Sim, Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface tenantId={tenantId} />
        </div>
      </div>
    )
  }

  return null
}

interface Conversation {
  id: string
  phone_number: string
  last_message_at: string
  is_bot_active: boolean
  unread_count: number
  patient_id?: string
  patient?: { full_name: string }
  lastMessagePreview?: string
}

interface Message {
  id: string
  content: string
  created_at: string
  direction: string
  sender_type: string
  message_type: string
  delivery_status?: string
  isOptimistic?: boolean
  isError?: boolean
  conversation_id?: string
}

function ChatInterface({ tenantId }: { tenantId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [search, setSearch] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [inputText, setInputText] = useState('')
  const [searchParams] = useSearchParams()
  const phoneParam = searchParams.get('phone')
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)

  selectedIdRef.current = selectedConv?.id || null

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true)
    const { data: convData } = await supabase
      .from('conversations')
      .select('*, patient:patients(full_name)')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })
      .limit(30)

    if (convData) {
      const ids = convData.map((c) => c.id)
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('conversation_id, content')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })

        const prepped = convData.map((c) => {
          const m = msgs?.find((msg) => msg.conversation_id === c.id)
          return {
            ...c,
            patient: Array.isArray(c.patient) ? c.patient[0] : c.patient,
            lastMessagePreview: m?.content?.substring(0, 50),
          }
        })
        setConversations(prepped as any)
      } else {
        setConversations([])
      }
    }
    setLoadingConvs(false)
  }, [tenantId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (phoneParam && conversations.length > 0) {
      const existing = conversations.find((c) => c.phone_number === phoneParam)
      if (existing && !selectedConv) {
        selectConversation(existing)
      } else if (!existing && !selectedConv) {
        const createNew = async () => {
          const { data: patient } = await supabase
            .from('patients')
            .select('id, full_name')
            .eq('phone', phoneParam)
            .eq('tenant_id', tenantId)
            .limit(1)
            .single()
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              tenant_id: tenantId,
              patient_id: patient?.id,
              phone_number: phoneParam,
              last_message_at: new Date().toISOString(),
              status: 'active',
              is_bot_active: true,
              unread_count: 0,
            })
            .select('*, patient:patients(full_name)')
            .single()

          if (newConv) {
            setConversations((prev) => [newConv as any, ...prev])
            selectConversation(newConv as any)
          }
        }
        createNew()
      }
    }
  }, [phoneParam, conversations, selectedConv, tenantId])

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv)
    setLoadingMessages(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setMessages(data.reverse())
      setTimeout(() => scrollToBottom(), 100)
    }

    if (conv.unread_count > 0) {
      await supabase.from('conversations').update({ unread_count: 0 }).eq('id', conv.id)
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)),
      )
    }

    setLoadingMessages(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          if (newMessage.conversation_id === selectedIdRef.current) {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) => !(m.isOptimistic && m.content === newMessage.content),
              )
              return [...filtered, newMessage]
            })
            setTimeout(scrollToBottom, 100)
          } else {
            setConversations((prev) => {
              const idx = prev.findIndex((c) => c.id === newMessage.conversation_id)
              if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  lastMessagePreview: newMessage.content.substring(0, 50),
                  unread_count: updated[idx].unread_count + 1,
                  last_message_at: newMessage.created_at,
                }
                return updated.sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
                )
              }
              return prev
            })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          if (updated.conversation_id === selectedIdRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === updated.id || (m.isOptimistic && m.content === updated.content)
                  ? updated
                  : m,
              ),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedConv) return

    const text = inputText.trim()
    setInputText('')

    const tempId = `temp-${Date.now()}`
    const optimisticMsg: Message = {
      id: tempId,
      content: text,
      created_at: new Date().toISOString(),
      direction: 'outbound',
      sender_type: 'human',
      message_type: 'text',
      isOptimistic: true,
      delivery_status: 'sending',
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(scrollToBottom, 100)

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { number: selectedConv.phone_number, text, conversationId: selectedConv.id },
      })
      if (error || !data.success) throw new Error()
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, isError: true, delivery_status: 'failed' } : m)),
      )
      toast({ description: 'Nao foi possivel enviar. Tente novamente.', variant: 'destructive' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const toggleBot = async () => {
    if (!selectedConv) return
    const newState = !selectedConv.is_bot_active
    await supabase
      .from('conversations')
      .update({ is_bot_active: newState })
      .eq('id', selectedConv.id)
    setSelectedConv((prev) => (prev ? { ...prev, is_bot_active: newState } : null))
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConv.id ? { ...c, is_bot_active: newState } : c)),
    )
    toast({
      description: newState ? 'Bot reativado para esta conversa' : 'Voce assumiu a conversa',
    })
  }

  const filteredConvs = conversations.filter((c) => {
    const term = search.toLowerCase()
    return c.patient?.full_name?.toLowerCase().includes(term) || c.phone_number.includes(term)
  })

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return 'ontem'
    return format(d, 'dd/MM')
  }

  return (
    <div className="w-full h-full flex overflow-hidden bg-background">
      <div
        className={cn(
          'w-full lg:w-[340px] shrink-0 flex flex-col bg-card border-r border-border h-full',
          selectedConv ? 'hidden lg:flex' : 'flex',
        )}
      >
        <div className="p-[16px] shrink-0">
          <div className="relative">
            <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 h-[16px] w-[16px] text-muted-foreground" />
            <input
              placeholder="Buscar conversa..."
              className="w-full h-[40px] bg-secondary border-none rounded-full pl-[36px] pr-[16px] text-[13px] outline-none placeholder:text-muted-foreground/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          {loadingConvs ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-[12px] p-[12px] px-[16px] border-b border-border/30">
                <Skeleton className="h-[44px] w-[44px] rounded-full shrink-0" />
                <div className="space-y-2 flex-1 mt-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-[13px]">
              {search
                ? 'Nenhuma conversa encontrada.'
                : 'Nenhuma conversa ainda. Quando pacientes enviarem mensagens, elas aparecerao aqui.'}
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredConvs.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={cn(
                    'p-[12px] px-[16px] flex gap-[12px] cursor-pointer border-b border-border/30 transition-colors',
                    selectedConv?.id === conv.id
                      ? 'bg-primary/[0.08] border-l-[3px] border-l-primary'
                      : 'hover:bg-secondary/50 border-l-[3px] border-l-transparent',
                  )}
                >
                  <div className="h-[44px] w-[44px] rounded-full bg-primary/10 shrink-0 flex items-center justify-center">
                    {conv.patient?.full_name ? (
                      <span className="text-[16px] font-semibold text-primary">
                        {conv.patient.full_name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Phone className="h-[18px] w-[18px] text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-[14px] font-medium text-foreground truncate">
                      {conv.patient?.full_name || conv.phone_number}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate mt-[2px]">
                      {conv.lastMessagePreview || 'Iniciou uma conversa'}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end justify-center gap-[4px]">
                    <span className="text-[11px] text-muted-foreground">
                      {formatTimestamp(conv.last_message_at)}
                    </span>
                    {conv.unread_count > 0 ? (
                      <div className="min-w-[20px] h-[20px] rounded-full bg-success text-white text-[11px] font-semibold flex items-center justify-center px-[6px]">
                        {conv.unread_count}
                      </div>
                    ) : conv.is_bot_active ? (
                      <Bot className="h-[14px] w-[14px] text-primary/60" />
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full h-[36px] text-[12px] text-muted-foreground rounded-none"
              >
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 flex flex-col h-full bg-background',
          !selectedConv ? 'hidden lg:flex' : 'flex',
        )}
      >
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <MessageCircle className="h-[48px] w-[48px] text-muted-foreground/30" />
            <h3 className="text-[16px] font-medium text-muted-foreground mt-[12px]">
              Selecione uma conversa
            </h3>
            <p className="text-[13px] text-muted-foreground/70 mt-1">
              Escolha uma conversa ao lado para comecar a responder.
            </p>
          </div>
        ) : (
          <>
            <div className="p-[12px] px-[20px] border-b border-border flex items-center justify-between shrink-0 bg-card">
              <div className="flex items-center gap-[12px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-[32px] w-[32px] -ml-2 text-foreground"
                  onClick={() => setSelectedConv(null)}
                >
                  <ArrowLeft className="h-[20px] w-[20px]" />
                </Button>
                <div className="flex flex-col">
                  {selectedConv.patient_id ? (
                    <Link
                      to={`/crm/patients/${selectedConv.patient_id}`}
                      className="text-[15px] font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {selectedConv.patient?.full_name || selectedConv.phone_number}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-semibold text-foreground">
                      {selectedConv.phone_number}
                    </span>
                  )}
                  <span className="text-[12px] font-mono text-muted-foreground">
                    {selectedConv.phone_number}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {new Date().getTime() - new Date(selectedConv.last_message_at).getTime() <
                      300000 && (
                      <>
                        <span className="relative flex h-[6px] w-[6px]">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-success"></span>
                        </span>
                        <span className="text-[11px] text-success font-medium">Online</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                {selectedConv.is_bot_active ? (
                  <Button
                    variant="outline"
                    className="h-[36px] text-[12px] gap-[4px]"
                    onClick={toggleBot}
                  >
                    <Hand className="h-[14px] w-[14px]" />
                    Assumir
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-[36px] text-[12px] gap-[4px] border-primary text-primary hover:bg-primary/5"
                    onClick={toggleBot}
                  >
                    <Bot className="h-[14px] w-[14px]" />
                    Devolver ao Bot
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-[20px] bg-secondary/10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent relative">
              {loadingMessages ? (
                <div className="flex flex-col gap-[16px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}
                    >
                      <Skeleton
                        className={cn(
                          'h-[64px] w-[200px] sm:w-[300px]',
                          i % 2 === 0
                            ? 'rounded-[12px_12px_12px_2px]'
                            : 'rounded-[12px_12px_2px_12px]',
                        )}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-[8px] pb-[16px]">
                  {messages.map((msg, i) => {
                    const showDate =
                      i === 0 ||
                      format(new Date(messages[i - 1].created_at), 'yyyy-MM-dd') !==
                        format(new Date(msg.created_at), 'yyyy-MM-dd')
                    const isOutbound = msg.direction === 'outbound'

                    return (
                      <div key={msg.id} className="flex flex-col">
                        {showDate && (
                          <div className="flex items-center justify-center my-[20px]">
                            <span className="text-[11px] text-muted-foreground bg-secondary px-[12px] py-[4px] rounded-full font-medium">
                              {isToday(new Date(msg.created_at))
                                ? 'Hoje'
                                : isYesterday(new Date(msg.created_at))
                                  ? 'Ontem'
                                  : format(new Date(msg.created_at), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            'flex w-full',
                            isOutbound ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] lg:max-w-[65%] p-[10px] px-[14px] shadow-sm relative group',
                              isOutbound
                                ? 'bg-primary/10 rounded-[12px_12px_2px_12px]'
                                : 'bg-card border border-border/50 rounded-[12px_12px_12px_2px]',
                              msg.isError && 'border border-destructive/30 bg-destructive/5',
                            )}
                          >
                            <div className="text-[14px] text-foreground leading-[1.5] whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>

                            <div
                              className={cn(
                                'text-[10px] text-muted-foreground mt-[4px] flex items-center gap-[4px] justify-end',
                              )}
                            >
                              {format(new Date(msg.created_at), 'HH:mm')}

                              {isOutbound && !msg.isError && (
                                <>
                                  {msg.sender_type === 'bot' ? (
                                    <Bot className="h-[12px] w-[12px] text-muted-foreground/70 ml-[2px]" />
                                  ) : (
                                    <UserIcon className="h-[12px] w-[12px] text-muted-foreground/70 ml-[2px]" />
                                  )}

                                  {msg.isOptimistic ? (
                                    <Check className="h-[14px] w-[14px] text-muted-foreground/50" />
                                  ) : msg.delivery_status === 'read' ? (
                                    <CheckCheck className="h-[14px] w-[14px] text-primary" />
                                  ) : msg.delivery_status === 'delivered' ? (
                                    <CheckCheck className="h-[14px] w-[14px] text-muted-foreground" />
                                  ) : (
                                    <Check className="h-[14px] w-[14px] text-muted-foreground" />
                                  )}
                                </>
                              )}
                            </div>

                            {msg.isError && (
                              <div className="flex items-center gap-[6px] mt-[4px] pt-[4px] border-t border-destructive/10">
                                <AlertTriangle className="h-[12px] w-[12px] text-destructive" />
                                <span className="text-[10px] text-muted-foreground">
                                  Falha ao enviar
                                </span>
                                <button
                                  onClick={sendMessage}
                                  className="text-[10px] font-medium text-primary hover:underline ml-[4px]"
                                >
                                  Reenviar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="p-[12px] px-[20px] border-t border-border flex items-end gap-[12px] shrink-0 bg-card">
              <div className="flex-1 bg-input border border-border rounded-[20px] p-[10px] px-[16px] flex items-center">
                <textarea
                  className="w-full text-[14px] bg-transparent border-none resize-none min-h-[20px] max-h-[120px] outline-none focus:ring-0 p-0 m-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full placeholder:text-muted-foreground/50"
                  placeholder="Digite uma mensagem..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  style={{ height: '20px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = '20px'
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                  }}
                />
              </div>
              <button
                className="h-[44px] w-[44px] rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                onClick={sendMessage}
                disabled={!inputText.trim()}
              >
                <ArrowUp className="h-[20px] w-[20px] text-primary-foreground" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
