import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * ConveyanceListPage
 * ------------------
 * The conveyance (cases) index page — lists all active and historical
 * conveyancing cases. Accessible by agents and solicitors.
 *
 * Route: /conveyances
 */
export class ConveyanceListPage extends BasePage {

  // ── List ─────────────────────────────────────────────────────
  readonly conveyanceRows: Locator;
    readonly emptyState: Locator;

  // ── Search & filters ─────────────────────────────────────────
  readonly searchInput: Locator;
    readonly stageFilter: Locator;
    readonly transactionTypeFilter: Locator;
    readonly solicitorFilter: Locator;
    readonly fastTrackToggle: Locator;

  // ── Sort controls ────────────────────────────────────────────
  readonly sortByColumn: Locator;

  // ── Pagination ───────────────────────────────────────────────
  readonly paginationInfo: Locator;

  constructor(page: Page) {
        super(page);

      this.conveyanceRows = page.getByTestId('conveyance-row');
        this.emptyState = page.getByTestId('conveyances-empty-state');

      this.searchInput = page.getByPlaceholder(/search.*conveyance|search.*case/i);
        this.stageFilter = page.getByTestId('filter-stage');
        this.transactionTypeFilter = page.getByTestId('filter-transaction-type');
        this.solicitorFilter = page.getByTestId('filter-solicitor');
        this.fastTrackToggle = page.getByLabel(/fast track/i);

      this.sortByColumn = page.getByTestId('sort-column');
        this.paginationInfo = page.getByTestId('pagination-info');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(): Promise<void> {
        await this.page.goto('/conveyances');
        await this.waitForPageLoad();
  }

  // ── Row helpers ──────────────────────────────────────────────

  /**
     * Get a conveyance row by property address or reference number.
     */
  getConveyanceRow(identifier: string): Locator {
        return this.conveyanceRows.filter({ hasText: identifier });
  }

  async clickConveyance(identifier: string): Promise<void> {
        await this.getConveyanceRow(identifier).click();
        await this.waitForPageLoad();
  }

  async getConveyanceCount(): Promise<number> {
        return this.conveyanceRows.count();
  }

  async getConveyanceStage(identifier: string): Promise<string> {
        const row = this.getConveyanceRow(identifier);
        const badge = row.getByTestId('conveyance-stage-badge');
        return (await badge.textContent())?.trim() || 'unknown';
  }

  async isConveyanceFastTrack(identifier: string): Promise<boolean> {
        const row = this.getConveyanceRow(identifier);
        return row.getByTestId('fast-track-badge').isVisible();
  }

  // ── Search & filter ──────────────────────────────────────────

  async searchFor(query: string): Promise<void> {
        await this.searchInput.fill(query);
        await this.searchInput.press('Enter');
        await this.waitForTurboStream();
  }

  async filterByStage(stage: string): Promise<void> {
        await this.stageFilter.selectOption(stage);
        await this.waitForPageLoad();
  }

  async filterByTransactionType(type: string): Promise<void> {
        await this.transactionTypeFilter.selectOption(type);
        await this.waitForPageLoad();
  }

  async filterBySolicitor(solicitorName: string): Promise<void> {
        await this.solicitorFilter.selectOption({ label: solicitorName });
        await this.waitForPageLoad();
  }

  async toggleFastTrackOnly(): Promise<void> {
        await this.fastTrackToggle.click();
        await this.waitForPageLoad();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectConveyanceVisible(identifier: string): Promise<void> {
        await expect(this.getConveyanceRow(identifier)).toBeVisible();
  }

  async expectConveyanceCount(count: number): Promise<void> {
        await expect(this.conveyanceRows).toHaveCount(count);
  }

  async expectConveyanceAtStage(identifier: string, stage: string): Promise<void> {
        const row = this.getConveyanceRow(identifier);
        await expect(row.getByTestId('conveyance-stage-badge')).toContainText(stage);
  }

  async expectEmptyState(): Promise<void> {
        await expect(this.emptyState).toBeVisible();
  }
}
