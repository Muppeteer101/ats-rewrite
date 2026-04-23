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
const TRUSTPILOT_URL = process.env.TRUSTPILOT_URL;

// Cross-promo points at almostlegal.ai (the icon-grid landing for the whole
// portfolio) rather than listing every brand by name — landing is being
// redesigned and we don't want to mirror a stale brand list here.

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sent after a resume rewrite completes (free or paid).
 *
 * This is the standard Almost Legal post-purchase email template — same
 * structure as Write My Legal Letter / Cancel My Parking Ticket / etc:
 * congratulations + PDF + star rating + share code (50% off, 10 uses) +
 * cross-promo to all 8 other portfolio brands.
 */
export async function sendRewriteReadyEmail(opts: {
  to: string;
  customerName?: string;
  jobTitle: string;
  scoreBefore: number;
  scoreAfter: number;
  rewriteUrl: string;
  pdfBase64: string;
  pdfFilename?: string;
  shareCode?: string;
  sessionId?: string;
}): Promise<void> {
  const {
    to,
    customerName,
    jobTitle,
    scoreBefore,
    scoreAfter,
    rewriteUrl,
    pdfBase64,
    shareCode,
    sessionId,
  } = opts;

  const filename =
    opts.pdfFilename ??
    `cv-${jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.pdf`;
  const firstName = customerName?.split(' ')[0] ?? 'there';
  const SITE_NAME = 'ATS Rewriter';
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://toolykit.ai';
  const FROM_EMAIL = 'hello@almostlegal.ai';

  // Single link to the AL portfolio landing — replaces the per-brand list.
  const crossPromoBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:10px;border:1px solid #eee;">
      <tr><td style="padding:18px 20px;text-align:center;">
        <p style="margin:0 0 6px;font-size:14px;color:#444;">More tools that fight your corner.</p>
        <p style="margin:0;font-size:13px;">
          <a href="https://almostlegal.ai" style="color:#533afd;font-weight:600;text-decoration:none;">Browse the Almost Legal toolkit →</a>
        </p>
      </td></tr>
    </table>`;

  const reviewSection = `
    <tr>
      <td style="padding: 28px 0 0;">
        <p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1a1a1a;">How did we do?</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #555; line-height: 1.6;">Tap a star to let us know — takes 10 seconds.</p>
        <table cellpadding="0" cellspacing="0" style="margin: 0;">
          <tr>
            ${[1, 2, 3, 4, 5]
              .map((n) => {
                const href =
                  n >= 4 && TRUSTPILOT_URL
                    ? TRUSTPILOT_URL
                    : `${SITE_URL}/feedback?rating=${n}&session=${sessionId || ''}`;
                return `<td style="padding: 0 4px 0 0;">
                  <a href="${href}" style="display: inline-block; font-size: 44px; line-height: 1; text-decoration: none; color: #f59e0b;" title="${n} star${n > 1 ? 's' : ''}">★</a>
                </td>`;
              })
              .join('')}
          </tr>
        </table>
      </td>
    </tr>`;

  const shareSection = shareCode
    ? `
    <tr>
      <td style="padding: 28px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f5ff; border-radius: 10px; border: 1px solid #e8e0ff;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 8px; font-size: 17px; font-weight: 700; color: #1a1a1a;">Share this. You both win. 🎁</p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #444; line-height: 1.6;">
                Know anyone job-hunting, fighting a parking ticket, or stuck reading a dodgy contract? Send them this code — it gives them <strong>50% off</strong> on any Almost Legal tool. Every time someone uses it, you get a <strong>free credit</strong> in return. Up to 10 times.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="padding: 16px 20px; background: white; border: 2px solid #1a1a1a; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.08em;">Your personal share code</p>
                    <p style="margin: 0; font-size: 30px; font-weight: 800; color: #1a1a1a; letter-spacing: 0.12em; font-family: monospace;">${escape(shareCode)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 13px; color: #666; line-height: 1.5;">
                They use it at checkout on any Almost Legal site for 50% off. You get emailed a free credit code each time. Simple.
              </p>
              <a href="mailto:?subject=50%25%20off%20any%20Almost%20Legal%20tool&body=Hey%2C%20I%20just%20used%20Almost%20Legal%20to%20rewrite%20my%20CV%20and%20it%20worked.%20Use%20my%20code%20${encodeURIComponent(shareCode)}%20for%2050%25%20off%20on%20any%20of%20their%20tools%3A%20https%3A%2F%2Falmostlegal.ai" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-right: 8px;">Share by Email</a>
              <a href="https://wa.me/?text=Hey%2C%20I%20just%20used%20Almost%20Legal%20to%20rewrite%20my%20CV%20and%20it%20worked.%20Use%20my%20code%20${encodeURIComponent(shareCode)}%20for%2050%25%20off%20on%20any%20of%20their%20tools%3A%20https%3A%2F%2Falmostlegal.ai" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 11px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">Share on WhatsApp</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : '';

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: white; border-radius: 12px; overflow: hidden;">

        <tr>
          <td style="background: #ffffff; padding: 24px 32px; text-align: center; border-bottom: 1px solid #eeeeee;">
            <p style="margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">${SITE_NAME}</p>
            <p style="margin: 4px 0 0; color: #666; font-size: 13px;">by Almost Legal</p>
          </td>
        </tr>

        <tr><td style="padding: 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom: 20px;">
              <p style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a;">Your resume is ready${firstName !== 'there' ? ', ' + escape(firstName) : ''} — go land that interview 🎉</p>
            </td></tr>

            <tr><td style="padding-bottom: 24px;">
              <p style="margin: 0; font-size: 15px; color: #444; line-height: 1.6;">
                We analysed, scored, and rewrote your resume for <strong>${escape(jobTitle)}</strong>. Your original matched the role at
                <strong>${scoreBefore}/100</strong>; the rewritten version is <strong style="color:#108c3d;">${scoreAfter}%</strong> confidence
                to pass ATS screening. The PDF is attached. Send it off and good luck.
              </p>
            </td></tr>

            <tr><td style="padding: 0 0 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f7ff; border: 1px solid #cce0ff; border-radius: 8px;">
                <tr><td style="padding: 20px 24px;">
                  <p style="margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1a1a1a;">📄 Your resume is attached</p>
                  <p style="margin: 0 0 14px; font-size: 14px; color: #444; line-height: 1.6;">
                    ATS-clean template (highest parse rate). Two more templates (Professional, Modern) are available on your result page below.
                  </p>
                  <a href="${escape(rewriteUrl)}" style="display:inline-block;background:#533afd;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:6px;font-size:14px;">Open the result page →</a>
                </td></tr>
              </table>
            </td></tr>

            ${reviewSection}
            ${shareSection}

            <tr><td style="padding: 28px 0 20px;"><hr style="border: none; border-top: 1px solid #eee; margin: 0;"></td></tr>

            <tr><td>
              ${crossPromoBlock}
            </td></tr>

          </table>
        </td></tr>

        <tr><td style="background: #f9f9f9; padding: 20px 32px; border-top: 1px solid #eee;">
          <p style="margin: 0; font-size: 12px; color: #999;">Almost Legal · <a href="https://almostlegal.ai" style="color: #999;">almostlegal.ai</a></p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #999;">Questions? <a href="mailto:${FROM_EMAIL}" style="color: #999;">${FROM_EMAIL}</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  await client().emails.send({
    from: FROM,
    to,
    subject: `Your resume is ready — match ${scoreBefore}/100, ATS ${scoreAfter}%`,
    html,
    attachments: [{ filename, content: pdfBase64 }],
  });
}

