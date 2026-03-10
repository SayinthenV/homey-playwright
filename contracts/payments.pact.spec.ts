import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import axios from 'axios';
import { makeProvider, homeyHeaders, paymentIntentShape, kycSessionShape } from '../helpers/PactHelper';

const M = MatchersV3;

// ── Payment Intents consumer contract ────────────────────────────────────────
describe('HomeyPaymentsAPI — consumer contract', () => {
    let provider: PactV3;

           beforeAll(() => {
                 provider = makeProvider('HomeyUI', 'HomeyPaymentsAPI');
           });

           afterAll(() => provider.finalize?.());

           // POST /api/v1/payment_intents
           it('creates a Stripe payment intent for a conveyance', () => {
                 return provider
                   .given('a conveyance with id 1 exists and requires payment')
                   .uponReceiving('a POST request to create a payment intent')
                   .withRequest({
                             method: 'POST',
                             path: '/api/v1/payment_intents',
                             headers: homeyHeaders,
                             body: {
                                         conveyance_id: M.integer(1),
                                         amount_pence: M.integer(150000),
                                         currency: M.string('gbp'),
                             },
                   })
                   .willRespondWith({
                             status: 201,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: paymentIntentShape(M),
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.post(
                                         `${mockserver.url}/api/v1/payment_intents`,
                               { conveyance_id: 1, amount_pence: 150000, currency: 'gbp' },
                               { headers: homeyHeaders },
                                       );
                             expect(res.status).toBe(201);
                             expect(res.data.client_secret).toBeDefined();
                             expect(res.data.stripe_payment_intent_id).toBeDefined();
                   });
           });

           // GET /api/v1/payment_intents/:id
           it('retrieves an existing payment intent', () => {
                 return provider
                   .given('a payment intent with id pi_1 exists')
                   .uponReceiving('a GET request for payment intent pi_1')
                   .withRequest({
                             method: 'GET',
                             path: '/api/v1/payment_intents/pi_1',
                             headers: homeyHeaders,
                   })
                   .willRespondWith({
                             status: 200,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: paymentIntentShape(M),
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.get(`${mockserver.url}/api/v1/payment_intents/pi_1`, {
                                         headers: homeyHeaders,
                             });
                             expect(res.status).toBe(200);
                             expect(res.data.status).toBeDefined();
                   });
           });

           // GET /api/v1/payment_intents/:id — not found
           it('returns 404 when payment intent does not exist', () => {
                 return provider
                   .given('no payment intent with id pi_missing exists')
                   .uponReceiving('a GET request for a missing payment intent')
                   .withRequest({
                             method: 'GET',
                             path: '/api/v1/payment_intents/pi_missing',
                             headers: homeyHeaders,
                   })
                   .willRespondWith({
                             status: 404,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: { error: M.string('Not found') },
                   })
                   .executeTest(async (mockserver) => {
                             try {
                                         await axios.get(`${mockserver.url}/api/v1/payment_intents/pi_missing`, {
                                                       headers: homeyHeaders,
                                         });
                             } catch (err: any) {
                                         expect(err.response.status).toBe(404);
                             }
                   });
           });

           // PATCH /api/v1/payment_intents/:id/confirm
           it('confirms a payment intent after Stripe 3DS', () => {
                 return provider
                   .given('payment intent pi_1 is awaiting confirmation')
                   .uponReceiving('a PATCH request to confirm payment intent pi_1')
                   .withRequest({
                             method: 'PATCH',
                             path: '/api/v1/payment_intents/pi_1/confirm',
                             headers: homeyHeaders,
                             body: { payment_method_id: M.string('pm_card_visa') },
                   })
                   .willRespondWith({
                             status: 200,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: {
                                         ...paymentIntentShape(M),
                                         status: M.string('succeeded'),
                             },
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.patch(
                                         `${mockserver.url}/api/v1/payment_intents/pi_1/confirm`,
                               { payment_method_id: 'pm_card_visa' },
                               { headers: homeyHeaders },
                                       );
                             expect(res.status).toBe(200);
                             expect(res.data.status).toBe('succeeded');
                   });
           });
});

