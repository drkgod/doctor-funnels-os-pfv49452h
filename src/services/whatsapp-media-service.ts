import { supabase } from '@/lib/supabase/client'

export async function uploadMedia(
  file: File,
  tenantId: string,
  conversationId: string,
): Promise<string> {
  const maxSize =
    file.type.startsWith('audio/') || file.type.startsWith('video/')
      ? 16 * 1024 * 1024
      : 10 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error(`Tamanho maximo excedido. O limite é ${maxSize / 1024 / 1024}MB.`)
  }

  const ext = file.name.split('.').pop() || 'bin'
  const uuid = crypto.randomUUID()
  const path = `${tenantId}/${conversationId}/${uuid}.${ext}`

  const { data, error } = await supabase.storage.from('whatsapp-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    throw new Error('Erro ao fazer upload do arquivo: ' + error.message)
  }

  return path
}

export function getMediaUrl(storagePath: string): string {
  const { data } = supabase.storage.from('whatsapp-media').getPublicUrl(storagePath)
  return data.publicUrl
}

export async function getSignedMediaUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('whatsapp-media')
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
