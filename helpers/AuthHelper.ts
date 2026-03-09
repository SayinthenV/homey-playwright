import { BrowserContext, Page, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * AuthHelper
 * ----------
 * Handles authentication for Homey tests.
 *
 * Strategy:
 *   1. API login (POST /api/v2/auth/sign_in) to get JWT token
 *   2. Save browser storage state (cookies + localStorage) to a file
 *   3. Tests load from that file — bypassing the UI login page entirely
 *
 * This makes tests ~3-5x faster by skipping login UI on every test.
 * Auth state files live in: playwright/.auth/{role}.json
 */

export interface HomeyUser {
    email: string;
    password: string;
    role: 'agent' | 'solicitor' | 'buyer' | 'seller' | 'panel_manager' | 'admin';
}

export const TEST_USERS: Record<string, HomeyUser> = {
    agent: {
          email: process.env.TEST_AGENT_EMAIL || 'agent@test.homey.com',
          password: process.env.TEST_AGENT_PASSWORD || 'test_password',
          role: 'agent',
    },
    solicitor: {
          email: process.env.TEST_SOLICITOR_EMAIL || 'solicitor@test.homey.com',
          password: process.env.TEST_SOLICITOR_PASSWORD || 'test_password',
          role: 'solicitor',
    },
    buyer: {
          email: process.env.TEST_BUYER_EMAIL || 'buyer@test.homey.com',
          password: process.env.TEST_BUYER_PASSWORD || 'test_password',
          role: 'buyer',
    },
    seller: {
          email: process.env.TEST_SELLER_EMAIL || 'seller@test.homey.com',
          password: process.env.TEST_SELLER_PASSWORD || 'test_password',
          role: 'seller',
    },
    panel_manager: {
          email: process.env.TEST_PANEL_MANAGER_EMAIL || 'panel@test.homey.com',
          password: process.env.TEST_PANEL_MANAGER_PASSWORD || 'test_password',
          role: 'panel_manager',
    },
    admin: {
          email: process.env.TEST_ADMIN_EMAIL || 'admin@test.homey.com',
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
     * Authenticates via Homey's API v2 and returns the JWT token.
     * Does NOT touch the browser — pure HTTP request.
     */
  async getJwtToken(user: HomeyUser): Promise<string> {
        const apiContext = await request.newContext({
                baseURL: this.baseURL,
        });

      const response = await apiContext.post('/api/v2/auth/sign_in', {
              data: {
                        user: {
                                    email: user.email,
                                    password: user.password,
                        },
              },
              headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
              },
      });

      if (!response.ok()) {
              const body = await response.text();
              throw new Error(
                        `Auth failed for ${user.email} (${response.status()}): ${body}`
                      );
      }

      const data = await response.json();
        // Homey API v2 returns: { token: "...", user: { ... } }
      const token = data.token || data.access_token;
        if (!token) {
                throw new Error(`No token in auth response: ${JSON.stringify(data)}`);
        }

      await apiContext.dispose();
        return token;
  }

  /**
     * Full browser login via UI — use only in auth setup, not in tests.
     * Saves browser storage state to playwright/.auth/{role}.json
     */
  async loginViaUI(page: Page, user: HomeyUser): Promise<void> {
        await page.goto('/users/sign_in');
        await page.getByLabel(/email/i).fill(user.email);
        await page.getByLabel(/password/i).fill(user.password);
        await page.getByRole('button', { name: /sign in/i }).click();

      // Wait until redirected away from sign_in
      await page.waitForURL((url) => !url.pathname.includes('sign_in'), {
              timeout: 20_000,
      });
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

      const stats = fs.statSync(filePath);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        return ageHours < maxAgeHours;
  }
}
