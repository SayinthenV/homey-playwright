import { Page, Locator, expect } from '@playwright/test';

/**
 * LoginPage
 * ---------
 * Covers Homey's Devise-based sign-in screen.
 * Route: /users/sign_in
 */
export class LoginPage {
    readonly page: Page;

  // ── Form fields ──────────────────────────────────────────────
  readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;
    readonly rememberMeCheckbox: Locator;

  // ── Links ────────────────────────────────────────────────────
  readonly forgotPasswordLink: Locator;

  // ── Errors ───────────────────────────────────────────────────
  readonly errorAlert: Locator;

  constructor(page: Page) {
        this.page = page;

      this.emailInput = page.getByLabel(/email/i);
        this.passwordInput = page.getByLabel(/password/i);
        this.signInButton = page.getByRole('button', { name: /sign in/i });
        this.rememberMeCheckbox = page.getByLabel(/remember me/i);
        this.forgotPasswordLink = page.getByRole('link', { name: /forgot.*password/i });
        this.errorAlert = page.getByTestId('devise-error-alert');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(): Promise<void> {
        await this.page.goto('/users/sign_in');
        await expect(this.signInButton).toBeVisible();
  }

  // ── Actions ──────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
        // Wait for Turbo Drive redirect after successful auth
      await this.page.waitForURL((url) => !url.pathname.includes('sign_in'), {
              timeout: 15_000,
      });
  }

  async attemptLogin(email: string, password: string): Promise<void> {
        // Like login() but does NOT assert redirect — use when testing failures
      await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.signInButton.click();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectLoginError(message?: string): Promise<void> {
        await expect(this.errorAlert).toBeVisible();
        if (message) {
                await expect(this.errorAlert).toContainText(message);
        }
  }

  async expectRedirectedToDashboard(): Promise<void> {
        await expect(this.page).not.toHaveURL(/sign_in/);
  }

  async expectOnLoginPage(): Promise<void> {
        await expect(this.page).toHaveURL(/sign_in/);
        await expect(this.signInButton).toBeVisible();
  }
}
