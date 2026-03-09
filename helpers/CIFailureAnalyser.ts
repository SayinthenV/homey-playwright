import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CIFailureAnalyser — AI-Powered Test Failure Investigator
 *
 * Analyses Playwright test failures by combining:
 * - Failure screenshot (visual context)
 * - Error message and stack trace
 * - Test source code context
 * - Browser console logs
 *
 * Returns structured analysis with:
 * - Root cause classification
 * - Suggested fix (code diff)
 * - Confidence score
 * - Whether it's a flaky test or genuine bug
 *
 * Integrates with GitHub Actions to post analysis as PR comments.
 * Homey-specific: understands Turbo Stream failures, Devise auth issues,
 * Stripe iframe timeouts, and Thirdfort webhook timing.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FailureCategory =
    | 'selector_broken'
  | 'timing_turbo'
  | 'auth_expired'
  | 'stripe_iframe'
  | 'thirdfort_webhook'
  | 'network_error'
  | 'assertion_failed'
  | 'test_data_invalid'
  | 'environment_config'
  | 'genuine_bug'
  | 'unknown';

export interface FailureInput {
    testTitle: string;
    errorMessage: string;
    stackTrace?: string;
    screenshotPath?: string;
    screenshotBase64?: string;
    testSourceCode?: string;
    consoleLogs?: string[];
    networkLogs?: string[];
    retryCount?: number;
}

export interface FailureAnalysis {
    category: FailureCategory;
    summary: string;
    rootCause: string;
    suggestedFix: string;
    codeChange?: string;
    isFlaky: boolean;
    confidence: number;
    homeySpecific?: string;
    prComment: string;
}

// ─── Category patterns for quick triage ──────────────────────────────────────

const KNOWN_PATTERNS: Array<{ pattern: RegExp; category: FailureCategory; hint: string }> = [
  {
        pattern: /TimeoutError.*locator/i,
        category: 'selector_broken',
        hint: 'Element not found — selector may have changed after a UI update',
  },
  {
        pattern: /turbo|stimulus|stream/i,
        category: 'timing_turbo',
        hint: 'Hotwire Turbo event timing — add waitForTurboStream() or increase timeout',
  },
  {
        pattern: /devise|sign.*in|401|403|unauthorized/i,
        category: 'auth_expired',
        hint: 'Auth state expired — re-run auth setup or increase storage state TTL',
  },
  {
        pattern: /stripe|card.*number|iframe.*timeout/i,
        category: 'stripe_iframe',
        hint: 'Stripe Elements iframe — ensure frameLocator() is used, not page.locator()',
  },
  {
        pattern: /thirdfort|kyc.*webhook|webhook.*timeout/i,
        category: 'thirdfort_webhook',
        hint: 'Thirdfort KYC webhook — use ThirdfortMocker to simulate webhook response',
  },
  {
        pattern: /net::ERR|ECONNREFUSED|ENOTFOUND|502|503|504/i,
        category: 'network_error',
        hint: 'Network/server error — check if app is running and BASE_URL is correct',
  },
  {
        pattern: /expect.*received|AssertionError/i,
        category: 'assertion_failed',
        hint: 'Assertion failed — expected and received values differ',
  },
  {
        pattern: /validation|invalid.*data|422/i,
        category: 'test_data_invalid',
        hint: 'Test data validation error — use testDataFactory to generate valid UK data',
  },
  {
        pattern: /env|BASE_URL|undefined.*process\.env/i,
        category: 'environment_config',
        hint: 'Missing environment variable — check .env.test file',
  },
  ];

// ─── CIFailureAnalyser class ─────────────────────────────────────────────────

export class CIFailureAnalyser {
    private readonly openai: OpenAI;
    private readonly reportDir: string;

  constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.reportDir = path.join(process.cwd(), 'test-results', 'ai-analysis');
  }

  /**
     * Analyse a single test failure and return structured diagnosis.
     */
  async analyse(input: FailureInput): Promise<FailureAnalysis> {
        // Quick pattern triage (no AI needed for well-known patterns)
      const quickResult = this.quickTriage(input);

      // Load screenshot if path provided
      let screenshotBase64 = input.screenshotBase64;
        if (!screenshotBase64 && input.screenshotPath && fs.existsSync(input.screenshotPath)) {
                screenshotBase64 = fs.readFileSync(input.screenshotPath).toString('base64');
        }

      // Build AI analysis prompt
      const analysis = await this.analyseWithAI(input, screenshotBase64, quickResult);

      // Save analysis report
      this.saveReport(input.testTitle, analysis);

      return analysis;
  }

  /**
     * Analyse multiple failures from a test run (e.g., from playwright results JSON).
     */
  async analyseBatch(failures: FailureInput[]): Promise<Map<string, FailureAnalysis>> {
        const results = new Map<string, FailureAnalysis>();

      console.log(`[CIFailureAnalyser] Analysing ${failures.length} failures...`);

      for (const failure of failures) {
              console.log(`  - ${failure.testTitle}`);
              const analysis = await this.analyse(failure);
              results.set(failure.testTitle, analysis);
              await new Promise(r => setTimeout(r, 300)); // Rate limit
      }

      return results;
  }

  /**
     * Parse Playwright's JSON results file and extract failures.
     */
  static parsePlaywrightResults(resultsPath: string): FailureInput[] {
        if (!fs.existsSync(resultsPath)) {
                console.warn(`[CIFailureAnalyser] Results file not found: ${resultsPath}`);
                return [];
        }

      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
        const failures: FailureInput[] = [];

      const processSpec = (spec: any) => {
              if (!spec.tests) return;
              for (const test of spec.tests) {
                        for (const result of test.results ?? []) {
                                    if (result.status === 'failed' || result.status === 'timedOut') {
                                                  const errorMsg = result.error?.message ?? result.errors?.[0]?.message ?? 'Unknown error';
                                                  const stackTrace = result.error?.stack ?? '';

                                      const screenshotAttachment = result.attachments?.find(
                                                      (a: any) => a.name === 'screenshot' || a.contentType?.includes('png')
                                                    );

                                      failures.push({
                                                      testTitle: test.title,
                                                      errorMessage: errorMsg,
                                                      stackTrace,
                                                      screenshotPath: screenshotAttachment?.path,
                                                      retryCount: result.retry ?? 0,
                                      });
                                    }
                        }
              }
      };

      // Recursively process suites
      const processSuite = (suite: any) => {
              suite.specs?.forEach(processSpec);
              suite.suites?.forEach(processSuite);
      };

      results.suites?.forEach(processSuite);
        return failures;
  }

  /**
     * Format all analyses as a GitHub PR comment (markdown).
     */
  static formatPRComment(analyses: Map<string, FailureAnalysis>): string {
        if (analyses.size === 0) return '';

      const flaky = Array.from(analyses.values()).filter(a => a.isFlaky);
        const bugs = Array.from(analyses.values()).filter(a => !a.isFlaky);

      const lines: string[] = [
              '## 🤖 AI Test Failure Analysis',
              '',
              `**${analyses.size} test(s) failed** — ${flaky.length} likely flaky, ${bugs.length} potential bugs`,
              '',
            ];

      if (bugs.length > 0) {
              lines.push('### 🐛 Potential Bugs');
              for (const [title, analysis] of analyses) {
                        if (!analysis.isFlaky) {
                                    lines.push(`\n#### \`${title}\``);
                                    lines.push(`**Category:** ${analysis.category} | **Confidence:** ${Math.round(analysis.confidence * 100)}%`);
                                    lines.push(`**Root Cause:** ${analysis.rootCause}`);
                                    lines.push(`**Fix:** ${analysis.suggestedFix}`);
                                    if (analysis.codeChange) {
                                                  lines.push('```typescript');
                                                  lines.push(analysis.codeChange);
                                                  lines.push('```');
                                    }
                        }
              }
      }

      if (flaky.length > 0) {
              lines.push('\n### ⚡ Flaky Tests (likely timing issues)');
              for (const [title, analysis] of analyses) {
                        if (analysis.isFlaky) {
                                    lines.push(`- **\`${title}\`** — ${analysis.summary}`);
                                    if (analysis.homeySpecific) {
                                                  lines.push(`  > Homey note: ${analysis.homeySpecific}`);
                                    }
                        }
              }
      }

      lines.push('\n---');
        lines.push('*Generated by [homey-playwright](https://github.com/SayinthenV/homey-playwright) AI Failure Analyser*');

      return lines.join('\n');
  }

  // ─── Private methods ──────────────────────────────────────────────────────

  private quickTriage(input: FailureInput): { category: FailureCategory; hint: string } | null {
        const searchText = [
                input.errorMessage,
                input.stackTrace ?? '',
                ...(input.consoleLogs ?? []),
              ].join('\n');

      for (const { pattern, category, hint } of KNOWN_PATTERNS) {
              if (pattern.test(searchText)) {
                        return { category, hint };
              }
      }
        return null;
  }

  private async analyseWithAI(
        input: FailureInput,
        screenshotBase64: string | undefined,
        quickResult: { category: FailureCategory; hint: string } | null
      ): Promise<FailureAnalysis> {
        try {
                const prompt = `You are a senior QA engineer analysing a Playwright test failure for Homey, a UK conveyancing web app.

                Homey uses: Rails + Hotwire/Turbo Streams, Devise auth, Stripe Elements iframes, Thirdfort KYC webhooks.

                TEST FAILURE DETAILS:
                Test: "${input.testTitle}"
                Error: ${input.errorMessage}
                Stack: ${(input.stackTrace ?? '').slice(0, 500)}
                Retries: ${input.retryCount ?? 0}
                ${quickResult ? `Quick Triage: ${quickResult.category} — ${quickResult.hint}` : ''}
                ${input.consoleLogs?.length ? `Console: ${input.consoleLogs.slice(0, 5).join('\n')}` : ''}
                ${input.testSourceCode ? `Test Source:\n${input.testSourceCode.slice(0, 800)}` : ''}

                Analyse this failure and respond with ONLY a valid JSON object (no markdown):
                {
                  "category": "selector_broken|timing_turbo|auth_expired|stripe_iframe|thirdfort_webhook|network_error|assertion_failed|test_data_invalid|environment_config|genuine_bug|unknown",
                    "summary": "one sentence summary",
                      "rootCause": "2-3 sentence explanation of why this happened",
                        "suggestedFix": "specific actionable fix instruction",
                          "codeChange": "optional: 3-10 lines of TypeScript showing the fix (or null)",
                            "isFlaky": true|false,
                              "confidence": 0.0-1.0,
                                "homeySpecific": "optional: Hotwire/Stripe/Thirdfort specific note (or null)"
                                }`;

          const messages: any[] = [{
                    role: 'user',
                    content: screenshotBase64
                      ? [
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } },
                        { type: 'text', text: prompt },
                                    ]
                                : prompt,
          }];

          const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages,
                    max_tokens: 800,
                    temperature: 0.2,
                    response_format: screenshotBase64 ? undefined : { type: 'json_object' },
          });

          const content = response.choices[0]?.message?.content?.trim() ?? '';
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);

          const analysis: FailureAnalysis = {
                    category: parsed.category ?? quickResult?.category ?? 'unknown',
                    summary: parsed.summary ?? 'Test failed',
                    rootCause: parsed.rootCause ?? input.errorMessage,
                    suggestedFix: parsed.suggestedFix ?? quickResult?.hint ?? 'Investigate manually',
                    codeChange: parsed.codeChange ?? undefined,
                    isFlaky: parsed.isFlaky ?? (input.retryCount ?? 0) > 0,
                    confidence: parsed.confidence ?? 0.5,
                    homeySpecific: parsed.homeySpecific ?? undefined,
                    prComment: '',
          };

          // Generate PR comment
          analysis.prComment = [
                    `**Test:** \`${input.testTitle}\``,
                    `**Category:** ${analysis.category} | **Confidence:** ${Math.round(analysis.confidence * 100)}%`,
                    `**Root Cause:** ${analysis.rootCause}`,
                    `**Fix:** ${analysis.suggestedFix}`,
                    analysis.codeChange ? `\`\`\`typescript\n${analysis.codeChange}\n\`\`\`` : '',
                    analysis.homeySpecific ? `> 🏠 Homey: ${analysis.homeySpecific}` : '',
                  ].filter(Boolean).join('\n');

          return analysis;
        } catch (err) {
                console.error('[CIFailureAnalyser] AI analysis failed:', err);

          // Return fallback analysis
          return {
                    category: quickResult?.category ?? 'unknown',
                    summary: 'Analysis failed — manual investigation required',
                    rootCause: input.errorMessage,
                    suggestedFix: quickResult?.hint ?? 'Run locally with --debug flag',
                    isFlaky: (input.retryCount ?? 0) > 0,
                    confidence: 0.3,
                    prComment: `**Test:** \`${input.testTitle}\`\n**Error:** ${input.errorMessage}`,
          };
        }
  }

  private saveReport(testTitle: string, analysis: FailureAnalysis): void {
        try {
                if (!fs.existsSync(this.reportDir)) {
                          fs.mkdirSync(this.reportDir, { recursive: true });
                }
                const slug = testTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
                const filePath = path.join(this.reportDir, `${slug}-${Date.now()}.json`);
                fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2));
        } catch {
                // Non-fatal — just log
        }
  }
}

