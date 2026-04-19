import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Info, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function EmailTab() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const [tenantId, setTenantId] = useState<string | null>(null)

  const [useCustomKey, setUseCustomKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [domain, setDomain] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [domainVerified, setDomainVerified] = useState(false)

  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()

        if (!profile?.tenant_id) throw new Error('Tenant não encontrado')
        setTenantId(profile.tenant_id)

        const { data: emailSettings } = await supabase
          .from('tenant_email_settings')
          .select('*')
          .eq('tenant_id', profile.tenant_id)
          .eq('provider', 'resend')
          .maybeSingle()

        if (emailSettings) {
          setUseCustomKey(emailSettings.use_custom_key ?? false)
          setDomain(emailSettings.domain || '')
          setFromName(emailSettings.from_name || '')
          setFromEmail(emailSettings.from_email || '')
          setReplyTo(emailSettings.reply_to || '')
          setDomainVerified(emailSettings.domain_verified ?? false)
        }

        const { data: apiKeyRow } = await supabase
          .from('tenant_api_keys')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .eq('provider', 'resend')
          .maybeSingle()

        if (apiKeyRow) {
          setHasExistingKey(true)
        }
      } catch (err) {
        console.error('Error loading email settings:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handleSave = async () => {
    if (!tenantId) return

    if (useCustomKey) {
      if (!hasExistingKey && !apiKey.trim()) {
        toast({
          title: 'Erro',
          description: 'A Chave API Resend é obrigatória no modo personalizado.',
          variant: 'destructive',
        })
        return
      }
      if (!domain.trim()) {
        toast({
          title: 'Erro',
          description: 'O Domínio verificado é obrigatório.',
          variant: 'destructive',
        })
        return
      }
      if (!fromName.trim()) {
        toast({
          title: 'Erro',
          description: 'O Nome do remetente é obrigatório.',
          variant: 'destructive',
        })
        return
      }
      if (!fromEmail.trim()) {
        toast({
          title: 'Erro',
          description: 'O Email do remetente é obrigatório.',
          variant: 'destructive',
        })
        return
      }
      if (!fromEmail.includes(`@${domain}`)) {
        toast({
          title: 'Erro',
          description: `O email deve terminar em @${domain}`,
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      if (useCustomKey && apiKey.trim()) {
        const { data: encKey, error: encError } = await supabase.functions.invoke(
          'encrypt-api-key',
          {
            body: { key_value: apiKey },
          },
        )

        if (encError || !encKey?.encrypted) throw new Error('Erro ao criptografar chave')

        const { error: upsertKeyError } = await supabase.from('tenant_api_keys').upsert(
          {
            tenant_id: tenantId,
            provider: 'resend',
            encrypted_key: encKey.encrypted,
            status: 'active',
          },
          { onConflict: 'tenant_id,provider' },
        )

        if (upsertKeyError) throw upsertKeyError
        setHasExistingKey(true)
        setApiKey('')
      }

      const { data: existingSettings } = await supabase
        .from('tenant_email_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'resend')
        .maybeSingle()

      const payload = {
        tenant_id: tenantId,
        provider: 'resend',
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo,
        domain: domain,
        use_custom_key: useCustomKey,
      }

      if (existingSettings) {
        await supabase.from('tenant_email_settings').update(payload).eq('id', existingSettings.id)
      } else {
        await supabase.from('tenant_email_settings').insert(payload)
      }

      toast({ title: 'Sucesso', description: 'Configurações salvas com sucesso.' })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({
        title: 'Erro',
        description: 'Insira um email válido para teste.',
        variant: 'destructive',
      })
      return
    }

    setSendingTest(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { to: testEmail },
      })
      if (error || (data && data.error)) {
        throw new Error((data && data.error) || error?.message)
      }
      toast({ title: 'Teste enviado', description: `Email de teste enviado para ${testEmail}` })
      setTestEmail('')
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao enviar email de teste.',
        variant: 'destructive',
      })
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
        <p className="text-lg font-medium mb-4 text-destructive">
          Erro ao carregar configurações de e-mail.
        </p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de E-mail</CardTitle>
          <CardDescription>Configure como seus emails de campanha serão enviados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Modo de Envio</h3>
            <RadioGroup
              value={useCustomKey ? 'custom' : 'default'}
              onValueChange={(val) => setUseCustomKey(val === 'custom')}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 border p-4 rounded-md">
                <RadioGroupItem value="default" id="r-default" className="mt-1" />
                <div>
                  <Label htmlFor="r-default" className="font-medium block mb-1">
                    Usar domínio padrão
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Seus emails serão enviados de noreply@doctorfunnels.com.br (ou domínio padrão da
                    plataforma). Nenhuma configuração adicional necessária.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 border p-4 rounded-md">
                <RadioGroupItem value="custom" id="r-custom" className="mt-1" />
                <div>
                  <Label htmlFor="r-custom" className="font-medium block mb-1">
                    Usar meu próprio domínio
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Configure seu próprio domínio e chave Resend para enviar emails personalizados
                    da sua clínica.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {useCustomKey && (
            <div className="space-y-6 pt-4 border-t border-border animate-fade-in">
              <h3 className="text-sm font-medium">Configuração Personalizada</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Chave API Resend</Label>
                  <Input
                    type="password"
                    placeholder={
                      hasExistingKey
                        ? 'Chave configurada (digite nova para alterar)'
                        : 're_xxxxxxxx'
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Crie sua chave em resend.com/api-keys. Ela será criptografada antes de salvar.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Domínio verificado</Label>
                  <Input
                    placeholder="mail.suaclinica.com.br"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    O domínio deve estar verificado no painel do Resend.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Status do Domínio</Label>
                  <div className="h-10 flex items-center">
                    {domainVerified ? (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 flex items-center space-x-1.5 px-3 py-1 text-sm font-normal">
                        <CheckCircle className="w-4 h-4" />
                        <span>Domínio verificado</span>
                      </Badge>
                    ) : domain ? (
                      <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20 flex items-center space-x-1.5 px-3 py-1 text-sm font-normal">
                        <AlertCircle className="w-4 h-4" />
                        <span>Verificação pendente</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground hover:bg-muted border-transparent flex items-center space-x-1.5 px-3 py-1 text-sm font-normal">
                        <Info className="w-4 h-4" />
                        <span>Nenhum domínio configurado</span>
                      </Badge>
                    )}
                  </div>
                  {!domainVerified && domain && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      Adicione os registros DNS no seu provedor de domínio e aguarde a propagação
                      (pode levar até 48h).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nome do remetente</Label>
                  <Input
                    placeholder="Dr. João Silva"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome que aparece no 'De:' do email.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Email do remetente</Label>
                  <Input
                    placeholder="contato@suaclinica.com.br"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deve usar o domínio verificado acima.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Email de resposta (Reply-To){' '}
                    <span className="text-muted-foreground font-normal">(Opcional)</span>
                  </Label>
                  <Input
                    placeholder="atendimento@suaclinica.com.br"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando o paciente responder, a resposta vai para este email.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t border-border pt-6 bg-muted/20">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teste de Envio</CardTitle>
          <CardDescription>
            Envie um email de teste para verificar as configurações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Input
              placeholder="seu-email@exemplo.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button
              onClick={handleTestEmail}
              disabled={sendingTest || !testEmail}
              variant="secondary"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar teste
            </Button>
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full bg-card border rounded-lg px-4">
        <AccordionItem value="instructions" className="border-none">
          <AccordionTrigger className="hover:no-underline font-medium text-sm py-4">
            Como configurar seu domínio no Resend
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3 pb-4">
            <p>
              <strong>Passo 1:</strong> Crie uma conta gratuita em resend.com
            </p>
            <p>
              <strong>Passo 2:</strong> Acesse resend.com/domains e clique em 'Add Domain'
            </p>
            <p>
              <strong>Passo 3:</strong> Digite o domínio da sua clínica (ex: mail.suaclinica.com.br)
            </p>
            <p>
              <strong>Passo 4:</strong> Adicione os 3 registros DNS que o Resend mostrar no painel
              do seu provedor de domínio (Hostinger, GoDaddy, Registro.br, etc)
            </p>
            <p>
              <strong>Passo 5:</strong> Aguarde a verificação (5 min a 48h)
            </p>
            <p>
              <strong>Passo 6:</strong> Acesse resend.com/api-keys e crie uma chave com permissão
              'Sending access'
            </p>
            <p>
              <strong>Passo 7:</strong> Cole a chave e o domínio nos campos acima e salve
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