// ── KYC Sessions consumer contract ───────────────────────────────────────────
describe('HomeyKycAPI — consumer contract', () => {
    let provider: PactV3;

           beforeAll(() => {
                 provider = makeProvider('HomeyUI', 'HomeyKycAPI');
           });

           afterAll(() => provider.finalize?.());

           // POST /api/v1/kyc_sessions
           it('creates a KYC session for a buyer', () => {
                 return provider
                   .given('a buyer with id 5 exists and requires KYC')
                   .uponReceiving('a POST request to create a KYC session')
                   .withRequest({
                             method: 'POST',
                             path: '/api/v1/kyc_sessions',
                             headers: homeyHeaders,
                             body: {
                                         user_id: M.integer(5),
                                         conveyance_id: M.integer(1),
                             },
                   })
                   .willRespondWith({
                             status: 201,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: kycSessionShape(M),
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.post(
                                         `${mockserver.url}/api/v1/kyc_sessions`,
                               { user_id: 5, conveyance_id: 1 },
                               { headers: homeyHeaders },
                                       );
                             expect(res.status).toBe(201);
                             expect(res.data.redirect_url).toBeDefined();
                             expect(res.data.session_token).toBeDefined();
                   });
           });

           // GET /api/v1/kyc_sessions/:id
           it('retrieves KYC session status', () => {
                 return provider
                   .given('KYC session kyc_abc exists')
                   .uponReceiving('a GET request for KYC session kyc_abc')
                   .withRequest({
                             method: 'GET',
                             path: '/api/v1/kyc_sessions/kyc_abc',
                             headers: homeyHeaders,
                   })
                   .willRespondWith({
                             status: 200,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: kycSessionShape(M),
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.get(`${mockserver.url}/api/v1/kyc_sessions/kyc_abc`, {
                                         headers: homeyHeaders,
                             });
                             expect(res.status).toBe(200);
                             expect(res.data.status).toBeDefined();
                   });
           });

           // POST /api/v1/kyc_sessions/webhook — Thirdfort webhook callback
           it('accepts a Thirdfort KYC webhook for status update', () => {
                 return provider
                   .given('Thirdfort sends a KYC completed webhook')
                   .uponReceiving('a POST webhook request from Thirdfort for KYC completion')
                   .withRequest({
                             method: 'POST',
                             path: '/api/v1/kyc_sessions/webhook',
                             headers: {
                                         'Content-Type': M.regex('application/json.*', 'application/json'),
                                         'X-Thirdfort-Signature': M.string('sha256=abc123'),
                             },
                             body: {
                                         event: M.string('kyc.completed'),
                                         session_token: M.string('kyc_abc'),
                                         result: M.string('pass'),
                                         completed_at: M.iso8601DateTime('2024-01-15T10:30:00Z'),
                             },
                   })
                   .willRespondWith({
                             status: 200,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: { received: M.boolean(true) },
                   })
                   .executeTest(async (mockserver) => {
                             const res = await axios.post(
                                         `${mockserver.url}/api/v1/kyc_sessions/webhook`,
                               {
                                             event: 'kyc.completed',
                                             session_token: 'kyc_abc',
                                             result: 'pass',
                                             completed_at: '2024-01-15T10:30:00Z',
                               },
                               {
                                             headers: {
                                                             'Content-Type': 'application/json',
                                                             'X-Thirdfort-Signature': 'sha256=abc123',
                                             },
                               },
                                       );
                             expect(res.status).toBe(200);
                             expect(res.data.received).toBe(true);
                   });
           });

           // POST /api/v1/kyc_sessions/webhook — invalid signature
           it('rejects a Thirdfort webhook with invalid signature', () => {
                 return provider
                   .given('an invalid Thirdfort webhook signature is provided')
                   .uponReceiving('a POST webhook request with bad signature')
                   .withRequest({
                             method: 'POST',
                             path: '/api/v1/kyc_sessions/webhook',
                             headers: {
                                         'Content-Type': M.regex('application/json.*', 'application/json'),
                                         'X-Thirdfort-Signature': M.string('sha256=invalid'),
                             },
                             body: M.like({ event: 'kyc.completed' }),
                   })
                   .willRespondWith({
                             status: 401,
                             headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                             body: { error: M.string('Invalid signature') },
                   })
                   .executeTest(async (mockserver) => {
                             try {
                                         await axios.post(
                                                       `${mockserver.url}/api/v1/kyc_sessions/webhook`,
                                           { event: 'kyc.completed' },
                                           {
                                                           headers: {
                                                                             'Content-Type': 'application/json',
                                                                             'X-Thirdfort-Signature': 'sha256=invalid',
                                                           },
                                           },
                                                     );
                             } catch (err: any) {
                                         expect(err.response.status).toBe(401);
                             }
                   });
           });
});
