import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * ActionCenterPage
 * ----------------
 * Represents the Homey Action Center — the live workflow dashboard
 * for a conveyancing case. Uses Turbo Streams (ActionCable WebSocket)
 * for real-time action state updates.
 *
 * Route: /conveyances/:id/actions  (or embedded within conveyance detail)
 */
export class ActionCenterPage extends BasePage {

  // ── Stage navigation sidebar ─────────────────────────────────
  readonly stagesSidebar: Locator;
    readonly stageLinks: Locator;

  // ── Action groups ────────────────────────────────────────────
  readonly actionGroups: Locator;
    readonly actionCards: Locator;

  // ── Individual action card elements ──────────────────────────
  readonly completeButtons: Locator;
    readonly waiveButtons: Locator;
    readonly overdueIndicators: Locator;
    readonly blockedIndicators: Locator;

  // ── Progress indicator ───────────────────────────────────────
  readonly progressBar: Locator;
    readonly progressText: Locator;

  // ── Filter controls ──────────────────────────────────────────
  readonly filterByOwner: Locator;
    readonly filterByStatus: Locator;
    readonly filterOverdueOnly: Locator;

  constructor(page: Page) {
        super(page);

      this.stagesSidebar = page.getByTestId('action-stages-sidebar');
        this.stageLinks = page.getByTestId('action-stage-link');

      this.actionGroups = page.getByTestId('action-group');
        this.actionCards = page.getByTestId('action-card');

      this.completeButtons = page.getByRole('button', { name: /complete/i });
        this.waiveButtons = page.getByRole('button', { name: /waive/i });
        this.overdueIndicators = page.getByTestId('action-overdue-badge');
        this.blockedIndicators = page.getByTestId('action-blocked-badge');

      this.progressBar = page.getByTestId('action-progress-bar');
        this.progressText = page.getByTestId('action-progress-text');

      this.filterByOwner = page.getByTestId('filter-by-owner');
        this.filterByStatus = page.getByTestId('filter-by-status');
        this.filterOverdueOnly = page.getByLabel(/overdue only/i);
  }

  // ── Navigation ───────────────────────────────────────────────

  async gotoForConveyance(conveyanceId: string): Promise<void> {
        await this.page.goto(`/conveyances/${conveyanceId}/actions`);
        await this.waitForPageLoad();
        await expect(this.stagesSidebar).toBeVisible();
  }

  async navigateToStage(stageName: string): Promise<void> {
        const stageLink = this.stageLinks.filter({ hasText: stageName });
        await stageLink.click();
        await this.waitForPageLoad();
  }

  // ── Action card helpers ──────────────────────────────────────

  /**
     * Returns a Locator for a specific action card by its title.
     */
  getActionCard(actionTitle: string): Locator {
        return this.actionCards.filter({ hasText: actionTitle });
  }

  /**
     * Marks an action as complete and waits for the Turbo Stream update.
     */
  async completeAction(actionTitle: string): Promise<void> {
        const card = this.getActionCard(actionTitle);
        await expect(card).toBeVisible();

      const completeBtn = card.getByRole('button', { name: /complete/i });
        await completeBtn.click();

      // Wait for real-time Turbo Stream update to reflect the new state
      await this.waitForTurboStream('/actions');

      // Assert the card now shows completed state
      await expect(card.getByTestId('action-status-badge')).toContainText(/complete/i);
  }

  /**
     * Waives (skips) an action with an optional reason.
     */
  async waiveAction(actionTitle: string, reason?: string): Promise<void> {
        const card = this.getActionCard(actionTitle);
        await card.getByRole('button', { name: /waive/i }).click();

      if (reason) {
              const reasonInput = this.page.getByLabel(/reason/i);
              await reasonInput.fill(reason);
      }

      await this.page.getByRole('button', { name: /confirm waive/i }).click();
        await this.waitForTurboStream('/actions');
  }

  /**
     * Returns the status of an action card.
     */
  async getActionStatus(actionTitle: string): Promise<string> {
        const card = this.getActionCard(actionTitle);
        const badge = card.getByTestId('action-status-badge');
        return (await badge.textContent())?.trim() || 'unknown';
  }

  /**
     * Checks if an action is blocked (waiting on dependency).
     */
  async isActionBlocked(actionTitle: string): Promise<boolean> {
        const card = this.getActionCard(actionTitle);
        return card.getByTestId('action-blocked-badge').isVisible();
  }

  /**
     * Checks if an action is overdue.
     */
  async isActionOverdue(actionTitle: string): Promise<boolean> {
        const card = this.getActionCard(actionTitle);
        return card.getByTestId('action-overdue-badge').isVisible();
  }

  // ── Progress helpers ─────────────────────────────────────────

  async getProgress(): Promise<{ completed: number; total: number }> {
        const text = await this.progressText.textContent();
        // Expected format: "3 / 12 complete"
      const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
        if (!match) throw new Error(`Unexpected progress text: ${text}`);
        return { completed: parseInt(match[1]), total: parseInt(match[2]) };
  }

  // ── Filter helpers ───────────────────────────────────────────

  async filterByOwnerRole(role: string): Promise<void> {
        await this.filterByOwner.selectOption(role);
        await this.waitForPageLoad();
  }

  async filterByActionStatus(status: string): Promise<void> {
        await this.filterByStatus.selectOption(status);
        await this.waitForPageLoad();
  }

  async toggleOverdueFilter(): Promise<void> {
        await this.filterOverdueOnly.click();
        await this.waitForPageLoad();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectActionVisible(actionTitle: string): Promise<void> {
        await expect(this.getActionCard(actionTitle)).toBeVisible();
  }

  async expectActionCompleted(actionTitle: string): Promise<void> {
        const card = this.getActionCard(actionTitle);
        await expect(card.getByTestId('action-status-badge')).toContainText(/complete/i);
  }

  async expectActionNotBlocked(actionTitle: string): Promise<void> {
        const card = this.getActionCard(actionTitle);
        await expect(card.getByTestId('action-blocked-badge')).not.toBeVisible();
  }

  /**
     * Waits for a real-time Turbo Stream push to update the action center.
     * Useful when another browser session completes an action.
     */
  async waitForLiveUpdate(): Promise<void> {
        await this.waitForTurboStream('/actions');
  }
}
