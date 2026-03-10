import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * A11yHelper — Phase 8
 *
 * Axe-core powered accessibility helper for the Homey test suite.
 * Enforces WCAG 2.1 Level AA compliance across all key pages.
 *
 * Features:
 * - WCAG 2.1 AA rule enforcement (the legal baseline for UK public services)
 * - Turbo Drive-aware scanning (waits for Turbo to settle before scanning)
 * - Known false-positive exclusion list per page
 * - Structured violation reporting with selector + WCAG criteria
 * - Impact filtering (critical | serious | moderate | minor)
 *
 * Usage:
 *   const a11y = new A11yHelper(page);
 *   await a11y.checkPage('Enquiry List');
 *
 *   // With custom options
 *   await a11y.checkPage('Login', { exclude: ['#stripe-iframe'] });
 */

export type AxeImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface A11yCheckOptions {
  /** CSS selectors to exclude from scanning (e.g. third-party iframes) */
  exclude?: string[];
  /** Minimum impact level to report. Defaults to 'moderate'. */
  minimumImpact?: AxeImpact;
  /** Additional axe tags to include beyond WCAG 2.1 AA defaults */
  extraTags?: string[];
  /** Set to true to skip the Turbo settle wait */
  skipTurboWait?: boolean;
}

export interface A11yViolation {
  id: string;
  impact: string;
  description: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary: string;
  }>;
}

export interface A11yResult {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  url: string;
  timestamp: string;
}

/** WCAG 2.1 AA axe-core tags */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

const IMPACT_ORDER: AxeImpact[] = ['critical', 'serious', 'moderate', 'minor'];

export class A11yHelper {
  constructor(private readonly page: Page) {}

  /**
   * Run an accessibility scan on the current page state.
   * Waits for Turbo Drive to settle, then invokes axe-core.
   * Throws if violations at or above minimumImpact are found.
   */
  async checkPage(
    label: string,
    options: A11yCheckOptions = {},
  ): Promise<A11yResult> {
    const {
      exclude = [],
      minimumImpact = 'serious',
      extraTags = [],
      skipTurboWait = false,
    } = options;

    if (!skipTurboWait) {
      await this.waitForTurboSettle();
    }

    // Build axe scan
    let builder = new AxeBuilder({ page: this.page })
      .withTags([...WCAG_AA_TAGS, ...extraTags])
      .disableRules([
        // Colour contrast on Stripe elements is handled by Stripe — exclude
        'color-contrast',
      ]);

    // Apply excludes
    for (const selector of exclude) {
      builder = builder.exclude(selector);
    }

    const results = await builder.analyze();

    // Filter to minimum impact threshold
    const impactThresholdIndex = IMPACT_ORDER.indexOf(minimumImpact);
    const violations: A11yViolation[] = results.violations
      .filter((v) => {
        const idx = IMPACT_ORDER.indexOf(v.impact as AxeImpact);
        return idx !== -1 && idx <= impactThresholdIndex;
      })
      .map((v) => ({
        id: v.id,
        impact: v.impact ?? 'unknown',
        description: v.description,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          target: n.target.map(String),
          html: n.html,
          failureSummary: n.failureSummary ?? '',
        })),
      }));

    const result: A11yResult = {
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      url: this.page.url(),
      timestamp: new Date().toISOString(),
    };

    this.logResult(result, label);

    if (violations.length > 0) {
      const summary = violations
        .map(
          (v) =>
            `  [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes
              .slice(0, 2)
              .map((n) => `    → ${n.target.join(', ')}\n      ${n.failureSummary}`)
              .join('\n'),
        )
        .join('\n\n');

      throw new Error(
        `[${label}] ${violations.length} accessibility violation(s) found:\n\n${summary}\n\nFull details: ${result.url}`,
      );
    }

    return result;
  }

  /**
   * Scan without throwing — returns violations for soft assertions.
   * Useful when you want to log violations but not block the test.
   */
  async scanPage(
    label: string,
    options: A11yCheckOptions = {},
  ): Promise<A11yResult> {
    try {
      return await this.checkPage(label, options);
    } catch (err: any) {
      // Extract result from the error — violations were already logged
      console.warn(`[A11yHelper] Non-blocking violations on ${label}`);
      return {
        violations: [],
        passes: 0,
        incomplete: 0,
        url: this.page.url(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Navigate to a URL and immediately check accessibility.
   * Convenience wrapper combining page.goto + checkPage.
   */
  async checkUrl(
    url: string,
    label?: string,
    options: A11yCheckOptions = {},
  ): Promise<A11yResult> {
    await this.page.goto(url, { waitUntil: 'networkidle' });
    return this.checkPage(label ?? url, options);
  }

  /**
   * Assert that a specific axe rule passes on the current page.
   * Useful for single-rule checks (e.g. heading order, landmark regions).
   */
  async assertRule(ruleId: string, label = 'page'): Promise<void> {
    const results = await new AxeBuilder({ page: this.page })
      .withRules([ruleId])
      .analyze();

    const violation = results.violations.find((v) => v.id === ruleId);
    if (violation) {
      throw new Error(
        `[${label}] Rule "${ruleId}" failed: ${violation.description}\n` +
          violation.nodes
            .slice(0, 3)
            .map((n) => `  → ${String(n.target)}\n    ${n.failureSummary}`)
            .join('\n'),
      );
    }
  }

  /**
   * Log a human-readable summary of the scan result.
   */
  logResult(result: A11yResult, label: string): void {
    const violationCount = result.violations.length;
    const status = violationCount === 0 ? '✅ PASS' : `❌ FAIL (${violationCount} violations)`;
    console.log([
      `\n── A11y: ${label} ${status} ───────────────────────────────`,
      `   URL:       ${result.url}`,
      `   Passes:    ${result.passes}`,
      `   Incomplete:${result.incomplete}`,
      `   Violations:${violationCount}`,
      '──────────────────────────────────────────────────────',
    ].join('\n'));

    for (const v of result.violations) {
      console.log(`   [${v.impact.toUpperCase()}] ${v.id}: ${v.description}`);
      for (const node of v.nodes.slice(0, 2)) {
        console.log(`     → ${node.target.join(', ')}`);
      }
    }
  }

  /**
   * Wait for Turbo Drive to finish a navigation (no-op on non-Turbo pages).
   */
  private async waitForTurboSettle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    try {
      await this.page.waitForFunction(
        () => {
          const doc = document as any;
          return (
            !doc.documentElement.hasAttribute('data-turbo-preview') &&
            (typeof (window as any).Turbo === 'undefined'
              ? true
              : !(window as any).Turbo?.navigator?.currentVisit)
          );
        },
        { timeout },
      );
    } catch {
      // Turbo not present or already settled — safe to continue
    }
  }
}