/**
 * Sent to the original sharer when someone uses their share code at
 * checkout on any Almost Legal site. Same template as Write My Legal Letter
 * — the reward code is a 100%-off coupon that works on any AL tool.
 */
export async function sendReferrerRewardEmail(opts: {
  to: string;
  rewardCode: string;
  buyerName?: string;
}): Promise<void> {
  const { to, rewardCode, buyerName } = opts;
  const SITE_NAME = 'ATS Rewriter';
  const FROM_EMAIL = 'hello@almostlegal.ai';
  const buyer = buyerName ?? 'Someone you referred';

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: white; border-radius: 12px; overflow: hidden;">
        <tr><td style="background: #1a1a1a; padding: 28px 32px;">
          <p style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">${SITE_NAME}</p>
          <p style="margin: 4px 0 0; color: #888; font-size: 13px;">by Almost Legal</p>
        </td></tr>
        <tr><td style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #1a1a1a;">Your free credit is here 🎉</p>
          <p style="margin: 0 0 20px; font-size: 15px; color: #444; line-height: 1.6;">
            ${escape(buyer)} just used your share code and bought. As promised — here's your free credit, valid on any Almost Legal site:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f5ff; border-radius: 10px; border: 1px solid #e8e0ff; margin-bottom: 24px;">
            <tr><td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.05em;">Your free credit code</p>
              <p style="margin: 0; font-size: 30px; font-weight: 800; color: #1a1a1a; letter-spacing: 0.1em; font-family: monospace;">${escape(rewardCode)}</p>
            </td></tr>
          </table>
          <p style="margin: 0 0 20px; font-size: 14px; color: #555; line-height: 1.6;">Use it at checkout on any Almost Legal site for 100% off. Single-use, no expiry.</p>
          <p style="margin: 0; font-size: 13px; color: #888;">Keep sharing your code — you get a free credit every time someone buys with it.</p>
        </td></tr>
        <tr><td style="background: #f9f9f9; padding: 20px 32px; border-top: 1px solid #eee;">
          <p style="margin: 0; font-size: 12px; color: #999;">Almost Legal · <a href="https://almostlegal.ai" style="color: #999;">almostlegal.ai</a></p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #999;">Questions? <a href="mailto:${FROM_EMAIL}" style="color: #999;">${FROM_EMAIL}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await client().emails.send({
    from: FROM,
    to,
    subject: `Your free credit is ready 🎉`,
    html,
  });
}

/** Lightweight Stripe-receipt nudge for credit-pack top-ups. */
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
    subject: `${credits} resume rewrites added to your account`,
    html: `<!doctype html><html><body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#f5f5f5;padding:32px;color:#1a1a1a;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;padding:32px;">
        <p style="margin:0 0 12px;font-size:20px;font-weight:700;">${credits} rewrites added 🎉</p>
        <p style="margin:0 0 18px;color:#444;line-height:1.55;">Thanks — <strong>${escape(total)}</strong> processed. Your credits are ready to use.</p>
        <p style="margin:0 0 22px;"><a href="${escape(dashboardUrl)}" style="display:inline-block;background:#533afd;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:6px;">Open dashboard →</a></p>
        <p style="margin:0;color:#888;font-size:13px;">Credits never expire.</p>
      </div></body></html>`,
  });
}
