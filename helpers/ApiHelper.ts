import { APIRequestContext, request } from '@playwright/test';

/**
 * ApiHelper — Homey REST API Test Helper
 *
 * Provides a typed interface to Homey's REST API for:
 * - Fast test setup/teardown without UI interactions
 * - Creating test enquiries and conveyances via API
 * - Cleaning up test data after each test
 * - Reading entity state for assertions
 *
 * Much faster than UI-based setup — use API helpers in beforeAll/afterAll
 * hooks to create the data your tests need, then let the UI tests verify it.
 *
 * Authentication: Uses Devise token-based auth or session cookies
 * from the saved auth state.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiEnquiry {
    id: number;
    reference: string;
    status: string;
    buyer_name: string;
    buyer_email: string;
    property_address: string;
    agreed_price: number;
    created_at: string;
}

export interface ApiConveyance {
    id: number;
    reference: string;
    pipeline_stage: string;
    enquiry_id: number;
    buyer_name: string;
    solicitor_email?: string;
    created_at: string;
}

export interface ApiUser {
    id: number;
    email: string;
    role: string;
    name: string;
}

export interface CreateEnquiryPayload {
    buyer_name: string;
    buyer_email: string;
    buyer_phone?: string;
    seller_name?: string;
    property_address: string;
    property_type?: string;
    agreed_price: number;
    tenure?: string;
}

export interface CreateConveyancePayload {
    enquiry_id: number;
    solicitor_email?: string;
    pipeline_stage?: string;
}

// ─── ApiHelper class ──────────────────────────────────────────────────────────

export class ApiHelper {
    private readonly baseUrl: string;
    private requestContext: APIRequestContext | null = null;
    private authToken: string | null = null;

  // Track created resources for cleanup
  private createdEnquiryIds: number[] = [];
    private createdConveyanceIds: number[] = [];

  constructor() {
        this.baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  }

  /**
     * Initialize the API context with authentication.
     * Call this in beforeAll.
     */
  async init(role: 'agent' | 'solicitor' | 'buyer' | 'admin' = 'agent'): Promise<void> {
        this.requestContext = await request.newContext({
                baseURL: this.baseUrl,
                extraHTTPHeaders: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json',
                          'X-Requested-With': 'XMLHttpRequest',
                },
        });

      // Authenticate using test credentials
      await this.authenticate(role);
  }

  /**
     * Clean up all resources created during the test session.
     * Call this in afterAll.
     */
  async cleanup(): Promise<void> {
        // Delete test conveyances first (depend on enquiries)
      for (const id of this.createdConveyanceIds.reverse()) {
              await this.deleteConveyance(id).catch(err =>
                        console.warn(`[ApiHelper] Failed to delete conveyance ${id}:`, err.message)
                                                          );
      }

      // Then delete test enquiries
      for (const id of this.createdEnquiryIds.reverse()) {
              await this.deleteEnquiry(id).catch(err =>
                        console.warn(`[ApiHelper] Failed to delete enquiry ${id}:`, err.message)
                                                       );
      }

      await this.requestContext?.dispose();
        this.createdEnquiryIds = [];
        this.createdConveyanceIds = [];
  }

  // ─── Authentication ──────────────────────────────────────────────────────

  private async authenticate(role: string): Promise<void> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const credentials = this.getCredentialsForRole(role);
        if (!credentials) {
                console.warn(`[ApiHelper] No credentials found for role: ${role}`);
                return;
        }

      const response = await this.requestContext.post('/users/sign_in', {
              data: {
                        user: {
                                    email: credentials.email,
                                    password: credentials.password,
                        },
              },
      });

      if (!response.ok()) {
              console.warn(`[ApiHelper] Auth failed for ${role}: ${response.status()}`);
              return;
      }

      // Extract auth token from response headers or body
      const authHeader = response.headers()['authorization'];
        if (authHeader) {
                this.authToken = authHeader.replace('Bearer ', '');
        }
  }

  private getCredentialsForRole(role: string): { email: string; password: string } | null {
        const credentials: Record<string, { email: string; password: string } | undefined> = {
                agent: process.env.TEST_AGENT_EMAIL && process.env.TEST_AGENT_PASSWORD
                  ? { email: process.env.TEST_AGENT_EMAIL, password: process.env.TEST_AGENT_PASSWORD }
                          : undefined,
                solicitor: process.env.TEST_SOLICITOR_EMAIL && process.env.TEST_SOLICITOR_PASSWORD
                  ? { email: process.env.TEST_SOLICITOR_EMAIL, password: process.env.TEST_SOLICITOR_PASSWORD }
                          : undefined,
                buyer: process.env.TEST_BUYER_EMAIL && process.env.TEST_BUYER_PASSWORD
                  ? { email: process.env.TEST_BUYER_EMAIL, password: process.env.TEST_BUYER_PASSWORD }
                          : undefined,
                admin: process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD
                  ? { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
                          : undefined,
        };
        return credentials[role] ?? null;
  }

  private getAuthHeaders(): Record<string, string> {
        return this.authToken
          ? { 'Authorization': `Bearer ${this.authToken}` }
                : {};
  }

  // ─── Enquiry API ────────────────────────────────────────────────────────

  /**
     * Create a test enquiry via API.
     * Much faster than filling the 4-step wizard in the UI.
     */
  async createEnquiry(payload: CreateEnquiryPayload): Promise<ApiEnquiry> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized — call init() first');

      const response = await this.requestContext.post('/api/v1/enquiries', {
              data: { enquiry: payload },
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              const body = await response.text();
              throw new Error(`[ApiHelper] Failed to create enquiry: ${response.status()} — ${body}`);
      }

      const enquiry: ApiEnquiry = await response.json();
        this.createdEnquiryIds.push(enquiry.id);
        console.log(`[ApiHelper] Created enquiry: ${enquiry.reference} (ID: ${enquiry.id})`);
        return enquiry;
  }

  /** Get an enquiry by ID */
  async getEnquiry(id: number): Promise<ApiEnquiry> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const response = await this.requestContext.get(`/api/v1/enquiries/${id}`, {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              throw new Error(`[ApiHelper] Failed to get enquiry ${id}: ${response.status()}`);
      }

      return response.json();
  }

  /** Get all enquiries (paginated, returns first page) */
  async getEnquiries(params: { page?: number; per_page?: number } = {}): Promise<ApiEnquiry[]> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const searchParams = new URLSearchParams({
              page: String(params.page ?? 1),
              per_page: String(params.per_page ?? 20),
      });

      const response = await this.requestContext.get(`/api/v1/enquiries?${searchParams}`, {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : data.enquiries ?? [];
  }

  /** Delete an enquiry by ID */
  async deleteEnquiry(id: number): Promise<void> {
        if (!this.requestContext) return;

      const response = await this.requestContext.delete(`/api/v1/enquiries/${id}`, {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              console.warn(`[ApiHelper] Could not delete enquiry ${id}: ${response.status()}`);
      }
  }

  // ─── Conveyance API ───────────────────────────────────────────────────────

  /** Create a conveyance from an existing enquiry */
  async createConveyance(payload: CreateConveyancePayload): Promise<ApiConveyance> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const response = await this.requestContext.post('/api/v1/conveyances', {
              data: { conveyance: payload },
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              const body = await response.text();
              throw new Error(`[ApiHelper] Failed to create conveyance: ${response.status()} — ${body}`);
      }

      const conveyance: ApiConveyance = await response.json();
        this.createdConveyanceIds.push(conveyance.id);
        console.log(`[ApiHelper] Created conveyance: ${conveyance.reference} (ID: ${conveyance.id})`);
        return conveyance;
  }

  /** Get a conveyance by ID */
  async getConveyance(id: number): Promise<ApiConveyance> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const response = await this.requestContext.get(`/api/v1/conveyances/${id}`, {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              throw new Error(`[ApiHelper] Failed to get conveyance ${id}: ${response.status()}`);
      }

      return response.json();
  }

  /** Get all conveyances */
  async getConveyances(): Promise<ApiConveyance[]> {
        if (!this.requestContext) throw new Error('[ApiHelper] Not initialized');

      const response = await this.requestContext.get('/api/v1/conveyances', {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : data.conveyances ?? [];
  }

  /** Delete a conveyance by ID */
  async deleteConveyance(id: number): Promise<void> {
        if (!this.requestContext) return;

      const response = await this.requestContext.delete(`/api/v1/conveyances/${id}`, {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) {
              console.warn(`[ApiHelper] Could not delete conveyance ${id}: ${response.status()}`);
      }
  }

  // ─── User API ─────────────────────────────────────────────────────────────

  /** Get the current authenticated user */
  async getCurrentUser(): Promise<ApiUser | null> {
        if (!this.requestContext) return null;

      const response = await this.requestContext.get('/api/v1/users/me', {
              headers: this.getAuthHeaders(),
      });

      if (!response.ok()) return null;
        return response.json();
  }

  // ─── Utility methods ─────────────────────────────────────────────────────

  /**
     * Ensure at least one enquiry exists for testing.
     * Creates one via API if the list is empty.
     */
  async ensureEnquiryExists(payload?: Partial<CreateEnquiryPayload>): Promise<ApiEnquiry> {
        const existing = await this.getEnquiries({ per_page: 1 });
        if (existing.length > 0) return existing[0];

      return this.createEnquiry({
              buyer_name: payload?.buyer_name ?? 'Test Buyer',
              buyer_email: payload?.buyer_email ?? `test+buyer+${Date.now()}@testmail.homey.dev`,
              property_address: payload?.property_address ?? '45 Oak Street, London, SW1 4AB',
              agreed_price: payload?.agreed_price ?? 350000,
              property_type: payload?.property_type ?? 'Terraced',
              tenure: payload?.tenure ?? 'Freehold',
      });
  }

  /**
     * Ensure at least one conveyance exists for testing.
     * Creates one from an existing or new enquiry if needed.
     */
  async ensureConveyanceExists(): Promise<ApiConveyance> {
        const existing = await this.getConveyances();
        if (existing.length > 0) return existing[0];

      const enquiry = await this.ensureEnquiryExists();
        return this.createConveyance({ enquiry_id: enquiry.id });
  }

  /**
     * Wait for a conveyance to reach a specific pipeline stage.
     * Polls the API until the stage matches or timeout is reached.
     */
  async waitForConveyanceStage(
        id: number,
        stage: string,
        options: { timeout?: number; interval?: number } = {}
      ): Promise<ApiConveyance> {
        const { timeout = 30000, interval = 1000 } = options;
        const deadline = Date.now() + timeout;

      while (Date.now() < deadline) {
              const conveyance = await this.getConveyance(id);
              if (conveyance.pipeline_stage === stage) return conveyance;
              await new Promise(r => setTimeout(r, interval));
      }

      throw new Error(`[ApiHelper] Conveyance ${id} did not reach stage "${stage}" within ${timeout}ms`);
  }

  /**
     * Health check — verify the API is reachable
     */
  async healthCheck(): Promise<boolean> {
        if (!this.requestContext) return false;

      const response = await this.requestContext.get('/api/v1/health', {
              headers: this.getAuthHeaders(),
      }).catch(() => null);

      return response?.ok() ?? false;
  }
}

// Singleton for use across test files
export const apiHelper = new ApiHelper();
