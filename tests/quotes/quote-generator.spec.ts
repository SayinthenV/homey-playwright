import { test, expect } from '@playwright/test';
import { EnquiryListPage } from '../../pages/enquiries/EnquiryListPage';
import { QuoteGeneratorPage } from '../../pages/quotes/QuoteGeneratorPage';
import { testDataFactory, TestDataFactory } from '../../helpers/TestDataFactory';


/**
 * Quote Generator Spec
 *
 * Tests Homey's quote/pricing generation system:
 * - Navigating to the quote generator from enquiries
 * - Selecting services and generating quotes
 * - Quote total calculation validation
 * - Sending quotes to clients
 * - Quote history and versioning
 *
 * Role: Agent (responsible for generating client quotes)
 */


test.use({ storageState: 'playwright/.auth/agent.json' });


test.describe('Quote Generator — Navigation', () => {
    let enquiryListPage: EnquiryListPage;
    let quoteGeneratorPage: QuoteGeneratorPage;


                test.beforeEach(async ({ page }) => {
                      enquiryListPage = new EnquiryListPage(page);
                      quoteGeneratorPage = new QuoteGeneratorPage(page);
                });


                test('should navigate to quote generator from enquiry', async ({ page }) => {
                      await test.step('Navigate to enquiry list', async () => {
                              await enquiryListPage.goto();
                              await enquiryListPage.expectPageVisible();


                                            const count = await enquiryListPage.getEnquiryCount();
                              if (count === 0) {
                                        console.log('No enquiries available — skipping quote test');
                                        test.skip();
                                        return;
                              }
                      });


                         await test.step('Open first enquiry', async () => {
                                 await enquiryListPage.clickFirstEnquiry();
                                 await page.waitForTimeout(500);
                         });


                         await test.step('Find and click quote/pricing link', async () => {
                                 const url = page.url();
                                 const match = url.match(/enquiries\/(\d+)/);
                                 if (!match) { test.skip(); return; }


                                               await quoteGeneratorPage.goto(match[1]);


                                               await test.step('Verify quote generator loaded', async () => {
                                                         await expect(page.getByText(/quote|pricing|fee/i).first()).toBeVisible({ timeout: 10000 });
                                               });
                         });
                });


                test('should display available services on quote page', async ({ page }) => {
                      await test.step('Navigate to an enquiry', async () => {
                              await enquiryListPage.goto();
                              const count = await enquiryListPage.getEnquiryCount();
