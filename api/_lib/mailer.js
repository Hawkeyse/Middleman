const FROM = 'Middleman <support@middlemansecure.com>'

// Firebase's own auth-email templates can't be edited past sender name/
// reply-to (Google locks the HTML body as an anti-phishing measure), so
// verify-email and password-reset go through this instead: we generate the
// real Firebase action link server-side (admin SDK) and mail it ourselves
// via Resend, using the same domain already verified for Firebase's SMTP.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function shell({ heading, bodyHtml, ctaText, ctaLink, footerNote }) {
  return `
<div style="background:#f5f7fb;padding:40px 16px;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e8ecf4;overflow:hidden;">
    <tr><td style="padding:32px 40px 0;text-align:center;">
      <img src="https://middlemansecure.com/middleman-logo.png" width="48" height="48" alt="Middleman" style="border-radius:12px;display:inline-block;" />
    </td></tr>
    <tr><td style="padding:24px 40px 4px;">
      <h1 style="margin:0 0 12px;color:#17213d;font-size:20px;font-weight:700;">${heading}</h1>
      <div style="color:#586380;font-size:14px;line-height:1.7;">${bodyHtml}</div>
      <div style="text-align:center;margin:26px 0 10px;">
        <a href="${ctaLink}" style="background:#2754ea;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px;display:inline-block;">${ctaText}</a>
      </div>
      <p style="color:#9ca7ba;font-size:11.5px;line-height:1.6;word-break:break-all;">Or paste this link into your browser:<br /><a href="${ctaLink}" style="color:#2754ea;">${ctaLink}</a></p>
    </td></tr>
    <tr><td style="padding:20px 40px 30px;border-top:1px solid #e8ecf4;">
      <p style="margin:0;color:#9ca7ba;font-size:12px;line-height:1.6;">${footerNote}</p>
      <p style="margin:14px 0 0;color:#b7bfd0;font-size:11px;">— The Middleman Team</p>
    </td></tr>
  </table>
</div>`.trim()
}

export const emailTemplates = {
  verifyEmail({ link, displayName }) {
    return {
      subject: 'Verify your email for Middleman',
      html: shell({
        heading: 'Verify your email',
        bodyHtml: `Hey ${escapeHtml(displayName || 'there')}, click below to verify your email address and finish setting up your Middleman account.`,
        ctaText: 'Verify email',
        ctaLink: link,
        footerNote: "If you didn't create a Middleman account, you can safely ignore this email.",
      }),
    }
  },
  resetPassword({ link, email }) {
    return {
      subject: 'Reset your password for Middleman',
      html: shell({
        heading: 'Reset your password',
        bodyHtml: `We got a request to reset the password for your ${escapeHtml(email)} account. Click below to choose a new one.`,
        ctaText: 'Reset password',
        ctaLink: link,
        footerNote: "If you didn't request this, you can safely ignore this email — your password won't change.",
      }),
    }
  },
}

export async function sendMail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend send failed (${res.status}): ${text}`)
  }
}
