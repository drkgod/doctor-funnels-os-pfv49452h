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
  Check,
  CheckCheck,
  ArrowLeft,
  AlertCircle,
  Phone,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  Copy,
  Unplug,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { useSearchParams, Link } from 'react-router-dom'
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

  const [connectionStatus, setConnectionStatus] = useState<string>('loading')
  const [statusData, setStatusData] = useState<any>(null)

  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState<any>(null)

  const intervalRef = useRef<any>(null)
  const pollCountRef = useRef(0)

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

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-status', { body: {} })
      if (error || !data) {
        setConnectionStatus('error')
        sessionStorage.removeItem('whatsapp-connected')
        sessionStorage.removeItem('whatsapp-status-data')
        return
      }

      const isConnected = data.connected || (data.status && data.status.connected)

      if (isConnected) {
        setConnectionStatus('connected')
        setStatusData(data)
        sessionStorage.setItem('whatsapp-connected', 'true')
        sessionStorage.setItem('whatsapp-status-data', JSON.stringify(data))
      } else if (data.configured) {
        setConnectionStatus('disconnected')
        sessionStorage.removeItem('whatsapp-connected')
        sessionStorage.removeItem('whatsapp-status-data')
      } else {
        setConnectionStatus('not_configured')
        sessionStorage.removeItem('whatsapp-connected')
        sessionStorage.removeItem('whatsapp-status-data')
      }
    } catch (e) {
      setConnectionStatus('error')
      sessionStorage.removeItem('whatsapp-connected')
      sessionStorage.removeItem('whatsapp-status-data')
    }
  }, [])

  useEffect(() => {
    const cachedConnected = sessionStorage.getItem('whatsapp-connected')
    const cachedData = sessionStorage.getItem('whatsapp-status-data')

    if (cachedConnected === 'true' && cachedData) {
      setConnectionStatus('connected')
      try {
        setStatusData(JSON.parse(cachedData))
      } catch (e) {}
    }

    checkStatus()
  }, [checkStatus])

  const generateQrCode = async () => {
    setQrLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', { body: {} })
      if (error) throw new Error(error.message || 'Erro na requisição')
      if (!data) throw new Error('Sem resposta')

      const qrCodeValue =
        data.instance?.qrcode || data.qrcode || data.base64 || data.qr || data.image
      const pairingCodeValue = data.instance?.paircode || data.pairingCode || data.pairing_code
      const instanceStatus = data.instance?.status

      let finalQrCode = qrCodeValue
      if (finalQrCode && !finalQrCode.startsWith('data:')) {
        finalQrCode = `data:image/png;base64,${finalQrCode}`
      }

      setQrData({
        qrCode: finalQrCode,
        pairingCode: pairingCodeValue,
        status: instanceStatus,
      })

      pollCountRef.current = 0
    } catch (e: any) {
      toast({ description: 'Erro ao gerar QR Code. Tente novamente.', variant: 'destructive' })
    } finally {
      setQrLoading(false)
    }
  }

  useEffect(() => {
    if (qrData && connectionStatus === 'disconnected') {
      pollCountRef.current = 0
      intervalRef.current = setInterval(async () => {
        pollCountRef.current += 1
        if (pollCountRef.current >= 18) {
          clearInterval(intervalRef.current)
          toast({ description: 'Tempo esgotado. Clique em Gerar QR Code novamente.' })
          setQrData(null)
          return
        }

        try {
          const { data, error } = await supabase.functions.invoke('whatsapp-status', { body: {} })
          if (!error && data) {
            const isConnected = data.connected || (data.status && data.status.connected)
            if (isConnected) {
              clearInterval(intervalRef.current)
              setConnectionStatus('connected')
              setStatusData(data)
              setQrData(null)
              sessionStorage.setItem('whatsapp-connected', 'true')
              sessionStorage.setItem('whatsapp-status-data', JSON.stringify(data))
              toast({ description: 'WhatsApp conectado com sucesso!' })
            }
          }
        } catch (err) {}
      }, 10000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [qrData, connectionStatus, toast])

  if (connectionStatus === 'loading') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center min-h-[200px] gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <p className="text-[15px] font-medium text-muted-foreground">
            Verificando conexao WhatsApp...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-xl font-semibold">Erro ao verificar WhatsApp</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Nao foi possivel verificar o status da conexao.
          </p>
          <Button onClick={checkStatus} variant="outline" className="w-full mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'not_configured') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center gap-4">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold">WhatsApp nao configurado</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Entre em contato com o administrador para configurar sua integracao com WhatsApp.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'disconnected') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center">
          <h3 className="text-xl font-semibold">Conectar WhatsApp</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed mt-2">
            Escaneie o QR Code abaixo com o WhatsApp do seu celular para conectar.
          </p>

          {qrLoading ? (
            <div className="flex flex-col items-center justify-center w-full mt-6 space-y-4">
              <Skeleton className="w-[280px] h-[280px] rounded-xl" />
              <p className="text-[14px] font-medium text-muted-foreground animate-pulse">
                Gerando QR Code...
              </p>
            </div>
          ) : qrData?.qrCode ? (
            <div className="w-full flex flex-col items-center mt-6">
              <div className="flex items-center justify-center p-2 bg-white rounded-xl border border-border shadow-sm">
                <img
                  src={qrData.qrCode}
                  alt="QR Code WhatsApp"
                  width={280}
                  height={280}
                  style={{ width: 280, height: 280 }}
                  className="object-contain"
                />
              </div>
              <p className="text-[13px] text-muted-foreground mt-4 leading-relaxed text-center">
                Abra o WhatsApp no seu celular, va em Dispositivos Conectados e escaneie o codigo
                acima.
              </p>

              {typeof qrData.pairingCode === 'string' && qrData.pairingCode.trim() !== '' && (
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
                <RefreshCw className="h-4 w-4" />
                Gerar Novo QR Code
              </Button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center mt-6">
              {qrData && !qrData.qrCode && (
                <p className="text-[13px] text-destructive mb-4 text-center">
                  QR Code nao retornado. Tente novamente.
                </p>
              )}
              <Button
                onClick={generateQrCode}
                disabled={qrLoading}
                className="w-full h-12 text-base gap-2"
              >
                <Smartphone className="h-5 w-5" />
                Gerar QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'connected' && tenantId) {
    return (
      <div className="flex flex-col h-full w-full bg-background border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="h-[48px] border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[13px] text-muted-foreground font-medium">
              WhatsApp conectado
              {statusData?.instance?.name ? ` - ${statusData.instance.name}` : ''}
              {statusData?.status?.jid
                ? ` (${statusData.status.jid.split('@')[0]})`
                : statusData?.instance?.owner
                  ? ` (${statusData.instance.owner.split('@')[0]})`
                  : ''}
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
                      description:
                        'Para desconectar, abra as configuracoes do WhatsApp no celular.',
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

const colors = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
]
const getAvatarColor = (name: string) => {
  if (!name) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
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
      .limit(50)

    if (convData) {
      const ids = convData.map((c) => c.id)
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('conversation_id, content, direction')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })

        const prepped = convData.map((c) => {
          const m = msgs?.find((msg) => msg.conversation_id === c.id)
          return {
            ...c,
            patient: Array.isArray(c.patient) ? c.patient[0] : c.patient,
            lastMessagePreview: m
              ? m.direction === 'outbound'
                ? `Voce: ${m.content.substring(0, 50)}`
                : m.content.substring(0, 50)
              : 'Iniciou uma conversa',
          }
        })
        setConversations(prepped as any)
      } else {
        setConversations(convData as any)
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
    const channelMsgs = supabase
      .channel('whatsapp_realtime_msgs')
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
          }
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === newMessage.conversation_id)
            if (idx >= 0) {
              const updated = [...prev]
              const prefix = newMessage.direction === 'outbound' ? 'Voce: ' : ''
              updated[idx] = {
                ...updated[idx],
                lastMessagePreview: `${prefix}${newMessage.content.substring(0, 50)}`,
                unread_count:
                  newMessage.conversation_id === selectedIdRef.current
                    ? 0
                    : updated[idx].unread_count + (newMessage.direction === 'inbound' ? 1 : 0),
                last_message_at: newMessage.created_at,
              }
              return updated.sort(
                (a, b) =>
                  new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
              )
            }
            return prev
          })
        },
      )
      .subscribe()

    const channelConvs = supabase
      .channel('whatsapp_realtime_convs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const updated = payload.new as Conversation
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === updated.id)
            if (idx >= 0) {
              const newArr = [...prev]
              newArr[idx] = { ...newArr[idx], ...updated }
              return newArr.sort(
                (a, b) =>
                  new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
              )
            }
            return prev
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelMsgs)
      supabase.removeChannel(channelConvs)
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
      toast({ description: 'Erro ao enviar mensagem.', variant: 'destructive' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
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
            <div className="p-8 text-center text-muted-foreground text-[13px] flex flex-col items-center">
              <MessageCircle className="h-8 w-8 mb-3 opacity-50" />
              {search
                ? 'Nenhuma conversa encontrada.'
                : 'Nenhuma conversa ainda. Quando pacientes enviarem mensagens pelo WhatsApp, elas aparecerão aqui.'}
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredConvs.map((conv) => {
                const displayName = conv.patient?.full_name || conv.phone_number
                const avatarColor = getAvatarColor(displayName)
                return (
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
                    <div
                      className={cn(
                        'h-[44px] w-[44px] rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-[16px]',
                        avatarColor,
                      )}
                    >
                      {conv.patient?.full_name ? (
                        conv.patient.full_name.charAt(0).toUpperCase()
                      ) : (
                        <Phone className="h-[18px] w-[18px] text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div
                        className={cn(
                          'text-[14px] font-bold text-foreground truncate',
                          conv.unread_count > 0 && 'text-foreground',
                        )}
                      >
                        {displayName}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">
                        {conv.phone_number !== displayName ? conv.phone_number : ''}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate mt-[2px]">
                        {conv.lastMessagePreview || 'Iniciou uma conversa'}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end justify-center gap-[4px]">
                      <span
                        className={cn(
                          'text-[11px]',
                          conv.unread_count > 0
                            ? 'text-primary font-bold'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatTimestamp(conv.last_message_at)}
                      </span>
                      {conv.unread_count > 0 ? (
                        <div className="min-w-[20px] h-[20px] rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center px-[6px]">
                          {conv.unread_count}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
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
                </div>
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
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                  <MessageCircle className="h-10 w-10 opacity-30" />
                  <p className="text-[14px]">Nenhuma mensagem nesta conversa.</p>
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
                              'flex flex-col max-w-[80%] lg:max-w-[65%]',
                              isOutbound ? 'items-end' : 'items-start',
                            )}
                          >
                            {msg.sender_type === 'bot' && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mb-1">
                                Bot
                              </span>
                            )}
                            <div
                              className={cn(
                                'p-[10px] px-[14px] shadow-sm relative group',
                                isOutbound
                                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-none'
                                  : 'bg-muted text-foreground rounded-2xl rounded-bl-none',
                                msg.isError &&
                                  'border border-destructive bg-destructive/10 text-foreground',
                                msg.isOptimistic && 'opacity-60',
                              )}
                            >
                              <div className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words">
                                {msg.content}
                              </div>
                              <div
                                className={cn(
                                  'text-[10px] mt-[4px] flex items-center gap-[4px] justify-end',
                                  isOutbound
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {format(new Date(msg.created_at), 'HH:mm')}
                                {isOutbound &&
                                  !msg.isError &&
                                  (msg.isOptimistic ? (
                                    <Check className="h-[12px] w-[12px]" />
                                  ) : (
                                    <CheckCheck className="h-[12px] w-[12px]" />
                                  ))}
                              </div>
                            </div>
                            {msg.isError && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                <span className="text-[10px] text-destructive">
                                  Falha ao enviar
                                </span>
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
                  className="w-full text-[14px] bg-transparent border-none resize-none outline-none focus:ring-0 p-0 m-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full placeholder:text-muted-foreground/50"
                  placeholder="Digite uma mensagem..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  style={{ height: '24px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = '24px'
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                  }}
                />
              </div>
              <Button
                size="icon"
                className="h-[44px] w-[44px] rounded-full shrink-0"
                onClick={sendMessage}
                disabled={!inputText.trim()}
              >
                <Send className="h-[20px] w-[20px]" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
