import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import axios from 'axios';
import {
    pactConfig,
    homeyHeaders,
    conveyanceShape,
    quoteShape,
    paginatedListShape,
    validationErrorShape,
    notFoundShape,
} from '../helpers/PactHelper';

const M = MatchersV3;

/**
 * Pact Consumer Contract Tests — Conveyances API
 * Covers conveyance CRUD, status transitions, quotes, and documents.
 */

const provider = new PactV3(pactConfig('HomeyPlaywrightConsumer', 'HomeyConveyancesAPI'));

describe('Homey Conveyances API — Consumer Contract', () => {
    // ─────────────────────────────────────────────────────────────────────────
           // GET /api/v1/conveyances
           // ─────────────────────────────────────────────────────────────────────────

           describe('GET /api/v1/conveyances', () => {
                 it('returns a paginated list of conveyances', async () => {
                         await provider
                           .given('there are conveyances')
                           .uponReceiving('a GET request for conveyance list')
                           .withRequest({
                                       method: 'GET',
                                       path: '/api/v1/conveyances',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: paginatedListShape(M, conveyanceShape(M)),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.get(`${mockserver.url}/api/v1/conveyances`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(200);
                                       expect(Array.isArray(res.data.data)).toBe(true);
                                       expect(res.data.meta).toBeDefined();
                           });
                 });

                        it('returns conveyances filtered by status', async () => {
                                await provider
                                  .given('there are active conveyances')
                                  .uponReceiving('a GET request filtering conveyances by status=active')
                                  .withRequest({
                                              method: 'GET',
                                              path: '/api/v1/conveyances',
                                              query: { status: 'active' },
                                              headers: homeyHeaders,
                                  })
                                  .willRespondWith({
                                              status: 200,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: paginatedListShape(M, conveyanceShape(M)),
                                  })
                                  .executeTest(async (mockserver) => {
                                              const res = await axios.get(`${mockserver.url}/api/v1/conveyances`, {
                                                            params: { status: 'active' },
                                                            headers: homeyHeaders,
                                              });
                                              expect(res.status).toBe(200);
                                              expect(Array.isArray(res.data.data)).toBe(true);
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // GET /api/v1/conveyances/:id
           // ─────────────────────────────────────────────────────────────────────────

           describe('GET /api/v1/conveyances/:id', () => {
                 it('returns a single conveyance', async () => {
                         await provider
                           .given('a conveyance with id 1 exists')
                           .uponReceiving('a GET request for conveyance id 1')
                           .withRequest({
                                       method: 'GET',
                                       path: '/api/v1/conveyances/1',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: conveyanceShape(M),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.get(`${mockserver.url}/api/v1/conveyances/1`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(200);
                                       expect(res.data.id).toBeDefined();
                                       expect(res.data.reference).toBeDefined();
                                       expect(res.data.status).toBeDefined();
                           });
                 });

                        it('returns 404 when conveyance does not exist', async () => {
                                await provider
                                  .given('conveyance with id 9999 does not exist')
                                  .uponReceiving('a GET request for non-existent conveyance')
                                  .withRequest({
                                              method: 'GET',
                                              path: '/api/v1/conveyances/9999',
                                              headers: homeyHeaders,
                                  })
                                  .willRespondWith({
                                              status: 404,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: notFoundShape(M),
                                  })
                                  .executeTest(async (mockserver) => {
                                              try {
                                                            await axios.get(`${mockserver.url}/api/v1/conveyances/9999`, {
                                                                            headers: homeyHeaders,
                                                            });
                                                            fail('Expected 404');
                                              } catch (err: any) {
                                                            expect(err.response.status).toBe(404);
                                              }
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // PATCH /api/v1/conveyances/:id — update status
           // ─────────────────────────────────────────────────────────────────────────

           describe('PATCH /api/v1/conveyances/:id (status transition)', () => {
                 it('transitions conveyance status to completed', async () => {
                         await provider
                           .given('a conveyance with id 1 is active')
                           .uponReceiving('a PATCH request to transition conveyance to completed')
                           .withRequest({
                                       method: 'PATCH',
                                       path: '/api/v1/conveyances/1',
                                       headers: homeyHeaders,
                                       body: { status: 'completed' },
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: {
                                                     ...conveyanceShape(M),
                                                     status: M.string('completed'),
                                       },
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.patch(
                                                     `${mockserver.url}/api/v1/conveyances/1`,
                                         { status: 'completed' },
                                         { headers: homeyHeaders },
                                                   );
                                       expect(res.status).toBe(200);
                                       expect(res.data.id).toBeDefined();
                           });
                 });

                        it('returns 422 when invalid status transition', async () => {
                                await provider
                                  .given('a conveyance with id 1 is active')
                                  .uponReceiving('a PATCH request with an invalid status transition')
                                  .withRequest({
                                              method: 'PATCH',
                                              path: '/api/v1/conveyances/1',
                                              headers: homeyHeaders,
                                              body: { status: 'invalid_status' },
                                  })
                                  .willRespondWith({
                                              status: 422,
                                              headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                              body: validationErrorShape(M),
                                  })
                                  .executeTest(async (mockserver) => {
                                              try {
                                                            await axios.patch(
                                                                            `${mockserver.url}/api/v1/conveyances/1`,
                                                              { status: 'invalid_status' },
                                                              { headers: homeyHeaders },
                                                                          );
                                                            fail('Expected 422');
                                              } catch (err: any) {
                                                            expect(err.response.status).toBe(422);
                                              }
                                  });
                        });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // GET /api/v1/conveyances/:id/quotes
           // ─────────────────────────────────────────────────────────────────────────

           describe('GET /api/v1/conveyances/:id/quotes', () => {
                 it('returns quotes for a conveyance', async () => {
                         await provider
                           .given('a conveyance with id 1 has quotes')
                           .uponReceiving('a GET request for quotes of conveyance 1')
                           .withRequest({
                                       method: 'GET',
                                       path: '/api/v1/conveyances/1/quotes',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({
                                       status: 200,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: M.eachLike(quoteShape(M)),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.get(`${mockserver.url}/api/v1/conveyances/1/quotes`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(200);
                                       expect(Array.isArray(res.data)).toBe(true);
                           });
                 });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // POST /api/v1/conveyances/:id/quotes
           // ─────────────────────────────────────────────────────────────────────────

           describe('POST /api/v1/conveyances/:id/quotes', () => {
                 it('creates a quote for a conveyance', async () => {
                         const quoteBody = { total_fee: 1500.0, notes: 'Standard conveyancing fee' };

                          await provider
                           .given('a conveyance with id 1 exists')
                           .uponReceiving('a POST request to create a quote for conveyance 1')
                           .withRequest({
                                       method: 'POST',
                                       path: '/api/v1/conveyances/1/quotes',
                                       headers: homeyHeaders,
                                       body: quoteBody,
                           })
                           .willRespondWith({
                                       status: 201,
                                       headers: { 'Content-Type': M.regex('application/json.*', 'application/json') },
                                       body: quoteShape(M),
                           })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.post(
                                                     `${mockserver.url}/api/v1/conveyances/1/quotes`,
                                                     quoteBody,
                                         { headers: homeyHeaders },
                                                   );
                                       expect(res.status).toBe(201);
                                       expect(res.data.id).toBeDefined();
                                       expect(res.data.conveyance_id).toBeDefined();
                           });
                 });
           });

           // ─────────────────────────────────────────────────────────────────────────
           // DELETE /api/v1/conveyances/:id
           // ─────────────────────────────────────────────────────────────────────────

           describe('DELETE /api/v1/conveyances/:id', () => {
                 it('deletes a conveyance and returns 204', async () => {
                         await provider
                           .given('a conveyance with id 1 exists')
                           .uponReceiving('a DELETE request for conveyance id 1')
                           .withRequest({
                                       method: 'DELETE',
                                       path: '/api/v1/conveyances/1',
                                       headers: homeyHeaders,
                           })
                           .willRespondWith({ status: 204 })
                           .executeTest(async (mockserver) => {
                                       const res = await axios.delete(`${mockserver.url}/api/v1/conveyances/1`, {
                                                     headers: homeyHeaders,
                                       });
                                       expect(res.status).toBe(204);
                           });
                 });
           });
});
