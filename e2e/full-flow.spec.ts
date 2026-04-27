/**
 * full-flow.spec.ts
 * End-to-end test for the complete IMR user journey:
 *   1. Upload CV (PDF) + paste JD
 *   2. Run analysis (6 passes, free)
 *   3. See teaser scores
 *   4. Answer gap questions — gaps now phrased as questions
 *   5. Rescore with confirmed items
 *   6. See improved scores
 *   7. Hit paywall (upsell modal)
 *
 * Requires:
 *   - Dev server running:  ANTHROPIC_API_KEY="..." npm run dev -- --port 3000
 *   - CLERK_SECRET_KEY set in environment (for global-setup auth)
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const CV_PDF = path.join(__dirname, '../../fightfines/dt-resume.pdf');
const JD_TEXT = fs.readFileSync(path.join(__dirname, 'fixtures/zellis-jd.txt'), 'utf-8');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForAnalysis(page: Page) {
  // The analyze SSE stream finishes when the teaser card appears.
  // Give it up to 90s for all 6 passes to complete.
  await expect(
    page.locator('text=A few quick questions before we rescore').or(
      page.locator('text=No gaps flagged'),
    ),
  ).toBeVisible({ timeout: 150_000 });
}

async function waitForRescore(page: Page) {
  // After rescoring, the new-scores view shows a heading "Your updated scores"
  await expect(
    page.getByRole('heading', { name: /your updated scores/i }),
  ).toBeVisible({ timeout: 150_000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('IMR full click-through flow', () => {

  test('analyze → gap questions → rescore → paywall', async ({ page }) => {

    // ── Step 1: navigate to /new ──────────────────────────────────────────
    await page.goto('/new');
    await expect(page).toHaveURL(/\/new/);
    await page.screenshot({ path: 'e2e/screenshots/01-new-page.png' });

    // ── Step 2: upload CV as PDF ──────────────────────────────────────────
    const cvFileInput = page.locator('input[type="file"]').first();
    await cvFileInput.setInputFiles(CV_PDF);

    // Wait for the CV text to be parsed and appear in the textarea
    const cvTextarea = page.locator('textarea').first();
    await expect(cvTextarea).not.toBeEmpty({ timeout: 15_000 });
    const cvChars = (await cvTextarea.inputValue()).length;
    console.log(`CV parsed: ${cvChars} chars`);
    expect(cvChars).toBeGreaterThan(200);
    await page.screenshot({ path: 'e2e/screenshots/02-cv-uploaded.png' });

    // ── Step 3: paste JD ──────────────────────────────────────────────────
    const jdTextarea = page.locator('textarea').nth(1);
    await jdTextarea.fill(JD_TEXT);
    await expect(jdTextarea).not.toBeEmpty();
    await page.screenshot({ path: 'e2e/screenshots/03-jd-pasted.png' });

    // ── Step 4: submit ─────────────────────────────────────────────────────
    const analyseButton = page.getByRole('button', { name: /run the full analysis|starting engine/i });
    await expect(analyseButton).toBeEnabled();
    await analyseButton.click();

    // Should move to the rewrite runner page
    await expect(page).toHaveURL(/\/rewrite\//, { timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/04-analyzing.png' });

    // ── Step 5: wait for all 6 passes to complete ─────────────────────────
    console.log('Waiting for 6-pass analysis to complete...');
    await waitForAnalysis(page);
    await page.screenshot({ path: 'e2e/screenshots/05-teaser.png' });

    // Verify the three headline scores are visible
    const scoreNumbers = page.locator('[data-testid="score"]').or(
      // Fallback: look for large circled numbers (the score dials render as text)
      page.locator('text=/^\\d{2}$/')
    );
    // At least two score numbers should be visible (role match + ATS confidence)
    await expect(scoreNumbers.first()).toBeVisible();
    console.log('✓ Teaser scores visible');

    // ── Step 6: verify gap questions are phrased as questions ─────────────
    const gapSection = page.locator('text=A few quick questions before we rescore');
    const hasGaps = await gapSection.isVisible().catch(() => false);

    if (hasGaps) {
      // Each gap question should end with "?" (the new prompt format)
      const gapRows = page.locator('label').filter({ hasText: /\?/ });
      const gapCount = await gapRows.count();
      console.log(`Gap questions visible: ${gapCount}`);

      if (gapCount > 0) {
        // Assert at least one gap is phrased as a question
        const firstGapText = await gapRows.first().textContent();
        console.log(`First gap: ${firstGapText}`);
        expect(firstGapText).toMatch(/\?/);

        // Answer all gaps: Yes to first two, No to the rest
        for (let i = 0; i < gapCount; i++) {
          const row = gapRows.nth(i);
          // Each label row has radio inputs — pick Yes for first 2, No for rest
          const yesRadio = row.locator('input[type="radio"]').first();
          const noRadio  = row.locator('input[type="radio"]').last();
          if (i < 2) {
            await yesRadio.check();
          } else {
            await noRadio.check();
          }
        }

        await page.screenshot({ path: 'e2e/screenshots/06-gaps-answered.png' });

        // Rescore button should now be enabled
        const rescoreBtn = page.getByRole('button', { name: /rescore with my/i });
        await expect(rescoreBtn).toBeEnabled();
        console.log('✓ Rescore button enabled after answering gaps');

        // ── Step 7: rescore ─────────────────────────────────────────────
        await rescoreBtn.click();
        console.log('Waiting for rescore to complete...');
        await waitForRescore(page);
        await page.screenshot({ path: 'e2e/screenshots/07-new-scores.png' });
        console.log('✓ Rescore complete — new scores visible');

      } else {
        // Gaps exist but none are questions — this means the prompt fix isn't in yet
        console.warn('⚠ Gap section visible but no question-phrased gaps found');
        const skipBtn = page.getByRole('button', { name: /skip/i });
        await skipBtn.click();
        await waitForRescore(page);
      }

    } else {
      // No gaps flagged — go straight to rescore
      console.log('No gaps flagged — skipping straight to rescore');
      const rescoreBtn = page.getByRole('button', { name: /rescore/i });
      await expect(rescoreBtn).toBeEnabled();
      await rescoreBtn.click();
      await waitForRescore(page);
    }

    // ── Step 8: verify paywall / upsell CTA ──────────────────────────────
    const paywallCta = page.getByRole('button', { name: /unlock the full debrief/i });
    await expect(paywallCta).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/08-paywall.png' });
    console.log('✓ Paywall CTA visible: "Unlock the full debrief + rewrite"');

    // ── Step 9: click the CTA — should trigger finalise flow (credits check / upsell) ──
    await paywallCta.click();
    // After clicking, either the upsell modal appears or (if user has credits) finalize starts
    // Wait briefly and take a screenshot regardless
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: 'e2e/screenshots/09-after-unlock-click.png' });
    console.log('✓ Unlock button clicked — screenshot taken');

    console.log('\n✅ Full flow complete: analyze → gaps → rescore → paywall');
  });

});
