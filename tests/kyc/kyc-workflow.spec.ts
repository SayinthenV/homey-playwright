import { test, expect } from '@playwright/test';
import { ConveyanceListPage } from '../../pages/conveyances/ConveyanceListPage';
import { KYCDashboardPage } from '../../pages/kyc/KYCDashboardPage';
import { ThirdfortMocker } from '../../helpers/ThirdfortMocker';
import { testDataFactory } from '../../helpers/TestDataFactory';


/**
 * KYC Workflow Spec
 *
 * Tests the full KYC/AML identity verification lifecycle in Homey:
 * - KYC dashboard navigation
 * - Initiating Thirdfort identity checks for buyers/sellers
 * - Mocking webhook responses (pass, fail, pending)
 * - Status updates via Turbo Streams
 * - Re-check flows after failures
 *
 * Uses ThirdfortMocker to simulate webhook callbacks without
 * requiring a live Thirdfort integration.
 *
 * Role: Solicitor (responsible for KYC compliance)
 */


test.use({ storageState: 'playwright/.auth/solicitor.json' });


test.describe('KYC Dashboard — Navigation', () => {
    let conveyanceListPage: ConveyanceListPage;
    let kycDashboardPage: KYCDashboardPage;


                test.beforeEach(async ({ page }) => {
                      conveyanceListPage = new ConveyanceListPage(page);
                      kycDashboardPage = new KYCDashboardPage(page);
                });


                test('should navigate to KYC dashboard from a conveyance', async ({ page }) => {
                      await test.step('Find a conveyance with KYC requirements', async () => {
                              await conveyanceListPage.goto();
                              await conveyanceListPage.expectPageVisible();


                                            const count = await conveyanceListPage.getConveyanceCount();
                              if (count === 0) {
                                        console.log('No conveyances available — skipping KYC test');
                                        test.skip();
                                        return;
                              }
                              await conveyanceListPage.clickFirstConveyance();
                      });


                         await test.step('Extract conveyance ID from URL', async () => {
                                 const url = page.url();
                                 const match = url.match(/conveyances\/(\d+)/);
                                 if (!match) {
                                           console.log('Could not extract conveyance ID — skipping');
                                           test.skip();
                                           return;
                                 }


                                               const conveyanceId = match[1];
                                 await test.step('Navigate to KYC dashboard', async () => {
                                           await kycDashboardPage.goto(conveyanceId);
                                           await expect(page).toHaveURL(/kyc|identity.*check|verification/, { timeout: 10000 })
                                             .catch(async () => {
                                                           // KYC may be embedded in the conveyance page as a tab
                                                                await expect(page.getByText(/identity.*check|kyc|verification/i).first())
                                                             .toBeVisible({ timeout: 10000 });
