import { redirect } from 'next/navigation';

/**
 * The user-facing dashboard lives on almostlegal.ai — that's where the
 * unified credit balance, purchase history, and rewrite history across
 * every Almost Legal product are shown.
 */
export default function DashboardRedirect(): never {
  redirect('https://almostlegal.ai/dashboard');
}
