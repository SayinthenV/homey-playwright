import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * NLTestConverter — Natural Language to Playwright Test Generator
 *
 * Converts plain English test descriptions into executable Playwright
 * TypeScript test code, mapped to the Homey POM library.
 *
 * Usage:
 *   const converter = new NLTestConverter();
 *   const code = await converter.convert(`
 *     Login as agent, create a new enquiry for 45 Oak Street, confirm it
 *     appears in the enquiry list, then check the action center has a task
 *   `);
 *   fs.writeFileSync('tests/generated/my-test.spec.ts', code);
 */

// ─── Available POM context sent to AI ───────────────────────────────────────

const POM_CONTEXT = `
Available Page Objects and their key methods:

LoginPage (pages/auth/LoginPage.ts):
  - goto(): navigate to login page
    - login(email, password): fill and submit login form
      - expectLoggedIn(): assert login succeeded

      EnquiryListPage (pages/enquiries/EnquiryListPage.ts):
        - goto(): navigate to /enquiries
          - search(query): search enquiries
            - clickEnquiry(ref): click enquiry by reference
              - expectEnquiryVisible(ref): assert enquiry appears in list
                - getEnquiryCount(): returns number of visible enquiries

                NewEnquiryPage (pages/enquiries/NewEnquiryPage.ts):
                  - goto(): navigate to new enquiry form
                    - fillPropertyAddress(address): fill address field
                      - fillBuyerDetails(person): fill buyer name, email, phone
                        - fillSellerDetails(person): fill seller name, email, phone
                          - selectPropertyType(type): choose from dropdown
                            - fillAgreedPrice(amount): fill price field
                              - submit(): click submit button
                                - expectSuccess(): assert enquiry created successfully

                                EnquiryDetailPage (pages/enquiries/EnquiryDetailPage.ts):
                                  - goto(id): navigate to /enquiries/:id
                                    - getStatus(): returns current status string
                                      - clickProgressButton(label): click a progress action button
                                        - addNote(text): add a note to the enquiry
                                          - expectStatus(status): assert current status

                                          ConveyanceListPage (pages/conveyances/ConveyanceListPage.ts):
                                            - goto(): navigate to /conveyances
                                              - search(query): search conveyances
                                                - clickConveyance(ref): click by reference
                                                  - expectConveyanceVisible(ref): assert visible

                                                  ConveyanceDetailPage (pages/conveyances/ConveyanceDetailPage.ts):
                                                    - goto(id): navigate to /conveyances/:id
                                                      - getStatus(): returns pipeline stage
                                                        - completeTask(taskName): complete a named task
                                                          - uploadDocument(name, filePath): upload a document
                                                            - expectTaskComplete(taskName): assert task done

                                                            ActionCenterPage (pages/actionCenter/ActionCenterPage.ts):
                                                              - goto(): navigate to /action-center
                                                                - getTaskCount(): count pending tasks
                                                                  - completeTask(title): complete task by title
                                                                    - filterByType(type): filter task list
                                                                      - expectTaskVisible(title): assert task is shown

                                                                      KYCDashboardPage (pages/kyc/KYCDashboardPage.ts):
                                                                        - goto(conveyanceId): navigate to KYC dashboard
                                                                          - initiateCheck(buyerName): start KYC for a buyer
                                                                            - getCheckStatus(buyerName): get status of check
                                                                              - expectCheckPassed(buyerName): assert KYC passed

                                                                              QuoteGeneratorPage (pages/quotes/QuoteGeneratorPage.ts):
                                                                                - goto(enquiryId): navigate to quote generator
                                                                                  - selectServices(services[]): check service checkboxes
                                                                                    - generateQuote(): click generate
                                                                                      - getQuoteTotal(): returns total as string
                                                                                        - expectQuoteGenerated(): assert quote is ready

                                                                                        StripePaymentPage (pages/payments/StripePaymentPage.ts):
                                                                                          - fillCardNumber(number): fill card in iframe
                                                                                            - fillExpiry(mmyy): fill expiry
                                                                                              - fillCVC(cvc): fill cvc
                                                                                                - submitPayment(): click pay button
                                                                                                  - expectPaymentSuccess(): assert success state

                                                                                                  AuthHelper (helpers/AuthHelper.ts):
                                                                                                    - saveAuthState(role): save browser storage state for role
                                                                                                      - use with: test.use({ storageState: '.auth/agent.json' })
                                                                                                      
                                                                                                      Roles: 'agent' | 'solicitor' | 'buyer' | 'admin'
                                                                                                      Test data: import { testDataFactory } from '../helpers/TestDataFactory'
                                                                                                      `.trim();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConvertOptions {
    testTitle?: string;
    role?: 'agent' | 'solicitor' | 'buyer' | 'admin';
    outputPath?: string;
    includeImports?: boolean;
}

export interface ConvertResult {
    code: string;
    testTitle: string;
    steps: string[];
    warnings: string[];
}

// ─── NLTestConverter class ───────────────────────────────────────────────────

export class NLTestConverter {
    private readonly openai: OpenAI;

  constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
     * Convert a natural language description into a Playwright TypeScript test.
     */
  async convert(
        description: string,
        options: ConvertOptions = {}
      ): Promise<ConvertResult> {
        const {
                testTitle = this.deriveTitle(description),
                role = 'agent',
                outputPath,
                includeImports = true,
        } = options;

      const prompt = `You are a Playwright test automation expert building tests for Homey, a UK conveyancing web app.
      The app uses Hotwire/Turbo Streams (Rails). Always use waitForTurboStream() after state-changing actions.

      ${POM_CONTEXT}

      Convert this natural language test description into a complete Playwright TypeScript test:

      "${description}"

      Rules:
      1. Use the Page Object classes listed above — NEVER write raw page.locator() calls
      2. Use role: '${role}' — load auth from '.auth/${role}.json' with test.use({ storageState })
      3. Import testDataFactory for any test data needed
      4. After ANY action that triggers a server update, add: await page.waitForTimeout(500) // Turbo settle
      5. Use descriptive test.step() wrappers for each logical step
      6. Include proper expect() assertions from @playwright/test
      7. Handle async/await correctly throughout
      8. Use const { page } = from Playwright test fixture

      Return ONLY valid TypeScript code. No markdown fences, no explanation.
      The output must be a complete, runnable spec file starting with imports.`;

      const response = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 2000,
              temperature: 0.3,
      });

      const rawCode = response.choices[0]?.message?.content?.trim() || '';

      // Strip markdown fences if AI included them anyway
      const code = rawCode
          .replace(/^```typescript\n?/i, '')
          .replace(/^```ts\n?/i, '')
          .replace(/```$/, '')
          .trim();

      const steps = this.extractSteps(code);
        const warnings = this.validateCode(code);

      if (outputPath) {
              const dir = path.dirname(outputPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(outputPath, code, 'utf-8');
              console.log(`[NLTestConverter] Test written to ${outputPath}`);
      }

      return { code, testTitle, steps, warnings };
  }

  /**
     * Convert multiple scenarios in batch.
     */
  async convertBatch(
        scenarios: Array<{ description: string; options?: ConvertOptions }>
      ): Promise<ConvertResult[]> {
        const results: ConvertResult[] = [];
        for (const { description, options } of scenarios) {
                console.log(`[NLTestConverter] Converting: "${description.slice(0, 60)}..."`);
                const result = await this.convert(description, options);
                results.push(result);
                // Rate limit courtesy pause
          await new Promise(r => setTimeout(r, 500));
        }
        return results;
  }

  /**
     * Generate a test suite from a feature description.
     * AI will produce multiple test cases grouped under one describe block.
     */
  async generateSuite(
        featureName: string,
        featureDescription: string,
        options: ConvertOptions = {}
      ): Promise<ConvertResult> {
        const { role = 'agent' } = options;

      const prompt = `You are a Playwright test automation expert building tests for Homey, a UK conveyancing web app.

      ${POM_CONTEXT}

      Generate a complete Playwright TypeScript test SUITE (describe block with multiple test cases) for:

      Feature: "${featureName}"
      Description: "${featureDescription}"

      Requirements:
      - Role: '${role}' (use storageState: '.auth/${role}.json')
      - Create 3-5 meaningful test cases covering happy path and edge cases
      - Each test should be independent (no shared state between tests)
      - Use beforeEach for navigation setup if needed
      - Include proper assertions in each test
      - Follow the POM pattern — use only the page objects listed
      - Use test.step() for readability
      - Import testDataFactory for test data

      Return ONLY valid TypeScript code. No markdown. Complete runnable spec file.`;

      const response = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 3000,
              temperature: 0.3,
      });

      const rawCode = response.choices[0]?.message?.content?.trim() || '';
        const code = rawCode
          .replace(/^```typescript\n?/i, '')
          .replace(/^```ts\n?/i, '')
          .replace(/```$/, '')
          .trim();

      const outputPath = options.outputPath ?? `tests/generated/${featureName.toLowerCase().replace(/\s+/g, '-')}.spec.ts`;
        if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(outputPath, code, 'utf-8');
                console.log(`[NLTestConverter] Suite written to ${outputPath}`);
        }

      return {
              code,
              testTitle: featureName,
              steps: this.extractSteps(code),
              warnings: this.validateCode(code),
      };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private deriveTitle(description: string): string {
        // Use first sentence or first 60 chars as title
      const firstSentence = description.split(/[.!?]/)[0].trim();
        return firstSentence.length > 80
          ? firstSentence.slice(0, 77) + '...'
                : firstSentence;
  }

  private extractSteps(code: string): string[] {
        const stepMatches = code.matchAll(/test\.step\(['"]([^'"]+)['"]/g);
        return Array.from(stepMatches, m => m[1]);
  }

  private validateCode(code: string): string[] {
        const warnings: string[] = [];

      if (!code.includes('import')) {
              warnings.push('No imports found — code may be incomplete');
      }
        if (code.includes('page.locator(') && !code.includes('Page(page)')) {
                warnings.push('Raw page.locator() calls detected — consider using POM classes');
        }
        if (!code.includes('expect(')) {
                warnings.push('No assertions found — test may not verify anything');
        }
        if (!code.includes('storageState') && !code.includes('login(')) {
                warnings.push('No auth setup detected — test may fail if login is required');
        }

      return warnings;
  }
}

// ─── CLI runner ──────────────────────────────────────────────────────────────
// Run directly: npx ts-node helpers/NLTestConverter.ts "your test description"

if (require.main === module) {
    const description = process.argv.slice(2).join(' ');
    if (!description) {
          console.error('Usage: npx ts-node helpers/NLTestConverter.ts "test description"');
          process.exit(1);
    }

  const converter = new NLTestConverter();
    const outputPath = `tests/generated/nl-test-${Date.now()}.spec.ts`;

  converter.convert(description, { outputPath }).then(result => {
        console.log('\n=== Generated Test ===\n');
        console.log(result.code);
        if (result.warnings.length) {
                console.log('\n=== Warnings ===');
                result.warnings.forEach(w => console.warn(' -', w));
        }
        console.log(`\nWritten to: ${outputPath}`);
  }).catch(console.error);
}
