import { request as playwrightRequest } from '@playwright/test';

/**
 * ThirdfortMocker
 * ---------------
 * Simulates Thirdfort webhook callbacks in test/QA environments.
 * Allows tests to trigger KYC check completions without real Thirdfort accounts.
 *
 * Usage:
 *   const mocker = new ThirdfortMocker();
 *   await mocker.simulateCheckPassed(checkId);  // triggers webhook → status = passed
 *   await mocker.simulateCheckFailed(checkId);  // triggers webhook → status = failed
 *
 * Requires: QA environment must have THIRDFORT_WEBHOOK_SECRET set.
 * Homey webhook endpoint: POST /webhooks/thirdfort
 */

export type KYCCheckStatus = 'passed' | 'failed' | 'expired' | 'cancelled';
export type KYCCheckType = 'identity' | 'aml' | 'source_of_funds';

export interface ThirdfortWebhookPayload {
    event: string;
    check_id: string;
    status: KYCCheckStatus;
    check_type: KYCCheckType;
    completed_at: string;
    party: {
      first_name: string;
      last_name: string;
      email: string;
    };
    results?: {
      identity_verified: boolean;
      aml_cleared: boolean;
      risk_level: 'low' | 'medium' | 'high';
    };
}

export class ThirdfortMocker {
    private readonly baseURL: string;
    private readonly webhookSecret: string;

  constructor() {
        this.baseURL = process.env.BASE_URL || 'http://localhost:3000';
        this.webhookSecret = process.env.THIRDFORT_WEBHOOK_SECRET_TEST || 'test_webhook_secret';
  }

  /**
     * Sends a simulated Thirdfort webhook to Homey's /webhooks/thirdfort endpoint.
     * Only works in test/QA environments where the mock webhook endpoint is enabled.
     */
  async sendWebhook(payload: ThirdfortWebhookPayload): Promise<void> {
        const apiContext = await playwrightRequest.newContext();

      const response = await apiContext.post(
              `${this.baseURL}/webhooks/thirdfort`,
        {
                  data: payload,
                  headers: {
                              'Content-Type': 'application/json',
                              'X-Thirdfort-Signature': this.generateSignature(JSON.stringify(payload)),
                              'X-Test-Webhook': 'true', // Homey checks this header in test env
                  },
        }
            );

      await apiContext.dispose();

      if (!response.ok()) {
              const body = await response.text();
              throw new Error(`Thirdfort webhook failed (${response.status()}): ${body}`);
      }
  }

  /**
     * Simulates a KYC check completing with PASSED status.
     */
  async simulateCheckPassed(checkId: string, partyDetails?: {
        firstName?: string;
        lastName?: string;
        email?: string;
  }): Promise<void> {
        await this.sendWebhook({
                event: 'check.completed',
                check_id: checkId,
                status: 'passed',
                check_type: 'identity',
                completed_at: new Date().toISOString(),
                party: {
                          first_name: partyDetails?.firstName || 'Test',
                          last_name: partyDetails?.lastName || 'User',
                          email: partyDetails?.email || 'test@example.com',
                },
                results: {
                          identity_verified: true,
                          aml_cleared: true,
                          risk_level: 'low',
                },
        });
  }

  /**
     * Simulates a KYC check completing with FAILED status.
     */
  async simulateCheckFailed(checkId: string, partyDetails?: {
        firstName?: string;
        lastName?: string;
        email?: string;
  }): Promise<void> {
        await this.sendWebhook({
                event: 'check.completed',
                check_id: checkId,
                status: 'failed',
                check_type: 'identity',
                completed_at: new Date().toISOString(),
                party: {
                          first_name: partyDetails?.firstName || 'Test',
                          last_name: partyDetails?.lastName || 'User',
                          email: partyDetails?.email || 'test@example.com',
                },
                results: {
                          identity_verified: false,
                          aml_cleared: false,
                          risk_level: 'high',
                },
        });
  }

  /**
     * Simulates check expiry.
     */
  async simulateCheckExpired(checkId: string): Promise<void> {
        await this.sendWebhook({
                event: 'check.expired',
                check_id: checkId,
                status: 'expired',
                check_type: 'identity',
                completed_at: new Date().toISOString(),
                party: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
        });
  }

  /**
     * Generates a simple HMAC-like signature for test webhooks.
     * In production, Thirdfort signs with a real secret key.
     */
  private generateSignature(payload: string): string {
        // For test environments, Homey accepts a simple test signature
      return `test_sig_${Buffer.from(payload.slice(0, 32)).toString('base64')}`;
  }
}
