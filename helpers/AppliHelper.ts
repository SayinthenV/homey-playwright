import { Page } from '@playwright/test';
import { VisualSnapshotOptions } from '../pages/visual/VisualBasePage';

export interface AppliConfig {
    appName?: string;
    testName?: string;
    batchName?: string;
    matchLevel?: 'Strict' | 'Content' | 'Layout' | 'Exact';
    branchName?: string;
    parentBranchName?: string;
    saveNewTests?: boolean;
}

/**
 * AppliHelper
 * Wraps @applitools/eyes-playwright for cross-browser visual testing on Homey.
 * Eyes runs only when APPLITOOLS_API_KEY is set; no-op otherwise.
 */
export class AppliHelper {
    private readonly page: Page;
    private readonly config: AppliConfig;
    private readonly enabled: boolean;
    private eyes: any = null;

  constructor(page: Page, config: AppliConfig = {}) {
        this.page = page;
        this.config = {
                appName: 'Homey Conveyancing',
                batchName: 'Homey Playwright Suite',
                matchLevel: 'Layout',
                branchName: process.env.GITHUB_HEAD_REF ?? 'main',
                parentBranchName: 'main',
                saveNewTests: true,
                ...config,
        };
        this.enabled = Boolean(process.env.APPLITOOLS_API_KEY);
  }

  async open(): Promise<void> {
        if (!this.enabled) { console.log('[Appli] Skipped — APPLITOOLS_API_KEY not set'); return; }
        let Eyes: any, Configuration: any, BatchInfo: any, BrowserType: any;
        try {
                const mod = await import('@applitools/eyes-playwright');
                ({ Eyes, Configuration, BatchInfo, BrowserType } = mod);
        } catch { console.warn('[Appli] package not installed'); return; }
        const cfg = new Configuration();
        cfg.setApiKey(process.env.APPLITOOLS_API_KEY!);
        cfg.setAppName(this.config.appName!);
        cfg.setTestName(this.config.testName ?? 'Unnamed');
        cfg.setBatch(new BatchInfo(this.config.batchName!));
        cfg.setMatchLevel(this.config.matchLevel!);
        cfg.setBranchName(this.config.branchName!);
        cfg.setParentBranchName(this.config.parentBranchName!);
        cfg.setSaveNewTests(this.config.saveNewTests!);
        cfg.addBrowser(1280, 800, BrowserType.CHROME);
        cfg.addBrowser(1280, 800, BrowserType.FIREFOX);
        cfg.addBrowser(1280, 800, BrowserType.SAFARI);
        cfg.addBrowser(375, 812, BrowserType.CHROME);
        this.eyes = new Eyes();
        this.eyes.setConfiguration(cfg);
        await this.eyes.open(this.page);
  }

  async check(opts: VisualSnapshotOptions): Promise<void> {
        if (!this.enabled || !this.eyes) { console.log(`[Appli] Skipped "${opts.name}"`); return; }
        await this.stabilise();
        if (opts.hideSelectors?.length) await this.hideElements(opts.hideSelectors);
        let Target: any;
        try { const mod = await import('@applitools/eyes-playwright'); Target = mod.Target; } catch { return; }
        if (opts.fullPage) await this.eyes.check(opts.name, Target.window().fully());
        else await this.eyes.check(opts.name, Target.window());
        if (opts.hideSelectors?.length) await this.restoreElements(opts.hideSelectors);
  }

  async checkWindow(name: string, fullPage = true): Promise<void> {
        await this.check({ name, fullPage });
  }

  async checkRegion(name: string, selector: string): Promise<void> {
        if (!this.enabled || !this.eyes) return;
        let Target: any;
        try { const mod = await import('@applitools/eyes-playwright'); Target = mod.Target; } catch { return; }
        await this.eyes.check(name, Target.region(this.page.locator(selector).first()));
  }

  async close(throwOnDiff = true): Promise<void> {
        if (!this.enabled || !this.eyes) return;
        try { await this.eyes.close(throwOnDiff); } finally { await this.eyes.abort(); }
  }

  async abort(): Promise<void> {
        if (this.eyes) await this.eyes.abort().catch(() => {});
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

  private async hideElements(sels: string[]): Promise<void> {
        await this.page.evaluate((s: string[]) => {
                s.forEach((sel) => document.querySelectorAll<HTMLElement>(sel)
                                  .forEach((el) => { el.style.visibility = 'hidden'; }));
        }, sels);
  }

  private async restoreElements(sels: string[]): Promise<void> {
        await this.page.evaluate((s: string[]) => {
                s.forEach((sel) => document.querySelectorAll<HTMLElement>(sel)
                                  .forEach((el) => { el.style.visibility = ''; }));
        }, sels);
  }
}
