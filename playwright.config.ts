import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

/**
 * ─── Environment resolution ────────────────────────────────────────────────────
 *
 * Set the ENV variable to target a specific environment:
 *
 *   ENV=qa      → https://app.qa.homey.co.uk
 *   ENV=preprod → https://app.preprod.homey.co.uk
 *   ENV=local   → http://localhost:3000 (default)
 */
const ENVIRONMENTS: Record<string, string> = {
    qa: 'https://app.qa.homey.co.uk',
    preprod: 'https://app.preprod.homey.co.uk',
    reviewapp: 'https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com',
    local: 'http://localhost:3000',
};

/**
 * Connectere subdomain — used for the panel manager / agent lead creation wizard.
 */
const CONNECTERE_ENVIRONMENTS: Record<string, string> = {
    qa: 'https://connectere.qa.homey.co.uk',
    preprod: 'https://connectere.preprod.homey.co.uk',
    local: 'http://localhost:3001',
};

const ENV = (process.env.ENV || 'local').toLowerCase();
const BASE_URL =
    process.env.BASE_URL ||
    ENVIRONMENTS[ENV] ||
    ENVIRONMENTS.local;

const CONNECTERE_URL =
    process.env.CONNECTERE_URL ||
    CONNECTERE_ENVIRONMENTS[ENV] ||
    CONNECTERE_ENVIRONMENTS.local;

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
          screenshot: 'on',
          video: 'on',
          actionTimeout: 15_000,
          navigationTimeout: 30_000,
          storageState: process.env.STORAGE_STATE || undefined,
    },
    projects: [
          // ── Setup project: authenticates ALL roles ────────────────────────────
      {
              name: 'setup',
              testDir: '.',
              testMatch: '**/fixtures/auth.setup.ts',
      },

          // ── Panel Manager setup only — isolated so buyer failure cannot block it
      {
              name: 'setup-panel-manager',
              testDir: '.',
              testMatch: '**/fixtures/panel-manager.setup.ts',
      },

          // ── Agent role tests ──────────────────────────────────────────────────
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

          // ── Solicitor role tests ──────────────────────────────────────────────
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

          // ── Buyer role tests ──────────────────────────────────────────────────
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

          // ── Admin role tests ──────────────────────────────────────────────────
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

          // ── Panel Manager / Agent (Connectere) — Lead creation tests ──────────
          // Uses its OWN isolated setup so buyer auth failure cannot block this.
          // Runs against connectere.<env>.homey.co.uk
      {
              name: 'chromium-panel-manager',
              use: {
                        ...devices['Desktop Chrome'],
                        baseURL: CONNECTERE_URL,
                        storageState: 'playwright/.auth/panel_manager.json',
              },
              dependencies: ['setup-panel-manager'],
              testMatch: [
                        '**/tests/leads/**',
                      ],
      },

          // ── Accessibility tests ───────────────────────────────────────────────
      {
              name: 'accessibility',
              use: {
                        ...devices['Desktop Chrome'],
                        storageState: 'playwright/.auth/agent.json',
              },
              dependencies: ['setup'],
              testMatch: ['**/tests/accessibility/**'],
      },

          // ── Performance tests ─────────────────────────────────────────────────
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

    webServer: (ENV === 'local' && !process.env.CI)
      ? {
                command: 'echo "Using existing local server"',
                url: BASE_URL,
                reuseExistingServer: true,
      }
          : undefined,
});
