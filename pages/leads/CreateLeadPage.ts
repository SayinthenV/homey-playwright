import { Page, Locator, expect } from '@playwright/test';

/**
 * CreateLeadPage
 * ──────────────
 * Page Object for the 4-step "Create Lead" wizard on connectere.qa.homey.co.uk.
 *
 * URL pattern:  https://connectere.qa.homey.co.uk/leads/new/property
 *
 * Steps:
 *   1. Property   – lead type radio + property address lookup
 *   2. Clients    – client role, name, contact details
 *   3. Transaction – stage, offer price, additional flags
 *   4. Details    – agency, branch, key persons, case note → Create Lead
 *
 * The BASE_URL in playwright.config.ts must be set to https://connectere.qa.homey.co.uk
 * when running these tests (or set via ENV=qa with the connectere subdomain).
 */

export type LeadType =
  | 'sale'
  | 'purchase'
  | 'remortgage'
  | 'transfer_of_equity'
  | 'sale_and_purchase';

export type TransactionStage =
  | 'offer_accepted'
  | 'offer_received'
  | 'offer_imminent'
  | 'on_market'
  | 'valuation_booked'
  | 'enquiry_made';

export interface Step1Data {
  leadType: LeadType;
  postcode: string;
  buildingNumber: string;
}

export interface Step2Data {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface Step3Data {
  transactionStage: TransactionStage;
  offerPrice: string | number;
}

export interface Step4Data {
  agency: string;
  branch: string;
}

export class CreateLeadPage {
  readonly page: Page;

  // ── Step 1: Property ────────────────────────────────────────────────────
  readonly saleRadio: Locator;
  readonly purchaseRadio: Locator;
  readonly remortgageRadio: Locator;
  readonly transferOfEquityRadio: Locator;
  readonly saleAndPurchaseRadio: Locator;
  readonly postcodeInput: Locator;
  readonly buildingNumberInput: Locator;

  // ── Step 2: Clients ─────────────────────────────────────────────────────
  readonly legalOwnerRadio: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;

  // ── Step 3: Transaction ─────────────────────────────────────────────────
  readonly transactionStageSelect: Locator;
  readonly offerPriceInput: Locator;

  // ── Step 4: Details ─────────────────────────────────────────────────────
  readonly agencySelect: Locator;
  readonly branchSelect: Locator;

  // ── Navigation ──────────────────────────────────────────────────────────
  readonly nextButton: Locator;
  readonly createLeadButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Step 1
    this.saleRadio              = page.getByRole('radio', { name: /^sale$/i });
    this.purchaseRadio          = page.getByRole('radio', { name: /^purchase$/i });
    this.remortgageRadio        = page.getByRole('radio', { name: /^remortgage$/i });
    this.transferOfEquityRadio  = page.getByRole('radio', { name: /transfer of equity/i });
    this.saleAndPurchaseRadio   = page.getByRole('radio', { name: /sale & purchase/i });
    this.postcodeInput          = page.getByLabel(/postcode/i);
    this.buildingNumberInput    = page.getByPlaceholder(/enter a postcode to start searching/i);

    // Step 2
    this.legalOwnerRadio = page.getByRole('radio', { name: /legal owner/i });
    this.firstNameInput  = page.getByLabel(/first name/i);
    this.lastNameInput   = page.getByLabel(/last name/i);
    this.emailInput      = page.getByLabel(/^email$/i);
    this.phoneInput      = page.getByLabel(/phone number/i);

    // Step 3
    this.transactionStageSelect = page.getByLabel(/transaction stage/i);
    this.offerPriceInput        = page.getByLabel(/offer price/i);

    // Step 4
    this.agencySelect = page.getByLabel(/agency/i);
    this.branchSelect = page.getByLabel(/branch/i);

