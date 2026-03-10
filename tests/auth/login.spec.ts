import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage';
import { TEST_USERS } from '../../helpers/AuthHelper';

/**
 * Login Tests
 * -----------
 * Tests for Homey's Devise-based authentication.
 *
 * Note: These tests intentionally use the UI login flow.
 * Most other test files use pre-saved auth state (playwright/.auth/*.json)
 * and skip the login UI entirely for speed.
 *
 * QA/PrePROD notes (verified on live page):
 *   - Login page is at /auth  (NOT /users/sign_in)
 *   - Unauthenticated redirects go to /auth
 */

test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('shows login form on /auth', async () => {
    await loginPage.expectOnLoginPage();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('agent can sign in with valid credentials', async ({ page }) => {
    const agent = TEST_USERS.agent;
    await loginPage.login(agent.email, agent.password);
    await loginPage.expectRedirectedToDashboard();
    // Should land on enquiries or dashboard
    await expect(page).toHaveURL(/enquiries|dashboard|conveyances/);
  });

  test('solicitor can sign in with valid credentials', async ({ page }) => {
    const solicitor = TEST_USERS.solicitor;
    await loginPage.login(solicitor.email, solicitor.password);
    await loginPage.expectRedirectedToDashboard();
  });

  test('shows error for invalid password', async () => {
    await loginPage.attemptLogin('agent@test.homey.com', 'wrong_password');
    await loginPage.expectLoginError();
    await loginPage.expectOnLoginPage();
  });

  test('shows error for unknown email', async () => {
    await loginPage.attemptLogin('notexist@homey.com', 'any_password');
    await loginPage.expectLoginError();
  });

  test('shows error for empty credentials', async () => {
    await loginPage.attemptLogin('', '');
    // Either stays on page or shows validation error
    await loginPage.expectOnLoginPage();
  });

  test('forgot password link navigates to reset page', async ({ page }) => {
    await loginPage.forgotPasswordLink.click();
    await expect(page).toHaveURL(/password.*new|reset.*password/i);
  });

  test('redirects to /auth when accessing protected page unauthenticated', async ({ page }) => {
    await page.goto('/conveyances');
    // Homey redirects to /auth (not /users/sign_in)
    await expect(page).toHaveURL(/\/auth/);
  });

  test('redirects to /auth when accessing enquiries unauthenticated', async ({ page }) => {
    await page.goto('/enquiries');
    await expect(page).toHaveURL(/\/auth/);
  });
});
