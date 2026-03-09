import { test as setup, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../helpers/AuthHelper';

/**
 * auth.setup.ts
 * -------------
 * Playwright "setup" project that runs ONCE before all test projects.
 * Logs in as each role and saves browser storage state to disk.
 *
 * Storage state files: playwright/.auth/{role}.json
 * These are loaded by chromium-agent, chromium-solicitor, etc. projects.
 *
 * Run automatically via: playwright.config.ts → projects[0].name = 'setup'
 */

const authHelper = new AuthHelper();

// ── Agent ────────────────────────────────────────────────────────────────────
setup('authenticate as agent', async ({ page }) => {
    const user = TEST_USERS.agent;
    await authHelper.loginViaUI(page, user);

        // Verify we landed on a valid authenticated page
        await expect(page).not.toHaveURL(/sign_in/);

        // Save storage state (cookies + session)
        await authHelper.saveStorageState(page.context(), 'agent');
    console.log('Agent auth state saved');
});

// ── Solicitor ────────────────────────────────────────────────────────────────
setup('authenticate as solicitor', async ({ page }) => {
    const user = TEST_USERS.solicitor;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/sign_in/);
    await authHelper.saveStorageState(page.context(), 'solicitor');
    console.log('Solicitor auth state saved');
});

// ── Buyer ────────────────────────────────────────────────────────────────────
setup('authenticate as buyer', async ({ page }) => {
    const user = TEST_USERS.buyer;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/sign_in/);
    await authHelper.saveStorageState(page.context(), 'buyer');
    console.log('Buyer auth state saved');
});

// ── Admin ────────────────────────────────────────────────────────────────────
setup('authenticate as admin', async ({ page }) => {
    const user = TEST_USERS.admin;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/sign_in/);
    await authHelper.saveStorageState(page.context(), 'admin');
    console.log('Admin auth state saved');
});
