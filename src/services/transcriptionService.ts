import { supabase } from '@/lib/supabase/client'

export const transcriptionService = {
  uploadAndProcess: async (
    recordId: string,
    tenantId: string,
    audioBlob: Blob,
    specialty: string,
    onStepChange?: (step: number) => void,
  ) => {
    try {
      onStepChange?.(1)
      const filename = `${tenantId}/${recordId}/audio-${Date.now()}.webm`

      const { error: uploadError } = await supabase.storage
        .from('medical-audio')
        .upload(filename, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          upsert: false,
        })

      if (uploadError) {
        throw new Error('Erro ao enviar audio. Tente novamente.')
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('medical-audio')
        .createSignedUrl(filename, 3600)

      if (signedError || !signedData?.signedUrl) {
        throw new Error('Erro ao gerar URL do audio.')
      }

      onStepChange?.(2)
      const timer = setTimeout(() => {
        onStepChange?.(3)
      }, 5000)

      const { data, error: invokeError } = await supabase.functions.invoke(
        'process-transcription',
        {
          body: {
            record_id: recordId,
            audio_url: signedData.signedUrl,
            tenant_id: tenantId,
            specialty,
          },
        },
      )

      clearTimeout(timer)

      if (invokeError) {
        throw new Error('Erro ao processar transcricao. Tente novamente.')
      }

      if (data?.success === false) {
        throw new Error(data.error || data.message || 'Erro ao processar transcricao.')
      }

      return data
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao processar transcricao. Tente novamente.')
    }
  },

  fetchTranscription: async (recordId: string) => {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return null
    return data
  },

  pollTranscriptionStatus: (recordId: string, callback: (transcription: any) => void) => {
    let polls = 0
    const maxPolls = 60

    const interval = setInterval(async () => {
      polls++
      const transcription = await transcriptionService.fetchTranscription(recordId)

      if (
        transcription &&
        (transcription.status === 'completed' || transcription.status === 'failed')
      ) {
        clearInterval(interval)
        callback(transcription)
      } else if (polls >= maxPolls) {
        clearInterval(interval)
        callback(null)
      }
    }, 5000)

    return () => clearInterval(interval)
  },
}
