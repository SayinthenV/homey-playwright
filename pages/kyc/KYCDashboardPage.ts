import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * KYCDashboardPage
 * ----------------
 * KYC/AML identity check management page for a conveyance.
 * Integrates with Thirdfort for identity verification.
 * Solicitors manage checks from here; results arrive via Thirdfort webhooks.
 *
 * Route: /conveyances/:id/kyc  OR  /kyc_checks
 */
export class KYCDashboardPage extends BasePage {

  // ── KYC check list ───────────────────────────────────────────
  readonly kycCheckRows: Locator;
    readonly emptyState: Locator;

  // ── Individual check card elements ───────────────────────────
  // (scoped using .filter() or .nth() in test code)
  readonly checkStatusBadge: Locator;
    readonly checkPartyName: Locator;
    readonly checkType: Locator;

  // ── Invite/request actions ───────────────────────────────────
  readonly requestCheckButton: Locator;
    readonly sendReminderButtons: Locator;
    readonly cancelCheckButtons: Locator;

  // ── Request check modal ──────────────────────────────────────
  readonly requestCheckModal: Locator;
    readonly partyTypeSelect: Locator;
    readonly partyEmailInput: Locator;
    readonly partyFirstNameInput: Locator;
    readonly partyLastNameInput: Locator;
    readonly checkTypeSelect: Locator;
    readonly submitRequestButton: Locator;

  // ── Summary counters ─────────────────────────────────────────
  readonly passedCount: Locator;
    readonly pendingCount: Locator;
    readonly failedCount: Locator;
    readonly totalCount: Locator;

  constructor(page: Page) {
        super(page);

      this.kycCheckRows = page.getByTestId('kyc-check-row');
        this.emptyState = page.getByTestId('kyc-empty-state');

      this.checkStatusBadge = page.getByTestId('kyc-status-badge');
        this.checkPartyName = page.getByTestId('kyc-party-name');
        this.checkType = page.getByTestId('kyc-check-type');

      this.requestCheckButton = page.getByRole('button', { name: /request.*check|new.*check|add.*check/i });
        this.sendReminderButtons = page.getByRole('button', { name: /send.*reminder|remind/i });
        this.cancelCheckButtons = page.getByRole('button', { name: /cancel.*check/i });

      this.requestCheckModal = page.getByRole('dialog', { name: /request.*check|kyc/i });
        this.partyTypeSelect = page.getByLabel(/party type|role/i);
        this.partyEmailInput = page.getByLabel(/email/i);
        this.partyFirstNameInput = page.getByLabel(/first name/i);
        this.partyLastNameInput = page.getByLabel(/last name|surname/i);
        this.checkTypeSelect = page.getByLabel(/check type/i);
        this.submitRequestButton = page.getByRole('button', { name: /send.*invitation|request.*check|submit/i });

      this.passedCount = page.getByTestId('kyc-passed-count');
        this.pendingCount = page.getByTestId('kyc-pending-count');
        this.failedCount = page.getByTestId('kyc-failed-count');
        this.totalCount = page.getByTestId('kyc-total-count');
  }

  // ── Navigation ───────────────────────────────────────────────

  async gotoForConveyance(conveyanceId: string): Promise<void> {
        await this.page.goto(`/conveyances/${conveyanceId}/kyc`);
        await this.waitForPageLoad();
  }

  // ── Row helpers ──────────────────────────────────────────────

  getCheckRow(partyName: string): Locator {
        return this.kycCheckRows.filter({ hasText: partyName });
  }

  async getCheckStatus(partyName: string): Promise<string> {
        const row = this.getCheckRow(partyName);
        const badge = row.getByTestId('kyc-status-badge');
        return (await badge.textContent())?.trim() || '';
  }

  async getCheckCount(): Promise<number> {
        return this.kycCheckRows.count();
  }

  // ── Actions ──────────────────────────────────────────────────

  async requestCheck(details: {
        partyType: string;
        firstName: string;
        lastName: string;
        email: string;
        checkType?: string;
  }): Promise<void> {
        await this.requestCheckButton.click();
        await this.requestCheckModal.waitFor({ state: 'visible' });

      await this.partyTypeSelect.selectOption(details.partyType);
        await this.partyFirstNameInput.fill(details.firstName);
        await this.partyLastNameInput.fill(details.lastName);
        await this.partyEmailInput.fill(details.email);

      if (details.checkType) {
              await this.checkTypeSelect.selectOption(details.checkType);
      }

      await this.submitRequestButton.click();
        await this.waitForTurboStream();

      // Modal should close and new check row should appear
      await expect(this.requestCheckModal).not.toBeVisible();
        await expect(this.getCheckRow(`${details.firstName} ${details.lastName}`)).toBeVisible();
  }

  async sendReminder(partyName: string): Promise<void> {
        const row = this.getCheckRow(partyName);
        await row.getByRole('button', { name: /send.*reminder|remind/i }).click();
        await this.waitForTurboStream();
        await this.expectSuccessFlash('Reminder sent');
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectCheckStatus(partyName: string, status: 'pending' | 'passed' | 'failed' | 'expired'): Promise<void> {
        const row = this.getCheckRow(partyName);
        await expect(row.getByTestId('kyc-status-badge')).toContainText(status);
  }

  async expectAllChecksPassed(): Promise<void> {
        const rows = await this.kycCheckRows.count();
        for (let i = 0; i < rows; i++) {
                const badge = this.kycCheckRows.nth(i).getByTestId('kyc-status-badge');
                await expect(badge).toContainText(/passed/i);
        }
  }

  async expectCheckCount(count: number): Promise<void> {
        await expect(this.kycCheckRows).toHaveCount(count);
  }

  async expectPassedCount(count: number): Promise<void> {
        await expect(this.passedCount).toContainText(count.toString());
  }

  async expectNoFailedChecks(): Promise<void> {
        const rows = this.kycCheckRows.filter({
                has: this.page.getByTestId('kyc-status-badge').filter({ hasText: /failed/i })
        });
        await expect(rows).toHaveCount(0);
  }
}
