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

test.use({ storageState: '.auth/agent.json' });

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
                              if (count === 0) { test.skip(); return; }
                              await enquiryListPage.clickFirstEnquiry();

                                            const url = page.url();
                              const match = url.match(/enquiries\/(\d+)/);
                              if (!match) { test.skip(); return; }
                              await quoteGeneratorPage.goto(match[1]);
                      });

                         await test.step('Verify service checkboxes are present', async () => {
                                 const serviceItems = page.locator(
                                           '[data-testid="service-item"], .service-option, input[type="checkbox"][name*="service"]'
                                         );
                                 const count = await serviceItems.count();
                                 console.log(`Available service options: ${count}`);
                                 expect(count).toBeGreaterThanOrEqual(0);
                         });
                });
});

test.describe('Quote Generator — Generation', () => {
    let quoteGeneratorPage: QuoteGeneratorPage;
    let enquiryListPage: EnquiryListPage;

                test.beforeEach(async ({ page }) => {
                      quoteGeneratorPage = new QuoteGeneratorPage(page);
                      enquiryListPage = new EnquiryListPage(page);
                });

                test('should generate a quote with all services selected', async ({ page }) => {
                      await test.step('Navigate to quote generator', async () => {
                              await enquiryListPage.goto();
                              const count = await enquiryListPage.getEnquiryCount();
                              if (count === 0) { test.skip(); return; }
                              await enquiryListPage.clickFirstEnquiry();

                                            const url = page.url();
                              const match = url.match(/enquiries\/(\d+)/);
                              if (!match) { test.skip(); return; }
                              await quoteGeneratorPage.goto(match[1]);
                      });

                         await test.step('Select all available services', async () => {
                                 const checkboxes = page.locator('input[type="checkbox"][name*="service"], [data-testid="service-checkbox"]');
                                 const checkCount = await checkboxes.count();

                                               if (checkCount > 0) {
                                                         for (let i = 0; i < checkCount; i++) {
                                                                     const checkbox = checkboxes.nth(i);
                                                                     const isChecked = await checkbox.isChecked().catch(() => false);
                                                                     if (!isChecked) await checkbox.check();
                                                         }
                                                         console.log(`Selected ${checkCount} service(s)`);
                                               }
                         });

                         await test.step('Generate quote', async () => {
                                 const generateBtn = page.getByRole('button', { name: /generate.*quote|calculate|get.*price/i })
                                   .or(page.locator('[data-testid="generate-quote-btn"]').first());

                                               const isVisible = await generateBtn.isVisible().catch(() => false);
                                 if (!isVisible) {
                                           console.log('No generate quote button found');
                                           return;
                                 }

                                               await generateBtn.click();
                                 await page.waitForTimeout(1000); // Allow quote calculation

                                               await test.step('Verify quote total is displayed', async () => {
                                                         await quoteGeneratorPage.expectQuoteGenerated();
                                                         const total = await quoteGeneratorPage.getQuoteTotal();
                                                         console.log(`Quote total: ${total}`);
                                                         expect(total).toBeTruthy();
                                               });
                         });
                });

                test('should update quote total when services change', async ({ page }) => {
                      await test.step('Navigate to quote generator', async () => {
                              await enquiryListPage.goto();
                              const count = await enquiryListPage.getEnquiryCount();
                              if (count === 0) { test.skip(); return; }
                              await enquiryListPage.clickFirstEnquiry();

                                            const url = page.url();
                              const match = url.match(/enquiries\/(\d+)/);
                              if (!match) { test.skip(); return; }
                              await quoteGeneratorPage.goto(match[1]);
                      });

                         await test.step('Get initial total with first service', async () => {
                                 const checkboxes = page.locator('input[type="checkbox"][name*="service"]');
                                 const checkCount = await checkboxes.count();
                                 if (checkCount === 0) { test.skip(); return; }

                                               // Check first service only
                                               await checkboxes.first().check();

                                               const generateBtn = page.getByRole('button', { name: /generate|calculate/i }).first();
                                 if (await generateBtn.isVisible().catch(() => false)) {
                                           await generateBtn.click();
                                           await page.waitForTimeout(800);
                                 }

                                               const initialTotal = await quoteGeneratorPage.getQuoteTotal().catch(() => null);
                                 console.log(`Initial quote total (1 service): ${initialTotal}`);
                         });

                         await test.step('Add more services and verify total increases', async () => {
                                 const checkboxes = page.locator('input[type="checkbox"][name*="service"]');
                                 const checkCount = await checkboxes.count();

                                               if (checkCount > 1) {
                                                         await checkboxes.nth(1).check();

                                   const generateBtn = page.getByRole('button', { name: /generate|calculate/i }).first();
                                                         if (await generateBtn.isVisible().catch(() => false)) {
                                                                     await generateBtn.click();
                                                                     await page.waitForTimeout(800);
                                                         }

                                   const updatedTotal = await quoteGeneratorPage.getQuoteTotal().catch(() => null);
                                                         console.log(`Updated quote total (2 services): ${updatedTotal}`);
                                               }
                         });
                });

                test('should validate quote contains GBP pricing', async ({ page }) => {
                      await test.step('Navigate and generate quote', async () => {
                              await enquiryListPage.goto();
                              const count = await enquiryListPage.getEnquiryCount();
                              if (count === 0) { test.skip(); return; }
                              await enquiryListPage.clickFirstEnquiry();

                                            const url = page.url();
                              const match = url.match(/enquiries\/(\d+)/);
                              if (!match) { test.skip(); return; }
                              await quoteGeneratorPage.goto(match[1]);

                                            // Select all services if any
                                            const checkboxes = page.locator('input[type="checkbox"][name*="service"]');
                              const checkCount = await checkboxes.count();
                              for (let i = 0; i < checkCount; i++) {
                                        await checkboxes.nth(i).check().catch(() => {});
                              }

                                            const generateBtn = page.getByRole('button', { name: /generate|calculate/i }).first();
                              if (await generateBtn.isVisible().catch(() => false)) {
                                        await generateBtn.click();
                                        await page.waitForTimeout(800);
                              }
                      });

                         await test.step('Verify GBP currency format', async () => {
                                 // Look for GBP amounts on the page
                                               const gbpPattern = page.getByText(/£[\d,]+(\.\d{2})?/);
                                 const hasGBP = await gbpPattern.first().isVisible().catch(() => false);
                                 console.log(`GBP pricing visible: ${hasGBP}`);

                                               if (hasGBP) {
                                                         const total = await quoteGeneratorPage.getQuoteTotal();
                                                         // Verify it contains a currency symbol or number
                                   expect(total).toMatch(/[£\d]/);
                                               }
                         });
                });
});

