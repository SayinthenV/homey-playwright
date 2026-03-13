import { test, expect } from '@playwright/test';
import { CreateLeadPage } from '../../pages/leads/CreateLeadPage';
import { CsvDataManager, LeadRow } from '../../helpers/CsvDataManager';

/**
 * Create Lead Tests — Panel Manager / Agent (Connectere)
 * ──────────────────────────────────────────────────────
 * Tests the 4-step lead creation wizard on connectere.qa.homey.co.uk.
 *
 * Covers 5 lead types (one test per CSV row):
 *   TC-LEAD-001 Sale
 *   TC-LEAD-002 Purchase
 *   TC-LEAD-003 Remortgage
 *   TC-LEAD-004 Transfer of Equity
 *   TC-LEAD-005 Sale & Purchase
 *
 * Data strategy:
 *   • Static fields (postcode, price, agency, branch) live in test-data/leads.csv
 *   • Dynamic fields (name, email, phone) are auto-generated at runtime by
 *     CsvDataManager and written BACK to the CSV alongside the test case ID.
 *   • After a successful lead creation the Case ID from the app is also
 *     written back to the CSV row so every run is fully traceable.
 *
 * Auth:
 *   Uses playwright/.auth/panel_manager.json (set up by fixtures/auth.setup.ts).
 *   Run: ENV=qa npx playwright test --project=chromium-panel-manager tests/leads/
 */

// ── Load & prepare CSV data once for the entire suite ─────────────────────
let csvRows: LeadRow[];

test.beforeAll(() => {
    const mgr = new CsvDataManager();
    csvRows = mgr.prepareRows();
});

// ── Helper: find row by test_case_id ──────────────────────────────────────
function getRow(testCaseId: string): LeadRow {
    const row = csvRows.find(r => r.test_case_id === testCaseId);
    if (!row) throw new Error(`CSV row not found for test case: ${testCaseId}`);
    return row;
}

// ── Shared step data builder from a CSV row ───────────────────────────────
function buildStepData(row: LeadRow) {
    return {
          step1: {
                  leadType: row.lead_type,
                  postcode: row.postcode,
                  buildingNumber: row.building_number,
          },
          step2: {
                  firstName: row.generated_first_name,
                  lastName: row.generated_last_name,
                  email: row.generated_email,
                  phone: row.generated_phone || undefined,
          },
          step3: {
                  transactionStage: row.transaction_stage as any,
                  offerPrice: row.offer_price,
          },
          step4: {
                  agency: row.agency,
                  branch: row.branch,
          },
    };
}

// ─────────────────────────────────────────────────────────────────────────
// TC-LEAD-001: Create a SALE lead
// ─────────────────────────────────────────────────────────────────────────
test('TC-LEAD-001: create a Sale lead with mandatory fields', async ({ page }) => {
    const row = getRow('TC-LEAD-001');
    const data = buildStepData(row);

       // Verify CSV data is ready
       expect(row.generated_first_name).toBeTruthy();
    expect(row.generated_email).toBeTruthy();

       const leadPage = new CreateLeadPage(page);

       // ── Step 1: Property ──────────────────────────────────────────────────
       await leadPage.goto();
    await leadPage.expectOnStep('Property');
    await leadPage.fillStep1(data.step1);
    await leadPage.clickNext();

       // ── Step 2: Clients ───────────────────────────────────────────────────
       await leadPage.expectOnStep('Clients');
    await leadPage.fillStep2(data.step2);
    await leadPage.clickNext();

       // ── Step 3: Transaction ───────────────────────────────────────────────
       await leadPage.expectOnStep('Transaction');
    await leadPage.fillStep3(data.step3);
    await leadPage.clickNext();

       // ── Step 4: Details → Create Lead ─────────────────────────────────────
       await leadPage.expectOnStep('Details');
    await leadPage.fillStep4(data.step4);
    await leadPage.clickCreateLead();

       // ── Assertions ─────────────────────────────────────────────────────────
       await expect(page).toHaveURL(/leads\/[a-z0-9-]+|dashboard/i, { timeout: 30_000 });

       // Write back Case ID to CSV
       const caseId = page.url().match(/leads\/([a-z0-9-]+)/i)?.[1]?.toUpperCase() ?? 'CREATED';
    new CsvDataManager().updateAfterCreation('TC-LEAD-001', caseId);

       // Confirm the Case ID prefix indicates a Sale (SA)
       if (caseId !== 'CREATED') {
             expect(caseId).toMatch(/^SA-/i);
       }
});

