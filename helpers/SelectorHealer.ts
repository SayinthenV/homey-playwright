import { Page, Locator } from '@playwright/test';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SelectorHealer - AI Self-Healing Selector Engine
 * Detects broken Playwright locators and uses GPT-4o vision to suggest fixes.
 * Homey-specific: accounts for Hotwire Turbo Stream DOM mutations.
 */

interface SelectorPatch {
    original: string;
    healed: string;
    page: string;
    timestamp: string;
    confidence: number;
}

interface HealResult {
    locator: Locator;
    selector: string;
    wasHealed: boolean;
}

export class SelectorHealer {
    private readonly openai: OpenAI;
    private readonly patchFilePath: string;
    private patches: Map<string, SelectorPatch>;

  constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.patchFilePath = path.join(process.cwd(), 'ai', 'selector-patches.json');
        this.patches = this.loadPatches();
  }

  /** Try selector, heal with AI if broken, cache the result. */
  async heal(
        page: Page,
        selector: string,
        description: string,
        pageName: string
      ): Promise<HealResult> {
        const patchKey = `${pageName}::${selector}`;
        const existingPatch = this.patches.get(patchKey);

      if (existingPatch) {
              const patchedLocator = page.locator(existingPatch.healed);
              const isVisible = await patchedLocator.isVisible().catch(() => false);
              if (isVisible) {
                        console.log(`[SelectorHealer] Using cached patch for "${description}": ${existingPatch.healed}`);
                        return { locator: patchedLocator, selector: existingPatch.healed, wasHealed: true };
              }
      }

      const originalLocator = page.locator(selector);
        const isOriginalVisible = await originalLocator.isVisible().catch(() => false);
        if (isOriginalVisible) {
                return { locator: originalLocator, selector, wasHealed: false };
        }

      console.warn(`[SelectorHealer] Broken: "${selector}" on ${pageName}. Engaging AI...`);
        const healedSelector = await this.healWithAI(page, selector, description, pageName);

      if (healedSelector) {
              const patch: SelectorPatch = {
                        original: selector,
                        healed: healedSelector,
                        page: pageName,
                        timestamp: new Date().toISOString(),
                        confidence: 0.85,
              };
              this.patches.set(patchKey, patch);
              this.savePatches();
              console.log(`[SelectorHealer] Healed! New selector: "${healedSelector}"`);
              return { locator: page.locator(healedSelector), selector: healedSelector, wasHealed: true };
      }

      console.error(`[SelectorHealer] Could not heal: "${selector}"`);
        return { locator: originalLocator, selector, wasHealed: false };
  }

  private async healWithAI(
        page: Page,
        brokenSelector: string,
        description: string,
        pageName: string
      ): Promise<string | null> {
        try {
                const screenshotBuffer = await page.screenshot({ fullPage: false });
                const base64Screenshot = screenshotBuffer.toString('base64');

          const domStructure = await page.evaluate(() => {
                    const simplify = (el: Element, depth = 0): string => {
                                if (depth > 4) return '';
                                const tag = el.tagName.toLowerCase();
                                const id = el.id ? `#${el.id}` : '';
                                const cls = typeof el.className === 'string'
                                  ? '.' + el.className.split(' ').filter(Boolean).slice(0, 3).join('.') : '';
                                const tid = el.getAttribute('data-testid') ? ` [data-testid="${el.getAttribute('data-testid')}"]` : '';
                                const text = el.textContent?.trim().slice(0, 50) || '';
                                const children = Array.from(el.children).slice(0, 5)
                                  .map(c => '  '.repeat(depth + 1) + simplify(c, depth + 1)).join('\n');
                                return `${tag}${id}${cls}${tid} "${text}"\n${children}`;
                    };
                    return simplify(document.body);
          });

          const prompt = `Playwright selector broken after UI update.
          Page: ${pageName} | Element: "${description}" | Broken: "${brokenSelector}"
          This is a Hotwire/Turbo Streams Rails app — elements may be replaced by server partials.

          DOM (simplified):
          ${domStructure.slice(0, 3000)}

          Return ONLY a JSON array of up to 5 Playwright selectors, most confident first:
          ["[data-testid='x']", "button:has-text('Submit')"]`;

          const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{
                                role: 'user',
                                content: [
                                  { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Screenshot}`, detail: 'high' } },
                                  { type: 'text', text: prompt },
                                            ],
                    }],
                    max_tokens: 400,
                    temperature: 0.2,
          });

          const content = response.choices[0]?.message?.content?.trim() || '';
                const match = content.match(/\[.*\]/s);
                if (!match) return null;

          const candidates: string[] = JSON.parse(match[0]);
                for (const candidate of candidates) {
                          const visible = await page.locator(candidate).isVisible().catch(() => false);
                          if (visible) return candidate;
                }
                return null;
        } catch (err) {
                console.error('[SelectorHealer] AI error:', err);
                return null;
        }
  }

  /** Wait for Turbo to settle, then attempt healing. */
  async findAfterTurbo(
        page: Page,
        selector: string,
        description: string,
        pageName: string,
        timeout = 5000
      ): Promise<HealResult> {
        await page.waitForFunction(
                () => !(document as any).querySelector('[data-turbo-stream]'),
          { timeout }
              ).catch(() => {});
        return this.heal(page, selector, description, pageName);
  }

  /** Scan all selectors in a page object and heal any that are broken. */
  async diagnosePageObject(
        page: Page,
        selectors: Record<string, string>,
        pageName: string
      ): Promise<{ broken: string[]; healed: Map<string, string> }> {
        const broken: string[] = [];
        const healed = new Map<string, string>();
        for (const [name, selector] of Object.entries(selectors)) {
                const visible = await page.locator(selector).isVisible().catch(() => false);
                if (!visible) {
                          broken.push(name);
                          const result = await this.heal(page, selector, name, pageName);
                          if (result.wasHealed) healed.set(name, result.selector);
                }
        }
        return { broken, healed };
  }

  private loadPatches(): Map<string, SelectorPatch> {
        try {
                if (fs.existsSync(this.patchFilePath)) {
                          const data = JSON.parse(fs.readFileSync(this.patchFilePath, 'utf-8'));
                          return new Map(Object.entries(data));
                }
        } catch { /* start fresh */ }
        return new Map();
  }

  private savePatches(): void {
        try {
                const dir = path.dirname(this.patchFilePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(this.patchFilePath, JSON.stringify(Object.fromEntries(this.patches), null, 2));
        } catch (err) {
                console.error('[SelectorHealer] Save failed:', err);
        }
  }

  generateReport(): string {
        const patches = Array.from(this.patches.values());
        if (!patches.length) return 'No selector patches recorded.';
        return [
                '# Selector Healer Patch Report',
                `Generated: ${new Date().toISOString()}`,
                `Total patches: ${patches.length}`,
                '',
                '| Page | Original | Healed | Date |',
                '|------|----------|--------|------|',
                ...patches.map(p => `| ${p.page} | \`${p.original}\` | \`${p.healed}\` | ${p.timestamp.split('T')[0]} |`),
              ].join('\n');
  }
}

export const selectorHealer = new SelectorHealer();
