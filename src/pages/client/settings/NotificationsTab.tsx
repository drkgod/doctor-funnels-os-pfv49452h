import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

const defaultNotifs = {
  whatsapp: true,
  appointments: true,
  noShow: true,
  leads: true,
  weeklyReport: false,
  sounds: true,
}

const togglesData = [
  {
    key: 'whatsapp',
    label: 'Novas mensagens WhatsApp',
    desc: 'Receber notificacao quando um paciente enviar mensagem',
  },
  {
    key: 'appointments',
    label: 'Novos agendamentos',
    desc: 'Receber notificacao quando um agendamento for criado',
  },
  {
    key: 'noShow',
    label: 'No-show de pacientes',
    desc: 'Receber alerta quando um paciente nao comparece',
  },
  {
    key: 'leads',
    label: 'Novos leads',
    desc: 'Receber notificacao quando um novo lead entrar no pipeline',
  },
  {
    key: 'weeklyReport',
    label: 'Relatorios semanais',
    desc: 'Receber resumo semanal por email toda segunda-feira',
  },
  {
    key: 'sounds',
    label: 'Sons de notificacao',
    desc: 'Reproduzir som ao receber novas mensagens',
  },
]

export function NotificationsTab() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<typeof defaultNotifs>(defaultNotifs)

  useEffect(() => {
    const stored = localStorage.getItem('df-notifications')
    if (stored) {
      try {
        setPrefs(JSON.parse(stored))
      } catch (e) {}
    }
  }, [])

  const handleChange = (key: keyof typeof defaultNotifs, checked: boolean) => {
    const next = { ...prefs, [key]: checked }
    setPrefs(next)
    localStorage.setItem('df-notifications', JSON.stringify(next))
    toast({ title: 'Sucesso', description: 'Preferencias salvas' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de Notificacao</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {togglesData.map((toggle) => (
          <div
            key={toggle.key}
            className="flex items-center justify-between gap-4 p-4 border rounded-lg"
          >
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium">{toggle.label}</h4>
              <p className="text-sm text-muted-foreground">{toggle.desc}</p>
            </div>
            <Switch
              checked={prefs[toggle.key as keyof typeof defaultNotifs]}
              onCheckedChange={(v) => handleChange(toggle.key as keyof typeof defaultNotifs, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
