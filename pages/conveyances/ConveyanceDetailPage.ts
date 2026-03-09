import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * ConveyanceDetailPage
 * --------------------
 * Detail view for a single conveyancing case.
 * Shows case summary, parties, stage progress, and links to Action Center.
 *
 * Route: /conveyances/:id
 */
export class ConveyanceDetailPage extends BasePage {

  // ── Case summary ─────────────────────────────────────────────
  readonly propertyAddress: Locator;
    readonly propertyValue: Locator;
    readonly transactionType: Locator;
    readonly caseReference: Locator;
    readonly stageBadge: Locator;
    readonly fastTrackBadge: Locator;

  // ── Parties section ──────────────────────────────────────────
  readonly buyerName: Locator;
    readonly sellerName: Locator;
    readonly solicitorFirmName: Locator;
    readonly agentName: Locator;

  // ── Key dates ────────────────────────────────────────────────
  readonly instructionDate: Locator;
    readonly targetCompletionDate: Locator;
    readonly exchangeDate: Locator;
    readonly completionDate: Locator;

  // ── Navigation tabs ──────────────────────────────────────────
  readonly actionsTab: Locator;
    readonly documentsTab: Locator;
    readonly paymentsTab: Locator;
    readonly kycTab: Locator;
    readonly activityTab: Locator;

  // ── Action buttons ───────────────────────────────────────────
  readonly viewActionsButton: Locator;
    readonly uploadDocumentButton: Locator;
    readonly requestPaymentButton: Locator;
    readonly upgradeToFastTrackButton: Locator;

  // ── Documents section ────────────────────────────────────────
  readonly documentRows: Locator;

  // ── Payments section ─────────────────────────────────────────
  readonly paymentRows: Locator;
    readonly totalPaidAmount: Locator;
    readonly outstandingAmount: Locator;

  constructor(page: Page) {
        super(page);

      this.propertyAddress = page.getByTestId('conveyance-property-address');
        this.propertyValue = page.getByTestId('conveyance-property-value');
        this.transactionType = page.getByTestId('conveyance-transaction-type');
        this.caseReference = page.getByTestId('conveyance-reference');
        this.stageBadge = page.getByTestId('conveyance-stage-badge');
        this.fastTrackBadge = page.getByTestId('fast-track-badge');

      this.buyerName = page.getByTestId('conveyance-buyer-name');
        this.sellerName = page.getByTestId('conveyance-seller-name');
        this.solicitorFirmName = page.getByTestId('conveyance-solicitor-firm');
        this.agentName = page.getByTestId('conveyance-agent-name');

      this.instructionDate = page.getByTestId('conveyance-instruction-date');
        this.targetCompletionDate = page.getByTestId('conveyance-target-completion-date');
        this.exchangeDate = page.getByTestId('conveyance-exchange-date');
        this.completionDate = page.getByTestId('conveyance-completion-date');

      this.actionsTab = page.getByRole('tab', { name: /actions/i });
        this.documentsTab = page.getByRole('tab', { name: /documents/i });
        this.paymentsTab = page.getByRole('tab', { name: /payments/i });
        this.kycTab = page.getByRole('tab', { name: /kyc|identity/i });
        this.activityTab = page.getByRole('tab', { name: /activity/i });

      this.viewActionsButton = page.getByRole('link', { name: /view actions|action center/i });
        this.uploadDocumentButton = page.getByRole('button', { name: /upload.*document/i });
        this.requestPaymentButton = page.getByRole('button', { name: /request.*payment|send.*payment/i });
        this.upgradeToFastTrackButton = page.getByRole('button', { name: /upgrade.*fast track|fast track/i });

      this.documentRows = page.getByTestId('document-row');
        this.paymentRows = page.getByTestId('payment-row');
        this.totalPaidAmount = page.getByTestId('total-paid-amount');
        this.outstandingAmount = page.getByTestId('outstanding-amount');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(conveyanceId: string): Promise<void> {
        await this.page.goto(`/conveyances/${conveyanceId}`);
        await this.waitForPageLoad();
  }

  async goToActionCenter(): Promise<void> {
        await this.viewActionsButton.click();
        await this.waitForPageLoad();
        await expect(this.page).toHaveURL(/actions/);
  }

  // ── Tab navigation ───────────────────────────────────────────

  async openDocumentsTab(): Promise<void> {
        await this.documentsTab.click();
        await this.waitForTurboFrame('documents-tab-content');
  }

  async openPaymentsTab(): Promise<void> {
        await this.paymentsTab.click();
        await this.waitForTurboFrame('payments-tab-content');
  }

  async openKycTab(): Promise<void> {
        await this.kycTab.click();
        await this.waitForTurboFrame('kyc-tab-content');
  }

  // ── Actions ──────────────────────────────────────────────────

  async upgradeToFastTrack(): Promise<void> {
        await this.upgradeToFastTrackButton.click();
        await this.page.getByRole('button', { name: /confirm/i }).click();
        await this.waitForTurboStream();
        await expect(this.fastTrackBadge).toBeVisible();
  }

  // ── Getters ──────────────────────────────────────────────────

  async getStage(): Promise<string> {
        return (await this.stageBadge.textContent())?.trim() || '';
  }

  async isFastTrack(): Promise<boolean> {
        return this.fastTrackBadge.isVisible();
  }

  async getDocumentCount(): Promise<number> {
        return this.documentRows.count();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectStage(stage: string): Promise<void> {
        await expect(this.stageBadge).toContainText(stage);
  }

  async expectPropertyAddress(address: string): Promise<void> {
        await expect(this.propertyAddress).toContainText(address);
  }

  async expectSolicitorFirm(firmName: string): Promise<void> {
        await expect(this.solicitorFirmName).toContainText(firmName);
  }

  async expectFastTrackVisible(): Promise<void> {
        await expect(this.fastTrackBadge).toBeVisible();
  }

  async expectDocumentCount(count: number): Promise<void> {
        await this.openDocumentsTab();
        await expect(this.documentRows).toHaveCount(count);
  }
}
