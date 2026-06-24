import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

const FROM = process.env.RESEND_FROM ?? 'Zapnit <noreply@zapnit.com>'
const APP_URL = process.env.APP_BASE_URL ?? 'https://zapnit.com'

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getResend()
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to)
    return
  }
  try {
    await client.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[email] send error', err)
  }
}

export async function sendBillingWarningEmail(
  user: { name: string; email: string },
  daysLeft: number,
  renewalUrl: string,
): Promise<void> {
  await sendEmail(
    user.email,
    `Sua assinatura Zapnit vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
    `<p>Olá ${user.name},</p>
     <p>Sua assinatura do Zapnit vence em <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong>.</p>
     <p>Para continuar usando suas instâncias sem interrupção, renove agora:</p>
     <p><a href="${renewalUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Renovar assinatura</a></p>
     <p>Equipe Zapnit</p>`,
  )
}

export async function sendPaymentFailedEmail(
  user: { name: string; email: string },
  renewalUrl: string,
): Promise<void> {
  await sendEmail(
    user.email,
    'Falha no pagamento — instâncias Zapnit pausadas',
    `<p>Olá ${user.name},</p>
     <p>Não conseguimos processar o pagamento da sua assinatura Zapnit. Suas instâncias foram <strong>pausadas</strong>.</p>
     <p>Para reativar, regularize o pagamento:</p>
     <p><a href="${renewalUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Regularizar pagamento</a></p>
     <p>Equipe Zapnit</p>`,
  )
}

export async function sendActivationConfirmationEmail(
  user: { name: string; email: string },
): Promise<void> {
  await sendEmail(
    user.email,
    'Assinatura ativada — instâncias Zapnit reativadas',
    `<p>Olá ${user.name},</p>
     <p>Sua assinatura foi ativada com sucesso! Suas instâncias WhatsApp estão <strong>ativas</strong>.</p>
     <p><a href="${APP_URL}/dashboard" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Acessar dashboard</a></p>
     <p>Equipe Zapnit</p>`,
  )
}

export async function sendTrialExpiryWarningEmail(
  user: { name: string; email: string },
  hoursLeft: number,
  upgradeUrl: string,
): Promise<void> {
  const label = hoursLeft <= 0 ? 'expirado' : `expira em ${hoursLeft}h`
  await sendEmail(
    user.email,
    hoursLeft <= 0 ? 'Trial Zapnit encerrado' : `Seu trial Zapnit ${label}`,
    `<p>Olá ${user.name},</p>
     <p>Seu período de trial do Zapnit ${label}. Escolha um plano para continuar usando suas instâncias:</p>
     <p><a href="${upgradeUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Escolher plano</a></p>
     <p>Equipe Zapnit</p>`,
  )
}
