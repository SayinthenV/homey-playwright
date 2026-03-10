import { test } from '@playwright/test';
import { StripePaymentPage } from '../../pages/payments/StripePaymentPage';
import { QuoteGeneratorPage } from '../../pages/quotes/QuoteGeneratorPage';
import { KYCDashboardPage } from '../../pages/kyc/KYCDashboardPage';
import { PercyHelper } from '../../helpers/PercyHelper';
import { AppliHelper } from '../../helpers/AppliHelper';
import { loadManifest } from '../../fixtures/test-data.setup';

/**
 * Visual regression tests — Payment, Quote, and KYC pages
 * Percy + Applitools, both are no-ops without their respective env vars.
 *
 * Stripe iframes: Percy handles these via the @percy/playwright SDK which
 * uses the Stripe test environment. Applitools uses Layout match level
 * which is tolerant of minor iframe rendering differences.
 */

test.describe('Stripe Payment — Visual', () => {
    test.use({ storageState: '.auth/buyer.json' });

                test('stripe payment form — initial state', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const paymentPage = new StripePaymentPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, {
                              testName: 'Stripe Payment - Initial State',
                              matchLevel: 'Layout',
                      });

                         await paymentPage.goto(conv.id);
                      await appli.open();

                         // Hide Stripe iframe content — it's always dynamic
                         await percy.snapshot({
                                 name: 'Stripe Payment - Initial State',
                                 fullPage: false,
                                 hideSelectors: [
                                           'iframe[src*="stripe"]',
                                           '[data-testid="stripe-element"]',
                                           '.StripeElement',
                                         ],
                         });
                      await appli.checkWindow('Stripe Payment - Initial State', false);
                      await appli.close(false);
                });

                test('stripe payment form — card declined error state', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const paymentPage = new StripePaymentPage(page);
                      const percy = new PercyHelper(page);

                         await paymentPage.goto(conv.id);

                         // Fill with decline card details
                         await paymentPage.fillCardDetails({
                                 number: '4000000000000002',
                                 expiry: '12/34',
                                 cvc: '123',
                         }).catch(() => {});
                      await paymentPage.submit().catch(() => {});
                      await page.waitForTimeout(1000);

                         await percy.snapshot({
                                 name: 'Stripe Payment - Card Declined Error',
                                 fullPage: false,
                                 hideSelectors: ['iframe[src*="stripe"]'],
                         });
                });

                test('stripe payment — success confirmation page', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const paymentPage = new StripePaymentPage(page);
                      const percy = new PercyHelper(page);

                         // Navigate to expected success URL pattern
                         await page.goto(`${process.env.BASE_URL}/conveyances/${conv.id}/payment/success`).catch(() => {});
                      await page.waitForTimeout(500);

                         if (page.url().includes('/payment/success') || page.url().includes('/thank-you')) {
                                 await percy.snapshot({
                                           name: 'Stripe Payment - Success Confirmation',
                                           fullPage: true,
                                           hideSelectors: ['time', '[datetime]'],
                                 });
                         }
                });
});

test.describe('Quote Generator — Visual', () => {
    test.use({ storageState: '.auth/agent.json' });

                test('quote generator — initial state', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.enquiries.length === 0, 'No test data manifest');

                         const enquiry = manifest!.enquiries[0];
                      const quotePage = new QuoteGeneratorPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, { testName: 'Quote Generator - Initial' });

                         await quotePage.goto(enquiry.id);
                      await appli.open();

                         await percy.snapshot({
                                 name: 'Quote Generator - Initial State',
                                 fullPage: true,
                                 hideSelectors: ['time', '[datetime]'],
                         });
                      await appli.checkWindow('Quote Generator - Initial State', true);
                      await appli.close(false);
                });

                test('quote generator — with pricing filled', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.enquiries.length === 0, 'No test data manifest');

                         const enquiry = manifest!.enquiries[0];
                      const quotePage = new QuoteGeneratorPage(page);
                      const percy = new PercyHelper(page);

                         await quotePage.goto(enquiry.id);
                      // Fill purchase price if field is present
                         await page.locator('[data-testid="purchase-price"], input[name*="price"]')
                        .first().fill('350000').catch(() => {});
                      await page.waitForTimeout(500);

                         await percy.snapshot({
                                 name: 'Quote Generator - With Price Filled',
                                 fullPage: false,
                         });
                });
});

test.describe('KYC Dashboard — Visual', () => {
    test.use({ storageState: '.auth/solicitor.json' });

                test('kyc dashboard — initial state', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const kycPage = new KYCDashboardPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, { testName: 'KYC Dashboard - Initial' });

                         await kycPage.goto(conv.id);
                      await appli.open();

                         await percy.snapshot({
                                 name: 'KYC Dashboard - Initial State',
                                 fullPage: true,
                                 hideSelectors: ['time', '[datetime]', '.relative-time'],
                         });
                      await appli.checkWindow('KYC Dashboard - Initial State', true);
                      await appli.close(false);
                });

                test('kyc dashboard — responsive snapshot', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const kycPage = new KYCDashboardPage(page);
                      const percy = new PercyHelper(page);

                         await kycPage.goto(conv.id);
                      await percy.responsiveSnapshot('KYC Dashboard - Responsive');
                });
});
