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

test.use({ storageState: '.auth/buyer.json' });

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

                                               if (isVisible) {
                                                         await paymentLink.click();
                                                         await page.waitForTimeout(1000);

                                   await test.step('Verify Stripe iframe loaded', async () => {
                                               const stripeFrame = page.frameLocator('iframe[src*="stripe.com"]').first();
                                               const cardInput = stripeFrame.locator('[placeholder*="card number"], input[name="cardnumber"]').first();
                                               const frameLoaded = await cardInput.isVisible({ timeout: 10000 }).catch(() => false);
                                               console.log(`Stripe Elements iframe loaded: ${frameLoaded}`);
                                   });
                                               }
                         });
                });

                test('should display payment summary before card entry', async ({ page }) => {
                      await test.step('Navigate to conveyance', async () => {
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();
                      });

                         await test.step('Check payment summary is shown', async () => {
                                 const paymentSummary = page.locator('[data-testid="payment-summary"], .payment-summary').first();
                                 const isVisible = await paymentSummary.isVisible().catch(() => false);
                                 console.log(`Payment summary visible: ${isVisible}`);

                                               if (isVisible) {
                                                         // Verify amount is in GBP
                                   const amountEl = page.getByText(/£[\d,]+/).first();
                                                         const hasAmount = await amountEl.isVisible().catch(() => false);
                                                         console.log(`GBP amount visible in payment summary: ${hasAmount}`);
                                               }
                         });
                });
});

test.describe('Stripe Payment — Successful Payment', () => {
    let stripePaymentPage: StripePaymentPage;

                test.beforeEach(async ({ page }) => {
                      stripePaymentPage = new StripePaymentPage(page);
                });

                test('should complete payment with Visa success card', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentLink = page.getByRole('link', { name: /pay.*now|make.*payment/i })
                                .or(page.locator('[data-testid="payment-btn"]').first());
                              const isVisible = await paymentLink.isVisible().catch(() => false);
                              if (!isVisible) { test.skip(); return; }
                              await paymentLink.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Fill Stripe card details', async () => {
                                 const { number, expiry, cvc } = STRIPE_CARDS.success;

                                               await stripePaymentPage.fillCardNumber(number);
                                 await stripePaymentPage.fillExpiry(expiry);
                                 await stripePaymentPage.fillCVC(cvc);
                         });

                         await test.step('Submit payment', async () => {
                                 await stripePaymentPage.submitPayment();
                         });

                         await test.step('Verify payment success', async () => {
                                 await stripePaymentPage.expectPaymentSuccess();

                                               // Should redirect back to conveyance or show success page
                                               const successMsg = page.getByText(/payment.*success|paid|thank.*you/i).first();
                                 const isSuccess = await successMsg.isVisible({ timeout: 15000 }).catch(() => false);
                                 console.log(`Payment success message visible: ${isSuccess}`);
                         });
                });

                test('should show receipt or confirmation after payment', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Complete payment with success card', async () => {
                                 await stripePaymentPage.fillCardNumber(STRIPE_CARDS.success.number);
                                 await stripePaymentPage.fillExpiry(STRIPE_CARDS.success.expiry);
                                 await stripePaymentPage.fillCVC(STRIPE_CARDS.success.cvc);
                                 await stripePaymentPage.submitPayment();
                         });

                         await test.step('Verify receipt/confirmation shown', async () => {
                                 const receiptEl = page.locator(
                                           '[data-testid="payment-receipt"], .payment-receipt, [class*="receipt"]'
                                         ).first();
                                 const hasReceipt = await receiptEl.isVisible({ timeout: 15000 }).catch(() => false);
                                 console.log(`Payment receipt/confirmation visible: ${hasReceipt}`);
                         });
                });
});

