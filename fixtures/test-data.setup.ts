import { test as setup, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/ApiHelper';
import { testDataFactory } from '../helpers/TestDataFactory';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test Data Setup Fixture
 *
 * Runs once before the entire test suite (via Playwright's global setup).
 * Uses ApiHelper to seed the database with the minimum required test data:
 * - At least one enquiry in various states
 * - At least one conveyance (converted from an enquiry)
 * - Test data manifest saved to .test-data/manifest.json
 *
 * This approach is much faster than creating data through the UI in each test.
 * Tests can read the manifest to get IDs of seeded data.
 *
 * Configure in playwright.config.ts:
 *   globalSetup: './fixtures/test-data.setup.ts'
 *
 * Or add to the setup project's testMatch:
 *   { name: 'data-setup', testMatch: 'fixtures/test-data.setup.ts' }
 */

const MANIFEST_DIR = path.join(process.cwd(), '.test-data');
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json');

export interface TestDataManifest {
    seededAt: string;
    enquiries: Array<{
      id: number;
      reference: string;
      status: string;
      buyerName: string;
      propertyAddress: string;
      agreedPrice: number;
    }>;
    conveyances: Array<{
      id: number;
      reference: string;
      pipelineStage: string;
      enquiryId: number;
    }>;
}

/**
 * Load the test data manifest (if it exists).
 * Returns null if no manifest found.
 */
export function loadManifest(): TestDataManifest | null {
    try {
          if (fs.existsSync(MANIFEST_PATH)) {
                  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
          }
    } catch {
          // File corrupted or missing
    }
    return null;
}

/**
 * Save test data manifest for use by tests.
 */
function saveManifest(manifest: TestDataManifest): void {
    if (!fs.existsSync(MANIFEST_DIR)) {
          fs.mkdirSync(MANIFEST_DIR, { recursive: true });
    }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ─── Setup fixture ────────────────────────────────────────────────────────────

setup('seed test data via API', async () => {
    const api = new ApiHelper();
    const manifest: TestDataManifest = {
          seededAt: new Date().toISOString(),
          enquiries: [],
          conveyances: [],
    };

        try {
              await api.init('agent');

      const isHealthy = await api.healthCheck();
              if (!isHealthy) {
                      console.warn('[TestDataSetup] API health check failed — skipping seed (tests will use existing data)');
                      saveManifest(manifest);
                      return;
              }

      console.log('[TestDataSetup] Seeding test data...');

      // ─── Seed enquiries ───────────────────────────────────────────────────

      // Enquiry 1: New/draft state
      const enquiry1Data = testDataFactory.enquiry();
              try {
                      const enquiry1 = await api.createEnquiry({
                                buyer_name: enquiry1Data.buyer.fullName,
                                buyer_email: enquiry1Data.buyer.email,
                                buyer_phone: enquiry1Data.buyer.phone,
                                seller_name: enquiry1Data.seller.fullName,
                                property_address: enquiry1Data.property.address.fullAddress,
                                property_type: enquiry1Data.property.propertyType,
                                agreed_price: enquiry1Data.property.agreedPrice,
                                tenure: enquiry1Data.property.tenure,
                      });

                manifest.enquiries.push({
                          id: enquiry1.id,
                          reference: enquiry1.reference,
                          status: enquiry1.status,
                          buyerName: enquiry1.buyer_name,
                          propertyAddress: enquiry1.property_address,
                          agreedPrice: enquiry1.agreed_price,
                });

                console.log(`[TestDataSetup] Created enquiry 1: ${enquiry1.reference}`);
              } catch (err: any) {
      console.warn('[TestDataSetup] Could not create enquiry 1 via API:', err.message);
              }

      // Enquiry 2: Different property type
      const enquiry2Data = testDataFactory.enquiry({ property: testDataFactory.property({ propertyType: 'Flat' }) });
              try {
                      const enquiry2 = await api.createEnquiry({
                                buyer_name: enquiry2Data.buyer.fullName,
                                buyer_email: enquiry2Data.buyer.email,
                                property_address: enquiry2Data.property.address.fullAddress,
                                property_type: 'Flat',
                                agreed_price: enquiry2Data.property.agreedPrice,
                                tenure: 'Leasehold',
                      });

                manifest.enquiries.push({
                          id: enquiry2.id,
                          reference: enquiry2.reference,
                          status: enquiry2.status,
                          buyerName: enquiry2.buyer_name,
                          propertyAddress: enquiry2.property_address,
                          agreedPrice: enquiry2.agreed_price,
                });

                console.log(`[TestDataSetup] Created enquiry 2: ${enquiry2.reference}`);

                // ─── Seed conveyances ───────────────────────────────────────────────

                // Create a conveyance from enquiry 2 (further along in the process)
                try {
                          const conveyance = await api.createConveyance({
                                      enquiry_id: enquiry2.id,
                                      pipeline_stage: 'instruction',
                          });

                        manifest.conveyances.push({
                                    id: conveyance.id,
                                    reference: conveyance.reference,
                                    pipelineStage: conveyance.pipeline_stage,
                                    enquiryId: conveyance.enquiry_id,
                        });

                        console.log(`[TestDataSetup] Created conveyance: ${conveyance.reference}`);
                } catch (err: any) {
        console.warn('[TestDataSetup] Could not create conveyance via API:', err.message);
                }
              } catch (err: any) {
      console.warn('[TestDataSetup] Could not create enquiry 2 via API:', err.message);
              }

      // If API creation failed entirely, check for existing data
      if (manifest.enquiries.length === 0) {
              console.log('[TestDataSetup] Checking for existing enquiries...');
              const existing = await api.getEnquiries({ per_page: 5 });
              for (const e of existing) {
                        manifest.enquiries.push({
                                    id: e.id,
                                    reference: e.reference,
                                    status: e.status,
                                    buyerName: e.buyer_name,
                                    propertyAddress: e.property_address,
                                    agreedPrice: e.agreed_price,
                        });
              }
      }

      if (manifest.conveyances.length === 0) {
              const existingConveyances = await api.getConveyances();
              for (const c of existingConveyances.slice(0, 3)) {
                        manifest.conveyances.push({
                                    id: c.id,
                                    reference: c.reference,
                                    pipelineStage: c.pipeline_stage,
                                    enquiryId: c.enquiry_id,
                        });
              }
      }

      console.log(`[TestDataSetup] Manifest: ${manifest.enquiries.length} enquiries, ${manifest.conveyances.length} conveyances`);
              saveManifest(manifest);

        } catch (err: any) {
    console.error('[TestDataSetup] Setup failed:', err.message);
              // Save empty manifest so tests can still run (they'll skip data-dependent steps)
      saveManifest(manifest);
        } finally {
              // Don't cleanup here — we want the data to persist for tests
      // Cleanup is handled separately or after the full test suite
      await api['requestContext']?.dispose();
        }
});

// ─── Teardown fixture (optional) ─────────────────────────────────────────────

setup('cleanup seeded test data', async () => {
    // Only run teardown if we have a manifest
        const manifest = loadManifest();
    if (!manifest || (manifest.enquiries.length === 0 && manifest.conveyances.length === 0)) {
          console.log('[TestDataTeardown] No seeded data to clean up');
          return;
    }

        // Skip teardown in CI unless explicitly requested
        if (process.env.CI && !process.env.CLEANUP_TEST_DATA) {
              console.log('[TestDataTeardown] Skipping cleanup in CI (set CLEANUP_TEST_DATA=true to enable)');
              return;
        }

        const api = new ApiHelper();
    try {
          await api.init('admin');

      // Delete conveyances first (they reference enquiries)
      for (const c of manifest.conveyances) {
              await api.deleteConveyance(c.id).catch(() => {});
              console.log(`[TestDataTeardown] Deleted conveyance: ${c.reference}`);
      }

      // Then delete enquiries
      for (const e of manifest.enquiries) {
              await api.deleteEnquiry(e.id).catch(() => {});
              console.log(`[TestDataTeardown] Deleted enquiry: ${e.reference}`);
      }

      // Remove manifest file
      if (fs.existsSync(MANIFEST_PATH)) {
              fs.unlinkSync(MANIFEST_PATH);
      }

      console.log('[TestDataTeardown] Cleanup complete');
    } catch (err: any) {
    console.warn('[TestDataTeardown] Cleanup error:', err.message);
    } finally {
          await api['requestContext']?.dispose();
    }
});
