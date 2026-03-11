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
 * The login page is /auth across all Homey environments:
 * QA → https://app.qa.homey.co.uk/auth
 * PrePROD → https://app.preprod.homey.co.uk/auth
 * ReviewApp → https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com/auth
 * Local → http://localhost:3000/auth
 *
 * Run automatically via: playwright.config.ts → projects[0].name = 'setup'
 */

const authHelper = new AuthHelper();

// ── Agent ──────────────────────────────────────────────────────────────────────
setup('authenticate as agent', async ({ page }) => {
  const user = TEST_USERS.agent;
  await authHelper.loginViaUI(page, user);
  await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
  await authHelper.saveStorageState(page.context(), 'agent');
  console.log('[setup] Agent auth state saved');
});

// ── Solicitor ──────────────────────────────────────────────────────────────────
setup('authenticate as solicitor', async ({ page }) => {
  const user = TEST_USERS.solicitor;
  await authHelper.loginViaUI(page, user);
  await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
  await authHelper.saveStorageState(page.context(), 'solicitor');
  console.log('[setup] Solicitor auth state saved');
});

// ── Buyer ──────────────────────────────────────────────────────────────────────
setup('authenticate as buyer', async ({ page }) => {
  const user = TEST_USERS.buyer;
  await authHelper.loginViaUI(page, user);
  await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
  await authHelper.saveStorageState(page.context(), 'buyer');
  console.log('[setup] Buyer auth state saved');
});

// ── Admin ──────────────────────────────────────────────────────────────────────
setup('authenticate as admin', async ({ page }) => {
  const user = TEST_USERS.admin;
  await authHelper.loginViaUI(page, user);
  await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
  await authHelper.saveStorageState(page.context(), 'admin');
  console.log('[setup] Admin auth state saved');
});

// ── Panel Manager (Connectere) ────────────────────────────────────────────────
// The panel manager logs in via app.*.homey.co.uk/auth (same auth endpoint),
// but tests run against connectere.*.homey.co.uk (lead creation wizard).
// The session cookie is shared across subdomains so one login covers both.
setup('authenticate as panel manager', async ({ page }) => {
  const user = TEST_USERS.panelManager;
  await authHelper.loginViaUI(page, user);
  await expect(page).not.toHaveURL(/\/auth($|\/|\?)/);
  await authHelper.saveStorageState(page.context(), 'panel_manager');
  console.log('[setup] Panel Manager auth state saved → playwright/.auth/panel_manager.json');
});
