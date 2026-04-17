import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const isUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const {
      tenant_id,
      diagnosis,
      specialty,
      patient_context,
      document_type = 'prescription',
    } = body

    if (!tenant_id || !diagnosis) {
      return new Response(JSON.stringify({ error: 'Dados obrigatorios ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isUUID(tenant_id)) {
      return new Response(JSON.stringify({ error: 'Identificador invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: apiKeyRow } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'openai')
      .eq('status', 'active')
      .maybeSingle()

    if (!apiKeyRow) {
      return new Response(JSON.stringify({ error: 'Servico de IA nao configurado.' }), {
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
      return new Response(JSON.stringify({ error: 'Erro ao processar configuracoes.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let systemMessage = ''
    let userMessage = `DIAGNOSTICO: ${diagnosis}`

    if (patient_context) {
      userMessage += `\nCONTEXTO DO PACIENTE: ${patient_context}`
    }

    if (document_type === 'atestado') {
      systemMessage =
        "Voce e um medico assistente. Gere o texto de um atestado medico. Inclua: declaracao de comparecimento, dias de afastamento sugeridos baseados no diagnostico, e CID-10 sugerido. Responda com JSON contendo 'content' (texto do atestado), 'days_off' (numero), 'cid10' (codigo)."
      userMessage += '\nSugira o atestado adequado.'
    } else if (document_type === 'laudo') {
      systemMessage =
        "Voce e um medico assistente. Gere o texto de um laudo medico baseado no diagnostico. Inclua descricao clinica detalhada, achados relevantes e conclusao. Responda com JSON contendo 'content' (texto do laudo) e 'cid10' (codigo se aplicavel)."
      userMessage += '\nSugira o laudo adequado.'
    } else {
      systemMessage = `Voce e um medico assistente especializado em prescricoes medicas. Especialidade: ${specialty || 'Geral'}. Sugira medicamentos baseados no diagnostico. Para CADA medicamento, forneca: name (nome comercial e generico), dosage (dose), frequency (posologia), duration (duracao do tratamento), route (via de administracao), instructions (orientacoes ao paciente), quantity (quantidade total). REGRAS: 1) Sugira entre 1 e 5 medicamentos. 2) Use doses e posologias padrao para adultos. 3) Inclua APENAS medicamentos pertinentes ao diagnostico. 4) Se o contexto do paciente mencionar alergias, EVITE medicamentos contraindicados. 5) Responda APENAS com JSON valido contendo um array 'medications' e um campo 'notes' com observacoes gerais.`
      userMessage += '\nSugira prescricao adequada.'
    }

    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${decryptedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!oaRes.ok) {
      console.error('OpenAI Error HTTP:', oaRes.status)
      return new Response(JSON.stringify({ error: 'Falha na comunicacao com provedor.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const oaData = await oaRes.json()
    const contentStr = oaData.choices?.[0]?.message?.content || '{}'
    const resultObj = JSON.parse(contentStr)

    return new Response(
      JSON.stringify({
        success: true,
        ...resultObj,
        disclaimer:
          'Sugestao gerada por IA. O medico e responsavel por revisar e ajustar o documento.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('suggest-prescription error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
