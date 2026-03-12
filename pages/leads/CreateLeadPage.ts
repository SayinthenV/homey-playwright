import { Page, Locator } from '@playwright/test';

// ─── Step data interfaces (match what create-lead.spec.ts passes) ─────────────

export interface Step1Data {
  leadType: string; // CSV format: 'sale' | 'purchase' | 'remortgage' | 'transfer_of_equity' | 'sale_and_purchase'
  postcode: string;
  buildingNumber: string;
}

export interface Step2Data {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface Step3Data {
  transactionStage: string; // CSV format e.g. 'offer_accepted' (value attribute)
  offerPrice: string;
}

export interface Step4Data {
  agency: string;
  branch: string;
}

export class CreateLeadPage {
  readonly page: Page;

  // ── Public locators (used directly by validation tests) ──────────────────
  readonly legalOwnerRadio: Locator;
  readonly emailInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly transactionStageSelect: Locator;
  readonly offerPriceInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.legalOwnerRadio        = page.locator('input[id*="client_type"]').first();
    this.emailInput             = page.locator('input[id*="email"]');
    this.firstNameInput         = page.locator('input[id*="first_name"]');
    this.lastNameInput          = page.locator('input[id*="last_name"]');
    this.transactionStageSelect = page.locator('select[id*="grade"]');
    this.offerPriceInput        = page.locator('input[id*="price"]');
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('https://connectere.qa.homey.co.uk/leads/new/property', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  /** Assert the wizard is on the expected step (e.g. 'Property', 'Clients') */
  async expectOnStep(stepName: string) {
    await this.page.waitForFunction(
      (name: string) => document.body.textContent?.includes(name),
      stepName,
      { timeout: 10000 }
    );
  }

  /** Click the "Next" button (advances the wizard by one step) */
  async clickNext() {
    await this.page.getByRole('button', { name: /next/i }).click();
  }

  /** Click the final "Create Lead" button on step 4 */
  async clickCreateLead() {
    await this.page.getByRole('button', { name: /create lead/i }).click();
  }

  // ── Step 1: Property ──────────────────────────────────────────────────────

  async fillStep1(data: Step1Data) {
    const { leadType, postcode, buildingNumber } = data;

    // Normalise lead type — accept both CSV format (lowercase_underscore) and display format
    // Maps to the radio input selector
    const radioMap: Record<string, string> = {
      // Display format (title case)
      'sale':               'input[id*="business_type_seller"]',
      'purchase':           'input[id*="business_type_buyer"]',
      'remortgage':         'input[id*="business_type_remortgage"]',
      'transfer_of_equity': 'input[id*="business_type_transfer_of_equity"]',
      'sale_and_purchase':  'input[id*="business_type_sale_and_purchase"]',
      // Also support human-readable variants
      'Sale':               'input[id*="business_type_seller"]',
      'Purchase':           'input[id*="business_type_buyer"]',
      'Remortgage':         'input[id*="business_type_remortgage"]',
      'Transfer of Equity': 'input[id*="business_type_transfer_of_equity"]',
      'Sale & Purchase':    'input[id*="business_type_sale_and_purchase"]',
    };
    const radioSelector = radioMap[leadType];
    if (!radioSelector) throw new Error(`Unknown lead type: ${leadType}`);

    await this.page.locator(radioSelector).click({ force: true });

    // ── Postcode ──────────────────────────────────────────────────────────
    // MUST use pressSequentially (not fill) so Stimulus keyboard listeners fire
    const postcodeInput = this.page.locator('#postcode_search_leads_property_form');
    await postcodeInput.click();
    await postcodeInput.pressSequentially(postcode, { delay: 50 });
    await postcodeInput.press('Tab'); // blur triggers Stimulus to enable building number input

    // Wait for the building number placeholder to change to "Flat/Building Number"
    await this.page.waitForFunction(
      () => {
        const el = document.querySelector('input[id*="address_search"]') as HTMLInputElement | null;
        if (!el) return false;
        const ph = el.placeholder.toLowerCase();
        return ph.includes('flat') || ph.includes('building');
      },
      { timeout: 15000 }
    );

    // ── Building Number ───────────────────────────────────────────────────
    // MUST use pressSequentially so Stimulus keyboard listeners fire the address lookup
    const buildingSearchInput = this.page.locator('input[id*="address_search"]');
    await buildingSearchInput.click();
    await buildingSearchInput.pressSequentially(buildingNumber, { delay: 100 });

    // Wait for address dropdown options (Stimulus-powered autocomplete)
    await this.page.locator('li.address_search__option').first().waitFor({
      state: 'visible',
      timeout: 15000,
    });

    // Click the first address option
    await this.page.locator('li.address_search__option').first().click();

    // Confirm address selected: UPRN must be populated
    await this.page.waitForFunction(
      () => {
        const el = document.querySelector('input[id*="uprn"]') as HTMLInputElement | null;
        return el && el.value && el.value.trim().length > 0;
      },
      { timeout: 15000 }
    );
  }

  // ── Step 2: Clients ───────────────────────────────────────────────────────

  async fillStep2(data: Step2Data) {
    // Click "Legal owner" radio (first client type option)
    const legalOwnerLabel = this.page.locator('label').filter({ hasText: /legal owner/i }).first();
    if (await legalOwnerLabel.isVisible()) {
      await legalOwnerLabel.click();
    } else {
      await this.legalOwnerRadio.click({ force: true });
    }

    await this.emailInput.fill(data.email);
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
  }

  // ── Step 3: Transaction ───────────────────────────────────────────────────

  async fillStep3(data: Step3Data) {
    // transactionStage may be a value attribute (e.g. 'offer_accepted') or label text
    // Try by value first, then fall back to label
    const select = this.transactionStageSelect;
    try {
      await select.selectOption({ value: data.transactionStage });
    } catch {
      await select.selectOption({ label: data.transactionStage });
    }
    await this.offerPriceInput.fill(data.offerPrice);
  }

  // ── Step 4: Details ───────────────────────────────────────────────────────

  async fillStep4(data: Step4Data) {
    // Agency / Referring company
    await this.page.locator('select[id*="referring_company"]').selectOption({ label: data.agency });

    // Wait for branch options to load after agency selection
    await this.page.waitForFunction(
      () => {
        const branchSelect = document.querySelector('select[id*="branch_id"]') as HTMLSelectElement | null;
        return branchSelect && branchSelect.options.length > 1;
      },
      { timeout: 10000 }
    );

    // Branch
    await this.page.locator('select[id*="branch_id"]').selectOption({ label: data.branch });
  }
}
