import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

/**
 * Homey Playwright Configuration
 * Supports: local dev, QA, staging, production (read-only)
 */
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
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Pass JWT token via storage state when pre-authenticated
    storageState: process.env.STORAGE_STATE || undefined,
  },
  projects: [
    // ── Setup project: authenticates and saves storage state ──
    {
      name: 'setup',
      testMatch: '**/fixtures/auth.setup.ts',
    },

    // ── Agent role tests ──
    {
      name: 'chromium-agent',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/auth/**', '**/tests/enquiries/**', '**/tests/conveyances/**'],
    },

    // ── Solicitor role tests ──
    {
      name: 'chromium-solicitor',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/solicitor.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/actionCenter/**', '**/tests/kyc/**', '**/tests/documents/**'],
    },

    // ── Buyer role tests ──
    {
      name: 'chromium-buyer',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/buyer.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/payments/**', '**/tests/quotes/**'],
    },

    // ── Admin role tests ──
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/admin/**', '**/tests/multiTenant/**'],
    },

    // ── Performance baseline tests (Phase 7) ──
    // Runs as agent (authenticated) so pages render with real data.
    // Single worker — sequential runs avoid noisy-neighbour CPU contention.
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/agent.json',
        // Disable service workers & caching so each run is a cold load
        serviceWorkers: 'block',
        // Emulate a mid-range laptop (no GPU raster throttling)
        launchOptions: {
          args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/tests/performance/**'],
      // Single worker prevents CPU contention between concurrent page loads
      fullyParallel: false,
    },
  ],

  // Start local dev server automatically when running locally
  webServer: process.env.CI ? undefined : {
    command: 'echo "Using existing server at BASE_URL"',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