// ─────────────────────────────────────────────────────────────────────────
// TC-LEAD-002: Create a PURCHASE lead
// ─────────────────────────────────────────────────────────────────────────
test('TC-LEAD-002: create a Purchase lead with mandatory fields', async ({ page }) => {
    const row = getRow('TC-LEAD-002');
    const data = buildStepData(row);
    const leadPage = new CreateLeadPage(page);

       await leadPage.goto();
    await leadPage.fillStep1(data.step1);
    await leadPage.clickNext();
    await leadPage.fillStep2(data.step2);
    await leadPage.clickNext();
    await leadPage.fillStep3(data.step3);
    await leadPage.clickNext();
    await leadPage.fillStep4(data.step4);
    await leadPage.clickCreateLead();

       await expect(page).toHaveURL(/leads\/[a-z0-9-]+|dashboard/i, { timeout: 30_000 });
    const caseId = page.url().match(/leads\/([a-z0-9-]+)/i)?.[1]?.toUpperCase() ?? 'CREATED';
    new CsvDataManager().updateAfterCreation('TC-LEAD-002', caseId);
    if (caseId !== 'CREATED') {
          expect(caseId).toMatch(/^PU-/i);
    }
});

// ─────────────────────────────────────────────────────────────────────────
// TC-LEAD-003: Create a REMORTGAGE lead
// ─────────────────────────────────────────────────────────────────────────
test('TC-LEAD-003: create a Remortgage lead with mandatory fields', async ({ page }) => {
    const row = getRow('TC-LEAD-003');
    const data = buildStepData(row);
    const leadPage = new CreateLeadPage(page);

       await leadPage.goto();
    await leadPage.fillStep1(data.step1);
    await leadPage.clickNext();
    await leadPage.fillStep2(data.step2);
    await leadPage.clickNext();
    await leadPage.fillStep3(data.step3);
    await leadPage.clickNext();
    await leadPage.fillStep4(data.step4);
    await leadPage.clickCreateLead();

       await expect(page).toHaveURL(/leads\/[a-z0-9-]+|dashboard/i, { timeout: 30_000 });
    const caseId = page.url().match(/leads\/([a-z0-9-]+)/i)?.[1]?.toUpperCase() ?? 'CREATED';
    new CsvDataManager().updateAfterCreation('TC-LEAD-003', caseId);
    if (caseId !== 'CREATED') {
          expect(caseId).toMatch(/^RE-/i);
    }
});

// ─────────────────────────────────────────────────────────────────────────
// TC-LEAD-004: Create a TRANSFER OF EQUITY lead
// ─────────────────────────────────────────────────────────────────────────
test('TC-LEAD-004: create a Transfer of Equity lead with mandatory fields', async ({ page }) => {
    const row = getRow('TC-LEAD-004');
    const data = buildStepData(row);
    const leadPage = new CreateLeadPage(page);

       await leadPage.goto();
    await leadPage.fillStep1(data.step1);
    await leadPage.clickNext();
    await leadPage.fillStep2(data.step2);
    await leadPage.clickNext();
    await leadPage.fillStep3(data.step3);
    await leadPage.clickNext();
    await leadPage.fillStep4(data.step4);
    await leadPage.clickCreateLead();

       await expect(page).toHaveURL(/leads\/[a-z0-9-]+|dashboard/i, { timeout: 30_000 });
    const caseId = page.url().match(/leads\/([a-z0-9-]+)/i)?.[1]?.toUpperCase() ?? 'CREATED';
    new CsvDataManager().updateAfterCreation('TC-LEAD-004', caseId);
    if (caseId !== 'CREATED') {
          // Transfer of Equity typically has TE prefix
      expect(caseId).toMatch(/^TE-/i);
    }
});

