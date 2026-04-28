'use client';

/**
 * Out-of-credits modal.
 *
 * Credit top-ups are handled centrally on almostlegal.ai/pricing.
 * This modal sends the user there with a `return_url` so they land
 * back on their in-progress rewrite after purchasing.
 */
export function UpsellModal({
  onClose,
  resumeDraftId,
}: {
  onClose?: () => void;
  resumeDraftId?: string;
}) {
  const returnPath = resumeDraftId ? `/rewrite/${resumeDraftId}` : '/';
  const pricingUrl = `https://almostlegal.ai/pricing?return_url=${encodeURIComponent(
    `https://improvemyresume.ai${returnPath}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(13, 37, 61, 0.45)' }}
    >
      <div className="card-elevated max-w-md w-full p-7">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="sub-heading mb-1">You&apos;re out of credits</h2>
            <p className="caption">Top up on Almost Legal to keep tailoring resumes.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-2xl leading-none px-2"
              style={{ color: 'var(--color-body)' }}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div
            className="p-4 rounded-[6px] border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: 4 }}>3 credits — £9.99</div>
            <div className="caption">£3.33 per rewrite</div>
          </div>
          <div
            className="p-4 rounded-[6px] border"
            style={{ borderColor: 'var(--color-purple)', background: 'var(--color-purple-soft)' }}
          >
            <span className="badge badge-purple" style={{ marginBottom: 6, display: 'inline-block' }}>Best value</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: 4 }}>10 credits — £24.99</div>
            <div className="caption">£2.50 per rewrite — works across all Almost Legal tools</div>
          </div>
        </div>

        <a
          href={pricingUrl}
          className="btn btn-primary w-full mt-5 text-center"
          style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
        >
          Buy credits on Almost Legal →
        </a>
        <p className="caption mt-3 text-center">
          Secure payment via Stripe. No subscription. Credits work on all Almost Legal tools and never expire.
        </p>
      </div>
    </div>
  );
}
