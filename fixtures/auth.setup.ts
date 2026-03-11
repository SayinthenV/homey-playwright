import { test as setup, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../helpers/AuthHelper';

/**
 * auth.setup.ts
 * -------------
 * Playwright "setup" project that runs ONCE before all test projects.
 * Logs in as each role and saves browser storage state to disk.
 *
 * Storage state files: playwright/.auth/{role}.json
 *
 * NOTE: buyer/seller auth failures are NON-FATAL — they skip gracefully
 * so that agent, solicitor, admin, and panel_manager tests still run.
 */

const authHelper = new AuthHelper();

// -- Agent ---
setup('authenticate as agent', async ({ page }) => {
    const user = TEST_USERS.agent;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
    await authHelper.saveStorageState(page.context(), 'agent');
    console.log('[setup] Agent auth state saved');
});

// -- Solicitor ---
setup('authenticate as solicitor', async ({ page }) => {
    const user = TEST_USERS.solicitor;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
    await authHelper.saveStorageState(page.context(), 'solicitor');
    console.log('[setup] Solicitor auth state saved');
});

// -- Buyer (non-fatal: invalid creds on QA are skipped gracefully) ---
setup('authenticate as buyer', async ({ page }) => {
    try {
          const user = TEST_USERS.buyer;
          await authHelper.loginViaUI(page, user);
          await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
          await authHelper.saveStorageState(page.context(), 'buyer');
          console.log('[setup] Buyer auth state saved');
    } catch (err) {
          console.warn('[setup] Buyer auth SKIPPED (credentials may be invalid on this env):', (err as Error).message);
          // Write an empty auth state so dependent projects can still start
      await authHelper.saveStorageState(page.context(), 'buyer');
    }
});

// -- Admin ---
setup('authenticate as admin', async ({ page }) => {
    const user = TEST_USERS.admin;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
    await authHelper.saveStorageState(page.context(), 'admin');
    console.log('[setup] Admin auth state saved');
});

// -- Panel Manager (Connectere) ---
// The panel manager logs in via app.*.homey.co.uk/auth (same auth endpoint),
// but tests run against connectere.*.homey.co.uk (lead creation wizard).
// The session cookie is shared across subdomains so one login covers both.
setup('authenticate as panel manager', async ({ page }) => {
    const user = TEST_USERS.panel_manager;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
    await authHelper.saveStorageState(page.context(), 'panel_manager');
    console.log('[setup] Panel Manager auth state saved -> playwright/.auth/panel_manager.json');
});
