import path from 'path';

/**
 * PactHelper
 * Centralises Pact consumer configuration for the Homey test suite.
 * Provides shared matchers, headers, and factory methods for common
 * Homey API response shapes used across contract specs.
 */

export const PACT_OUTPUT_DIR = path.join(process.cwd(), 'pacts');

export function pactConfig(consumer: string, provider: string) {
    return {
          consumer,
          provider,
          dir: PACT_OUTPUT_DIR,
          logLevel: 'warn' as const,
    };
}

export const homeyHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
};

export async function getMatchers() {
    const { MatchersV3 } = await import('@pact-foundation/pact');
    return MatchersV3;
}

export function enquiryShape(M: any) {
    return {
          id: M.integer(1),
          reference: M.string('ENQ-001'),
          status: M.string('pending'),
          property_type: M.string('house'),
          property_address: M.string('10 Test Street, London, SW1A 1AA'),
          purchase_price: M.decimal(350000),
          created_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
          updated_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
    };
}

export function conveyanceShape(M: any) {
    return {
          id: M.integer(1),
          reference: M.string('CONV-001'),
          status: M.string('active'),
          enquiry_id: M.integer(1),
          solicitor_id: M.integer(1),
          created_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
          updated_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
    };
}

export function quoteShape(M: any) {
    return {
          id: M.integer(1),
          conveyance_id: M.integer(1),
          total_fee: M.decimal(1500.0),
          status: M.string('draft'),
          created_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
    };
}

export function paymentIntentShape(M: any) {
    return {
          id: M.string('pi_test_123'),
          client_secret: M.string('pi_test_123_secret'),
          amount: M.integer(150000),
          currency: M.string('gbp'),
          status: M.string('requires_payment_method'),
    };
}

export function paginatedListShape(M: any, itemShape: object) {
    return {
          data: M.eachLike(itemShape),
          meta: {
                  current_page: M.integer(1),
                  total_pages: M.integer(1),
                  total_count: M.integer(1),
                  per_page: M.integer(25),
          },
    };
}

export function validationErrorShape(M: any) {
    return {
          errors: M.eachLike({
                  field: M.string('property_address'),
                  message: M.string("can't be blank"),
          }),
    };
}

export function notFoundShape(M: any) {
    return {
          error: M.string('Not found'),
          status: M.integer(404),
    };
}
