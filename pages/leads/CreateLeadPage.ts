import { Page, Locator, expect } from '@playwright/test';

/**
 * CreateLeadPage
 * ──────────────
 * Page Object for the 4-step "Create Lead" wizard on connectere.qa.homey.co.uk.
 *
 * URL pattern: https://connectere.qa.homey.co.uk/leads/new/property
 *
 * Steps:
 *  1. Property  – lead type radio + property address lookup
 *  2. Clients   – client role, name, contact details
 *  3. Transaction – stage, offer price, additional flags
 *  4. Details   – agency, branch, key persons, case note → Create Lead
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

  // ── Step 1: Property ──────────────────────────────────────────────────────
  readonly saleRadio: Locator;
      readonly purchaseRadio: Locator;
      readonly remortgageRadio: Locator;
      readonly transferOfEquityRadio: Locator;
      readonly saleAndPurchaseRadio: Locator;
      readonly postcodeInput: Locator;

  // ── Step 2: Clients ───────────────────────────────────────────────────────
  readonly legalOwnerRadio: Locator;
      readonly firstNameInput: Locator;
      readonly lastNameInput: Locator;
      readonly emailInput: Locator;
      readonly phoneInput: Locator;

  // ── Step 3: Transaction ───────────────────────────────────────────────────
  readonly transactionStageSelect: Locator;
      readonly offerPriceInput: Locator;

  // ── Step 4: Details ───────────────────────────────────────────────────────
  readonly agencySelect: Locator;
      readonly branchSelect: Locator;

  // ── Navigation ────────────────────────────────────────────────────────────
  readonly nextButton: Locator;
      readonly createLeadButton: Locator;
      readonly cancelButton: Locator;

  constructor(page: Page) {
          this.page = page;

        // Step 1 — use stable id-based selectors
        this.saleRadio = page.locator('input[id*="business_type_seller"]');
          this.purchaseRadio = page.locator('input[id*="business_type_buyer"]');
          this.remortgageRadio = page.locator('input[id*="business_type_remortgage"]');
          this.transferOfEquityRadio = page.locator('input[id*="business_type_transfer_of_equity"]');
          this.saleAndPurchaseRadio = page.locator('input[id*="business_type_sale_and_purchase"]');
          this.postcodeInput = page.locator('#postcode_search_leads_property_form');

        // Step 2 — use stable id-based selectors
        this.legalOwnerRadio = page.getByRole('radio', { name: /legal owner/i });
          this.firstNameInput = page.locator('input[id*="first_name"]').first();
          this.lastNameInput = page.locator('input[id*="last_name"]').first();
          this.emailInput = page.locator('input[type="email"]').first();
          this.phoneInput = page.locator('input[type="tel"]').first();

        // Step 3 — use stable id-based selectors
        this.transactionStageSelect = page.locator('select[id*="grade"]');
          this.offerPriceInput = page.locator('input[id*="price"]');

        // Step 4 — use stable id-based selectors
        this.agencySelect = page.locator('select[id*="referring_company"]');
          this.branchSelect = page.locator('select[id*="branch_id"]');

        // Nav
        this.nextButton = page.getByRole('button', { name: /^next$/i });
          this.createLeadButton = page.getByRole('button', { name: /create lead/i });
          this.cancelButton = page.getByRole('button', { name: /^cancel$/i });
  }

  // ── Navigation ────────────────────────────────────────────────────────────
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

  // ── Step 1: Property ──────────────────────────────────────────────────────
  private leadTypeRadio(leadType: LeadType): Locator {
          const map: Record<LeadType, Locator> = {
                    sale: this.saleRadio,
                    purchase: this.purchaseRadio,
                    remortgage: this.remortgageRadio,
                    transfer_of_equity: this.transferOfEquityRadio,
                    sale_and_purchase: this.saleAndPurchaseRadio,
          };
          return map[leadType];
  }

  async fillStep1(data: Step1Data): Promise<void> {
          // Select lead type
        await this.leadTypeRadio(data.leadType).click();

        // Fill postcode and tab away to enable the building number field
        await this.postcodeInput.fill(data.postcode);
          await this.postcodeInput.press('Tab');

        // Wait for the building number search field to become active
        // (placeholder changes from "Enter a postcode..." to "Enter Flat/Building Number...")
        const buildingInput = this.page.locator(
                  'input[id*="address_search"]',
                );
          await buildingInput.waitFor({ state: 'visible', timeout: 10_000 });
          await buildingInput.click();
          await buildingInput.fill(data.buildingNumber);

        // Wait for address suggestion dropdown — use specific class to avoid matching nav <li> elements
        const addressSuggestion = this.page
            .locator('li.address_search__option')
            .filter({ hasText: new RegExp(`^${data.buildingNumber}[,\\s]`, 'i') })
            .first();
          await addressSuggestion.waitFor({ state: 'visible', timeout: 15_000 });
          await addressSuggestion.click();

        // Verify address was selected: wait for the hidden UPRN input to be populated
        // (this is the most reliable signal — the UPRN field gets the value after selection)
        await this.page.waitForFunction(
                  () => {
                              const uprn = document.querySelector(
                                            'input[id*="uprn"]',
                                          ) as HTMLInputElement | null;
                              return uprn !== null && uprn.value.trim().length > 0;
                  },
            { timeout: 10_000 },
                );
  }

  // ── Step 2: Clients ───────────────────────────────────────────────────────
  async fillStep2(data: Step2Data): Promise<void> {
          await this.legalOwnerRadio.click();

        if (data.email) {
                  await this.emailInput.fill(data.email);
        }
          if (data.phone) {
                    await this.phoneInput.fill(data.phone);
          }

        await this.firstNameInput.fill(data.firstName);
          await this.lastNameInput.fill(data.lastName);
  }

  // ── Step 3: Transaction ───────────────────────────────────────────────────
  async fillStep3(data: Step3Data): Promise<void> {
          await this.transactionStageSelect.selectOption(data.transactionStage);
          await this.offerPriceInput.fill(String(data.offerPrice));
  }

  // ── Step 4: Details ───────────────────────────────────────────────────────
  async fillStep4(data: Step4Data): Promise<void> {
          await this.agencySelect.selectOption({ label: data.agency });

        // Wait for branch dropdown to be populated after agency selection
        await this.page.waitForFunction(
                  (branchName: string) => {
                              const sel = document.querySelector(
                                            'select[id*="branch_id"]',
                                          ) as HTMLSelectElement | null;
                              if (!sel) return false;
                              return Array.from(sel.options).some(o => o.text.includes(branchName));
                  },
                  data.branch,
            { timeout: 10_000 },
                );
          await this.branchSelect.selectOption({ label: data.branch });
  }

  // ── Full wizard flow ───────────────────────────────────────────────────────
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

        await this.page.waitForURL(/\/leads\/[a-z0-9-]+|dashboard/, { timeout: 30_000 });
          const url = this.page.url();
          const match = url.match(/\/leads\/([a-z0-9-]+)/i);
          return match ? match[1].toUpperCase() : '';
  }

  // ── Assertions ─────────────────────────────────────────────────────────────
  async expectOnStep(stepLabel: string): Promise<void> {
          await expect(this.page.getByText(stepLabel, { exact: true }).first()).toBeVisible();
  }

  async expectSuccessFlash(): Promise<void> {
          await expect(
                    this.page.getByText(/lead (created|successfully)/i),
                  ).toBeVisible({ timeout: 10_000 });
  }
}
