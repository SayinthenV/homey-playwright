import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * NewEnquiryPage
 * --------------
 * Multi-step wizard for creating a new enquiry/lead.
 * Powered by Wicked gem in Homey — each step is a separate form.
 *
 * Steps:
 *   1. property_details  — address, value, transaction type
 *   2. client_details    — buyer/seller name, email, phone
 *   3. solicitor_select  — choose solicitor from panel
 *   4. confirm           — review and submit
 *
 * Route: /enquiries/new  (step 1)
 *        /enquiries/new?step=client_details  (step 2) etc.
 */
export class NewEnquiryPage extends BasePage {

  // ── Step indicators ──────────────────────────────────────────
  readonly stepIndicator: Locator;
    readonly currentStepLabel: Locator;

  // ── Step 1: Property Details ─────────────────────────────────
  readonly addressLine1Input: Locator;
    readonly addressLine2Input: Locator;
    readonly cityInput: Locator;
    readonly postcodeInput: Locator;
    readonly addressLookupInput: Locator;
    readonly addressSuggestions: Locator;
    readonly propertyValueInput: Locator;
    readonly transactionTypeSelect: Locator;
    readonly leaseholdCheckbox: Locator;
    readonly newBuildCheckbox: Locator;

  // ── Step 2: Client Details ───────────────────────────────────
  readonly clientFirstNameInput: Locator;
    readonly clientLastNameInput: Locator;
    readonly clientEmailInput: Locator;
    readonly clientPhoneInput: Locator;

  // ── Step 3: Solicitor Select ─────────────────────────────────
  readonly solicitorSearchInput: Locator;
    readonly solicitorOptions: Locator;

  // ── Step 4: Confirm ──────────────────────────────────────────
  readonly confirmSummary: Locator;

  // ── Navigation buttons ───────────────────────────────────────
  readonly nextStepButton: Locator;
    readonly prevStepButton: Locator;
    readonly submitButton: Locator;

  // ── Validation errors ────────────────────────────────────────
  readonly fieldErrors: Locator;

  constructor(page: Page) {
        super(page);

      this.stepIndicator = page.getByTestId('wizard-steps');
        this.currentStepLabel = page.getByTestId('current-step-label');

      // Step 1
      this.addressLine1Input = page.getByLabel(/address line 1/i);
        this.addressLine2Input = page.getByLabel(/address line 2/i);
        this.cityInput = page.getByLabel(/city|town/i);
        this.postcodeInput = page.getByLabel(/postcode/i);
        this.addressLookupInput = page.getByPlaceholder(/enter postcode|find address/i);
        this.addressSuggestions = page.getByTestId('address-suggestions');
        this.propertyValueInput = page.getByLabel(/property value|purchase price/i);
        this.transactionTypeSelect = page.getByLabel(/transaction type/i);
        this.leaseholdCheckbox = page.getByLabel(/leasehold/i);
        this.newBuildCheckbox = page.getByLabel(/new build/i);

      // Step 2
      this.clientFirstNameInput = page.getByLabel(/first name/i);
        this.clientLastNameInput = page.getByLabel(/last name|surname/i);
        this.clientEmailInput = page.getByLabel(/email/i);
        this.clientPhoneInput = page.getByLabel(/phone|mobile/i);

      // Step 3
      this.solicitorSearchInput = page.getByPlaceholder(/search.*solicitor|find.*firm/i);
        this.solicitorOptions = page.getByTestId('solicitor-option');

      // Step 4
      this.confirmSummary = page.getByTestId('enquiry-confirm-summary');

      // Nav
      this.nextStepButton = page.getByRole('button', { name: /next|continue/i });
        this.prevStepButton = page.getByRole('button', { name: /back|previous/i });
        this.submitButton = page.getByRole('button', { name: /submit|create enquiry|finish/i });

      this.fieldErrors = page.getByTestId('field-error');
  }

  // ── Navigation ───────────────────────────────────────────────

