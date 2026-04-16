import { useState } from 'react'
import { ShieldCheck, Search, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { signatureService } from '@/services/signatureService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'

export default function VerifySignature() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await signatureService.verifySignature(code.trim())
      if (res && res.valid) {
        setResult(res)
      } else {
        setError('Codigo nao encontrado ou invalido.')
      }
    } catch (err: any) {
      setError('Ocorreu um erro ao verificar o codigo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-20 px-4">
      <div className="w-full max-w-md text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Verificar Prontuario Medico
        </h1>
        <p className="text-sm text-muted-foreground">
          Insira o codigo de verificacao para confirmar a autenticidade do documento.
        </p>
      </div>

      <div className="w-full max-w-md bg-card border shadow-sm rounded-xl p-6">
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Codigo de Verificacao</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: SIG-A1B2C3D4-E5F6-G7H8"
                className="pl-9 font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!code.trim() || loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Verificar Documento
          </Button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">Falha na Verificacao</h3>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6 p-5 bg-[#20b26c]/10 border border-[#20b26c]/20 rounded-lg">
            <div className="flex items-center gap-2 mb-4 text-[#20b26c]">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-semibold">Documento Verificado</h3>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profissional
                </div>
                <div className="text-sm font-medium text-foreground">
                  Dr(a). {result.doctor_name}
                </div>
                <div className="text-sm text-muted-foreground">{result.specialty}</div>
              </div>

              <div className="pt-3 border-t border-[#20b26c]/20">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Documento
                </div>
                <div className="text-sm font-medium text-foreground flex items-center gap-1.5 mt-1">
                  <FileText className="w-3.5 h-3.5" />
                  Prontuario Medico (
                  {result.record_type === 'consultation' ? 'Consulta' : result.record_type})
                </div>
              </div>

              <div className="pt-3 border-t border-[#20b26c]/20">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Data da Assinatura
                </div>
                <div className="text-sm font-medium text-foreground mt-1">
                  {format(new Date(result.signed_at), "dd/MM/yyyy 'as' HH:mm")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
