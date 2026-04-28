import { redirect } from 'next/navigation';

/**
 * Sign-in lives on almostlegal.ai. This page just bounces the user there
 * with a return URL so they come back here after signing in.
 */
export const metadata = {
  title: 'Sign in — ImproveMyResume.ai',
};

export default async function SignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const returnUrl = params.redirect_url ?? 'https://improvemyresume.ai/';
  const url = new URL('https://almostlegal.ai/sign-in');
  url.searchParams.set('redirect_url', returnUrl);
  redirect(url.toString());
}
