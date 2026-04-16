import { Resend } from 'resend';

let _resend: Resend | null = null;
function client(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Almost Legal <hello@almostlegal.ai>';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain, professional template — narrow column, system fonts, white background,
 * one CTA. Matches the Stripe-style brand without trying to look like a Mailchimp
 * promo. Most CV recipients will read this on mobile mail clients that strip
 * fancy CSS anyway, so we keep it simple and let the words do the work.
 */
function shell(opts: { preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:24px;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#061b31;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escape(opts.preheader)}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5edf5;border-radius:8px;">
      <tr>
        <td style="padding:28px 32px 12px;">
          <div style="font-size:13px;letter-spacing:0.04em;color:#64748d;">ATS Rewriter · Almost Legal</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 28px;font-size:15px;line-height:1.55;">
          ${opts.bodyHtml}
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:12px;color:#64748d;">
      Almost Legal · hello@almostlegal.ai
    </p>
  </body>
</html>`;
}

/**
 * Sent immediately after a rewrite completes. Includes the chosen-template PDF
 * as an attachment + a link back to the dashboard for re-download / change report.
 */
export async function sendRewriteReadyEmail(opts: {
  to: string;
  jobTitle: string;
  scoreBefore: number;
  scoreAfter: number;
  rewriteUrl: string;
  pdfBase64: string;
  pdfFilename?: string;
}): Promise<void> {
  const { to, jobTitle, scoreBefore, scoreAfter, rewriteUrl, pdfBase64 } = opts;
  const filename = opts.pdfFilename ?? `cv-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.pdf`;
  const subject = `Your CV is ready — ATS score ${scoreBefore} → ${scoreAfter}`;

  const text = [
    `Your rewritten CV for ${jobTitle} is attached.`,
    ``,
    `ATS match score: ${scoreBefore} → ${scoreAfter}.`,
    ``,
    `Open the full result (re-download in another template, see the change report, view the gap report):`,
    rewriteUrl,
    ``,
    `— Almost Legal`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 18px;">Your rewritten CV for <strong>${escape(jobTitle)}</strong> is attached.</p>
    <p style="margin:0 0 22px;color:#64748d;">ATS match score: <span style="color:#061b31;font-weight:500;">${scoreBefore} → ${scoreAfter}</span></p>
    <p style="margin:0 0 26px;">
      <a href="${escape(rewriteUrl)}" style="display:inline-block;background:#533afd;color:#ffffff;text-decoration:none;font-weight:500;padding:10px 18px;border-radius:4px;">Open the full result →</a>
    </p>
    <p style="margin:0;color:#64748d;font-size:14px;">From there you can re-download in a different template, view the change report (every line we rewrote and why), or read the honest gap report.</p>
  `;

  await client().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html: shell({ preheader: `ATS score ${scoreBefore} → ${scoreAfter} — your rewrite is attached.`, bodyHtml }),
    attachments: [{ filename, content: pdfBase64 }],
  });
}

/** Receipt for a credit-pack purchase. Stripe sends its own receipt; this is the nudge back to use the credits. */
export async function sendCreditsTopUpEmail(opts: {
  to: string;
  credits: number;
  total: string;
  dashboardUrl: string;
}): Promise<void> {
  const { to, credits, total, dashboardUrl } = opts;

  const text = [
    `Thanks — ${total} processed.`,
    ``,
    `${credits} rewrites have been added to your account. Use them whenever you’re tailoring a CV to a specific role.`,
    ``,
    dashboardUrl,
    ``,
    `— Almost Legal`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 18px;">Thanks — <strong>${escape(total)}</strong> processed.</p>
    <p style="margin:0 0 22px;color:#64748d;"><span style="color:#061b31;font-weight:500;">${credits} rewrites</span> added to your account.</p>
    <p style="margin:0 0 22px;">
      <a href="${escape(dashboardUrl)}" style="display:inline-block;background:#533afd;color:#ffffff;text-decoration:none;font-weight:500;padding:10px 18px;border-radius:4px;">Open dashboard →</a>
    </p>
    <p style="margin:0;color:#64748d;font-size:14px;">Credits never expire.</p>
  `;

  await client().emails.send({
    from: FROM,
    to,
    subject: `${credits} CV rewrites added to your account`,
    text,
    html: shell({ preheader: `${credits} rewrites added — credits never expire.`, bodyHtml }),
  });
}
