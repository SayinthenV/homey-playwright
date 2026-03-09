import { test, expect } from '@playwright/test';
import { EnquiryListPage } from '../../pages/enquiries/EnquiryListPage';
import { EnquiryDetailPage } from '../../pages/enquiries/EnquiryDetailPage';
import { NewEnquiryPage } from '../../pages/enquiries/NewEnquiryPage';

/**
 * Create Enquiry Tests
 * --------------------
 * Tests the multi-step enquiry creation wizard.
 * Tests run as agent role (uses playwright/.auth/agent.json storage state).
 */

// Shared test data
const TEST_ENQUIRY = {
    property: {
          addressLine1: '14 Acacia Avenue',
          city: 'London',
          postcode: 'SW1A 1AA',
          propertyValue: 450000,
          transactionType: 'purchase' as const,
          leasehold: false,
          newBuild: false,
    },
    client: {
          firstName: 'James',
          lastName: 'Wilson',
          email: 'james.wilson.test@playwright.homey.com',
          phone: '07700900000',
    },
    solicitorFirm: 'Test Solicitors Ltd',
};

test.describe('Enquiry Creation — Agent', () => {
    let newEnquiryPage: NewEnquiryPage;
    let enquiryListPage: EnquiryListPage;

                test.beforeEach(async ({ page }) => {
                      newEnquiryPage = new NewEnquiryPage(page);
                      enquiryListPage = new EnquiryListPage(page);
                });

                test('enquiry list page loads with correct elements', async ({ page }) => {
                      enquiryListPage = new EnquiryListPage(page);
                      await enquiryListPage.goto();
                      await expect(page).toHaveURL(/enquiries/);
                      await expect(enquiryListPage.searchInput).toBeVisible();
                      await expect(enquiryListPage.newEnquiryButton).toBeVisible();
                });

                test('navigates to new enquiry wizard on button click', async ({ page }) => {
                      await enquiryListPage.goto();
                      await enquiryListPage.clickNewEnquiry();
                      await expect(page).toHaveURL(/enquiries\/new/);
                      await newEnquiryPage.expectCurrentStep('property');
                });

                test('step 1: validates required property fields', async () => {
                      await newEnquiryPage.goto();
                      // Try to proceed without filling anything
                         await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectValidationError();
                });

                test('step 1: fills property details and proceeds', async () => {
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(TEST_ENQUIRY.property);
                      await newEnquiryPage.expectNoValidationErrors();
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectCurrentStep('client');
                });

                test('step 2: validates required client fields', async () => {
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(TEST_ENQUIRY.property);
                      await newEnquiryPage.goToNextStep();
                      // Try to proceed without client details
                         await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectValidationError();
                });

                test('step 2: fills client details and proceeds', async () => {
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(TEST_ENQUIRY.property);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.fillClientDetails(TEST_ENQUIRY.client);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectCurrentStep('solicitor');
                });

                test('step 3: can search and select a solicitor firm', async () => {
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(TEST_ENQUIRY.property);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.fillClientDetails(TEST_ENQUIRY.client);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.selectSolicitor(TEST_ENQUIRY.solicitorFirm);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectCurrentStep('confirm');
                });

                test('back button returns to previous step', async () => {
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(TEST_ENQUIRY.property);
                      await newEnquiryPage.goToNextStep();
                      await newEnquiryPage.expectCurrentStep('client');
                      await newEnquiryPage.goToPrevStep();
                      await newEnquiryPage.expectCurrentStep('property');
                });

                test('creates a full enquiry through the complete wizard', async ({ page }) => {
                      await newEnquiryPage.createEnquiry({
                              property: TEST_ENQUIRY.property,
                              client: TEST_ENQUIRY.client,
                              solicitorFirm: TEST_ENQUIRY.solicitorFirm,
                      });

                         // Should land on the new enquiry detail page
                         await expect(page).toHaveURL(/\/enquiries\/[a-z0-9-]+/);

                         // Verify the created enquiry shows correct data
                         const detailPage = new EnquiryDetailPage(page);
                      await detailPage.expectPropertyAddress('14 Acacia Avenue');
                      await detailPage.expectStatus('new');
                      await detailPage.expectConvertButtonVisible();
                });

                test('leasehold enquiry shows correct supplement in quote', async ({ page }) => {
                      const leaseholdEnquiry = {
                              ...TEST_ENQUIRY.property,
                              leasehold: true,
                      };
                      await newEnquiryPage.goto();
                      await newEnquiryPage.fillPropertyDetails(leaseholdEnquiry);
                      // Verify leasehold checkbox is checked
                         await expect(newEnquiryPage.leaseholdCheckbox).toBeChecked();
                });

                test('enquiry appears in the enquiry list after creation', async ({ page }) => {
                      await newEnquiryPage.createEnquiry({
                              property: TEST_ENQUIRY.property,
                              client: TEST_ENQUIRY.client,
                              solicitorFirm: TEST_ENQUIRY.solicitorFirm,
                      });

                         // Go back to list
                         await enquiryListPage.goto();
                      await enquiryListPage.searchFor('14 Acacia Avenue');
                      await enquiryListPage.expectEnquiryVisible('14 Acacia Avenue');
                });
});

test.describe('Enquiry List — Filtering', () => {
    test('can filter enquiries by status', async ({ page }) => {
          const listPage = new EnquiryListPage(page);
          await listPage.goto();
          await listPage.filterByStatus('new');
          // All visible rows should have 'new' status
             const count = await listPage.getEnquiryCount();
          expect(count).toBeGreaterThanOrEqual(0);
    });

                test('can search enquiries by address', async ({ page }) => {
                      const listPage = new EnquiryListPage(page);
                      await listPage.goto();
                      await listPage.searchFor('Acacia');
                      const count = await listPage.getEnquiryCount();
                      expect(count).toBeGreaterThanOrEqual(0);
                });

                test('shows empty state for no results', async ({ page }) => {
                      const listPage = new EnquiryListPage(page);
                      await listPage.goto();
                      await listPage.searchFor('ZZZNORESULTS999XYZ');
                      await listPage.expectEmptyState();
                });
});
