import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { signatureService } from '@/services/signatureService'
import { useToast } from '@/hooks/use-toast'

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Assinar Prontuario</DialogTitle>
              <DialogDescription>
                Ao assinar, o prontuario sera finalizado e nao podera mais ser editado.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 p-4 bg-secondary/30 rounded-md">
              <p className="font-medium">Dr(a). {doctorName}</p>
              <p className="text-sm text-muted-foreground">{specialty}</p>
              <p className="text-sm text-muted-foreground">
                CRM {crmNumber}/{crmState}
              </p>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <Checkbox
                id="confirm-review"
                checked={confirmed}
                onCheckedChange={(c) => setConfirmed(!!c)}
              />
              <label
                htmlFor="confirm-review"
                className="text-[13px] font-medium leading-none cursor-pointer"
              >
                Confirmo que revisei todas as informacoes e estao corretas.
              </label>
            </div>
            <Button onClick={handleRequest} disabled={!confirmed || loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Solicitar Codigo
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Digite o codigo de verificacao</DialogTitle>
              <DialogDescription>
                Para confirmar a assinatura, insira o codigo de 6 digitos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center my-6 space-y-4">
              <div className="px-4 py-2 bg-primary/10 text-primary rounded-md font-mono text-xl tracking-widest">
                {code}
              </div>
              <InputOTP
                maxLength={6}
                value={inputCode}
                onChange={setInputCode}
                disabled={timeLeft === 0 || loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              <div className="text-sm text-muted-foreground">
                Tempo restante:{' '}
                <span className="font-medium tabular-nums">{formatTime(timeLeft)}</span>
              </div>

              {errorMsg && (
                <div className="text-sm font-medium text-destructive mt-2">{errorMsg}</div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleConfirm}
                disabled={inputCode.length !== 6 || timeLeft === 0 || loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Confirmar Assinatura
              </Button>

              {(timeLeft === 0 || errorMsg.includes('expirado')) && (
                <Button
                  variant="outline"
                  onClick={handleRequest}
                  disabled={loading}
                  className="w-full"
                >
                  Reenviar Codigo
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
