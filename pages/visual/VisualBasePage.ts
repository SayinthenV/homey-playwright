import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base/BasePage';

export interface VisualSnapshotOptions {
    name: string;
    /** Elements to hide (e.g. timestamps, avatars) before snapshot */
  hideSelectors?: string[];
    /** Elements to ignore in diff (still visible but not compared) */
  ignoreSelectors?: string[];
    /** Clip to a specific locator region */
  clip?: Locator;
    /** Viewport width overrides */
  widths?: number[];
    /** Minimum % of pixels that must match (Percy) */
  minDiffPercentage?: number;
    /** Full-page screenshot or viewport only */
  fullPage?: boolean;
}

/**
 * VisualBasePage
 * Extends BasePage with visual regression helpers shared by Percy and Applitools.
 * Provides Turbo-aware stabilisation before any snapshot is taken.
 */
export abstract class VisualBasePage extends BasePage {
    constructor(page: Page) {
          super(page);
    }

  // ---------------------------------------------------------------------------
  // Turbo stabilisation — wait for all Turbo activity to settle
  // ---------------------------------------------------------------------------

  async stabilise(): Promise<void> {
        // Wait for Turbo to signal it is not busy
      await this.page
          .waitForFunction(() => {
                    const doc = document as any;
                    return (
                                !doc.documentElement.hasAttribute('data-turbo-preview') &&
                                typeof doc.querySelector('turbo-frame[busy]') === 'object' &&
                                doc.querySelector('turbo-frame[busy]') === null
                              );
          }, { timeout: 10_000 })
          .catch(() => {});

      // Let CSS transitions finish
      await this.page.waitForTimeout(300);

      // Ensure no network requests are in-flight
      await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Dynamic content masking — replace date/time strings with static placeholders
  // ---------------------------------------------------------------------------

  async maskDynamicContent(): Promise<void> {
        await this.page.evaluate(() => {
                // Mask elements that typically contain timestamps or dynamic values
                                       const selectors = [
                                                 '[data-testid="timestamp"]',
                                                 '[data-testid="created-at"]',
                                                 '[data-testid="updated-at"]',
                                                 '.timestamp',
                                                 '.relative-time',
                                                 'time',
                                                 '[datetime]',
                                               ];
                selectors.forEach((sel) => {
                          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
                                      el.style.visibility = 'hidden';
                          });
                });

                                       // Mask avatar images — replace src with blank data URL
                                       document.querySelectorAll<HTMLImageElement>('img.avatar, img[data-testid="avatar"]').forEach((img) => {
                                                 img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                                       });
        });
  }

  // ---------------------------------------------------------------------------
  // Hide selectors helper
  // ---------------------------------------------------------------------------

  async hideElements(selectors: string[]): Promise<void> {
        if (!selectors.length) return;
        await this.page.evaluate((sels: string[]) => {
                sels.forEach((sel) => {
                          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
                                      el.style.visibility = 'hidden';
                          });
                });
        }, selectors);
  }

  // ---------------------------------------------------------------------------
  // Restore hidden elements after snapshot
  // ---------------------------------------------------------------------------

  async restoreElements(selectors: string[]): Promise<void> {
        if (!selectors.length) return;
        await this.page.evaluate((sels: string[]) => {
                sels.forEach((sel) => {
                          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
                                      el.style.visibility = '';
                          });
                });
        }, selectors);
  }

  // ---------------------------------------------------------------------------
  // Scroll page to force lazy images to load
  // ---------------------------------------------------------------------------

  async triggerLazyLoad(): Promise<void> {
        const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
        const step = 600;
        for (let y = 0; y < scrollHeight; y += step) {
                await this.page.evaluate((pos: number) => window.scrollTo(0, pos), y);
                await this.page.waitForTimeout(80);
        }
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(200);
  }

  // ---------------------------------------------------------------------------
  // Full pre-snapshot preparation pipeline
  // ---------------------------------------------------------------------------

  async prepareForSnapshot(opts: Pick<VisualSnapshotOptions, 'hideSelectors' | 'fullPage'>): Promise<void> {
        await this.stabilise();
        await this.maskDynamicContent();
        if (opts.hideSelectors?.length) {
                await this.hideElements(opts.hideSelectors);
        }
        if (opts.fullPage) {
                await this.triggerLazyLoad();
        }
  }
}
