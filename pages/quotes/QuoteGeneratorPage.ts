import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * QuoteGeneratorPage
 * ------------------
 * The fee-scale driven quote generation page.
 * Displays itemised breakdown of legal fees, disbursements, and VAT.
 * Driven by Homey's FeeScale / QuoteCalculator system.
 *
 * Route: /enquiries/:id/quotes/new  OR  /conveyances/:id/quotes/new
 */
export class QuoteGeneratorPage extends BasePage {

  // ── Fee scale selector ───────────────────────────────────────
  readonly feeScaleSelect: Locator;
    readonly solicitorFirmSelect: Locator;

  // ── Quote breakdown (Turbo Frame: quote-breakdown) ───────────
  readonly quoteBreakdownFrame: Locator;
    readonly baseFeeAmount: Locator;
    readonly leaseholdSupplement: Locator;
    readonly newBuildSupplement: Locator;
    readonly disbursementsSection: Locator;
    readonly disbursementRows: Locator;
    readonly vatAmount: Locator;
    readonly totalAmount: Locator;

  // ── Quote actions ────────────────────────────────────────────
  readonly generateButton: Locator;
    readonly sendToClientButton: Locator;
    readonly downloadPdfButton: Locator;
    readonly acceptQuoteButton: Locator;

  // ── Optional disbursements ───────────────────────────────────
  readonly optionalDisbursementCheckboxes: Locator;

  constructor(page: Page) {
        super(page);

      this.feeScaleSelect = page.getByLabel(/fee scale/i);
        this.solicitorFirmSelect = page.getByLabel(/solicitor.*firm/i);

      // Turbo Frame wrapping the live quote preview
      this.quoteBreakdownFrame = page.locator('turbo-frame#quote-breakdown');
        this.baseFeeAmount = page.getByTestId('quote-base-fee');
        this.leaseholdSupplement = page.getByTestId('quote-leasehold-supplement');
        this.newBuildSupplement = page.getByTestId('quote-new-build-supplement');
        this.disbursementsSection = page.getByTestId('quote-disbursements');
        this.disbursementRows = page.getByTestId('disbursement-row');
        this.vatAmount = page.getByTestId('quote-vat');
        this.totalAmount = page.getByTestId('quote-total');

      this.generateButton = page.getByRole('button', { name: /generate.*quote/i });
        this.sendToClientButton = page.getByRole('button', { name: /send.*client|email.*quote/i });
        this.downloadPdfButton = page.getByRole('link', { name: /download.*pdf|pdf/i });
        this.acceptQuoteButton = page.getByRole('button', { name: /accept.*quote/i });

      this.optionalDisbursementCheckboxes = page.getByTestId('optional-disbursement-checkbox');
  }

  // ── Navigation ───────────────────────────────────────────────

  async gotoForEnquiry(enquiryId: string): Promise<void> {
        await this.page.goto(`/enquiries/${enquiryId}/quotes/new`);
        await this.waitForPageLoad();
  }

  async gotoForConveyance(conveyanceId: string): Promise<void> {
        await this.page.goto(`/conveyances/${conveyanceId}/quotes/new`);
        await this.waitForPageLoad();
  }

  // ── Actions ──────────────────────────────────────────────────

  async selectFeeScale(feeScaleName: string): Promise<void> {
        await this.feeScaleSelect.selectOption({ label: feeScaleName });
        // Fee scale change triggers Turbo Frame refresh of quote breakdown
      await this.waitForTurboFrame('quote-breakdown');
  }

  async generateQuote(): Promise<void> {
        await this.generateButton.click();
        await this.waitForTurboFrame('quote-breakdown');
        await expect(this.totalAmount).toBeVisible();
  }

  async toggleOptionalDisbursement(index: number): Promise<void> {
        const checkbox = this.optionalDisbursementCheckboxes.nth(index);
        await checkbox.click();
        await this.waitForTurboFrame('quote-breakdown');
  }

  async sendToClient(): Promise<void> {
        await this.sendToClientButton.click();
        await this.waitForTurboStream();
        await this.expectSuccessFlash();
  }

  async downloadPdf(): Promise<void> {
        const downloadPromise = this.page.waitForEvent('download');
        await this.downloadPdfButton.click();
        const download = await downloadPromise;
        return download.path();
  }

  // ── Getters ──────────────────────────────────────────────────

  async getTotalAmount(): Promise<string> {
        return (await this.totalAmount.textContent())?.trim() || '';
  }

  async getTotalAmountAsNumber(): Promise<number> {
        const text = await this.getTotalAmount();
        return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  async getBaseFee(): Promise<string> {
        return (await this.baseFeeAmount.textContent())?.trim() || '';
  }

  async getDisbursementCount(): Promise<number> {
        return this.disbursementRows.count();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectTotalAmount(amount: string): Promise<void> {
        await expect(this.totalAmount).toContainText(amount);
  }

  async expectLeaseholdSupplementVisible(): Promise<void> {
        await expect(this.leaseholdSupplement).toBeVisible();
  }

  async expectNewBuildSupplementVisible(): Promise<void> {
        await expect(this.newBuildSupplement).toBeVisible();
  }

  async expectDisbursementCount(count: number): Promise<void> {
        await expect(this.disbursementRows).toHaveCount(count);
  }

  async expectVatVisible(): Promise<void> {
        await expect(this.vatAmount).toBeVisible();
  }
}
