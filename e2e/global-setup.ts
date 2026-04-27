/**
 * global-setup.ts
 * Uses @clerk/testing/playwright to sign in once without OTP,
 * then saves storageState.json for reuse across all tests.
 */
import { chromium, type FullConfig } from '@playwright/test';
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000';
const STORAGE_STATE = path.join(__dirname, 'storageState.json');

async function globalSetup(config: FullConfig) {
  // Re-use saved session if it's less than 6 hours old
  if (fs.existsSync(STORAGE_STATE)) {
    const age = Date.now() - fs.statSync(STORAGE_STATE).mtimeMs;
    if (age < 6 * 60 * 60 * 1000) {
      console.log('[setup] Reusing existing storageState (< 6h old)');
      return;
    }
  }

  // Initialise Clerk testing env vars (sets CLERK_FAPI + CLERK_TESTING_TOKEN)
  await clerkSetup({ config });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to a page that loads Clerk JS (homepage redirects to sign-in, which is fine)
  await page.goto(BASE_URL);

  // Sign in using Clerk's backend token — bypasses OTP entirely
  await clerk.signIn({
    page,
    emailAddress: 'dougietoal@gmail.com',
  });

  // clerk.signIn completes without navigating — go to /new to confirm auth
  await page.goto(`${BASE_URL}/new`);
  await page.waitForURL(/\/new/, { timeout: 15_000 });
  console.log(`[setup] Signed in. URL: ${page.url()}`);

  await context.storageState({ path: STORAGE_STATE });
  console.log(`[setup] Saved storageState → ${STORAGE_STATE}`);

  await browser.close();
}

export default globalSetup;
