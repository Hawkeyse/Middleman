const FROM = 'Middleman <support@middlemansecure.com>'

// Firebase's own auth-email templates can't be edited past sender name/
// reply-to (Google locks the HTML body as an anti-phishing measure), so
// verify-email and password-reset go through this instead: we generate the
// real Firebase action link server-side (admin SDK) and mail it ourselves
// via Resend, using the same domain already verified for Firebase's SMTP.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// showRawLink is on for action-code links (verify/reset), where the raw
// URL is a useful fallback if the button doesn't render — off for plain
// notification emails (warning/ban/verification decision) where the CTA
// just points at a normal in-app page.
function shell({ heading, bodyHtml, ctaText, ctaLink, footerNote, showRawLink = true }) {
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
      ${showRawLink ? `<p style="color:#9ca7ba;font-size:11.5px;line-height:1.6;word-break:break-all;">Or paste this link into your browser:<br /><a href="${ctaLink}" style="color:#2754ea;">${ctaLink}</a></p>` : ''}
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
      subject: 'Welcome to Middleman — verify your email',
      html: shell({
        heading: `Welcome to Middleman, ${escapeHtml(displayName || 'there')}!`,
        bodyHtml: `Middleman holds the money for a deal until the buyer confirms they actually got what they paid for — so nobody has to just trust a stranger. Click below to verify your email and activate your account.`
          + `<br /><br />One more thing: before you can deposit, create or accept a deal, or request a refund, you'll also need to complete identity verification in the app (a quick ID + selfie check) — that's what keeps every deal on Middleman accountable.`,
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
  warning({ reason, cooldownUntil }) {
    const restricted = cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()
    return {
      subject: "You've received a warning on Middleman",
      html: shell({
        heading: 'Account warning',
        bodyHtml: `Your Middleman account has received a warning.<br /><br /><b>Reason:</b> ${escapeHtml(reason || 'No reason given.')}`
          + (restricted ? `<br /><br />Your account is restricted until <b>${escapeHtml(new Date(cooldownUntil).toLocaleString())}</b> — money and identity actions are paused until then.` : ''),
        ctaText: 'Go to your account',
        ctaLink: 'https://middlemansecure.com/dashboard',
        footerNote: 'Repeated or serious violations can lead to a permanent ban. If you believe this was a mistake, reach out through Support in the app.',
        showRawLink: false,
      }),
    }
  },
  ban({ reason }) {
    return {
      subject: 'Your Middleman account has been suspended',
      html: shell({
        heading: 'Account suspended',
        bodyHtml: `Your Middleman account has been suspended and you no longer have access to the platform.<br /><br /><b>Reason:</b> ${escapeHtml(reason || 'Violated Middleman terms.')}`,
        ctaText: 'Read our Terms',
        ctaLink: 'https://middlemansecure.com/terms',
        footerNote: 'If you believe this was a mistake, contact details are available on our FAQ page.',
        showRawLink: false,
      }),
    }
  },
  verificationApproved() {
    return {
      subject: "You're verified on Middleman!",
      html: shell({
        heading: 'Identity verified',
        bodyHtml: 'Good news — your identity verification was approved. You can now create and accept deals on Middleman.',
        ctaText: 'Go to your dashboard',
        ctaLink: 'https://middlemansecure.com/dashboard',
        footerNote: 'Thanks for helping keep Middleman a safe place to deal.',
        showRawLink: false,
      }),
    }
  },
  verificationDeclined({ reason }) {
    return {
      subject: 'Your Middleman verification needs another look',
      html: shell({
        heading: 'Verification declined',
        bodyHtml: `Your identity verification wasn't approved this time.<br /><br /><b>Reason:</b> ${escapeHtml(reason || 'Submitted documents did not meet our requirements.')}<br /><br />You can submit again with clearer documents from your account.`,
        ctaText: 'Try again',
        ctaLink: 'https://middlemansecure.com/verify',
        footerNote: "If you're not sure what went wrong, reach out through Support in the app.",
        showRawLink: false,
      }),
    }
  },
  deposit({ amount, currency }) {
    return {
      subject: 'Deposit confirmed on Middleman',
      html: shell({
        heading: 'Deposit confirmed',
        bodyHtml: `We've added <b>${escapeHtml(currency)} ${Number(amount).toFixed(2)}</b> to your Middleman wallet. It's ready to use on your next deal.`,
        ctaText: 'Go to your wallet',
        ctaLink: 'https://middlemansecure.com/dashboard',
        footerNote: 'Keep an eye on your dashboard for updates on your deals.',
        showRawLink: false,
      }),
    }
  },
  refundSent({ amount, currency }) {
    return {
      subject: 'Your refund has been sent',
      html: shell({
        heading: 'Refund sent',
        bodyHtml: `Your refund of <b>${escapeHtml(currency)} ${Number(amount).toFixed(2)}</b> has been sent. It should reflect shortly depending on your payment provider.`,
        ctaText: 'View your wallet',
        ctaLink: 'https://middlemansecure.com/dashboard',
        footerNote: "If it doesn't show up after a while, reach out through Support in the app.",
        showRawLink: false,
      }),
    }
  },
  passwordChanged() {
    return {
      subject: 'Your Middleman password was changed',
      html: shell({
        heading: 'Password changed',
        bodyHtml: 'The password on your Middleman account was just changed. If this was you, no action is needed.',
        ctaText: "It wasn't me — reset it",
        ctaLink: 'https://middlemansecure.com/forgot-password',
        footerNote: "If you didn't make this change, reset your password right away and contact Support in the app.",
        showRawLink: false,
      }),
    }
  },
  unbanned() {
    return {
      subject: 'Your Middleman account has been restored',
      html: shell({
        heading: 'Account restored',
        bodyHtml: "Good news — your Middleman account is no longer restricted. You can log back in and pick up right where you left off.",
        ctaText: 'Log back in',
        ctaLink: 'https://middlemansecure.com/login',
        footerNote: 'Please keep following our Terms of Service to avoid further action on your account.',
        showRawLink: false,
      }),
    }
  },
}

// Best-effort — a moderation action or money movement must still succeed
// even if Resend is down or a particular address bounces.
export async function notify(to, template) {
  try {
    await sendMail({ to, ...template })
  } catch (err) {
    console.error('notification email failed', err)
  }
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
