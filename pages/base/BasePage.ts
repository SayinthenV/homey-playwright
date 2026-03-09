import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage
 * --------
 * Abstract base class for all Homey Page Objects.
 * Wraps common UI elements present on every authenticated page:
 *   - Top navigation bar
 *   - Notification bell
 *   - Company switcher (multi-tenant)
 *   - Flash messages (Turbo Stream injected)
 *   - Loading state helpers
 */
export abstract class BasePage {
    readonly page: Page;

  // ── Navigation ──────────────────────────────────────────────
  readonly navLogo: Locator;
    readonly navEnquiries: Locator;
    readonly navConveyances: Locator;
    readonly navQuotes: Locator;
    readonly navCompany: Locator;
    readonly navAdmin: Locator;

  // ── Header ───────────────────────────────────────────────────
  readonly notificationBell: Locator;
    readonly notificationPanel: Locator;
    readonly unreadBadge: Locator;
    readonly userMenu: Locator;
    readonly signOutLink: Locator;

  // ── Company switcher (panel managers / admins) ───────────────
  readonly companySwitcher: Locator;

  // ── Flash messages ───────────────────────────────────────────
  readonly flashSuccess: Locator;
    readonly flashError: Locator;
    readonly flashNotice: Locator;

  constructor(page: Page) {
        this.page = page;

      // Navigation
      this.navLogo = page.getByRole('link', { name: /homey/i }).first();
        this.navEnquiries = page.getByRole('link', { name: /enquiries/i });
        this.navConveyances = page.getByRole('link', { name: /conveyances/i });
        this.navQuotes = page.getByRole('link', { name: /quotes/i });
        this.navCompany = page.getByRole('link', { name: /company/i });
        this.navAdmin = page.getByRole('link', { name: /admin/i });

      // Header
      this.notificationBell = page.getByTestId('notification-bell');
        this.notificationPanel = page.getByTestId('notification-panel');
        this.unreadBadge = page.getByTestId('notification-badge');
        this.userMenu = page.getByTestId('user-menu');
        this.signOutLink = page.getByRole('link', { name: /sign out/i });

      // Company switcher
      this.companySwitcher = page.getByTestId('company-switcher');

      // Flash messages
      this.flashSuccess = page.getByTestId('flash-success');
        this.flashError = page.getByTestId('flash-error');
        this.flashNotice = page.getByTestId('flash-notice');
  }

  // ── Navigation helpers ───────────────────────────────────────

  async goToEnquiries(): Promise<void> {
        await this.navEnquiries.click();
        await this.waitForPageLoad();
  }

  async goToConveyances(): Promise<void> {
        await this.navConveyances.click();
        await this.waitForPageLoad();
  }

  async goToQuotes(): Promise<void> {
        await this.navQuotes.click();
        await this.waitForPageLoad();
  }

  // ── Notification helpers ─────────────────────────────────────

  async openNotifications(): Promise<void> {
        await this.notificationBell.click();
        await this.notificationPanel.waitFor({ state: 'visible' });
  }

  async getUnreadNotificationCount(): Promise<number> {
        if (await this.unreadBadge.isHidden()) return 0;
        const text = await this.unreadBadge.textContent();
        return parseInt(text?.trim() || '0', 10);
  }

  // ── Company switcher ─────────────────────────────────────────

  async switchToCompany(companyName: string): Promise<void> {
        await this.companySwitcher.click();
        await this.page.getByRole('option', { name: companyName }).click();
        await this.waitForPageLoad();
  }

  // ── Flash message helpers ────────────────────────────────────

  async expectSuccessFlash(message?: string): Promise<void> {
        await expect(this.flashSuccess).toBeVisible();
        if (message) {
                await expect(this.flashSuccess).toContainText(message);
        }
  }

  async expectErrorFlash(message?: string): Promise<void> {
        await expect(this.flashError).toBeVisible();
        if (message) {
                await expect(this.flashError).toContainText(message);
        }
  }

  async dismissFlash(): Promise<void> {
        const closeBtn = this.page.getByTestId('flash-close');
        if (await closeBtn.isVisible()) {
                await closeBtn.click();
        }
  }

  // ── Page load helpers ────────────────────────────────────────

  /**
     * Waits for Turbo Drive navigation to complete.
     * Homey uses Hotwire Turbo, so standard networkidle can be unreliable.
     */
  async waitForPageLoad(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
        // Wait for Turbo to settle (no active Turbo frames loading)
      await this.page.waitForFunction(() => {
              const frames = document.querySelectorAll('turbo-frame[busy]');
              return frames.length === 0;
      }, { timeout: 10_000 }).catch(() => {
              // Non-fatal: proceed if Turbo frames aren't present
      });
  }

  /**
     * Waits for a Turbo Stream response matching a URL pattern.
     * Use this after actions that trigger server-sent DOM updates.
     */
  async waitForTurboStream(urlPattern?: string | RegExp): Promise<void> {
        await this.page.waitForResponse(
                (response) => {
                          const contentType = response.headers()['content-type'] || '';
                          const isTurboStream = contentType.includes('text/vnd.turbo-stream.html');
                          if (urlPattern) {
                                      return isTurboStream && (
                                                    typeof urlPattern === 'string'
                                                      ? response.url().includes(urlPattern)
                                                      : urlPattern.test(response.url())
                                                  );
                          }
                          return isTurboStream;
                },
          { timeout: 10_000 }
              );
  }

  /**
     * Waits for a Turbo Frame to finish loading.
     */
  async waitForTurboFrame(frameId: string): Promise<void> {
        const frame = this.page.locator(`turbo-frame#${frameId}`);
        await frame.waitFor({ state: 'attached' });
        // Wait until the busy attribute is removed
      await this.page.waitForFunction(
              (id) => {
                        const el = document.querySelector(`turbo-frame#${id}`);
                        return el && !el.hasAttribute('busy');
              },
              frameId,
        { timeout: 10_000 }
            );
  }

  // ── Sign out ─────────────────────────────────────────────────

  async signOut(): Promise<void> {
        await this.userMenu.click();
        await this.signOutLink.click();
        await this.page.waitForURL(/sign_in|login/);
  }

  // ── Utility ──────────────────────────────────────────────────

  async getPageTitle(): Promise<string> {
        return this.page.title();
  }

  async scrollToTop(): Promise<void> {
        await this.page.keyboard.press('Control+Home');
  }

  async takeScreenshot(name: string): Promise<void> {
        await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }
}