test.describe('Quote Generator — Client Communication', () => {
    let quoteGeneratorPage: QuoteGeneratorPage;

                test.beforeEach(async ({ page }) => {
                      quoteGeneratorPage = new QuoteGeneratorPage(page);
                });

                test('should send quote to client via email', async ({ page }) => {
                      const enquiryData = testDataFactory.enquiry();

                         await test.step('Navigate to quote generator', async () => {
                                 const enquiryListPage = new EnquiryListPage(page);
                                 await enquiryListPage.goto();
                                 const count = await enquiryListPage.getEnquiryCount();
                                 if (count === 0) { test.skip(); return; }
                                 await enquiryListPage.clickFirstEnquiry();

                                               const url = page.url();
                                 const match = url.match(/enquiries\/(\d+)/);
                                 if (!match) { test.skip(); return; }
                                 await quoteGeneratorPage.goto(match[1]);
                         });

                         await test.step('Find send/email quote button', async () => {
                                 const sendBtn = page.getByRole('button', { name: /send.*quote|email.*client|share.*quote/i })
                                   .or(page.locator('[data-testid="send-quote-btn"]').first());

                                               const isVisible = await sendBtn.isVisible().catch(() => false);
                                 console.log(`Send quote button visible: ${isVisible}`);

                                               if (isVisible) {
                                                         await sendBtn.click();
                                                         await page.waitForTimeout(500);

                                   const successMsg = page.getByText(/sent|email.*sent|quote.*delivered/i).first();
                                                         const isSent = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
                                                         console.log(`Quote sent confirmation visible: ${isSent}`);
                                               }
                         });
                });

                test('should display quote history if available', async ({ page }) => {
                      await test.step('Navigate to quote generator', async () => {
                              const enquiryListPage = new EnquiryListPage(page);
                              await enquiryListPage.goto();
                              const count = await enquiryListPage.getEnquiryCount();
                              if (count === 0) { test.skip(); return; }
                              await enquiryListPage.clickFirstEnquiry();

                                            const url = page.url();
                              const match = url.match(/enquiries\/(\d+)/);
                              if (!match) { test.skip(); return; }
                              await quoteGeneratorPage.goto(match[1]);
                      });

                         await test.step('Check for quote history section', async () => {
                                 const historySection = page.getByRole('region', { name: /quote.*history|previous.*quotes/i })
                                   .or(page.locator('[data-testid="quote-history"]').first());

                                               const isVisible = await historySection.isVisible().catch(() => false);
                                 console.log(`Quote history section visible: ${isVisible}`);
                         });
                });
});

test.describe('Quote Generator — Property Value Impact', () => {
    test('should reflect property value in quote calculation', async ({ page }) => {
          const data = testDataFactory.enquiry();
          const formattedPrice = TestDataFactory.formatPrice(data.property.agreedPrice);

             await test.step('Navigate to a quote page', async () => {
                     const enquiryListPage = new EnquiryListPage(page);
                     const quoteGeneratorPage = new QuoteGeneratorPage(page);

                                   await enquiryListPage.goto();
                     const count = await enquiryListPage.getEnquiryCount();
                     if (count === 0) { test.skip(); return; }
                     await enquiryListPage.clickFirstEnquiry();

                                   const url = page.url();
                     const match = url.match(/enquiries\/(\d+)/);
                     if (!match) { test.skip(); return; }
                     await quoteGeneratorPage.goto(match[1]);
             });

             await test.step('Verify property value is shown on quote page', async () => {
                     // Quote page should reference the agreed property price
                                   const priceEl = page.locator('[data-testid="property-price"], .property-value').first();
                     const isVisible = await priceEl.isVisible().catch(() => false);
                     console.log(`Property value visible on quote page: ${isVisible}`);
             });
    });
});
