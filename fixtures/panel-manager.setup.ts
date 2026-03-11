import { test as setup, expect } from '@playwright/test';
import { AuthHelper, TEST_USERS } from '../helpers/AuthHelper';

/**
 * panel-manager.setup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated auth setup for the Panel Manager / Connectere agent role ONLY.
 *
 * This is deliberately separate from auth.setup.ts so that failures in other
 * role setups (e.g. buyer with invalid credentials) cannot block the lead
 * creation tests from running.
 *
 * Used by: chromium-panel-manager project (tests/leads/**)
 * Output:  playwright/.auth/panel_manager.json
 *
 * The panel manager logs in via app.*.homey.co.uk/auth and is redirected
 * to connectere.*.homey.co.uk. The session cookie is shared across subdomains.
 */

const authHelper = new AuthHelper();

setup('authenticate as panel manager', async ({ page }) => {
    const user = TEST_USERS.panel_manager;
    await authHelper.loginViaUI(page, user);
    await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
    await authHelper.saveStorageState(page.context(), 'panel_manager');
    console.log('[setup] Panel Manager auth state saved -> playwright/.auth/panel_manager.json');
});
