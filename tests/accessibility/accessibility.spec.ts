import { test, expect } from '@playwright/test';
import { A11yHelper } from '../../helpers/A11yHelper';
import { loadManifest } from '../../fixtures/test-data.setup';

/**
 * Accessibility Baseline Tests — Phase 8
 *
 * Enforces WCAG 2.1 Level AA compliance across all key Homey pages using
 * axe-core. Tests run against the authenticated agent role so pages render
 * with real data rather than empty states.
 *
 * Impact threshold: 'serious' and above will fail the test.
 * 'moderate' violations are logged as warnings but do not block.
 *
 * Run locally:
 *   ENV=qa npm run test:a11y
 *
 * Third-party iframes (Stripe Elements, Thirdfort widget) are excluded from
 * scanning — their accessibility is the vendor's responsibility.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Authentication — /auth
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Authentication', () => {
  test('login page meets WCAG 2.1 AA', async ({ page }) => {
    // Use a fresh unauthenticated page for the login page check
    const a11y = new A11yHelper(page);
    await page.goto('/auth', { waitUntil: 'networkidle' });
    await a11y.checkPage('Login /auth', {
      minimumImpact: 'serious',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enquiries
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Enquiries', () => {
  test('enquiry list page meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/enquiries', { waitUntil: 'networkidle' });
    await a11y.checkPage('Enquiry List');
  });

  test('new enquiry wizard meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/enquiries/new', { waitUntil: 'networkidle' });
    await a11y.checkPage('New Enquiry Wizard — Step 1');
  });

  test('enquiry detail page meets WCAG 2.1 AA', async ({ page }) => {
    const manifest = loadManifest();
    test.skip(!manifest || manifest.enquiries.length === 0, 'No seeded enquiry available');

    const a11y = new A11yHelper(page);
    const enquiry = manifest!.enquiries[0];
    await page.goto(`/enquiries/${enquiry.id}`, { waitUntil: 'networkidle' });
    await a11y.checkPage(`Enquiry Detail (${enquiry.reference})`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conveyances
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Conveyances', () => {
  test('conveyance list page meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/conveyances', { waitUntil: 'networkidle' });
    await a11y.checkPage('Conveyance List');
  });

  test('conveyance detail page meets WCAG 2.1 AA', async ({ page }) => {
    const manifest = loadManifest();
    test.skip(!manifest || manifest.conveyances.length === 0, 'No seeded conveyance available');

    const a11y = new A11yHelper(page);
    const conveyance = manifest!.conveyances[0];
    await page.goto(`/conveyances/${conveyance.id}`, { waitUntil: 'networkidle' });
    await a11y.checkPage(`Conveyance Detail (${conveyance.reference})`);
  });

  test('action centre page meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/action_centre', { waitUntil: 'networkidle' });
    await a11y.checkPage('Action Centre');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Quotes', () => {
  test('quote generator page meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/quotes/new', { waitUntil: 'networkidle' });
    await a11y.checkPage('Quote Generator');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Payments — Stripe iframe excluded from scanning
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Payments', () => {
  test('payments page meets WCAG 2.1 AA (excluding Stripe iframe)', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/payments', { waitUntil: 'networkidle' });
    await a11y.checkPage('Payments', {
      // Stripe Elements renders in an iframe — exclude it from scanning
      // Stripe is responsible for its own WCAG compliance
      exclude: ['iframe[name*="stripe"]', '#stripe-card-element', '[data-testid="stripe-iframe"]'],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KYC — Thirdfort widget excluded
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — KYC', () => {
  test('KYC dashboard meets WCAG 2.1 AA (excluding Thirdfort widget)', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/kyc', { waitUntil: 'networkidle' });
    await a11y.checkPage('KYC Dashboard', {
      exclude: ['iframe[src*="thirdfort"]', '[data-testid="thirdfort-widget"]'],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Documents', () => {
  test('document upload page meets WCAG 2.1 AA', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/documents', { waitUntil: 'networkidle' });
    await a11y.checkPage('Document Upload');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Focused rule checks — high-priority WCAG criteria
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility — Focused rule checks', () => {
  test('enquiry list has correct heading structure', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/enquiries', { waitUntil: 'networkidle' });
    await a11y.assertRule('heading-order', 'Enquiry List heading order');
  });

  test('conveyance list has landmark regions', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/conveyances', { waitUntil: 'networkidle' });
    await a11y.assertRule('region', 'Conveyance List landmark regions');
  });

  test('login form has accessible labels', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/auth', { waitUntil: 'networkidle' });
    await a11y.assertRule('label', 'Login form labels');
  });

  test('navigation has skip link', async ({ page }) => {
    const a11y = new A11yHelper(page);
    await page.goto('/enquiries', { waitUntil: 'networkidle' });
    // Check bypass block rule — ensures a skip-to-content link exists
    await a11y.assertRule('bypass', 'Skip navigation link');
  });
});