  async goto(): Promise<void> {
        await this.page.goto('/enquiries/new');
        await this.waitForPageLoad();
  }

  // ── Step 1: Fill property details ───────────────────────────

  async fillPropertyDetails(details: {
        addressLine1: string;
        addressLine2?: string;
        city: string;
        postcode: string;
        propertyValue: number;
        transactionType: 'sale' | 'purchase' | 'remortgage';
        leasehold?: boolean;
        newBuild?: boolean;
  }): Promise<void> {
        await this.addressLine1Input.fill(details.addressLine1);
        if (details.addressLine2) {
                await this.addressLine2Input.fill(details.addressLine2);
        }
        await this.cityInput.fill(details.city);
        await this.postcodeInput.fill(details.postcode);
        await this.propertyValueInput.fill(details.propertyValue.toString());
        await this.transactionTypeSelect.selectOption(details.transactionType);
        if (details.leasehold) {
                await this.leaseholdCheckbox.check();
        }
        if (details.newBuild) {
                await this.newBuildCheckbox.check();
        }
  }

  async useAddressLookup(postcode: string, addressLine?: string): Promise<void> {
        await this.addressLookupInput.fill(postcode);
        await this.addressSuggestions.waitFor({ state: 'visible' });
        if (addressLine) {
                const option = this.addressSuggestions.filter({ hasText: addressLine });
                await option.click();
        } else {
                await this.addressSuggestions.first().click();
        }
  }

  // ── Step 2: Fill client details ──────────────────────────────

  async fillClientDetails(client: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
  }): Promise<void> {
        await this.clientFirstNameInput.fill(client.firstName);
        await this.clientLastNameInput.fill(client.lastName);
        await this.clientEmailInput.fill(client.email);
        await this.clientPhoneInput.fill(client.phone);
  }

  // ── Step 3: Select solicitor ─────────────────────────────────

  async selectSolicitor(firmName: string): Promise<void> {
        await this.solicitorSearchInput.fill(firmName);
        const option = this.solicitorOptions.filter({ hasText: firmName }).first();
        await option.waitFor({ state: 'visible' });
        await option.click();
  }

  // ── Wizard navigation ────────────────────────────────────────

  async goToNextStep(): Promise<void> {
        await this.nextStepButton.click();
        await this.waitForPageLoad();
  }

  async goToPrevStep(): Promise<void> {
        await this.prevStepButton.click();
        await this.waitForPageLoad();
  }

  async submitEnquiry(): Promise<void> {
        await this.submitButton.click();
        await this.waitForPageLoad();
        // Should redirect to the new enquiry detail page
      await expect(this.page).toHaveURL(/\/enquiries\/[a-z0-9-]+$/);
  }

  // ── Complete full wizard flow ────────────────────────────────

  async createEnquiry(data: {
        property: Parameters<typeof this.fillPropertyDetails>[0];
        client: Parameters<typeof this.fillClientDetails>[0];
        solicitorFirm: string;
  }): Promise<void> {
        await this.goto();
        await this.fillPropertyDetails(data.property);
        await this.goToNextStep();
        await this.fillClientDetails(data.client);
        await this.goToNextStep();
        await this.selectSolicitor(data.solicitorFirm);
        await this.goToNextStep();
        // Step 4: confirm
      await expect(this.confirmSummary).toBeVisible();
        await this.submitEnquiry();
  }

  // ── Assertions ───────────────────────────────────────────────

  async expectCurrentStep(stepName: string): Promise<void> {
        await expect(this.currentStepLabel).toContainText(stepName);
  }

  async expectValidationError(fieldName?: string): Promise<void> {
        await expect(this.fieldErrors.first()).toBeVisible();
        if (fieldName) {
                const fieldError = this.page.getByTestId(`field-error-${fieldName}`);
                await expect(fieldError).toBeVisible();
        }
  }

  async expectNoValidationErrors(): Promise<void> {
        await expect(this.fieldErrors).toHaveCount(0);
  }
}
