import { Page } from '@playwright/test';

/**
 * PerformanceHelper — Phase 7
 *
 * Playwright-native performance measurement utility for the Homey test suite.
 * Captures Core Web Vitals (LCP, FID/INP, CLS, FCP, TTFB) and custom
 * Turbo Drive navigation timings via the browser Performance API.
 * Thresholds are based on Google's "Good" CWV ranges by default.
 */

export interface PerformanceThresholds {
  /** Largest Contentful Paint — ms (Good ≤ 2500) */
  lcp?: number;
  /** First Contentful Paint — ms (Good ≤ 1800) */
  fcp?: number;
  /** Time to First Byte — ms (Good ≤ 800) */
  ttfb?: number;
  /** Cumulative Layout Shift score (Good ≤ 0.1) */
  cls?: number;
  /** Total Blocking Time — ms (proxy for FID/INP; Good ≤ 200) */
  tbt?: number;
  /** DOM Content Loaded — ms */
  dcl?: number;
  /** Full page load — ms */
  load?: number;
}

export interface PerformanceMetrics {
  lcp: number | null;
  fcp: number | null;
  ttfb: number | null;
  cls: number | null;
  tbt: number | null;
  dcl: number | null;
  load: number | null;
  /** Raw Navigation Timing entry for debugging */
  navigationTiming: Record<string, number>;
}

/** Default "Good" CWV thresholds (Google field data guidelines) */
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: 2500,
  fcp: 1800,
  ttfb: 800,
  cls: 0.1,
  tbt: 200,
  dcl: 3000,
  load: 5000,
};

export class PerformanceHelper {
  constructor(private readonly page: Page) {}

  /**
   * Navigate to a URL and collect performance metrics once the page has settled.
   * Waits for Turbo Drive to finish if the transition is a Turbo navigation.
   */
  async measureNavigation(url: string): Promise<PerformanceMetrics> {
    // Inject CLS observer before navigation so we capture all layout shifts
    await this.page.addInitScript(() => {
      (window as any).__clsValue = 0;
      if (typeof PerformanceObserver !== 'undefined') {
        try {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const e = entry as any;
              if (!e.hadRecentInput) {
                (window as any).__clsValue += e.value;
              }
            }
          });
          obs.observe({ type: 'layout-shift', buffered: true });
        } catch (_) { /* unsupported */ }
      }
    });

    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.waitForTurboSettle();

    return this.collectMetrics();
  }

  /**
   * Collect metrics for the current page without navigating.
   * Useful after in-page interactions (e.g. Turbo Stream updates).
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    await this.page.waitForLoadState('networkidle');

    const metrics = await this.page.evaluate((): PerformanceMetrics => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

      // LCP — last entry wins
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries.length > 0
        ? (lcpEntries[lcpEntries.length - 1] as any).startTime
        : null;

      // FCP
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined;
      const fcp = fcpEntry ? fcpEntry.startTime : null;

      // TTFB
      const ttfb = nav ? nav.responseStart - nav.requestStart : null;

      // CLS accumulated by init script
      const cls = typeof (window as any).__clsValue === 'number'
        ? (window as any).__clsValue
        : null;

      // TBT — sum of long task excess over 50 ms
      const longTasks = performance.getEntriesByType('longtask');
      const tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

      // DCL & Load from navigation timing
      const dcl = nav ? nav.domContentLoadedEventEnd - nav.startTime : null;
      const load = nav ? nav.loadEventEnd - nav.startTime : null;

      // Raw navigation timing for debugging
      const navigationTiming: Record<string, number> = {};
      if (nav) {
        const keys: (keyof PerformanceNavigationTiming)[] = [
          'startTime', 'requestStart', 'responseStart', 'responseEnd',
          'domInteractive', 'domContentLoadedEventEnd', 'loadEventEnd',
          'transferSize', 'encodedBodySize',
        ];
        for (const k of keys) {
          const v = nav[k];
          if (typeof v === 'number') navigationTiming[k as string] = v;
        }
      }

      return { lcp, fcp, ttfb, cls, tbt: longTasks.length > 0 ? tbt : null, dcl, load, navigationTiming };
    });

    return metrics;
  }

  /**
   * Assert that collected metrics are within the given thresholds.
   * Merges with DEFAULT_THRESHOLDS — pass custom values to override.
   */
  assertThresholds(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds = {},
    label = 'page',
  ): void {
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const failures: string[] = [];

    const check = (name: string, value: number | null, limit: number | undefined) => {
      if (limit === undefined || value === null) return;
      if (value > limit) {
        failures.push(`[${label}] ${name}: ${value.toFixed(1)} > threshold ${limit}`);
      }
    };

    check('LCP (ms)', metrics.lcp, t.lcp);
    check('FCP (ms)', metrics.fcp, t.fcp);
    check('TTFB (ms)', metrics.ttfb, t.ttfb);
    check('CLS', metrics.cls, t.cls);
    check('TBT (ms)', metrics.tbt, t.tbt);
    check('DCL (ms)', metrics.dcl, t.dcl);
    check('Load (ms)', metrics.load, t.load);

    if (failures.length > 0) {
      throw new Error(
        `Performance thresholds exceeded:\n${failures.map(f => '  • ' + f).join('\n')}`,
      );
    }
  }

  /**
   * Measure and assert in one call. Returns the metrics for optional further inspection.
   */
  async measureAndAssert(
    url: string,
    thresholds: PerformanceThresholds = {},
    label?: string,
  ): Promise<PerformanceMetrics> {
    const metrics = await this.measureNavigation(url);
    this.assertThresholds(metrics, thresholds, label ?? url);
    return metrics;
  }

  /**
   * Log a human-readable summary of metrics to the test console.
   */
  logMetrics(metrics: PerformanceMetrics, label = 'Performance'): void {
    const fmt = (v: number | null, unit = 'ms') =>
      v !== null ? `${v.toFixed(1)}${unit}` : 'n/a';

    console.log([
      `\n── ${label} ──────────────────────────────`,
      `  LCP:   ${fmt(metrics.lcp)}  (threshold ${DEFAULT_THRESHOLDS.lcp}ms)`,
      `  FCP:   ${fmt(metrics.fcp)}  (threshold ${DEFAULT_THRESHOLDS.fcp}ms)`,
      `  TTFB:  ${fmt(metrics.ttfb)}  (threshold ${DEFAULT_THRESHOLDS.ttfb}ms)`,
      `  CLS:   ${fmt(metrics.cls, '')}  (threshold ${DEFAULT_THRESHOLDS.cls})`,
      `  TBT:   ${fmt(metrics.tbt)}  (threshold ${DEFAULT_THRESHOLDS.tbt}ms)`,
      `  DCL:   ${fmt(metrics.dcl)}  (threshold ${DEFAULT_THRESHOLDS.dcl}ms)`,
      `  Load:  ${fmt(metrics.load)}  (threshold ${DEFAULT_THRESHOLDS.load}ms)`,
      '──────────────────────────────────────────',
    ].join('\n'));
  }

  /**
   * Wait for Turbo Drive to finish a navigation (no-op on non-Turbo pages).
   */
  private async waitForTurboSettle(timeout = 5000): Promise<void> {
    try {
      await this.page.waitForFunction(
        () => {
          const doc = document as any;
          return (
            !doc.documentElement.hasAttribute('data-turbo-preview') &&
            typeof (window as any).Turbo === 'undefined'
              ? true
              : !(window as any).Turbo?.navigator?.currentVisit
          );
        },
        { timeout },
      );
    } catch {
      // Turbo not present or already settled — safe to continue
    }
  }
}
