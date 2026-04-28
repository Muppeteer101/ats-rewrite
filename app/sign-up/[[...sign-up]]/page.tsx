import { redirect } from 'next/navigation';

/**
 * Sign-up lives on almostlegal.ai. This page just bounces the user there
 * with a return URL so they come back here after creating an account.
 */
export const metadata = {
  title: 'Sign up — ImproveMyResume.ai',
  robots: { index: false, follow: false },
};

export default async function SignUpRedirect({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const returnUrl = params.redirect_url ?? 'https://improvemyresume.ai/';
  const url = new URL('https://almostlegal.ai/sign-up');
  url.searchParams.set('redirect_url', returnUrl);
  redirect(url.toString());
}
