import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const isUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let reqDocumentId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const { tenant_id, bot_config_id, document_id, file_url, file_name } = body

    if (!tenant_id || !bot_config_id || !document_id || !file_url || !file_name) {
      return new Response(JSON.stringify({ error: 'Dados obrigatorios ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isUUID(tenant_id) || !isUUID(bot_config_id) || !isUUID(document_id)) {
      return new Response(JSON.stringify({ error: 'Identificadores invalidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    reqDocumentId = document_id

    await supabaseAdmin
      .from('bot_documents')
      .update({ embedding_status: 'processing' })
      .eq('id', document_id)

    const { data: apiKeyRow } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'openai')
      .maybeSingle()

    if (!apiKeyRow) {
      await supabaseAdmin
        .from('bot_documents')
        .update({ embedding_status: 'error' })
        .eq('id', document_id)
      return new Response(JSON.stringify({ error: 'Servico de processamento nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'
    const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: apiKeyRow.encrypted_key,
        secret_key: secretKey,
      },
    )

    if (decryptError || !decryptedToken) {
      await supabaseAdmin
        .from('bot_documents')
        .update({ embedding_status: 'error' })
        .eq('id', document_id)
      return new Response(JSON.stringify({ error: 'Erro ao processar configuracoes.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fileRes = await fetch(file_url)
    if (!fileRes.ok) {
      await supabaseAdmin
        .from('bot_documents')
        .update({ embedding_status: 'error' })
        .eq('id', document_id)
      return new Response(JSON.stringify({ error: 'Falha no download do documento.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const textContent = await fileRes.text()

    const paragraphs = textContent.split('\n\n')
    const chunks: string[] = []
    let currentChunk = ''
    const maxChunkSize = 2000
    const overlapSize = 200

    for (const p of paragraphs) {
      if (currentChunk.length + p.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        const overlap = currentChunk.slice(-overlapSize)
        currentChunk = overlap + '\n\n' + p
      } else {
        currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + p
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
    }

    const validChunks = chunks.filter((c) => c.length >= 50)

    await supabaseAdmin.from('bot_embeddings').delete().contains('metadata', { document_id })

    const BATCH_SIZE = 20
    for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
      const batch = validChunks.slice(i, i + BATCH_SIZE)

      const embeddingsPromises = batch.map(async (chunkText, index) => {
        const chunkIndex = i + index
        const openAiRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunkText,
          }),
        })

        if (!openAiRes.ok) {
          throw new Error('Falha no provedor')
        }

        const openAiData = await openAiRes.json()
        const embeddingVector = openAiData.data?.[0]?.embedding

        if (embeddingVector) {
          await supabaseAdmin.from('bot_embeddings').insert({
            tenant_id,
            bot_document_id: document_id,
            content: chunkText,
            embedding: JSON.stringify(embeddingVector),
            metadata: {
              document_id,
              file_name,
              chunk_index: chunkIndex,
            },
          })
        }
      })

      await Promise.all(embeddingsPromises)

      if (i + BATCH_SIZE < validChunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    await supabaseAdmin
      .from('bot_documents')
      .update({
        embedding_status: 'ready',
        chunk_count: validChunks.length,
      })
      .eq('id', document_id)

    return new Response(
      JSON.stringify({
        success: true,
        chunks_processed: validChunks.length,
        document_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('process-bot-document error:', error)
    if (reqDocumentId) {
      await supabaseAdmin
        .from('bot_documents')
        .update({ embedding_status: 'error' })
        .eq('id', reqDocumentId)
        .catch(() => null)
    }

    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar documento. Tente novamente.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
