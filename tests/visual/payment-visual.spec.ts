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
    test.use({ storageState: 'playwright/.auth/buyer.json' });


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
