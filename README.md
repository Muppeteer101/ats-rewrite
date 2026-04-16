# ats-rewriter

A multi-pass AI CV rewriter for the Almost Legal portfolio. Premium ATS rewriting that's measurably better than ChatGPT — without inventing experience.

- **Engine**: 4-pass pipeline (JD analysis → CV analysis → contextual rewrite → ATS scoring), Anthropic Claude Sonnet + Haiku, streamed via SSE
- **Output**: Polished PDF (3 templates: ATS-clean, Professional, Modern) + change report + before/after ATS score
- **Pricing**: First rewrite free + 1 free per calendar month, then 3-pack £9.99 / 10-pack £19.99 (multi-currency)
- **Auth**: Clerk magic-link + dashboard
- **Stack**: Next.js 16 + TypeScript + Tailwind 4, Upstash Redis, Stripe, Resend, deployed to Vercel

> **Working name only.** Domain TBD — replace `ats-rewriter` references when chosen.

## Architecture quick-reference

```
app/
  page.tsx                            Hero + RewriteForm
  rewrite/[id]/page.tsx               Live SSE narration + result UI
  dashboard/page.tsx                  Credits + history + upsell
  sign-in/[[...sign-in]]/page.tsx     Clerk magic-link
  api/
    rewrite/                          SSE engine orchestrator (consumes 1 credit)
    rewrite-meta/[id]/                Result lookup for the result page
    parse-cv/  parse-jd/              File/URL → text
    pdf/[rewriteId]/                  Render PDF in any template
    checkout/                         Stripe credit-pack session
    webhook/                          Stripe checkout.session.completed → +credits
src/engine/
  index.ts                            4-pass orchestrator (yields NarrationEvents)
  passes/                             analyzeJD · analyzeCV · rewriteCV · scoreATS
  prompts.ts                          ALL system prompts (anti-hallucination clauses live here)
  schemas.ts                          Zod schemas for every pass output
  llm.ts                              callJson + streamText helpers
lib/
  credits.ts                          Lifetime-free → monthly-free → paid order of consumption
  redis.ts  fx.ts  stripe.ts  email.ts
  pdf-templates/                      atsClean (default) · professional · modern · shared
  parsers/                            pdf · docx · url
components/                           RewriteForm · RewriteRunner · ScoreGauge · TemplatePicker · GapReportCard · ChangeRationaleList · UpsellModal · DashboardActions · RefTracker
proxy.ts                              Clerk middleware (Next 16 rename of middleware.ts)
```

## First-time setup

```bash
cp .env.example .env.local
# Fill in keys (see "Required env vars" below), then:
npm install
npm run dev
```

## Required env vars

All listed in `.env.example`. Critical ones:

| Var | How to get |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` | dashboard.clerk.com → new project (or `vercel integration add clerk`) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | `vercel integration add upstash` (auto-provisions) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com (use existing Almost Legal Stripe account) |
| `STRIPE_PRICE_*_PACK3` + `STRIPE_PRICE_*_PACK10` × 6 currencies | Create in Stripe (see below) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | resend.com |
| `CREATOR_TRACK_SECRET` + `CREATOR_TRACK_URL` | `cd ../almostlegal-ai && vercel env pull /tmp/al.env --environment=production --yes` then copy `CREATOR_TRACK_SECRET` |

## Stripe products to create

In the shared Almost Legal Stripe dashboard (Products → Add product), create one Product per pack with prices in each currency:

| Product | Currency | Amount | Env var |
|---|---|---|---|
| 3-pack | GBP | £9.99 | `STRIPE_PRICE_GBP_PACK3` |
| 3-pack | USD | $9.99 | `STRIPE_PRICE_USD_PACK3` |
| 3-pack | EUR | €9.99 | `STRIPE_PRICE_EUR_PACK3` |
| 3-pack | AUD | A$15 | `STRIPE_PRICE_AUD_PACK3` |
| 3-pack | CAD | C$13 | `STRIPE_PRICE_CAD_PACK3` |
| 3-pack | NZD | NZ$16 | `STRIPE_PRICE_NZD_PACK3` |
| 10-pack | GBP | £19.99 | `STRIPE_PRICE_GBP_PACK10` |
| 10-pack | USD | $19.99 | `STRIPE_PRICE_USD_PACK10` |
| 10-pack | EUR | €19.99 | `STRIPE_PRICE_EUR_PACK10` |
| 10-pack | AUD | A$30 | `STRIPE_PRICE_AUD_PACK10` |
| 10-pack | CAD | C$26 | `STRIPE_PRICE_CAD_PACK10` |
| 10-pack | NZD | NZ$32 | `STRIPE_PRICE_NZD_PACK10` |

All are one-shot (Mode: One time payment). All use `metadata.site === 'ATSR'` set by the checkout route — the webhook filters by this so the shared Stripe account routes events to the right product.

Webhook endpoint: `https://<your-domain>/api/webhook` — listen for `checkout.session.completed`.

