import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

/**
 * ─── Environment resolution ──────────────────────────────────────────────────
 *
 * Set the ENV variable to target a specific environment:
 *
 * ENV=qa → https://app.qa.homey.co.uk
 * ENV=preprod → https://app.preprod.homey.co.uk
 * ENV=reviewapp → https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com
 * ENV=local → http://localhost:3000 (default)
 *
 * Examples:
 * ENV=qa npx playwright test
 * ENV=preprod npx playwright test --project=chromium-agent
 *
 * BASE_URL always wins if set explicitly (useful for one-off overrides).
 */
const ENVIRONMENTS: Record<string, string> = {
  qa: 'https://app.qa.homey.co.uk',
  preprod: 'https://app.preprod.homey.co.uk',
  reviewapp: 'https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com',
  local: 'http://localhost:3000',
};

/**
 * Connectere subdomain — used for the panel manager / agent lead creation wizard.
 * Lead creation happens at connectere.<subdomain>.homey.co.uk, NOT app.<subdomain>.
 */
const CONNECTERE_ENVIRONMENTS: Record<string, string> = {
  qa: 'https://connectere.qa.homey.co.uk',
  preprod: 'https://connectere.preprod.homey.co.uk',
  local: 'http://localhost:3001',
};

const ENV = (process.env.ENV || 'local').toLowerCase();

const BASE_URL =
  process.env.BASE_URL ||          // explicit override always wins
  ENVIRONMENTS[ENV] ||             // lookup from ENV shorthand
  ENVIRONMENTS.local;              // fallback

const CONNECTERE_URL =
  process.env.CONNECTERE_URL ||
  CONNECTERE_ENVIRONMENTS[ENV] ||
  CONNECTERE_ENVIRONMENTS.local;

/** Auth page path — Homey uses /auth (not the Rails default /users/sign_in) */
export const AUTH_PATH = '/auth';

console.log(`[playwright.config] ENV=${ENV} BASE_URL=${BASE_URL} CONNECTERE_URL=${CONNECTERE_URL}`);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Record screenshots for ALL tests (pass + fail)
    screenshot: 'on',
    // Record video for ALL tests (pass + fail)
    // Videos are saved to test-results/<test-name>/video.webm
    video: 'on',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    storageState: process.env.STORAGE_STATE || undefined,
  },
  projects: [
    // ── Setup project: authenticates and saves storage state ────────────
    // IMPORTANT: testDir is overridden to '.' so Playwright can find
    // fixtures/auth.setup.ts which lives outside the default ./tests dir.
    {
      name: 'setup',
      testDir: '.',
      testMatch: '**/fixtures/auth.setup.ts',
    },

    // ── Agent role tests ────────────────────────────────────────────────
    // Covers: auth login, enquiry creation/filtering, conveyance detail
    {
      name: 'chromium-agent',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
      },
      dependencies: ['setup'],
      testMatch: [
        '**/tests/auth/**',
        '**/tests/enquiries/**',
        '**/tests/conveyances/**',
      ],
    },

    // ── Solicitor role tests ────────────────────────────────────────────
    // Covers: action centre, KYC workflow
    {
      name: 'chromium-solicitor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/solicitor.json',
      },
      dependencies: ['setup'],
      testMatch: [
        '**/tests/actionCenter/**',
        '**/tests/kyc/**',
      ],
    },

    // ── Buyer role tests ────────────────────────────────────────────────
    // Covers: Stripe payments, quote generator
    {
      name: 'chromium-buyer',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/buyer.json',
      },
      dependencies: ['setup'],
      testMatch: [
        '**/tests/payments/**',
        '**/tests/quotes/**',
      ],
    },

    // ── Admin role tests ────────────────────────────────────────────────
    // Covers: visual regression tests (solicitor + agent views)
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: [
        '**/tests/visual/**',
      ],
    },

    // ── Panel Manager / Agent (Connectere) — Lead creation tests ────────
    // Creates Sale, Purchase, Remortgage, Transfer of Equity, Sale & Purchase leads.
    // Runs against connectere.<env>.homey.co.uk (different subdomain from app.*).
    {
      name: 'chromium-panel-manager',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: CONNECTERE_URL,
        storageState: 'playwright/.auth/panel_manager.json',
      },
      dependencies: ['setup'],
      testMatch: [
        '**/tests/leads/**',
      ],
    },

    // ── Accessibility tests (Phase 8) ───────────────────────────────────
    // Runs as agent so pages render with real data.
    // Uses axe-core via @axe-core/playwright to enforce WCAG 2.1 AA.
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/accessibility/**'],
    },

    // ── Performance baseline tests (Phase 7) ───────────────────────────
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
        serviceWorkers: 'block',
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/performance/**'],
      fullyParallel: false,
    },
  ],

  // Start local dev server automatically when running locally
  webServer: (ENV === 'local' && !process.env.CI) ? {
    command: 'echo "Using existing local server"',
    url: BASE_URL,
    reuseExistingServer: true,
  } : undefined,
});
