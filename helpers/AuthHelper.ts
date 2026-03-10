import { BrowserContext, Page, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * AuthHelper
 * ----------
 * Handles authentication for Homey tests.
 *
 * Strategy:
 * 1. Browser UI login via /auth (Homey's Devise sign-in page)
 * 2. Save browser storage state (cookies + localStorage) to a file
 * 3. Tests load from that file — bypassing the UI login page entirely
 *
 * This makes tests ~3-5x faster by skipping login UI on every test.
 * Auth state files live in: playwright/.auth/{role}.json
 *
 * Supported environments (set via ENV variable):
 *   ENV=qa        → https://app.qa.homey.co.uk
 *   ENV=preprod   → https://app.preprod.homey.co.uk
 *   ENV=reviewapp → https://homey-tv-86ev94a8a-ccl--6ewkll.herokuapp.com
 *   ENV=local     → http://localhost:3000  (default)
 */

/** Homey's sign-in page path across all environments */
export const AUTH_PATH = '/auth';

export interface HomeyUser {
  email: string;
  password: string;
  role: 'agent' | 'solicitor' | 'buyer' | 'seller' | 'panel_manager' | 'admin';
}

export const TEST_USERS: Record<string, HomeyUser> = {
  agent: {
    email:    process.env.TEST_AGENT_EMAIL    || 'agent@test.homey.com',
    password: process.env.TEST_AGENT_PASSWORD || 'test_password',
    role: 'agent',
  },
  solicitor: {
    email:    process.env.TEST_SOLICITOR_EMAIL    || 'solicitor@test.homey.com',
    password: process.env.TEST_SOLICITOR_PASSWORD || 'test_password',
    role: 'solicitor',
  },
  buyer: {
    email:    process.env.TEST_BUYER_EMAIL    || 'buyer@test.homey.com',
    password: process.env.TEST_BUYER_PASSWORD || 'test_password',
    role: 'buyer',
  },
  seller: {
    email:    process.env.TEST_SELLER_EMAIL    || 'seller@test.homey.com',
    password: process.env.TEST_SELLER_PASSWORD || 'test_password',
    role: 'seller',
  },
  panel_manager: {
    email:    process.env.TEST_PANEL_MANAGER_EMAIL    || 'panel@test.homey.com',
    password: process.env.TEST_PANEL_MANAGER_PASSWORD || 'test_password',
    role: 'panel_manager',
  },
  admin: {
    email:    process.env.TEST_ADMIN_EMAIL    || 'admin@test.homey.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'test_password',
    role: 'admin',
  },
};

export class AuthHelper {
  private readonly baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * Authenticates via Homey's API and returns the JWT token.
   * Does NOT touch the browser — pure HTTP request.
   */
  async getJwtToken(user: HomeyUser): Promise<string> {
    const apiContext = await request.newContext({ baseURL: this.baseURL });

    const response = await apiContext.post('/api/v2/auth/sign_in', {
      data: {
        user: {
          email:    user.email,
          password: user.password,
        },
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Auth failed for ${user.email} (${response.status()}): ${body}`);
    }

    const data  = await response.json();
    const token = data.token || data.access_token;

    if (!token) {
      throw new Error(`No token in auth response: ${JSON.stringify(data)}`);
    }

    await apiContext.dispose();
    return token;
  }

  /**
   * Full browser login via the Homey /auth page.
   * Use only in auth.setup.ts (not in individual tests).
   * Saves browser storage state to playwright/.auth/{role}.json
   *
   * QA/PrePROD/ReviewApp notes (verified against live QA page):
   *   - Email field uses type="text" (NOT type="email")
   *   - Email label text is "Email Address *"
   *   - Submit button text is "Continue" (NOT "Sign in" or "Log in")
   */
  async loginViaUI(page: Page, user: HomeyUser): Promise<void> {
    await page.goto(AUTH_PATH);

    // Wait for the sign-in form to be fully loaded
    await page.waitForLoadState('networkidle');

    // QA/PrePROD use label "Email Address *" on a type="text" input (not type="email")
    const emailInput = page
      .getByLabel(/email address/i)
      .or(page.locator('input[type="text"]'))
      .first();

    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[type="password"]'))
      .first();

    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);

    // Homey QA uses "Continue" as the submit button text (verified on live QA page)
    await page
      .getByRole('button', { name: /continue|sign in|log in|login/i })
      .click();

    // Wait until redirected away from the /auth page
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/auth'),
      { timeout: 30_000 },
    );

    console.log(`[${user.role}] Logged in — now at: ${page.url()}`);
  }

  /**
   * Saves the current browser context state (cookies, localStorage, sessionStorage)
   * to a file. Used by auth.setup.ts to persist auth across test runs.
   */
  async saveStorageState(context: BrowserContext, role: string): Promise<string> {
    const authDir = path.join(process.cwd(), 'playwright', '.auth');

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const filePath = path.join(authDir, `${role}.json`);
    await context.storageState({ path: filePath });
    return filePath;
  }

  /**
   * Returns the path to a saved auth state file.
   */
  static authStatePath(role: string): string {
    return path.join(process.cwd(), 'playwright', '.auth', `${role}.json`);
  }

  /**
   * Checks if an auth state file exists and is less than N hours old.
   * Used to decide whether to re-run authentication setup.
   */
  static isAuthStateValid(role: string, maxAgeHours = 8): boolean {
    const filePath = AuthHelper.authStatePath(role);
    if (!fs.existsSync(filePath)) return false;
    const stats    = fs.statSync(filePath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    return ageHours < maxAgeHours;
  }
}
