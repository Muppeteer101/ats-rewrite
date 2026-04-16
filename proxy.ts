import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require an authenticated session.
// /rewrite/:id is gated because every rewrite is tied to a user (consumes a credit).
// /dashboard is the user-facing history + credits page.
// /api/rewrite is the SSE engine endpoint — caller must be signed in (we charge the credit).
// /api/checkout creates Stripe sessions for credit-pack purchases (must be a real user).
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/rewrite/(.*)',
  '/api/rewrite',
  '/api/checkout',
  '/api/pdf/(.*)',
  '/api/track-credit',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

// Next 16 renamed `middleware.ts` to `proxy.ts` — same matcher syntax.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
