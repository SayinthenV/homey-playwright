import { test, expect } from '@playwright/test';
import { ConveyanceListPage } from '../../pages/conveyances/ConveyanceListPage';
import { StripePaymentPage } from '../../pages/payments/StripePaymentPage';


/**
 * Stripe Payment Spec
 *
 * Tests Stripe payment flows within Homey's conveyancing platform:
 * - Navigating to the payment section
 * - Filling Stripe Elements iframe (card, expiry, CVC)
 * - Successful payment with test card 4242...
 * - Declined payment with test card 4000...0002
 * - 3D Secure challenge flow
 * - Insufficient funds scenario
 *
 * IMPORTANT: All payments use Stripe TEST mode cards.
 * Never use real card numbers in tests.
 *
 * Stripe Elements are rendered in iframes — must use frameLocator().
 * Role: Buyer (responsible for making payments)
 */


test.use({ storageState: 'playwright/.auth/buyer.json' });


// ─── Stripe test card constants ───────────────────────────────────────────────


const STRIPE_CARDS = {
    success: { number: '4242424242424242', expiry: '12/28', cvc: '123' },
    declined: { number: '4000000000000002', expiry: '12/28', cvc: '123' },
    threeDSecure: { number: '4000002500003155', expiry: '12/28', cvc: '123' },
    insufficientFunds: { number: '4000000000009995', expiry: '12/28', cvc: '123' },
    authRequired: { number: '4000002760003184', expiry: '12/28', cvc: '123' },
};


test.describe('Stripe Payment — Navigation', () => {
    let conveyanceListPage: ConveyanceListPage;
    let stripePaymentPage: StripePaymentPage;


                test.beforeEach(async ({ page }) => {
                      conveyanceListPage = new ConveyanceListPage(page);
                      stripePaymentPage = new StripePaymentPage(page);
                });


                test('should navigate to payment page from conveyance', async ({ page }) => {
                      await test.step('Find a conveyance with payment due', async () => {
                              await conveyanceListPage.goto();
                              await conveyanceListPage.expectPageVisible();


                                            const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) {
                                        console.log('No conveyances available — skipping payment test');
                                        test.skip();
                                        return;
                              }
                              await conveyanceListPage.clickFirstConveyance();
                      });


                         await test.step('Find payment link or button', async () => {
                                 const paymentLink = page.getByRole('link', { name: /pay.*now|make.*payment|payment/i })
                                   .or(page.getByRole('button', { name: /pay.*now|proceed.*payment/i }))
                                   .or(page.locator('[data-testid="payment-btn"]').first());


                                               const isVisible = await paymentLink.isVisible().catch(() => false);
                                 console.log(`Payment link visible: ${isVisible}`);