// ─── Reporter hook for use in playwright.config.ts ───────────────────────────
// Add to reporter array: ['./helpers/CIFailureAnalyser', { outputFile: 'test-results/failures.md' }]

export default class AIFailureReporter {
    private readonly failures: FailureInput[] = [];
    private readonly analyser: CIFailureAnalyser;
    private readonly outputFile: string;

  constructor(options: { outputFile?: string } = {}) {
        this.analyser = new CIFailureAnalyser();
        this.outputFile = options.outputFile ?? 'test-results/ai-failure-report.md';
  }

  onTestEnd(test: any, result: any) {
        if (result.status === 'failed' || result.status === 'timedOut') {
                const screenshot = result.attachments?.find((a: any) => a.name === 'screenshot');
                this.failures.push({
                          testTitle: test.title,
                          errorMessage: result.error?.message ?? 'Unknown error',
                          stackTrace: result.error?.stack,
                          screenshotPath: screenshot?.path,
                          retryCount: result.retry ?? 0,
                });
        }
  }

  async onEnd() {
        if (this.failures.length === 0) return;

      console.log(`\n[AI Failure Analyser] Analysing ${this.failures.length} failure(s)...`);
        const analyses = await this.analyser.analyseBatch(this.failures);
        const comment = CIFailureAnalyser.formatPRComment(analyses);

      const dir = path.dirname(this.outputFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.outputFile, comment, 'utf-8');
        console.log(`[AI Failure Analyser] Report saved to ${this.outputFile}`);
  }
}