## Engine: how it works

Per `/Users/openclaw/Documents/Muerto/relaunch-2026-04-16/ats-engine-architecture.md`:

1. **Pass 1 — JD analysis** (Sonnet @ 0.1, ~15s) — extracts required/preferred skills, deal-breakers, tone
2. **Pass 2 — CV analysis** (Sonnet @ 0.1, ~15s, parallel with Pass 1) — extracts roles, achievements, voice signature
3. **Pass 3 — Rewrite + change-log** (Sonnet @ 0.4, streamed, ~40s) — reframes real experience against JD keywords; for each bullet records `{ before, after, reason }`; flags JD requirements not met
4. **Pass 4 — ATS scoring** (Haiku @ 0, ~5s) — keyword coverage + before/after score + honest gap report

The defensive prompts in `src/engine/prompts.ts` (REWRITE_SYSTEM, lines marked NON-NEGOTIABLE) are the load-bearing differentiator vs ChatGPT. **Never soften them.**

## Credits accounting

`lib/credits.ts` — order of consumption per rewrite:

1. Lifetime-free (first rewrite ever) → `lifetimeFreeUsed = true`
2. Monthly-free (auto-resets when calendar month rolls) → `monthlyFreeUsed = true`
3. Paid credits (from Stripe pack purchases) → `paidCredits--`
4. Else → 402 Payment Required → upsell modal

State is keyed by Clerk userId in `cv-user:{userId}`. Stripe webhook adds `paidCredits` on `checkout.session.completed`.

## Creator-programme attribution

This site participates in the existing Almost Legal creator programme:

- **Click**: `RefTracker.tsx` reads `?ref=CODE`, sets `al_ref` cookie (30d), pings `https://almostlegal.ai/api/track-click` once per session per code
- **Sale**: webhook reads the Stripe coupon used at checkout, fires-and-forgets `POST CREATOR_TRACK_URL` with `x-track-secret`, `code`, `brand: 'ats-rewriter.com'`, `amountMinor`, `currency`
- **Discount**: 20% off via Stripe promotion code (matches the creator's sign-up coupon)

See `/Users/openclaw/Documents/Muerto/creator-programme-handoff.md` for the full pattern.

## Dev workflow

```bash
npm run dev              # local dev server
npm run build            # production build (catches all type errors)
npm run lint             # ESLint
```

Per the repo workflow methodology: work on `dev`, merge to `main`, Vercel auto-deploys `main`. Snapshot tarballs go to `/Users/openclaw/Archive/ats-rewriter/<YYYY-MM-DD>-<label>.tar.gz`.

## Verification checklist

- [ ] `npm run build` passes
- [ ] Sign in with magic link → land on `/dashboard`
- [ ] Upload sample CV (PDF) + paste JD → SSE narration appears within 3s, finishes in ≤90s
- [ ] Score gauge animates 42 → 87 (or similar) on completion
- [ ] Anti-hallucination test: CV without AWS, JD requires AWS → rewrite does NOT add AWS, gap report mentions it
- [ ] All 3 PDF templates download correctly
- [ ] ATS-clean PDF: open in [enhancv.com/resume-checker](https://enhancv.com/resume-checker) → 90%+ parse rate
- [ ] Out-of-credits flow: consume free + monthly-free → upsell modal appears
- [ ] Buy 3-pack with `4242 4242 4242 4242` → webhook fires → balance shows 3 credits
- [ ] Creator referral: visit `?ref=LOBSTERTEST` → `track-click` 200 → buy with promo → `track/sale` POST → check creator dashboard

## Notes for future me

- **Engine is design-agnostic.** If you ever want to A/B test designs, the engine + components are decoupled — clone `app/` into a variant.
- **Same plumbing fits `writemywill.ai`.** Parsers, PDF templates, credits accounting, dashboard, Stripe webhook, Resend email all generalise.
- **No Postgres.** All state in Upstash Redis. If you ever need joins or analytics, BigQuery export from Stripe + Resend is sufficient.
- **Cost per rewrite**: ~$0.08–0.15 at Sonnet pricing. Free monthly = ~$1.20/year per active user. Margin on a 10-pack = £18.99.
