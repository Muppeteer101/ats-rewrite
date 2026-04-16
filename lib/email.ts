import { Resend } from 'resend';

let _resend: Resend | null = null;
function client(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ATS Rewriter <hello@example.com>';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sent immediately after a rewrite completes (whether free or paid).
 * Includes the chosen-template PDF as an attachment + a deep link back
 * to the dashboard for re-download / picking a different template.
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
  const filename = opts.pdfFilename ?? `cv-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

  const subject = `Your CV is ready — ATS score ${scoreBefore} → ${scoreAfter}`;

  const text =
    `Your rewritten CV for "${jobTitle}" is attached.\n\n` +
    `ATS match score: ${scoreBefore} → ${scoreAfter}.\n\n` +
    `Re-download in a different template, view your full change report, or apply this same flow to another job:\n${rewriteUrl}\n\n` +
    `— ATS Rewriter`;

  const html = `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:32px;line-height:1.55;">
    <div style="max-width:560px;margin:0 auto;background:#131316;border:1px solid #26262d;border-radius:14px;padding:32px;">
      <h1 style="margin:0 0 12px;font-size:22px;">Your CV is ready</h1>
      <p style="margin:0 0 20px;color:#a1a1aa;">Rewritten for <strong style="color:#f4f4f5;">${escape(jobTitle)}</strong>.</p>
      <div style="display:flex;gap:16px;align-items:center;background:#06060a;border:1px solid #26262d;border-radius:10px;padding:18px 22px;margin:0 0 24px;">
        <div style="font-size:13px;color:#71717a;">ATS score</div>
        <div style="font-size:22px;font-weight:600;color:#a1a1aa;">${scoreBefore}</div>
        <div style="font-size:18px;color:#71717a;">→</div>
        <div style="font-size:28px;font-weight:700;color:#4ade80;">${scoreAfter}</div>
      </div>
      <p style="margin:0 0 24px;">The PDF is attached. You can also re-download it in a different template, view the full change report (every line we rewrote and why), or run this flow again on a new job.</p>
      <p style="margin:0 0 28px;"><a href="${escape(rewriteUrl)}" style="background:#ff6b6b;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block;">View on ATS Rewriter →</a></p>
      <p style="margin:0;color:#71717a;font-size:13px;">Nothing in your CV was invented. If a job needs a skill you don't have, the change report tells you so — explicitly. That's the whole point.</p>
    </div>
  </body></html>`;

  await client().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
    attachments: [{ filename, content: pdfBase64 }],
  });
}

/**
 * Receipt for a credit-pack purchase (sent from the Stripe webhook).
 * Lightweight — Stripe also sends its own receipt, this is just the
 * "thanks, your N credits are ready" nudge back to the dashboard.
 */
export async function sendCreditsTopUpEmail(opts: {
  to: string;
  credits: number;
  total: string;
  dashboardUrl: string;
}): Promise<void> {
  const { to, credits, total, dashboardUrl } = opts;

  await client().emails.send({
    from: FROM,
    to,
    subject: `${credits} CV rewrites added to your account`,
    text:
      `Thanks for the ${total} top-up.\n\n` +
      `${credits} rewrites have been added to your ATS Rewriter account. ` +
      `Tackle your next role here:\n${dashboardUrl}\n`,
    html: `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:32px;line-height:1.55;">
      <div style="max-width:520px;margin:0 auto;background:#131316;border:1px solid #26262d;border-radius:14px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;">${credits} rewrites added</h1>
        <p style="margin:0 0 18px;color:#a1a1aa;">Thanks for the ${escape(total)} top-up. Your credits are ready to use.</p>
        <p style="margin:0 0 28px;"><a href="${escape(dashboardUrl)}" style="background:#ff6b6b;color:#0a0a0b;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block;">Open my dashboard →</a></p>
      </div>
    </body></html>`,
  });
}
