import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

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
    desc: 'Receber notificação quando um paciente enviar mensagem',
  },
  {
    key: 'appointments',
    label: 'Novos agendamentos',
    desc: 'Receber notificação quando um agendamento for criado',
  },
  {
    key: 'noShow',
    label: 'No-show de pacientes',
    desc: 'Receber alerta quando um paciente não comparece',
  },
  {
    key: 'leads',
    label: 'Novos leads',
    desc: 'Receber notificação quando um novo lead entrar no pipeline',
  },
  {
    key: 'weeklyReport',
    label: 'Relatórios semanais',
    desc: 'Receber resumo semanal por email toda segunda-feira',
  },
  {
    key: 'sounds',
    label: 'Sons de notificação',
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
      } catch (e) {
        /* ignore parse error */
      }
    }
  }, [])

  const handleChange = (key: keyof typeof defaultNotifs, checked: boolean) => {
    const next = { ...prefs, [key]: checked }
    setPrefs(next)
    localStorage.setItem('df-notifications', JSON.stringify(next))
    toast({ title: 'Sucesso', description: 'Preferências salvas' })
  }

  return (
    <Card className="p-7 bg-card border-border rounded-xl shadow-sm">
      <h2 className="text-[17px] font-semibold mb-6 pb-4 border-b border-border text-foreground">
        Preferências de Notificação
      </h2>
      <div className="flex flex-col">
        {togglesData.map((toggle, index) => {
          const isLast = index === togglesData.length - 1
          const checked = prefs[toggle.key as keyof typeof defaultNotifs]
          return (
            <div
              key={toggle.key}
              className={cn(
                'flex items-center justify-between gap-4 py-4',
                !isLast && 'border-b border-border/30',
              )}
            >
              <div className="space-y-0.5">
                <h4 className="text-[14px] font-medium text-foreground">{toggle.label}</h4>
                <p
                  className={cn(
                    'text-[12px] text-muted-foreground mt-0.5 transition-opacity duration-300',
                    !checked && 'opacity-70',
                  )}
                >
                  {toggle.desc}
                </p>
              </div>
              <Switch
                checked={checked}
                onCheckedChange={(v) => handleChange(toggle.key as keyof typeof defaultNotifs, v)}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
