import { Page } from '@playwright/test';
import { VisualSnapshotOptions } from '../pages/visual/VisualBasePage';

/**
 * PercyHelper
 * Wraps @percy/playwright with Turbo-aware stabilisation and dynamic
 * content masking so snapshots are deterministic on Homey pages.
 * Percy runs only when PERCY_TOKEN env var is set.
 */
export class PercyHelper {
    private readonly page: Page;
    private readonly enabled: boolean;

  constructor(page: Page) {
        this.page = page;
        this.enabled = Boolean(process.env.PERCY_TOKEN);
  }

  async snapshot(opts: VisualSnapshotOptions): Promise<void> {
        if (!this.enabled) {
                console.log(`[Percy] Skipped "${opts.name}" — PERCY_TOKEN not set`);
                return;
        }
        let percySnapshot: Function;
        try {
                const mod = await import('@percy/playwright');
                percySnapshot = mod.default ?? (mod as any).percySnapshot;
        } catch {
                console.warn('[Percy] @percy/playwright not installed — skipping');
                return;
        }
        await this.stabilise();
        await this.maskDynamicContent(opts.hideSelectors ?? []);
        const options: Record<string, unknown> = {};
        if (opts.widths?.length) options['widths'] = opts.widths;
        if (opts.fullPage !== undefined) options['fullPage'] = opts.fullPage;
        await percySnapshot(this.page, opts.name, options);
        if (opts.hideSelectors?.length) await this.restoreElements(opts.hideSelectors);
  }

  async responsiveSnapshot(name: string, widths = [375, 768, 1280, 1440]): Promise<void> {
        await this.snapshot({ name, widths, fullPage: true });
  }

  async componentSnapshot(name: string, selector: string): Promise<void> {
        if (!this.enabled) return;
        const box = await this.page.locator(selector).first().boundingBox();
        if (!box) { console.warn(`[Percy] Element not found: ${selector}`); return; }
        await this.snapshot({ name, fullPage: false });
  }

  private async stabilise(): Promise<void> {
        await this.page.waitForFunction(() => {
                const d = document as any;
                return !d.documentElement.hasAttribute('data-turbo-preview') &&
                          d.querySelector('turbo-frame[busy]') === null;
        }, { timeout: 10_000 }).catch(() => {});
        await this.page.waitForTimeout(300);
        await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  private async maskDynamicContent(extra: string[]): Promise<void> {
        const sels = [
                'time', '[datetime]', '.timestamp', '.relative-time',
                '[data-testid="timestamp"]', '[data-testid="created-at"]',
                ...extra,
              ];
        await this.page.evaluate((s: string[]) => {
                s.forEach((sel) => document.querySelectorAll<HTMLElement>(sel)
                                  .forEach((el) => { el.style.visibility = 'hidden'; }));
                document.querySelectorAll<HTMLImageElement>('img.avatar')
                  .forEach((img) => {
                              img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                  });
        }, sels);
  }

  private async restoreElements(sels: string[]): Promise<void> {
        await this.page.evaluate((s: string[]) => {
                s.forEach((sel) => document.querySelectorAll<HTMLElement>(sel)
                                  .forEach((el) => { el.style.visibility = ''; }));
        }, sels);
  }

  async triggerLazyLoad(): Promise<void> {
        const h = await this.page.evaluate(() => document.body.scrollHeight);
        for (let y = 0; y < h; y += 600) {
                await this.page.evaluate((p: number) => window.scrollTo(0, p), y);
                await this.page.waitForTimeout(80);
        }
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(200);
  }
}
