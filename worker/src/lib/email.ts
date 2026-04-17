import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Crescova <noreply@crescova.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crescova.app'

export async function sendPostReadyEmail(
  email: string,
  name: string | null,
  topic: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Crescova <noreply@crescova.app>'
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crescova.app'
  const greeting = name ? `Hi ${escapeHtml(name)}` : 'Hi there'
  const safeТopic = escapeHtml(topic)

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your post is ready for review`,
    html: `
      <p>${greeting},</p>
      <p>Your AI-generated LinkedIn post on <strong>"${safeТopic}"</strong> is ready and waiting for your approval.</p>
      <p style="margin: 24px 0;">
        <a href="${APP_URL}/dashboard/posts?tab=pending_approval"
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Review &amp; Publish →
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">
        You can edit, approve, or regenerate the post from your dashboard.
      </p>
      <p>— The Crescova Team</p>
    `,
  })
}

export async function sendTokenExpiryWarning(
  email: string,
  name: string | null,
  daysLeft: number,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping expiry email')
    return
  }

  const greeting = name ? `Hi ${escapeHtml(name)}` : 'Hi there'
  const dayWord = daysLeft === 1 ? 'day' : 'days'

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Action needed: Your LinkedIn connection expires in ${daysLeft} ${dayWord}`,
    html: `
      <p>${greeting},</p>
      <p>Your LinkedIn account connection in <strong>Crescova</strong> will expire in <strong>${daysLeft} ${dayWord}</strong>.</p>
      <p>Once it expires, automated posts will stop. To keep things running, please reconnect your LinkedIn account.</p>
      <p style="margin: 24px 0;">
        <a href="${APP_URL}/dashboard/accounts" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Reconnect LinkedIn →
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">If you no longer want automated posts, you can ignore this email or disconnect the account from your dashboard.</p>
      <p>— The Crescova Team</p>
    `,
  })
}
