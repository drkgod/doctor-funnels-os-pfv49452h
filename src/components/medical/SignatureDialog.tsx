import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ShieldCheck, Loader2, AlertTriangle, Stethoscope, Clock, AlertCircle } from 'lucide-react'
import { signatureService } from '@/services/signatureService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface SignatureDialogProps {
  recordId: string
  doctorId: string
  tenantId: string
  doctorName: string
  specialty: string
  crmNumber: string
  crmState: string
  onSigned: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignatureDialog({
  recordId,
  doctorId,
  tenantId,
  doctorName,
  specialty,
  crmNumber,
  crmState,
  onSigned,
  open,
  onOpenChange,
}: SignatureDialogProps) {
  const [step, setStep] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [timeLeft, setTimeLeft] = useState(600)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) {
      setStep(1)
      setConfirmed(false)
      setCode('')
      setInputCode('')
      setErrorMsg('')
      setTimeLeft(600)
    }
  }, [open])

  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [step, timeLeft])

  const handleRequest = async () => {
    setLoading(true)
    try {
      const newCode = await signatureService.requestSignature(recordId, doctorId, tenantId)
      setCode(newCode)
      setStep(2)
      setTimeLeft(600)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (inputCode.length !== 6) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await signatureService.confirmSignature(recordId, doctorId, tenantId, inputCode)
      toast({ title: 'Prontuario assinado com sucesso!', description: res.verification_code })
      onSigned()
      onOpenChange(false)
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const isWarning = timeLeft <= 120 && timeLeft > 30
  const isDanger = timeLeft <= 30

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-w-[100vw] p-0 rounded-none overflow-hidden border-0 shadow-lg sm:rounded-[var(--radius)] min-h-[100dvh] sm:min-h-0 sm:max-h-[100dvh]">
        <DialogHeader className="p-5 px-6 bg-gradient-to-b from-primary/5 to-transparent text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-[18px] font-bold">Assinar Prontuario</DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-6 pt-0">
          {step === 1 && (
            <div className="animate-in fade-in duration-200">
              <div className="p-3 px-4 bg-[hsl(45,93%,47%)]/10 border border-[hsl(45,93%,47%)]/20 rounded-md mb-5 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(45,93%,47%)] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] leading-relaxed text-foreground">
                  Ao assinar, o prontuario sera finalizado e nao podera mais ser editado.
                </p>
              </div>

              <div className="p-3.5 px-4 bg-secondary/20 rounded-md mb-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="h-[18px] w-[18px] text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold">Dr(a). {doctorName}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {specialty} • CRM {crmNumber}/{crmState}
                  </span>
                </div>
              </div>

              <label
                className={cn(
                  'flex items-start gap-2 p-3 px-4 rounded-md cursor-pointer transition-colors border border-transparent',
                  confirmed
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-secondary/10 hover:bg-secondary/20',
                )}
              >
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(c) => setConfirmed(!!c)}
                  className="mt-0.5"
                />
                <span className="text-[13px] leading-relaxed select-none">
                  Confirmo que revisei todas as informacoes e estao corretas.
                </span>
              </label>

              <Button
                onClick={handleRequest}
                disabled={!confirmed || loading}
                className="w-full h-11 mt-5 font-semibold gap-1.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Solicitar Codigo
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-6 p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-md text-center">
                <div className="text-[11px] text-muted-foreground mb-2">
                  Seu codigo de verificacao:
                </div>
                <div className="text-[32px] font-bold tabular-nums tracking-[8px] text-primary font-mono">
                  {code}
                </div>
              </div>

              <div className="text-[12px] text-muted-foreground mb-5 text-center">
                Em producao, este codigo sera enviado por e-mail ou SMS.
              </div>

              <div className="flex justify-center mb-4">
                <InputOTP
                  maxLength={6}
                  value={inputCode}
                  onChange={setInputCode}
                  disabled={timeLeft === 0 || loading}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <InputOTPSlot
                        key={idx}
                        index={idx}
                        className={cn(
                          'w-10 h-12 md:w-12 md:h-14 text-[20px] md:text-[24px] font-bold bg-input border-2 border-r-2 rounded-md transition-all duration-150',
                          errorMsg
                            ? 'border-destructive focus-visible:ring-destructive'
                            : 'focus-visible:ring-primary focus-visible:border-primary',
                          inputCode.length > idx && !errorMsg ? 'border-primary/50' : '',
                        )}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div
                className={cn(
                  'flex items-center justify-center gap-1.5 mb-5',
                  isDanger
                    ? 'text-destructive font-semibold animate-pulse'
                    : isWarning
                      ? 'text-[hsl(45,93%,47%)] font-medium'
                      : 'text-muted-foreground',
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[13px]">{formatTime(timeLeft)}</span>
              </div>

              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-destructive mb-3">
                  <AlertCircle className="w-3 h-3" />
                  {errorMsg}
                </div>
              )}

              <Button
                onClick={handleConfirm}
                disabled={inputCode.length !== 6 || timeLeft === 0 || loading}
                className="w-full h-12 font-semibold gap-1.5 bg-[hsl(270,60%,50%)] text-white hover:bg-[hsl(270,60%,45%)] active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Confirmar Assinatura
              </Button>

              {(timeLeft === 0 || errorMsg.includes('expirado')) && (
                <Button
                  variant="outline"
                  onClick={handleRequest}
                  disabled={loading}
                  className="w-full mt-2 h-11"
                >
                  Reenviar Codigo
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