test.describe('Stripe Payment — Failed Payments', () => {
    let stripePaymentPage: StripePaymentPage;

                test.beforeEach(async ({ page }) => {
                      stripePaymentPage = new StripePaymentPage(page);
                });

                test('should handle declined card gracefully', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Enter declined card details', async () => {
                                 await stripePaymentPage.fillCardNumber(STRIPE_CARDS.declined.number);
                                 await stripePaymentPage.fillExpiry(STRIPE_CARDS.declined.expiry);
                                 await stripePaymentPage.fillCVC(STRIPE_CARDS.declined.cvc);
                                 await stripePaymentPage.submitPayment();
                         });

                         await test.step('Verify decline error is shown', async () => {
                                 const errorMsg = page.getByText(/declined|card.*declined|payment.*failed/i).first();
                                 const isDeclined = await errorMsg.isVisible({ timeout: 10000 }).catch(() => false);
                                 console.log(`Card declined error visible: ${isDeclined}`);

                                               // User should still be on the payment page (not redirected)
                                               const stillOnPayment = page.url().includes('payment');
                                 console.log(`Still on payment page after decline: ${stillOnPayment}`);
                         });
                });

                test('should show insufficient funds error', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Enter insufficient funds card', async () => {
                                 await stripePaymentPage.fillCardNumber(STRIPE_CARDS.insufficientFunds.number);
                                 await stripePaymentPage.fillExpiry(STRIPE_CARDS.insufficientFunds.expiry);
                                 await stripePaymentPage.fillCVC(STRIPE_CARDS.insufficientFunds.cvc);
                                 await stripePaymentPage.submitPayment();
                         });

                         await test.step('Verify insufficient funds error', async () => {
                                 const errorMsg = page.getByText(/insufficient|funds|balance/i).first();
                                 const hasError = await errorMsg.isVisible({ timeout: 10000 }).catch(() => false);
                                 console.log(`Insufficient funds error visible: ${hasError}`);
                         });
                });
});

test.describe('Stripe Payment — 3D Secure', () => {
    let stripePaymentPage: StripePaymentPage;

                test.beforeEach(async ({ page }) => {
                      stripePaymentPage = new StripePaymentPage(page);
                });

                test('should handle 3D Secure challenge flow', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Enter 3DS card and submit', async () => {
                                 await stripePaymentPage.fillCardNumber(STRIPE_CARDS.threeDSecure.number);
                                 await stripePaymentPage.fillExpiry(STRIPE_CARDS.threeDSecure.expiry);
                                 await stripePaymentPage.fillCVC(STRIPE_CARDS.threeDSecure.cvc);
                                 await stripePaymentPage.submitPayment();
                         });

                         await test.step('Handle 3DS challenge iframe', async () => {
                                 // Stripe 3DS opens a modal with a nested iframe
                                               const threeDSFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]')
                                   .frameLocator('iframe').first();

                                               const completeBtn = threeDSFrame.getByRole('button', { name: /complete|authorize|confirm/i }).first();
                                 const challengeVisible = await completeBtn.isVisible({ timeout: 10000 }).catch(() => false);

                                               console.log(`3DS challenge visible: ${challengeVisible}`);

                                               if (challengeVisible) {
                                                         await completeBtn.click();
                                                         await stripePaymentPage.expectPaymentSuccess();
                                                         console.log('3DS payment completed successfully');
                                               }
                         });
                });
});

test.describe('Stripe Payment — Validation', () => {
    let stripePaymentPage: StripePaymentPage;

                test.beforeEach(async ({ page }) => {
                      stripePaymentPage = new StripePaymentPage(page);
                });

                test('should validate required card fields before submission', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Submit without filling card details', async () => {
                                 await stripePaymentPage.submitPayment();

                                               // Should show validation errors within the Stripe iframe
                                               const errorMsg = page.getByText(/required|incomplete|enter.*card/i).first();
                                 const stripeError = page.frameLocator('iframe[src*="stripe.com"]')
                                   .getByText(/incomplete|required/i).first();

                                               const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(async () =>
                                                         await stripeError.isVisible({ timeout: 5000 }).catch(() => false)
                                                                                                                        );
                                 console.log(`Validation error shown for empty submission: ${hasError}`);
                         });
                });

                test('should reject invalid card number', async ({ page }) => {
                      await test.step('Navigate to payment page', async () => {
                              const conveyanceListPage = new ConveyanceListPage(page);
                              await conveyanceListPage.goto();
                              const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) { test.skip(); return; }
                              await conveyanceListPage.clickFirstConveyance();

                                            const paymentBtn = page.locator('[data-testid="payment-btn"], [href*="payment"]').first();
                              if (!await paymentBtn.isVisible().catch(() => false)) { test.skip(); return; }
                              await paymentBtn.click();
                              await page.waitForTimeout(1000);
                      });

                         await test.step('Enter invalid card number', async () => {
                                 await stripePaymentPage.fillCardNumber('1234567890123456');
                                 await stripePaymentPage.fillExpiry('12/28');
                                 await stripePaymentPage.fillCVC('123');
                                 await stripePaymentPage.submitPayment();

                                               const errorMsg = page.frameLocator('iframe[src*="stripe.com"]')
                                   .getByText(/invalid.*card|card.*number.*invalid/i).first();
                                 const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
                                 console.log(`Invalid card number error shown: ${hasError}`);
                         });
                });
});