    // Nav
    this.nextButton       = page.getByRole('button', { name: /^next$/i });
    this.createLeadButton = page.getByRole('button', { name: /create lead/i });
    this.cancelButton     = page.getByRole('button', { name: /^cancel$/i });
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/leads/new/property');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForSelector('input[type="radio"]', { state: 'visible', timeout: 15_000 });
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickCreateLead(): Promise<void> {
    await this.createLeadButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ── Step 1: Property ────────────────────────────────────────────────────

  /** Maps lead_type CSV value to the correct radio button. */
  private leadTypeRadio(leadType: LeadType): Locator {
    const map: Record<LeadType, Locator> = {
      sale:                this.saleRadio,
      purchase:            this.purchaseRadio,
      remortgage:          this.remortgageRadio,
      transfer_of_equity:  this.transferOfEquityRadio,
      sale_and_purchase:   this.saleAndPurchaseRadio,
    };
    return map[leadType];
  }

  async fillStep1(data: Step1Data): Promise<void> {
    // Select lead type
    await this.leadTypeRadio(data.leadType).click();

    // Fill postcode
    await this.postcodeInput.fill(data.postcode);

    // Type building number — wait for suggestions dropdown
    await this.buildingNumberInput.click();
    await this.buildingNumberInput.fill(data.buildingNumber);

    // Wait for address suggestion matching the building number to appear
    const addressSuggestion = this.page.locator('li, [role="option"], button')
      .filter({ hasText: new RegExp(data.buildingNumber, 'i') })
      .first();
    await addressSuggestion.waitFor({ state: 'visible', timeout: 15_000 });
    await addressSuggestion.click();

    // Verify property card appeared
    await this.page.waitForSelector('text=UPRN', { timeout: 10_000 });
  }

  // ── Step 2: Clients ─────────────────────────────────────────────────────

  async fillStep2(data: Step2Data): Promise<void> {
    // Select Legal owner
    await this.legalOwnerRadio.click();

    // Fill contact info — at least one of email or phone is required
    if (data.email) {
      await this.emailInput.fill(data.email);
    }
    if (data.phone) {
      await this.phoneInput.fill(data.phone);
    }

    // Fill name
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
  }

  // ── Step 3: Transaction ─────────────────────────────────────────────────

  async fillStep3(data: Step3Data): Promise<void> {
    await this.transactionStageSelect.selectOption(data.transactionStage);
    await this.offerPriceInput.fill(String(data.offerPrice));
  }

  // ── Step 4: Details ─────────────────────────────────────────────────────

  async fillStep4(data: Step4Data): Promise<void> {
    // Agency — use selectOption with label matching (partial text)
    await this.agencySelect.selectOption({ label: data.agency });

    // After selecting agency, wait for branch dropdown to populate
    await this.page.waitForFunction(
      (branchName: string) => {
        const sel = document.querySelector('select[id*="branch"], select[name*="branch"]') as HTMLSelectElement | null;
        if (!sel) return false;
        return Array.from(sel.options).some(o => o.text.includes(branchName));
      },
      data.branch,
      { timeout: 10_000 },
    );
    await this.branchSelect.selectOption({ label: data.branch });
  }

  // ── Full wizard flow ─────────────────────────────────────────────────────

  /**
   * Runs through all 4 steps and clicks "Create Lead".
   * Returns the Case ID of the created lead (extracted from the redirect URL).
   */
  async createLead(
    step1: Step1Data,
    step2: Step2Data,
    step3: Step3Data,
    step4: Step4Data,
  ): Promise<string> {
    await this.goto();
    await this.fillStep1(step1);
    await this.clickNext();

    await this.fillStep2(step2);
    await this.clickNext();

    await this.fillStep3(step3);
    await this.clickNext();

    await this.fillStep4(step4);
    await this.clickCreateLead();

    // Wait for redirect to the new lead detail page
    // URL pattern: /leads/<case-id> or /dashboard with a flash message
    await this.page.waitForURL(/\/leads\/[a-z0-9-]+|dashboard/, { timeout: 30_000 });

    // Extract Case ID from flash or URL
    const url = this.page.url();
    const match = url.match(/\/leads\/([a-z0-9-]+)/i);
    return match ? match[1].toUpperCase() : '';
  }

  // ── Assertions ───────────────────────────────────────────────────────────

  async expectOnStep(stepLabel: string): Promise<void> {
    await expect(this.page.getByText(stepLabel, { exact: true }).first()).toBeVisible();
  }

  async expectSuccessFlash(): Promise<void> {
    await expect(
      this.page.getByText(/lead (created|successfully)/i),
    ).toBeVisible({ timeout: 10_000 });
  }
}