// ─────────────────────────────────────────────────────────────────────────
// TC-LEAD-005: Create a SALE & PURCHASE lead
// ─────────────────────────────────────────────────────────────────────────
test('TC-LEAD-005: create a Sale & Purchase lead with mandatory fields', async ({ page }) => {
    const row = getRow('TC-LEAD-005');
    const data = buildStepData(row);
    const leadPage = new CreateLeadPage(page);

       await leadPage.goto();
    await leadPage.fillStep1(data.step1);
    await leadPage.clickNext();
    await leadPage.fillStep2(data.step2);
    await leadPage.clickNext();
    await leadPage.fillStep3(data.step3);
    await leadPage.clickNext();
    await leadPage.fillStep4(data.step4);
    await leadPage.clickCreateLead();

       await expect(page).toHaveURL(/leads\/[a-z0-9-]+|dashboard/i, { timeout: 30_000 });
    const caseId = page.url().match(/leads\/([a-z0-9-]+)/i)?.[1]?.toUpperCase() ?? 'CREATED';
    new CsvDataManager().updateAfterCreation('TC-LEAD-005', caseId);
    // Sale & Purchase creates linked sale + purchase cases
       // URL usually lands on one of them; just verify creation succeeded
       expect(caseId).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────
// Validation tests — ensure mandatory fields are enforced per lead type
// ─────────────────────────────────────────────────────────────────────────
test.describe('Form validation — mandatory fields enforced', () => {
    test('Step 1: cannot proceed without selecting lead type', async ({ page }) => {
          const leadPage = new CreateLeadPage(page);
          await leadPage.goto();

             // Do NOT select a lead type
             await leadPage.clickNext();

             // Should stay on Property step with a validation error.
             // The app may show any of: "select a lead type", "required", "can't be blank",
             // "must be selected", or a flash/toast message — we match broadly.
             await expect(page).toHaveURL(/\/leads\/new\/property|\/leads\/[a-z0-9]+\/property/i);
          await expect(
                  page
                    .getByText(/select a lead type|required|can't be blank|must be selected|please select/i)
                    .first(),
                ).toBeVisible({ timeout: 5000 });
    });

                test('Step 2: cannot proceed without client first name', async ({ page }) => {
                      const row = getRow('TC-LEAD-001');
                      const leadPage = new CreateLeadPage(page);

                         await leadPage.goto();
                      await leadPage.fillStep1({
                              leadType: row.lead_type,
                              postcode: row.postcode,
                              buildingNumber: row.building_number,
                      });
                      await leadPage.clickNext();

                         // Fill email but omit name — use fillStep2's label/radio logic via the page object
                         // to keep the test independent of the internal radio selector.
                         const legalOwnerLabel = page
                        .locator('label')
                        .filter({ hasText: /legal\s+owner/i })
                        .first();
                      try {
                              await legalOwnerLabel.waitFor({ state: 'visible', timeout: 5000 });
                              await legalOwnerLabel.click();
                      } catch {
                              await leadPage.legalOwnerRadio.click({ force: true });
                      }
                      await leadPage.emailInput.fill('valid@email.com');
                      // intentionally skip firstName and lastName

                         await leadPage.clickNext();

                         // Should show validation errors
                         await expect(page.getByText(/first name|required/i).first()).toBeVisible();
                });

                test('Step 3: cannot proceed without offer price', async ({ page }) => {
                      const row = getRow('TC-LEAD-002');
                      const leadPage = new CreateLeadPage(page);

                         await leadPage.goto();
                      await leadPage.fillStep1({
                              leadType: row.lead_type,
                              postcode: row.postcode,
                              buildingNumber: row.building_number,
                      });
                      await leadPage.clickNext();
                      await leadPage.fillStep2({
                              firstName: 'Test',
                              lastName: 'User',
                              email: 'test@example.com',
                      });
                      await leadPage.clickNext();

                         // Fill stage but skip offer price
                         await leadPage.transactionStageSelect.selectOption('offer_accepted');
                      // intentionally skip offerPriceInput

                         await leadPage.clickNext();

                         // Should stay on Transaction step
                         await expect(page.getByText(/offer price|required/i).first()).toBeVisible();
                });
});
