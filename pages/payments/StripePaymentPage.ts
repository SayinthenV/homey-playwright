import { Page, Locator, expect, FrameLocator } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * StripePaymentPage
 * -----------------
 * Handles the Stripe.js payment form embedded in Homey.
 * Stripe card inputs are inside an iframe (Stripe Elements).
 * Card details NEVER touch Homey servers — Stripe.js handles them.
 *
 * Stripe Test Cards:
 *   Success:   4242 4242 4242 4242
 *   Declined:  4000 0000 0000 0002
 *   3DS Auth:  4000 0025 0000 3155
 *   Insuff:    4000 0000 0000 9995
 *
 * Route: /conveyances/:id/payments/new  OR  /payments/:id
 */
export class StripePaymentPage extends BasePage {

  // ── Payment summary ──────────────────────────────────────────
  readonly paymentAmount: Locator;
    readonly paymentDescription: Locator;
    readonly paymentReference: Locator;

  // ── Stripe iframe frame locator ──────────────────────────────
  // Stripe Elements renders card inputs inside an iframe
  readonly stripeFrame: FrameLocator;

  // ── Pay button (outside Stripe iframe) ──────────────────────
  readonly payButton: Locator;
    readonly payButtonAmount: Locator;

  // ── Post-payment ─────────────────────────────────────────────
  readonly paymentSuccessBanner: Locator;
    readonly paymentFailureBanner: Locator;
    readonly paymentReference_success: Locator;

  constructor(page: Page) {
        super(page);

      this.paymentAmount = page.getByTestId('payment-amount');
        this.paymentDescription = page.getByTestId('payment-description');
        this.paymentReference = page.getByTestId('payment-reference');

      // Stripe iframe — selector matches Stripe Elements' iframe
      this.stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]');

      this.payButton = page.getByRole('button', { name: /pay|submit payment/i });
        this.payButtonAmount = page.getByTestId('pay-button-amount');

      this.paymentSuccessBanner = page.getByTestId('payment-success-banner');
        this.paymentFailureBanner = page.getByTestId('payment-failure-banner');
        this.paymentReference_success = page.getByTestId('payment-success-reference');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(paymentId: string): Promise<void> {
        await this.page.goto(`/payments/${paymentId}`);
        await this.waitForPageLoad();
        // Wait for Stripe iframe to load
      await this.stripeFrame.locator('[placeholder="Card number"]').waitFor({ timeout: 15_000 });
  }

  // ── Stripe card input ────────────────────────────────────────

  /**
     * Fills the Stripe card number field (inside Stripe iframe).
     * Uses Playwright's FrameLocator to interact with iframe content.
     */
  async fillCardNumber(cardNumber: string): Promise<void> {
        const cardInput = this.stripeFrame.locator('[placeholder="Card number"]');
        await cardInput.click();
        await cardInput.fill(cardNumber.replace(/\s/g, ''));
  }

  async fillExpiry(expiry: string): Promise<void> {
        const expiryInput = this.stripeFrame.locator('[placeholder="MM / YY"]');
        await expiryInput.fill(expiry);
  }

  async fillCvc(cvc: string): Promise<void> {
        const cvcInput = this.stripeFrame.locator('[placeholder="CVC"]');
        await cvcInput.fill(cvc);
  }

  async fillPostcode(postcode: string): Promise<void> {
        const postcodeInput = this.stripeFrame.locator('[placeholder="ZIP"]');
        if (await postcodeInput.isVisible()) {
                await postcodeInput.fill(postcode);
        }
  }

  /**
     * Fills all Stripe card fields at once.
     * Uses Stripe test cards by default.
     */
  async fillCard(options: {
        cardNumber?: string;
        expiry?: string;
        cvc?: string;
        postcode?: string;
  } = {}): Promise<void> {
        const {
                cardNumber = '4242 4242 4242 4242',
                expiry = '12/29',
                cvc = '123',
                postcode = 'SW1A 1AA',
        } = options;

      await this.fillCardNumber(cardNumber);
        await this.fillExpiry(expiry);
        await this.fillCvc(cvc);
        await this.fillPostcode(postcode);
  }

  // ── Submit payment ───────────────────────────────────────────

  async submitPayment(): Promise<void> {
        await this.payButton.click();
        // Wait for payment processing — Stripe webhook triggers Turbo Stream update
      await this.page.waitForResponse(
              (r) => r.url().includes('webhooks/stripe') || r.url().includes('payments'),
        { timeout: 30_000 }
            ).catch(() => {
              // Fallback: just wait for success banner
      });
  }

  /**
     * Complete end-to-end payment flow with a test card.
     */
  async completePayment(cardNumber = '4242 4242 4242 4242'): Promise<void> {
        await this.fillCard({ cardNumber });
        await this.submitPayment();
        await this.expectPaymentSuccess();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectPaymentSuccess(): Promise<void> {
        await expect(this.paymentSuccessBanner).toBeVisible({ timeout: 15_000 });
  }

  async expectPaymentDeclined(): Promise<void> {
        await expect(this.paymentFailureBanner).toBeVisible({ timeout: 10_000 });
        await expect(this.paymentFailureBanner).toContainText(/declined|failed/i);
  }

  async expectPaymentAmount(amount: string): Promise<void> {
        await expect(this.paymentAmount).toContainText(amount);
  }

  async expectPayButtonEnabled(): Promise<void> {
        await expect(this.payButton).toBeEnabled();
  }

  async expectPayButtonDisabled(): Promise<void> {
        await expect(this.payButton).toBeDisabled();
  }
}

/**
 * Stripe Test Card Constants
 */
export const STRIPE_TEST_CARDS = {
    SUCCESS: '4242 4242 4242 4242',
    DECLINED: '4000 0000 0000 0002',
    THREE_D_SECURE: '4000 0025 0000 3155',
    INSUFFICIENT_FUNDS: '4000 0000 0000 9995',
    EXPIRED: '4000 0000 0000 0069',
    INCORRECT_CVC: '4000 0000 0000 0127',
} as const;
