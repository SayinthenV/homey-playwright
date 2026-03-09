import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * EnquiryListPage
 * ---------------
 * The enquiry index page — lists all inbound leads for an agent.
 * Supports search, filter by status, and navigation to detail.
 *
 * Route: /enquiries
 */
export class EnquiryListPage extends BasePage {

  // ── List & table ─────────────────────────────────────────────
  readonly enquiryRows: Locator;
    readonly emptyState: Locator;

  // ── Search & filters ─────────────────────────────────────────
  readonly searchInput: Locator;
    readonly statusFilter: Locator;
    readonly transactionTypeFilter: Locator;
    readonly dateRangeFilter: Locator;

  // ── Actions ──────────────────────────────────────────────────
  readonly newEnquiryButton: Locator;

  // ── Pagination ───────────────────────────────────────────────
  readonly nextPageButton: Locator;
    readonly prevPageButton: Locator;
    readonly paginationInfo: Locator;

  constructor(page: Page) {
        super(page);

      this.enquiryRows = page.getByTestId('enquiry-row');
        this.emptyState = page.getByTestId('enquiries-empty-state');

      this.searchInput = page.getByPlaceholder(/search enquiries/i);
        this.statusFilter = page.getByTestId('filter-status');
        this.transactionTypeFilter = page.getByTestId('filter-transaction-type');
        this.dateRangeFilter = page.getByTestId('filter-date-range');

      this.newEnquiryButton = page.getByRole('link', { name: /new enquiry/i });

      this.nextPageButton = page.getByRole('link', { name: /next/i });
        this.prevPageButton = page.getByRole('link', { name: /previous/i });
        this.paginationInfo = page.getByTestId('pagination-info');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(): Promise<void> {
        await this.page.goto('/enquiries');
        await this.waitForPageLoad();
  }

  async clickNewEnquiry(): Promise<void> {
        await this.newEnquiryButton.click();
        await this.waitForPageLoad();
  }

  // ── Row helpers ──────────────────────────────────────────────

  /**
     * Returns a locator for a specific enquiry row by client name or address.
     */
  getEnquiryRow(identifier: string): Locator {
        return this.enquiryRows.filter({ hasText: identifier });
  }

  async clickEnquiry(identifier: string): Promise<void> {
        await this.getEnquiryRow(identifier).click();
        await this.waitForPageLoad();
  }

  async getEnquiryCount(): Promise<number> {
        return this.enquiryRows.count();
  }

  // ── Search & filter ──────────────────────────────────────────

  async searchFor(query: string): Promise<void> {
        await this.searchInput.fill(query);
        await this.searchInput.press('Enter');
        await this.waitForTurboStream();
  }

  async filterByStatus(status: string): Promise<void> {
        await this.statusFilter.selectOption(status);
        await this.waitForPageLoad();
  }

  async filterByTransactionType(type: string): Promise<void> {
        await this.transactionTypeFilter.selectOption(type);
        await this.waitForPageLoad();
  }

  async clearFilters(): Promise<void> {
        const clearBtn = this.page.getByRole('button', { name: /clear filters/i });
        if (await clearBtn.isVisible()) {
                await clearBtn.click();
                await this.waitForPageLoad();
        }
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectEnquiryVisible(identifier: string): Promise<void> {
        await expect(this.getEnquiryRow(identifier)).toBeVisible();
  }

  async expectEnquiryNotVisible(identifier: string): Promise<void> {
        await expect(this.getEnquiryRow(identifier)).not.toBeVisible();
  }

  async expectEmptyState(): Promise<void> {
        await expect(this.emptyState).toBeVisible();
        await expect(this.enquiryRows).toHaveCount(0);
  }

  async expectEnquiryCount(count: number): Promise<void> {
        await expect(this.enquiryRows).toHaveCount(count);
  }

  async expectStatusBadge(identifier: string, status: string): Promise<void> {
        const row = this.getEnquiryRow(identifier);
        await expect(row.getByTestId('enquiry-status-badge')).toContainText(status);
  }
}
