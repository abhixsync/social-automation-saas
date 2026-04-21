import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Crescova <noreply@crescova.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crescova.app'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return null
  }
  return (_resend ??= new Resend(process.env.RESEND_API_KEY))
}

export async function sendWelcomeEmail(email: string, name: string | null): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const displayName = escapeHtml(name ?? 'there')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Crescova</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Crescova</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">AI-powered LinkedIn content on autopilot</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">Welcome, ${displayName}!</h2>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                You're now set up on Crescova. Here's what you can do to get started:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
                <tr>
                  <td style="padding:12px 16px;background-color:#eff6ff;border-radius:6px;margin-bottom:8px;">
                    <p style="margin:0;color:#1d4ed8;font-size:14px;font-weight:600;">1. Connect your LinkedIn account</p>
                    <p style="margin:4px 0 0;color:#374151;font-size:13px;">Link your LinkedIn profile so Crescova can post on your behalf.</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
                <tr>
                  <td style="padding:12px 16px;background-color:#f0fdf4;border-radius:6px;">
                    <p style="margin:0;color:#15803d;font-size:14px;font-weight:600;">2. Set your content pillars</p>
                    <p style="margin:4px 0 0;color:#374151;font-size:13px;">Tell us your niche and topics — we'll generate posts that sound like you.</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;width:100%;">
                <tr>
                  <td style="padding:12px 16px;background-color:#fef9c3;border-radius:6px;">
                    <p style="margin:0;color:#a16207;font-size:14px;font-weight:600;">3. Schedule your posts</p>
                    <p style="margin:4px 0 0;color:#374151;font-size:13px;">Choose your posting days and times and let Crescova handle the rest.</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/dashboard"
                       style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
                      Go to your dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                You're receiving this because you signed up for Crescova.<br />
                &copy; ${new Date().getFullYear()} Crescova. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Welcome to Crescova, ${displayName}!`,
      html,
    })
  } catch (err) {
    console.error('[email/sendWelcomeEmail]', err)
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Crescova password</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Crescova</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">AI-powered LinkedIn content on autopilot</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                We received a request to reset your Crescova password. Click the button below to choose a new one. This link expires in 1 hour.
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                You're receiving this because a password reset was requested for your Crescova account.<br />
                &copy; ${new Date().getFullYear()} Crescova. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your Crescova password',
      html,
    })
  } catch (err) {
    console.error('[email/sendPasswordResetEmail]', err)
  }
}
