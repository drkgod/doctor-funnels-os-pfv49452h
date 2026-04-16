import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { CalendarDays, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { startOfMonth, endOfMonth } from 'date-fns'

export function GoogleCalendarConnect() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connectedEmail, setConnectedEmail] = useState('')
  const [connectedAt, setConnectedAt] = useState('')
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'check_status' },
      })
      if (data?.connected) {
        setConnected(true)
        setConnectedEmail(data.email || '')
        setConnectedAt(data.connected_at || '')
      } else {
        setConnected(false)
        setConnectedEmail('')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    const gcal = searchParams.get('gcal')
    if (gcal === 'success') {
      const email = searchParams.get('email')
      toast({
        title: 'Sucesso',
        description: `Google Calendar conectado com sucesso! ${email || ''}`,
      })
      const url = new URL(window.location.href)
      url.searchParams.delete('gcal')
      url.searchParams.delete('email')
      window.history.replaceState({}, '', url.toString())
      checkStatus()
    } else if (gcal === 'error') {
      const reason = searchParams.get('reason')
      let msg = 'Erro ao conectar. Tente novamente.'
      if (reason === 'missing_code') msg = 'Autorizacao cancelada. Tente novamente.'
      if (reason === 'invalid_state') msg = 'Erro de validacao. Tente novamente.'
      if (reason === 'token_exchange_failed') msg = 'Erro ao conectar. Tente novamente.'
      if (reason === 'server_error') msg = 'Erro interno. Tente novamente.'

      toast({ title: 'Erro', description: msg, variant: 'destructive' })
      const url = new URL(window.location.href)
      url.searchParams.delete('gcal')
      url.searchParams.delete('reason')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, toast])

  const handleConnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'get_auth_url' },
      })
      if (data?.auth_url) {
        window.location.href = data.auth_url
      } else {
        toast({
          title: 'Erro',
          description: 'Nao foi possivel obter URL de conexao.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro interno.', variant: 'destructive' })
    }
  }

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Desconectar Google Calendar\n\nA sincronizacao com Google Calendar sera desativada. Tem certeza?',
      )
    )
      return

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      })
      if (data?.success) {
        setConnected(false)
        setConnectedEmail('')
        toast({ title: 'Sucesso', description: 'Google Calendar desconectado.' })
      } else {
        toast({
          title: 'Erro',
          description: 'Nao foi possivel desconectar.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro interno.', variant: 'destructive' })
    }
  }

  const handleSync = async () => {
    try {
      const timeMin = startOfMonth(new Date()).toISOString()
      const timeMax = endOfMonth(new Date()).toISOString()

      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'list_events', timeMin, timeMax },
      })

      if (!error) {
        toast({ title: 'Sucesso', description: 'Calendario sincronizado' })
      } else {
        toast({ title: 'Erro', description: 'Erro ao sincronizar', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Erro', description: 'Erro interno.', variant: 'destructive' })
    }
  }

  if (loading) {
    return <Skeleton className="w-[200px] h-[36px] rounded-md" />
  }

  if (!connected) {
    return (
      <Button variant="outline" className="h-[36px] text-[13px] px-3 gap-2" onClick={handleConnect}>
        <CalendarDays className="w-4 h-4" />
        Conectar Google Calendar
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-md px-3 h-[36px]">
      <div className="w-2 h-2 rounded-full bg-success" />
      <span className="text-success text-[13px] font-medium">Calendar conectado</span>
      {connectedEmail && (
        <span className="text-muted-foreground text-[12px] truncate max-w-[120px]">
          {connectedEmail}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-6 w-6 p-0 ml-1">
            <ChevronDown className="w-[14px] h-[14px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleSync}>Sincronizar agora</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDisconnect}
          >
            Desconectar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
