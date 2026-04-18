import { useState, useEffect, useRef, useCallback } from 'react'
import { GenericPage } from '@/components/GenericPage'
import { ModuleGate } from '@/components/ModuleGate'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Paperclip,
  Camera,
  Mic,
  Video,
  FileText,
  Smile,
  MapPin,
  UserCircle,
  UserPlus,
  Play,
  Pause,
  Download,
  Trash2,
  Square,
  X,
  Pencil,
  ExternalLink,
  ImageOff,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { uploadMedia, formatFileSize } from '@/services/whatsapp-media-service'

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
        .then(({ data }) => setTenantId(data?.tenant_id || null))
    }
  }, [user])

  const checkStatus = useCallback(async (isInitial = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-status', { body: {} })
      if (error || !data) {
        setConnectionStatus('error')
        sessionStorage.removeItem('whatsapp-connected')
        sessionStorage.removeItem('whatsapp-status-data')
        return
      }

      const isConnected =
        data.connected === true ||
        data.instance?.status === 'connected' ||
        data.instance?.status === 'open' ||
        data.status?.connected === true ||
        data.status?.loggedIn === true

      if (isConnected) {
        setConnectionStatus('connected')
        setStatusData(data)
        sessionStorage.setItem('whatsapp-connected', 'true')
        sessionStorage.setItem('whatsapp-status-data', JSON.stringify(data))
      } else if (data.configured || data.instance || data.success) {
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
    }
  }, [])

  useEffect(() => {
    const cachedConnected = sessionStorage.getItem('whatsapp-connected')
    const cachedData = sessionStorage.getItem('whatsapp-status-data')
    if (cachedConnected === 'true' && cachedData) {
      setConnectionStatus('connected')
      try {
        setStatusData(JSON.parse(cachedData))
      } catch (e) {
        /* ignore */
      }
      checkStatus(true)
    } else {
      checkStatus(true)
    }
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
      let finalQrCode = qrCodeValue
      if (finalQrCode && !finalQrCode.startsWith('data:'))
        finalQrCode = `data:image/png;base64,${finalQrCode}`

      setQrData({
        qrCode: finalQrCode,
        pairingCode: pairingCodeValue,
        status: data.instance?.status,
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
            const isConnected =
              data.connected === true ||
              data.instance?.status === 'connected' ||
              data.instance?.status === 'open' ||
              data.status?.connected === true ||
              data.status?.loggedIn === true
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
        } catch (err) {
          // ignore error
        }
      }, 10000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [qrData, connectionStatus, toast])

  if (connectionStatus === 'loading')
    return (
      <div className="p-8 text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
      </div>
    )
  if (connectionStatus === 'error')
    return <div className="p-8 text-center text-destructive">Erro na conexão</div>
  if (connectionStatus === 'not_configured')
    return <div className="p-8 text-center">WhatsApp não configurado</div>

  if (connectionStatus === 'disconnected') {
    return (
      <Card className="w-full max-w-[440px] mx-auto mt-[80px] p-[40px] text-center bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-0 flex flex-col items-center justify-center">
          <h3 className="text-xl font-semibold">Conectar WhatsApp</h3>
          {qrLoading ? (
            <div className="mt-6 space-y-4 flex flex-col items-center">
              <Skeleton className="w-[280px] h-[280px] rounded-xl" />
              <p className="animate-pulse">Gerando QR Code...</p>
            </div>
          ) : qrData?.qrCode ? (
            <div className="mt-6 flex flex-col items-center w-full">
              <div className="p-2 bg-white rounded-xl border">
                <img
                  src={qrData.qrCode}
                  alt="QR Code"
                  style={{ width: 280, height: 280 }}
                  className="object-contain"
                />
              </div>
              {typeof qrData.pairingCode === 'string' && qrData.pairingCode.trim() !== '' && (
                <div className="mt-6 w-full text-left">
                  <p className="mb-2">Ou use o código de pareamento:</p>
                  <div className="flex justify-between bg-secondary p-3 px-4 rounded-lg border">
                    <span className="font-mono text-lg font-bold">{qrData.pairingCode}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(qrData.pairingCode)
                        toast({ description: 'Copiado!' })
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
            <Button
              onClick={generateQrCode}
              disabled={qrLoading}
              className="w-full h-12 mt-6 gap-2"
            >
              <Smartphone className="h-5 w-5" />
              Gerar QR Code
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'connected' && tenantId) {
    return (
      <div className="flex flex-col h-full w-full bg-background border rounded-xl shadow-sm overflow-hidden">
        <div className="h-[48px] border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[13px] text-muted-foreground font-medium">
              WhatsApp conectado
            </span>
          </div>
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
const getAvatarColor = (name: string) =>
  colors[Math.abs(Array.from(name).reduce((a, b) => a + b.charCodeAt(0), 0)) % colors.length]

interface Conversation {
  id: string
  phone_number: string
  last_message_at: string
  is_bot_active: boolean
  unread_count: number
  patient_id?: string
  patient?: { full_name: string }
  lastMessagePreview?: string
  last_message_type?: string
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
  media_url?: string
  media_filename?: string
  media_size?: number
  media_thumbnail_url?: string
  latitude?: number
  longitude?: number
}

const formatTimeDuration = (secs: number) => {
  if (!secs || isNaN(secs)) return '00:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function CustomAudioPlayer({ src, isOutbound }: { src: string; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [error, setError] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setProgress((audio.currentTime / (audio.duration || 1)) * 100)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }
    const onError = () => setError(true)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    const newTime = (Number(e.target.value) / 100) * (audioRef.current.duration || 0)
    audioRef.current.currentTime = newTime
    setProgress(Number(e.target.value))
  }

  const toggleSpeed = () => {
    if (!audioRef.current) return
    const newRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
    audioRef.current.playbackRate = newRate
    setPlaybackRate(newRate)
  }

  if (error) {
    return <div className="text-[12px] opacity-80 py-2">Audio indisponivel</div>
  }

  return (
    <div className="flex items-center gap-3 w-[220px]">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        onClick={togglePlay}
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          isOutbound ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col justify-center">
        <input
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={handleSeek}
          className={cn(
            'h-1 rounded-full appearance-none bg-black/10 cursor-pointer',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full',
            isOutbound
              ? '[&::-webkit-slider-thumb]:bg-primary-foreground'
              : '[&::-webkit-slider-thumb]:bg-primary',
          )}
        />
        <div className="flex justify-between mt-1 items-center">
          <span className="text-[10px] opacity-70">{formatTimeDuration(duration)}</span>
          <button
            onClick={toggleSpeed}
            className="text-[10px] font-medium opacity-70 hover:opacity-100"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  )
}

const MessageTypeIcon = ({ type }: { type: string }) => {
  if (type === 'image') return <Camera className="h-[14px] w-[14px]" />
  if (type === 'audio') return <Mic className="h-[14px] w-[14px]" />
  if (type === 'video') return <Video className="h-[14px] w-[14px]" />
  if (type === 'document') return <FileText className="h-[14px] w-[14px]" />
  if (type === 'sticker') return <Smile className="h-[14px] w-[14px]" />
  if (type === 'location') return <MapPin className="h-[14px] w-[14px]" />
  if (type === 'contact') return <UserCircle className="h-[14px] w-[14px]" />
  return null
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

  const {
    isRecording,
    duration: recDuration,
    audioBlob,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder()
  const [showAttachments, setShowAttachments] = useState(false)
  const [previewFile, setPreviewFile] = useState<{
    file: File
    type: string
    caption: string
  } | null>(null)
  const [locationModal, setLocationModal] = useState(false)
  const [contactModal, setContactModal] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileTypeAccept, setFileTypeAccept] = useState<string>('')
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false)
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)

  const [locData, setLocData] = useState({ lat: '', lng: '', name: '' })
  const [contactData, setContactData] = useState({ name: '', phone: '' })

  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')

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
          .select('conversation_id, content, direction, message_type')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
        const prepped = convData.map((c) => {
          const m = msgs?.find((msg) => msg.conversation_id === c.id)
          return {
            ...c,
            patient: Array.isArray(c.patient) ? c.patient[0] : c.patient,
            lastMessagePreview: m
              ? m.direction === 'outbound'
                ? `Voce: ${m.content.substring(0, 40)}`
                : m.content.substring(0, 40)
              : 'Iniciou uma conversa',
            last_message_type: m?.message_type || 'text',
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
    if (phoneParam && conversations.length > 0 && !selectedConv) {
      const existing = conversations.find((c) => c.phone_number === phoneParam)
      if (existing) selectConversation(existing)
    }
  }, [phoneParam, conversations, selectedConv])

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv)
    setLoadingMessages(true)
    setShowAttachments(false)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      const msgs = data.reverse()
      const processedMsgs = msgs.map((msg) => {
        if (msg.media_url && !msg.media_url.startsWith('http')) {
          const { data } = supabase.storage.from('whatsapp-media').getPublicUrl(msg.media_url)
          if (data?.publicUrl) {
            return { ...msg, media_url: data.publicUrl }
          }
        }
        return msg
      })
      setMessages(processedMsgs)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    if (conv.unread_count > 0) {
      await supabase.from('conversations').update({ unread_count: 0 }).eq('id', conv.id)
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)),
      )
    }
    setLoadingMessages(false)
  }

  const handleSaveName = async () => {
    if (!selectedConv || editNameValue.trim().length < 2) {
      toast({ description: 'Nome deve ter pelo menos 2 caracteres.', variant: 'destructive' })
      return
    }
    const newName = editNameValue.trim()

    if (selectedConv.patient_id) {
      await supabase
        .from('patients')
        .update({ full_name: newName })
        .eq('id', selectedConv.patient_id)
    } else {
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', selectedConv.phone_number)
        .maybeSingle()

      if (existingPatient) {
        await supabase.from('patients').update({ full_name: newName }).eq('id', existingPatient.id)
        await supabase
          .from('conversations')
          .update({ patient_id: existingPatient.id })
          .eq('id', selectedConv.id)
      } else {
        const { data: newPatient } = await supabase
          .from('patients')
          .insert({
            tenant_id: tenantId,
            full_name: newName,
            phone: selectedConv.phone_number,
            source: 'whatsapp',
            pipeline_stage: 'lead',
          })
          .select('id')
          .single()

        if (newPatient) {
          await supabase
            .from('conversations')
            .update({ patient_id: newPatient.id })
            .eq('id', selectedConv.id)
        }
      }
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConv.id) {
          return { ...c, patient: { ...c.patient, full_name: newName } }
        }
        return c
      }),
    )

    setSelectedConv((prev) =>
      prev ? { ...prev, patient: { ...prev.patient, full_name: newName } } : null,
    )
    setEditingName(false)
    toast({ description: 'Nome atualizado.' })
  }

  const handleLinkPatient = async () => {
    if (!selectedConv) return
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('phone', selectedConv.phone_number)
      .maybeSingle()

    if (existingPatient) {
      await supabase
        .from('conversations')
        .update({ patient_id: existingPatient.id })
        .eq('id', selectedConv.id)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConv.id
            ? { ...c, patient_id: existingPatient.id, patient: existingPatient }
            : c,
        ),
      )
      setSelectedConv((prev) =>
        prev ? { ...prev, patient_id: existingPatient.id, patient: existingPatient } : null,
      )
      toast({ description: `Paciente vinculado: ${existingPatient.full_name}` })
    } else {
      const { data: newPatient } = await supabase
        .from('patients')
        .insert({
          tenant_id: tenantId,
          full_name: selectedConv.patient?.full_name || selectedConv.phone_number,
          phone: selectedConv.phone_number,
          source: 'whatsapp',
          pipeline_stage: 'lead',
        })
        .select('id, full_name')
        .single()

      if (newPatient) {
        await supabase
          .from('conversations')
          .update({ patient_id: newPatient.id })
          .eq('id', selectedConv.id)
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConv.id ? { ...c, patient_id: newPatient.id, patient: newPatient } : c,
          ),
        )
        setSelectedConv((prev) =>
          prev ? { ...prev, patient_id: newPatient.id, patient: newPatient } : null,
        )
        toast({ description: 'Paciente criado na pipeline.' })
      }
    }
  }

  useEffect(() => {
    if (audioBlob) {
      setPreviewAudioUrl(URL.createObjectURL(audioBlob))
      setIsPreviewingAudio(true)
    }
  }, [audioBlob])

  const sendMessageText = async () => {
    if (!inputText.trim() || !selectedConv) return
    const text = inputText.trim()
    setInputText('')

    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        content: text,
        created_at: new Date().toISOString(),
        direction: 'outbound',
        sender_type: 'human',
        message_type: 'text',
        isOptimistic: true,
        delivery_status: 'sending',
      },
    ])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    try {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          tenant_id: tenantId || '',
          conversation_id: selectedConv.id || '',
          number: selectedConv.phone_number || '',
          type: 'text',
          text: text || '',
          media_url: '',
          filename: '',
        },
      })
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, isError: true, delivery_status: 'failed' } : m)),
      )
      toast({ description: 'Erro ao enviar.', variant: 'destructive' })
    }
  }

  const handleSendAudio = async () => {
    if (!audioBlob || !selectedConv) return
    setIsPreviewingAudio(false)
    setPreviewAudioUrl(null)
    try {
      const path = await uploadMedia(
        new File([audioBlob], 'audio.webm', { type: 'audio/webm' }),
        tenantId,
        selectedConv.id,
      )

      const { data: publicData } = supabase.storage.from('whatsapp-media').getPublicUrl(path)
      const displayUrl = publicData?.publicUrl || path

      const tempId = `temp-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content: '[Audio]',
          created_at: new Date().toISOString(),
          direction: 'outbound',
          sender_type: 'human',
          message_type: 'audio',
          media_url: displayUrl,
          isOptimistic: true,
          delivery_status: 'sending',
        },
      ])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          tenant_id: tenantId || '',
          conversation_id: selectedConv.id || '',
          number: selectedConv.phone_number || '',
          type: 'audio',
          text: '',
          media_url: path || '',
          filename: '',
        },
      })
    } catch (e: any) {
      toast({ description: 'Erro ao enviar arquivo. Tente novamente.', variant: 'destructive' })
    } finally {
      resetRecording()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewFile({
      file,
      type: fileTypeAccept.includes('image') ? 'image' : 'document',
      caption: '',
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSendFile = async () => {
    if (!previewFile || !selectedConv) return
    const { file, type, caption } = previewFile
    setPreviewFile(null)
    try {
      const path = await uploadMedia(file, tenantId, selectedConv.id)

      const { data: publicData } = supabase.storage.from('whatsapp-media').getPublicUrl(path)
      const displayUrl = publicData?.publicUrl || path

      const tempId = `temp-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content: caption || `[${type === 'image' ? 'Imagem' : 'Documento'}]`,
          created_at: new Date().toISOString(),
          direction: 'outbound',
          sender_type: 'human',
          message_type: type,
          media_filename: file.name,
          media_size: file.size,
          media_url: displayUrl,
          isOptimistic: true,
          delivery_status: 'sending',
        },
      ])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          tenant_id: tenantId || '',
          conversation_id: selectedConv.id || '',
          number: selectedConv.phone_number || '',
          type: type || 'document',
          text: caption || '',
          media_url: path || '',
          filename: file.name || '',
        },
      })
    } catch (e: any) {
      toast({ description: 'Erro ao enviar arquivo. Tente novamente.', variant: 'destructive' })
    }
  }

  const handleSendLocation = async () => {
    if (!locData.lat || !locData.lng || !selectedConv) return
    setLocationModal(false)
    try {
      const tempId = `temp-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content: locData.name || '[Localizacao]',
          created_at: new Date().toISOString(),
          direction: 'outbound',
          sender_type: 'human',
          message_type: 'location',
          latitude: parseFloat(locData.lat),
          longitude: parseFloat(locData.lng),
          isOptimistic: true,
          delivery_status: 'sending',
        },
      ])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          tenant_id: tenantId,
          conversation_id: selectedConv.id,
          number: selectedConv.phone_number,
          type: 'location',
          latitude: parseFloat(locData.lat),
          longitude: parseFloat(locData.lng),
          location_name: locData.name || '',
          location_address: '',
        },
      })
      setLocData({ lat: '', lng: '', name: '' })
    } catch (e: any) {
      toast({ description: 'Erro ao enviar localização.', variant: 'destructive' })
    }
  }

  const handleSendContact = async () => {
    if (!contactData.name || !contactData.phone || !selectedConv) return
    setContactModal(false)
    try {
      const tempId = `temp-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content: `[Contato: ${contactData.name}]`,
          created_at: new Date().toISOString(),
          direction: 'outbound',
          sender_type: 'human',
          message_type: 'contact',
          isOptimistic: true,
          delivery_status: 'sending',
        },
      ])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          tenant_id: tenantId,
          conversation_id: selectedConv.id,
          number: selectedConv.phone_number,
          type: 'contact',
          contact_name: contactData.name,
          contact_phone: contactData.phone,
        },
      })
      setContactData({ name: '', phone: '' })
    } catch (e: any) {
      toast({ description: 'Erro ao enviar contato.', variant: 'destructive' })
    }
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
              className="w-full h-[40px] bg-secondary border-none rounded-full pl-[36px] pr-[16px] text-[13px] outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
          {filteredConvs(conversations, search).map((conv) => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={cn(
                'p-[12px] px-[16px] flex gap-[12px] cursor-pointer border-b transition-colors',
                selectedConv?.id === conv.id
                  ? 'bg-primary/[0.08] border-l-[3px] border-l-primary'
                  : 'hover:bg-secondary/50 border-l-[3px] border-l-transparent',
              )}
            >
              <div
                className={cn(
                  'h-[44px] w-[44px] rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-[16px]',
                  getAvatarColor(conv.patient?.full_name || conv.phone_number),
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
                  {conv.patient?.full_name || conv.phone_number}
                </div>
                <div className="text-[12px] text-muted-foreground truncate mt-[2px] flex items-center gap-[4px]">
                  {conv.last_message_type && <MessageTypeIcon type={conv.last_message_type} />}
                  <span>{conv.lastMessagePreview || 'Iniciou uma conversa'}</span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end justify-center gap-[4px]">
                <span
                  className={cn(
                    'text-[11px]',
                    conv.unread_count > 0 ? 'text-primary font-bold' : 'text-muted-foreground',
                  )}
                >
                  {format(new Date(conv.last_message_at), 'HH:mm')}
                </span>
                {conv.unread_count > 0 && (
                  <div className="min-w-[20px] h-[20px] rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center px-[6px]">
                    {conv.unread_count}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 flex flex-col h-full bg-background',
          !selectedConv ? 'hidden lg:flex' : 'flex',
        )}
      >
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
            <MessageCircle className="h-[48px] w-[48px] mb-4" />
            <h3 className="text-[16px] font-medium text-muted-foreground">
              Selecione uma conversa
            </h3>
          </div>
        ) : (
          <>
            <div className="p-[12px] px-[20px] border-b flex flex-col justify-center shrink-0 bg-card relative">
              <div className="flex items-center gap-[12px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-[32px] w-[32px] -ml-2 shrink-0"
                  onClick={() => setSelectedConv(null)}
                >
                  <ArrowLeft className="h-[20px] w-[20px]" />
                </Button>
                <div className="flex flex-col min-w-0 w-full relative group/header">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="h-8 text-[15px] font-semibold px-2 w-[200px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName()
                          if (e.key === 'Escape') setEditingName(false)
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={handleSaveName}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditingName(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[15px] font-semibold cursor-pointer truncate"
                        onClick={() => {
                          setEditNameValue(
                            selectedConv.patient?.full_name || selectedConv.phone_number,
                          )
                          setEditingName(true)
                        }}
                      >
                        {selectedConv.patient?.full_name || selectedConv.phone_number}
                      </span>
                      <Pencil
                        className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/header:opacity-100 cursor-pointer transition-opacity"
                        onClick={() => {
                          setEditNameValue(
                            selectedConv.patient?.full_name || selectedConv.phone_number,
                          )
                          setEditingName(true)
                        }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] font-mono text-muted-foreground shrink-0">
                      {selectedConv.phone_number}
                    </span>
                    {!selectedConv.patient_id ? (
                      /[a-zA-Z]/.test(selectedConv.patient?.full_name || '') && (
                        <span className="text-[11px] text-muted-foreground/70 italic">
                          (nome do WhatsApp)
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70 italic">
                        (paciente cadastrado)
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center">
                    {!selectedConv.patient_id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 -ml-2 text-primary"
                        onClick={handleLinkPatient}
                      >
                        <UserPlus className="h-3 w-3" />
                        Adicionar a pipeline
                      </Button>
                    ) : (
                      <Link to={`/crm/patients/${selectedConv.patient_id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] gap-1 -ml-2 text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver paciente
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-[20px] bg-secondary/10 relative">
              <div className="flex flex-col gap-[8px] pb-[16px]">
                {messages.map((msg, i) => {
                  const isOutbound = msg.direction === 'outbound'
                  const hasBubbleBg = !['sticker'].includes(msg.message_type)
                  let contentNode = null

                  if (
                    !msg.media_url &&
                    ['image', 'audio', 'video', 'document', 'sticker'].includes(msg.message_type)
                  ) {
                    contentNode = (
                      <div
                        className={cn(
                          'text-[14px] leading-[1.5] whitespace-pre-wrap break-words italic opacity-80',
                        )}
                      >
                        {msg.content}
                      </div>
                    )
                  } else if (msg.message_type === 'image') {
                    contentNode = (
                      <div className="flex flex-col gap-1">
                        <img
                          src={msg.media_url || ''}
                          className="max-w-[280px] max-h-[280px] object-cover rounded-xl cursor-pointer"
                          onClick={() => setLightboxImage(msg.media_url!)}
                          alt="Imagem indisponivel"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.onerror = null
                            target.outerHTML =
                              '<div class="flex items-center justify-center flex-col w-[280px] h-[200px] bg-secondary/50 rounded-xl"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off text-muted-foreground mb-2"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.05-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg><span class="text-sm text-muted-foreground">Imagem indisponivel</span></div>'
                          }}
                        />
                        {msg.content && msg.content !== '[Imagem]' && (
                          <span className="text-[14px] mt-1">{msg.content}</span>
                        )}
                      </div>
                    )
                  } else if (msg.message_type === 'audio') {
                    contentNode = (
                      <div className="min-w-[200px]">
                        <CustomAudioPlayer src={msg.media_url || ''} isOutbound={isOutbound} />
                      </div>
                    )
                  } else if (msg.message_type === 'document') {
                    contentNode = (
                      <div
                        className="flex items-center gap-3 bg-background/10 p-2 rounded-xl cursor-pointer hover:bg-background/20 transition-colors"
                        onClick={() => msg.media_url && window.open(msg.media_url, '_blank')}
                      >
                        <FileText className="h-8 w-8 opacity-80" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[13px] font-medium truncate">
                            {msg.media_filename || 'Documento'}
                          </span>
                          {msg.media_size && (
                            <span className="text-[11px] opacity-70">
                              {formatFileSize(msg.media_size)}
                            </span>
                          )}
                        </div>
                        <Download className="h-4 w-4 opacity-80" />
                      </div>
                    )
                  } else if (msg.message_type === 'video') {
                    contentNode = (
                      <div className="relative max-w-[280px] rounded-xl overflow-hidden">
                        <video
                          src={msg.media_url || ''}
                          controls
                          className="w-full max-h-[280px] object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement
                            target.onerror = null
                            target.outerHTML =
                              '<div class="flex items-center justify-center flex-col w-[280px] h-[200px] bg-secondary/50 rounded-xl"><span class="text-sm text-muted-foreground">Video indisponivel</span></div>'
                          }}
                        />
                      </div>
                    )
                  } else if (msg.message_type === 'sticker') {
                    contentNode = (
                      <img
                        src={msg.media_url || ''}
                        className="w-[150px] h-[150px] object-contain bg-transparent shadow-none"
                        alt="Sticker"
                      />
                    )
                  } else if (msg.message_type === 'location') {
                    contentNode = (
                      <div
                        className="flex items-center gap-3 bg-background/10 p-2 rounded-xl cursor-pointer"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`,
                            '_blank',
                          )
                        }
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          {msg.content && msg.content !== '[Localizacao]' && (
                            <span className="text-[13px] font-medium truncate">{msg.content}</span>
                          )}
                          <span className="text-[11px] opacity-70">
                            Lat: {msg.latitude}, Lng: {msg.longitude}
                          </span>
                        </div>
                      </div>
                    )
                  } else if (msg.message_type === 'contact') {
                    contentNode = (
                      <div className="flex items-center gap-3 bg-background/10 p-2 rounded-xl">
                        <UserCircle className="h-10 w-10 opacity-80 shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0 mr-2">
                          <span className="text-[13px] font-medium truncate">
                            {msg.content?.replace('[Contato: ', '').replace(']', '') || 'Contato'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[11px]"
                          onClick={() => navigator.clipboard.writeText(msg.content || '')}
                        >
                          Salvar
                        </Button>
                      </div>
                    )
                  } else {
                    contentNode = (
                      <div
                        className={cn(
                          'text-[14px] leading-[1.5] whitespace-pre-wrap break-words',
                          msg.content?.startsWith('[') ? 'italic opacity-80' : '',
                        )}
                      >
                        {msg.content}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={msg.id}
                      className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'flex flex-col max-w-[80%] lg:max-w-[65%]',
                          isOutbound ? 'items-end' : 'items-start',
                        )}
                      >
                        <div
                          className={cn(
                            'relative group max-w-full',
                            hasBubbleBg && 'p-[10px] px-[14px] shadow-sm',
                            hasBubbleBg && isOutbound
                              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-none'
                              : hasBubbleBg &&
                                  'bg-muted text-foreground rounded-2xl rounded-bl-none',
                            !hasBubbleBg && 'p-0 bg-transparent',
                            msg.isError && 'border border-destructive bg-destructive/10',
                            msg.isOptimistic && 'opacity-60',
                          )}
                        >
                          {contentNode}
                          {hasBubbleBg && (
                            <div
                              className={cn(
                                'text-[10px] mt-[4px] flex items-center gap-[4px] justify-end',
                                isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground',
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
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-[12px] px-[20px] border-t flex flex-col shrink-0 bg-card relative">
              {showAttachments && (
                <div className="absolute bottom-[100%] left-0 w-full p-4 bg-card border-t flex gap-4 animate-fade-in-up z-10">
                  <Button
                    variant="outline"
                    className="flex-1 flex flex-col gap-2 h-auto py-3"
                    onClick={() => {
                      setFileTypeAccept('image/*')
                      setShowAttachments(false)
                      setTimeout(() => fileInputRef.current?.click(), 100)
                    }}
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[11px]">Imagem</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 flex flex-col gap-2 h-auto py-3"
                    onClick={() => {
                      setFileTypeAccept(
                        'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
                      )
                      setShowAttachments(false)
                      setTimeout(() => fileInputRef.current?.click(), 100)
                    }}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-[11px]">Documento</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 flex flex-col gap-2 h-auto py-3"
                    onClick={() => {
                      setShowAttachments(false)
                      setLocationModal(true)
                    }}
                  >
                    <MapPin className="h-5 w-5" />
                    <span className="text-[11px]">Localização</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 flex flex-col gap-2 h-auto py-3"
                    onClick={() => {
                      setShowAttachments(false)
                      setContactModal(true)
                    }}
                  >
                    <UserPlus className="h-5 w-5" />
                    <span className="text-[11px]">Contato</span>
                  </Button>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={fileTypeAccept}
                onChange={handleFileSelect}
              />

              {isRecording ? (
                <div className="flex items-center gap-3 w-full h-[44px]">
                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[14px] font-medium min-w-[50px]">
                    {formatTimeDuration(recDuration)}
                  </span>
                  <div className="flex-1 text-[12px] text-muted-foreground animate-pulse">
                    Gravando áudio...
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    onClick={resetRecording}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={stopRecording}
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                </div>
              ) : isPreviewingAudio ? (
                <div className="flex items-center gap-3 w-full h-[44px]">
                  <CustomAudioPlayer src={previewAudioUrl!} isOutbound={true} />
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsPreviewingAudio(false)
                      resetRecording()
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSendAudio} className="gap-2">
                    <Send className="h-4 w-4" /> Enviar
                  </Button>
                </div>
              ) : (
                <div className="flex items-end gap-[12px] w-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-[44px] w-[44px] shrink-0 rounded-full',
                      showAttachments && 'bg-secondary',
                    )}
                    onClick={() => setShowAttachments(!showAttachments)}
                  >
                    <Paperclip className="h-[20px] w-[20px] text-muted-foreground" />
                  </Button>
                  <div className="flex-1 bg-input border rounded-[20px] p-[10px] px-[16px] flex items-center">
                    <textarea
                      className="w-full text-[14px] bg-transparent border-none resize-none outline-none focus:ring-0 p-0 m-0 [&::-webkit-scrollbar]:hidden placeholder:text-muted-foreground/50"
                      placeholder="Digite uma mensagem..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessageText()
                        }
                      }}
                      rows={1}
                      style={{ height: '24px', maxHeight: '120px' }}
                      onInput={(e) => {
                        const t = e.target as HTMLTextAreaElement
                        t.style.height = '24px'
                        t.style.height = `${Math.min(t.scrollHeight, 120)}px`
                      }}
                    />
                  </div>
                  {inputText.trim() ? (
                    <Button
                      size="icon"
                      className="h-[44px] w-[44px] rounded-full shrink-0"
                      onClick={sendMessageText}
                    >
                      <Send className="h-[20px] w-[20px]" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-[44px] w-[44px] rounded-full shrink-0 text-muted-foreground hover:bg-secondary"
                      onClick={startRecording}
                    >
                      <Mic className="h-[20px] w-[20px]" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Arquivo</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4 gap-4">
                  {previewFile?.type === 'image' && (
                    <img
                      src={URL.createObjectURL(previewFile.file)}
                      alt="Preview"
                      className="max-w-[300px] max-h-[300px] object-contain rounded-lg shadow-sm"
                    />
                  )}
                  {previewFile?.type === 'document' && (
                    <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg w-full">
                      <FileText className="h-10 w-10 opacity-70" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{previewFile.file.name}</span>
                        <span className="text-[12px] text-muted-foreground">
                          {formatFileSize(previewFile.file.size)}
                        </span>
                      </div>
                    </div>
                  )}
                  {previewFile?.type === 'image' && (
                    <Input
                      placeholder="Adicionar legenda..."
                      value={previewFile.caption}
                      onChange={(e) => setPreviewFile({ ...previewFile, caption: e.target.value })}
                    />
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPreviewFile(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSendFile}>Enviar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={locationModal} onOpenChange={setLocationModal}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Localização</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do local (opcional)</Label>
                    <Input
                      value={locData.name}
                      onChange={(e) => setLocData({ ...locData, name: e.target.value })}
                      placeholder="Ex: Clínica"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={locData.lat}
                        onChange={(e) => setLocData({ ...locData, lat: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={locData.lng}
                        onChange={(e) => setLocData({ ...locData, lng: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLocationModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSendLocation} disabled={!locData.lat || !locData.lng}>
                    Enviar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={contactModal} onOpenChange={setContactModal}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Contato</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={contactData.name}
                      onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={contactData.phone}
                      onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                      placeholder="+5511999999999"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setContactModal(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSendContact}
                    disabled={!contactData.name || !contactData.phone}
                  >
                    Enviar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {lightboxImage && (
              <div
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
                onClick={() => setLightboxImage(null)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white hover:bg-white/20"
                  onClick={() => setLightboxImage(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
                <img
                  src={lightboxImage}
                  className="max-w-[90%] max-h-[90%] object-contain"
                  alt="Ampliado"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-4 right-4 gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(lightboxImage, '_blank')
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function filteredConvs(convs: Conversation[], search: string) {
  const term = search.toLowerCase()
  return convs.filter(
    (c) => c.patient?.full_name?.toLowerCase().includes(term) || c.phone_number.includes(term),
  )
}
