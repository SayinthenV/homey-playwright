import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PageObjectGenerator — AI DOM Crawler → POM Skeleton Generator
 *
 * Crawls a live Homey URL, extracts the DOM structure and screenshots,
 * then uses GPT-4o to generate a complete TypeScript Page Object class
 * that extends BasePage.
 *
 * Usage:
 *   npx ts-node ai/PageObjectGenerator.ts \
 *     --url http://localhost:3000/enquiries \
 *     --name EnquiryListPage \
 *     --output pages/enquiries/EnquiryListPage.ts \
 *     --role agent
 *
 * The generator:
 * 1. Launches Chromium with the saved auth state for the given role
 * 2. Navigates to the URL
 * 3. Takes a screenshot + extracts DOM with interactive elements
 * 4. Sends to GPT-4o with the BasePage API contract
 * 5. Returns a complete, typed TypeScript class
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface InteractiveElement {
    tag: string;
    role?: string;
    text?: string;
    placeholder?: string;
    name?: string;
    id?: string;
    dataTestId?: string;
    classes: string;
    type?: string;
    href?: string;
}

interface GenerateOptions {
    url: string;
    className: string;
    outputPath?: string;
    role?: 'agent' | 'solicitor' | 'buyer' | 'admin';
    authStatePath?: string;
    description?: string;
}

interface GenerateResult {
    code: string;
    className: string;
    elementsFound: number;
    outputPath?: string;
}

// ─── BasePage contract (sent to AI for context) ───────────────────────────────

const BASE_PAGE_API = `
Abstract BasePage class contract (all Page Objects must extend this):

import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

    // Navigation
      abstract goto(...args: any[]): Promise<void>;

        // Turbo Stream helpers (Hotwire/Rails)
          async waitForTurboStream(action?: string): Promise<void>
            async waitForTurboFrame(frameId: string): Promise<void>
              async waitForPageLoad(): Promise<void>

                // Convenience
                  async waitForURL(pattern: string | RegExp): Promise<void>
                    async getTitle(): Promise<string>
                      async scrollToBottom(): Promise<void>
                      }

                      Locator patterns to use (in order of preference):
                      1. page.getByRole('button', { name: 'Submit' })
                      2. page.getByLabel('Email address')
                      3. page.getByPlaceholder('Search...')
                      4. page.getByText('heading text')
                      5. page.locator('[data-testid="submit-btn"]')
                      6. page.locator('.css-class')  // Last resort
                      `.trim();

// ─── PageObjectGenerator class ────────────────────────────────────────────────

export class PageObjectGenerator {
    private readonly openai: OpenAI;

  constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
     * Generate a Page Object class for a given URL.
     */
  async generate(options: GenerateOptions): Promise<GenerateResult> {
        const {
                url,
                className,
                outputPath,
                role = 'agent',
                authStatePath,
                description = '',
        } = options;

      console.log(`[PageObjectGenerator] Crawling ${url}...`);

      // Launch browser and crawl
      const authPath = authStatePath ?? path.join(process.cwd(), '.auth', `${role}.json`);
        const { elements, screenshotBase64, pageTitle, currentUrl } = await this.crawlPage(url, authPath);

      console.log(`[PageObjectGenerator] Found ${elements.length} interactive elements`);
        console.log(`[PageObjectGenerator] Generating ${className} POM...`);

      // Generate POM with AI
      const code = await this.generateWithAI({
              url: currentUrl,
              className,
              description,
              elements,
              screenshotBase64,
              pageTitle,
      });

      // Write output file
      if (outputPath) {
              const dir = path.dirname(outputPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(outputPath, code, 'utf-8');
              console.log(`[PageObjectGenerator] Written to ${outputPath}`);
      }

      return {
              code,
              className,
              elementsFound: elements.length,
              outputPath,
      };
  }

  /**
     * Generate Page Objects for multiple URLs in batch.
     */
  async generateBatch(
        pages: Array<{ url: string; className: string; outputDir?: string; role?: string }>
      ): Promise<GenerateResult[]> {
        const results: GenerateResult[] = [];
        for (const pageConfig of pages) {
                const outputDir = pageConfig.outputDir ?? 'pages/generated';
                const outputPath = path.join(outputDir, `${pageConfig.className}.ts`);
                const result = await this.generate({
                          ...pageConfig,
                          role: (pageConfig.role as any) ?? 'agent',
                          outputPath,
                });
                results.push(result);
                await new Promise(r => setTimeout(r, 1000)); // Courtesy pause
        }
        return results;
  }

  // ─── Private methods ──────────────────────────────────────────────────────

  private async crawlPage(
        url: string,
        authStatePath: string
      ): Promise<{
        elements: InteractiveElement[];
        screenshotBase64: string;
        pageTitle: string;
        currentUrl: string;
  }> {
        const storageState = fs.existsSync(authStatePath) ? authStatePath : undefined;

      const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ storageState });
        const page = await context.newPage();

