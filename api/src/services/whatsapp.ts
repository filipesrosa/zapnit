const GRAPH_API = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION ?? 'v21.0'}`

interface SendTextParams {
  phoneNumberId: string
  accessToken: string
  to: string
  message: string
  preview_url?: boolean
}

interface SendTemplateParams {
  phoneNumberId: string
  accessToken: string
  to: string
  template_name: string
  language: string
  components: unknown[]
}

interface MetaApiResponse {
  messages?: Array<{ id: string }>
  error?: { message: string }
}

export async function sendTextMessage({
  phoneNumberId,
  accessToken,
  to,
  message,
  preview_url = false
}: SendTextParams): Promise<MetaApiResponse> {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message, preview_url }
    })
  })

  const data = (await res.json()) as MetaApiResponse
  if (!res.ok) throw new Error(data.error?.message ?? 'Meta API error')
  return data
}

export async function sendTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  template_name,
  language,
  components
}: SendTemplateParams): Promise<MetaApiResponse> {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template_name,
        language: { code: language },
        components
      }
    })
  })

  const data = (await res.json()) as MetaApiResponse
  if (!res.ok) throw new Error(data.error?.message ?? 'Meta API error')
  return data
}
