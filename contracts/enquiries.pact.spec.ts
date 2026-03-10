import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import axios from 'axios';
import {
    pactConfig,
    homeyHeaders,
    enquiryShape,
    paginatedListShape,
    validationErrorShape,
    notFoundShape,
} from '../helpers/PactHelper';

const M = MatchersV3;

/**
 * Pact Consumer Contract Tests — Enquiries API
 *
 * These tests define the contract between the Homey Playwright test suite
 * (consumer) and the Homey Rails API (provider) for the Enquiries resource.
 *
 * Run: npm run pact:test
 * Publish: npm run pact:publish
 */

const provider = new PactV3(pactConfig('HomeyPlaywrightConsumer', 'HomeyEnquiriesAPI'));

describe('Homey Enquiries API — Consumer Contract', () => {
    // ─────────────────────────────────────────────────────────────────────────
           // GET /api/v1/enquiries
           // ─────────────────────────────────────────────────────────────────────────

           describe('GET /api/v1/enquiries', () => {
                 it('returns a paginated list of enquiries', async () => {
                         await provider
                           .given('there are enquiries')
                           .uponReceiving('a GET request for enquiry list')
                           .withRequest({
                                       method: 'GET',
                                       path: '/api/v1/enquiries',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: paginatedListShape(M, enquiryShape(M)),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.get(`${mockserver.url}/api/v1/enquiries`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(200);
                                       expect(res.data.data).toBeDefined();
                                       expect(Array.isArray(res.data.data)).toBe(true);
                                       expect(res.data.meta).toBeDefined();
                           });
                 });

                        it('returns filtered enquiries by status', async () => {
                                await provider
                                  .given('there are pending enquiries')
                                  .uponReceiving('a GET request filtering enquiries by status=pending')
                                  .withRequest({
                                              method: 'GET',
                                              path: '/api/v1/enquiries',
                                              query: { status: 'pending' },
                                              headers: homeyHeaders,
                                  })
                                  .willRespondWith({
                                              status: 200,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: paginatedListShape(M, enquiryShape(M)),
                                  })
                                  .executeTest(async (mockserver) => {
                                              const res = await axios.get(`${mockserver.url}/api/v1/enquiries`, {
                                                            params: { status: 'pending' },
                                                            headers: homeyHeaders,
                                              });
                                              expect(res.status).toBe(200);
                                              expect(Array.isArray(res.data.data)).toBe(true);
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // GET /api/v1/enquiries/:id
           // ─────────────────────────────────────────────────────────────────────────

           describe('GET /api/v1/enquiries/:id', () => {
                 it('returns a single enquiry', async () => {
                         await provider
                           .given('an enquiry with id 1 exists')
                           .uponReceiving('a GET request for enquiry id 1')
                           .withRequest({
                                       method: 'GET',
                                       path: '/api/v1/enquiries/1',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: enquiryShape(M),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.get(`${mockserver.url}/api/v1/enquiries/1`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(200);
                                       expect(res.data.id).toBeDefined();
                                       expect(res.data.reference).toBeDefined();
                           });
                 });

                        it('returns 404 when enquiry does not exist', async () => {
                                await provider
                                  .given('enquiry with id 9999 does not exist')
                                  .uponReceiving('a GET request for non-existent enquiry')
                                  .withRequest({
                                              method: 'GET',
                                              path: '/api/v1/enquiries/9999',
                                              headers: homeyHeaders,
                                  })
                                  .willRespondWith({
                                              status: 404,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: notFoundShape(M),
                                  })
                                  .executeTest(async (mockserver) => {
                                              try {
                                                            await axios.get(`${mockserver.url}/api/v1/enquiries/9999`, {
                                                                            headers: homeyHeaders,
                                                            });
                                                            fail('Expected 404 error');
                                              } catch (err: any) {
                                                            expect(err.response.status).toBe(404);
                                              }
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // POST /api/v1/enquiries
           // ─────────────────────────────────────────────────────────────────────────

           describe('POST /api/v1/enquiries', () => {
                 it('creates a new enquiry', async () => {
                         const enquiryBody = {
                                   property_type: 'house',
                                   property_address: '10 Test Street, London, SW1A 1AA',
                                   purchase_price: 350000,
                                   buyer_first_name: 'John',
                                   buyer_last_name: 'Smith',
                                   buyer_email: 'john@example.com',
                         };

                          await provider
                           .given('the user is an authenticated agent')
                           .uponReceiving('a POST request to create an enquiry')
                           .withRequest({
                                       method: 'POST',
                                       path: '/api/v1/enquiries',
                                       headers: homeyHeaders,
                                       body: enquiryBody,
                           })
                           .willRespondWith({
                                       status: 201,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: enquiryShape(M),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.post(`${mockserver.url}/api/v1/enquiries`, enquiryBody, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(201);
                                       expect(res.data.id).toBeDefined();
                                       expect(res.data.reference).toBeDefined();
                           });
                 });

                        it('returns 422 when required fields are missing', async () => {
                                await provider
                                  .given('the user is an authenticated agent')
                                  .uponReceiving('a POST request with missing required fields')
                                  .withRequest({
                                              method: 'POST',
                                              path: '/api/v1/enquiries',
                                              headers: homeyHeaders,
                                              body: { property_type: 'house' },
                                  })
                                  .willRespondWith({
                                              status: 422,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: validationErrorShape(M),
                                  })
                                  .executeTest(async (mockserver) => {
                                              try {
                                                            await axios.post(`${mockserver.url}/api/v1/enquiries`,
                                                                             { property_type: 'house' },
                                                                             { headers: homeyHeaders },
                                                                                         );
                                                            fail('Expected 422 error');
                                              } catch (err: any) {
                                                            expect(err.response.status).toBe(422);
                                                            expect(err.response.data.errors).toBeDefined();
                                              }
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // PATCH /api/v1/enquiries/:id
           // ─────────────────────────────────────────────────────────────────────────

           describe('PATCH /api/v1/enquiries/:id', () => {
                 it('updates an existing enquiry', async () => {
                         await provider
                           .given('an enquiry with id 1 exists')
                           .uponReceiving('a PATCH request to update enquiry id 1')
                           .withRequest({
                                       method: 'PATCH',
                                       path: '/api/v1/enquiries/1',
                                       headers: homeyHeaders,
                                       body: { purchase_price: 400000 },
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: enquiryShape(M),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.patch(
                                                     `${mockserver.url}/api/v1/enquiries/1`,
                                         { purchase_price: 400000 },
                                         { headers: homeyHeaders },
                                                   );
                                       expect(res.status).toBe(200);
                                       expect(res.data.id).toBeDefined();
                           });
                 });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // POST /api/v1/enquiries/:id/convert — convert enquiry to conveyance
           // ─────────────────────────────────────────────────────────────────────────

           describe('POST /api/v1/enquiries/:id/convert', () => {
                 it('converts an enquiry to a conveyance', async () => {
                         await provider
                           .given('an enquiry with id 1 is ready to convert')
                           .uponReceiving('a POST request to convert enquiry id 1 to conveyance')
                           .withRequest({
                                       method: 'POST',
                                       path: '/api/v1/enquiries/1/convert',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 201,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: {
                                                     id: M.integer(1),
                                                     reference: M.string('CONV-001'),
                                                     status: M.string('active'),
                                                     enquiry_id: M.integer(1),
                                                     created_at: M.iso8601DateTime('2024-01-01T00:00:00Z'),
                                       },
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.post(`${mockserver.url}/api/v1/enquiries/1/convert`, {}, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(201);
                                       expect(res.data.enquiry_id).toBe(1);
                           });
                 });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // DELETE /api/v1/enquiries/:id
           // ─────────────────────────────────────────────────────────────────────────

           describe('DELETE /api/v1/enquiries/:id', () => {
                 it('deletes an enquiry and returns 204', async () => {
                         await provider
                           .given('an enquiry with id 1 exists')
                           .uponReceiving('a DELETE request for enquiry id 1')
                           .withRequest({
                                       method: 'DELETE',
                                       path: '/api/v1/enquiries/1',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({ status: 204 })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.delete(`${mockserver.url}/api/v1/enquiries/1`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(204);
                           });
                 });
           });
});