      try {
              await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

          // Wait for any Turbo initialisation
          await page.waitForTimeout(1000);

          const pageTitle = await page.title();
              const currentUrl = page.url();

          // Extract interactive elements
          const elements: InteractiveElement[] = await page.evaluate(() => {
                    const interactiveSelectors = [
                                'a[href]', 'button', 'input', 'select', 'textarea',
                                '[role="button"]', '[role="link"]', '[role="tab"]',
                                '[data-testid]', 'form',
                              ];

                                                                             const seen = new Set<string>();
                    const result: any[] = [];

                                                                             for (const selector of interactiveSelectors) {
                                                                                         const elements = document.querySelectorAll(selector);
                                                                                         elements.forEach(el => {
                                                                                                       const key = el.tagName + (el.id || el.getAttribute('data-testid') || el.textContent?.slice(0, 20));
                                                                                                       if (seen.has(key)) return;
                                                                                                       seen.add(key);

                                                                                                                      const classList = typeof el.className === 'string'
                                                                                                         ? el.className.split(' ').filter(Boolean).slice(0, 3).join(' ')
                                                                                                                                      : '';

                                                                                                                      result.push({
                                                                                                                                      tag: el.tagName.toLowerCase(),
                                                                                                                                      role: el.getAttribute('role') ?? undefined,
                                                                                                                                      text: el.textContent?.trim().slice(0, 60) || undefined,
                                                                                                                                      placeholder: (el as HTMLInputElement).placeholder || undefined,
                                                                                                                                      name: (el as HTMLInputElement).name || undefined,
                                                                                                                                      id: el.id || undefined,
                                                                                                                                      dataTestId: el.getAttribute('data-testid') || undefined,
                                                                                                                                      classes: classList,
                                                                                                                                      type: (el as HTMLInputElement).type || undefined,
                                                                                                                                      href: (el as HTMLAnchorElement).href?.replace(window.location.origin, '') || undefined,
                                                                                                                        });
                                                                                           });
                                                                             }

                                                                             return result.slice(0, 60); // Cap at 60 elements
          });

          // Take screenshot
          const screenshotBuffer = await page.screenshot({ fullPage: false });
              const screenshotBase64 = screenshotBuffer.toString('base64');

          return { elements, screenshotBase64, pageTitle, currentUrl };
      } finally {
              await browser.close();
      }
  }

  private async generateWithAI(params: {
        url: string;
        className: string;
        description: string;
        elements: InteractiveElement[];
        screenshotBase64: string;
        pageTitle: string;
  }): Promise<string> {
        const { url, className, description, elements, screenshotBase64, pageTitle } = params;

      const elementsJson = JSON.stringify(elements, null, 2);

      const prompt = `You are a Playwright TypeScript expert building a Page Object Model for Homey, a UK conveyancing app.

      ${BASE_PAGE_API}

      Generate a complete TypeScript Page Object class for this page:

      Page Title: "${pageTitle}"
      URL: "${url}"
      Class Name: "${className}"
      Description: "${description || 'Homey application page'}"

      Interactive elements found on the page:
      \`\`\`json
      ${elementsJson.slice(0, 4000)}
      \`\`\`

      Requirements:
      1. Class must extend BasePage
      2. Import from '../base/BasePage' (adjust path as needed)
      3. Declare all interactive elements as private readonly Locator properties in the constructor
      4. Use the preferred locator strategy hierarchy (getByRole > getByLabel > getByPlaceholder > getByTestId > locator)
      5. Create meaningful action methods that combine related steps (e.g., fillLoginForm + submit = login())
      6. Create getter methods that return text/values for assertions
      7. Create expect*() assertion methods using Playwright's expect API
      8. Add waitForTurboStream() calls after state-changing actions
      9. Add JSDoc comments on public methods
      10. The goto() method should navigate to the correct URL pattern

      Return ONLY valid TypeScript code. No markdown fences.
      Start with the imports, end with the class export.`;

      const response = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{
                        role: 'user',
                        content: [
                          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } },
                          { type: 'text', text: prompt },
                                  ],
              }],
              max_tokens: 3000,
              temperature: 0.2,
      });

      const rawCode = response.choices[0]?.message?.content?.trim() ?? '';
        return rawCode
          .replace(/^```typescript\n?/i, '')
          .replace(/^```ts\n?/i, '')
          .replace(/```$/, '')
          .trim();
  }
}

// ─── CLI runner ───────────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    const getArg = (flag: string) => {
          const i = args.indexOf(flag);
          return i !== -1 ? args[i + 1] : undefined;
    };

  const url = getArg('--url');
    const name = getArg('--name');
    const output = getArg('--output');
    const role = getArg('--role') as any ?? 'agent';
    const description = getArg('--description');

  if (!url || !name) {
        console.error('Usage: npx ts-node ai/PageObjectGenerator.ts --url <url> --name <ClassName> [--output <path>] [--role agent|solicitor|buyer|admin] [--description "..."]');
        process.exit(1);
  }

  const generator = new PageObjectGenerator();
    generator.generate({ url, className: name, outputPath: output, role, description })
      .then(result => {
              console.log(`\n=== Generated: ${result.className} (${result.elementsFound} elements) ===\n`);
              if (!output) console.log(result.code);
      })
      .catch(err => {
              console.error('[PageObjectGenerator] Failed:', err);
              process.exit(1);
      });
}
