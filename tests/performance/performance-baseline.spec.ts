import { test, expect } from '@playwright/test';
import { PerformanceHelper, PerformanceThresholds } from '../../helpers/PerformanceHelper';

/**
 * Performance Baseline Assertions — Phase 7
 *
 * Measures Core Web Vitals and load timing for key Homey pages.
 * Tests run against the BASE_URL environment variable (staging by default).
 *
 * All thresholds use Google "Good" CWV ranges. Override per-page where
 * the product team has agreed a tighter or looser budget.
 *
 * Run locally:
 *   npm run test:performance
 *
 * CI: runs in the performance-tests job on every push/PR.
 */

// Pages with heavier server-side data may need a slightly relaxed LCP
const RELAXED: PerformanceThresholds = {
  lcp: 3500,
  fcp: 2500,
  ttfb: 1200,
  dcl: 5000,
  load: 8000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — Authentication', () => {
  test('login page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/users/sign_in');
    perf.logMetrics(metrics, 'Login Page');
    perf.assertThresholds(metrics, {}, 'Login Page');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enquiries
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — Enquiries', () => {
  test('enquiry list page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/enquiries');
    perf.logMetrics(metrics, 'Enquiry List');
    perf.assertThresholds(metrics, {}, 'Enquiry List');
  });

  test('new enquiry wizard page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/enquiries/new');
    perf.logMetrics(metrics, 'New Enquiry Wizard');
    perf.assertThresholds(metrics, {}, 'New Enquiry Wizard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conveyances
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — Conveyances', () => {
  test('conveyance list page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/conveyances');
    perf.logMetrics(metrics, 'Conveyance List');
    // List can be data-heavy; use relaxed thresholds
    perf.assertThresholds(metrics, RELAXED, 'Conveyance List');
  });

  test('action centre page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/action_centre');
    perf.logMetrics(metrics, 'Action Centre');
    perf.assertThresholds(metrics, RELAXED, 'Action Centre');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quotes & Payments
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — Quotes & Payments', () => {
  test('quote generator page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/quotes/new');
    perf.logMetrics(metrics, 'Quote Generator');
    perf.assertThresholds(metrics, {}, 'Quote Generator');
  });

  test('payments page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    // Stripe Elements adds third-party JS — allow relaxed budget
    const metrics = await perf.measureNavigation('/payments');
    perf.logMetrics(metrics, 'Payments');
    perf.assertThresholds(metrics, RELAXED, 'Payments');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KYC & Documents
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — KYC & Documents', () => {
  test('KYC dashboard page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/kyc');
    perf.logMetrics(metrics, 'KYC Dashboard');
    perf.assertThresholds(metrics, {}, 'KYC Dashboard');
  });

  test('document upload page meets Core Web Vitals thresholds', async ({ page }) => {
    const perf = new PerformanceHelper(page);
    const metrics = await perf.measureNavigation('/documents');
    perf.logMetrics(metrics, 'Document Upload');
    perf.assertThresholds(metrics, {}, 'Document Upload');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Turbo Drive navigation timing
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Performance — Turbo Drive transitions', () => {
  test('Turbo navigation between enquiry list and new enquiry is fast', async ({ page }) => {
    const perf = new PerformanceHelper(page);

    // Cold load — full navigation
    await perf.measureNavigation('/enquiries');

    // Turbo-driven in-page navigation
    await page.click('a[href="/enquiries/new"]');
    await page.waitForURL('**/enquiries/new');

    // Collect metrics for the Turbo transition
    const metrics = await perf.collectMetrics();
    perf.logMetrics(metrics, 'Turbo: Enquiries → New');

    // Turbo transitions should be noticeably faster than cold loads
    // We only assert TTFB and TBT here; LCP/FCP may not re-fire on Turbo navigations
    if (metrics.ttfb !== null) {
      expect(metrics.ttfb, 'TTFB on Turbo navigation').toBeLessThan(400);
    }
    if (metrics.tbt !== null) {
      expect(metrics.tbt, 'TBT on Turbo navigation').toBeLessThan(150);
    }
  });
});
