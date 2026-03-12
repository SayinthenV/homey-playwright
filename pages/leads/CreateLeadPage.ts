import { Page, Locator } from '@playwright/test';

export interface LeadData {
  testCaseId: string;
  leadType: 'Sale' | 'Purchase' | 'Remortgage' | 'Transfer of Equity' | 'Sale & Purchase';
  postcode: string;
  buildingNumber: string;
  transactionStage: string;
  offerPrice: string;
  agency: string;
  branch: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export class CreateLeadPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://connectere.qa.homey.co.uk/leads/new/property', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  async fillStep1(data: LeadData) {
    const { leadType, postcode, buildingNumber } = data;

    // Select lead type radio
    const radioMap: Record<string, string> = {
      'Sale':               'input[id*="business_type_seller"]',
      'Purchase':           'input[id*="business_type_buyer"]',
      'Remortgage':         'input[id*="business_type_remortgage"]',
      'Transfer of Equity': 'input[id*="business_type_transfer_of_equity"]',
      'Sale & Purchase':    'input[id*="business_type_sale_and_purchase"]',
    };
    const radioSelector = radioMap[leadType];
    if (!radioSelector) throw new Error(`Unknown lead type: ${leadType}`);

    await this.page.locator(radioSelector).click({ force: true });

    // --- Postcode ---
    // MUST use pressSequentially (not fill) so Stimulus keyboard listeners fire
    const postcodeInput = this.page.locator('#postcode_search_leads_property_form');
    await postcodeInput.click();
    await postcodeInput.pressSequentially(postcode, { delay: 50 });
    await postcodeInput.press('Tab'); // blur triggers Stimulus to enable building search

    // Wait for the building number input placeholder to change from default to "Flat/Building Number"
    await this.page.waitForFunction(
      () => {
        const el = document.querySelector('input[id*="address_search"]') as HTMLInputElement | null;
        return el && el.placeholder.toLowerCase().includes('flat') || el?.placeholder.toLowerCase().includes('building');
      },
      { timeout: 15000 }
    );

    // --- Building Number ---
    // MUST use pressSequentially so Stimulus keyboard listeners fire the address lookup API call
    const buildingSearchInput = this.page.locator('input[id*="address_search"]');
    await buildingSearchInput.click();
    await buildingSearchInput.pressSequentially(buildingNumber, { delay: 100 });

    // Wait for address dropdown options (Stimulus-powered autocomplete)
    await this.page.locator('li.address_search__option').first().waitFor({ state: 'visible', timeout: 15000 });

    // Click the first option that starts with our building number
    const firstOption = this.page.locator('li.address_search__option').first();
    await firstOption.click();

    // Wait for UPRN to be populated (confirms address was selected)
    await this.page.waitForFunction(
      () => {
        const el = document.querySelector('input[id*="uprn"]') as HTMLInputElement | null;
        return el && el.value && el.value.trim().length > 0;
      },
      { timeout: 15000 }
    );
  }

  async fillStep2(data: LeadData) {
    // Click "Legal owner" radio (first option)
    const legalOwnerRadio = this.page.locator('input[type="radio"]').filter({ hasText: /legal owner/i }).first();
    // Try the label approach
    const legalOwnerLabel = this.page.locator('label').filter({ hasText: /legal owner/i }).first();
    if (await legalOwnerLabel.isVisible()) {
      await legalOwnerLabel.click();
    } else {
      // Fallback: click first radio in client section
      await this.page.locator('input[id*="client_type"]').first().click({ force: true });
    }

    await this.page.locator('input[id*="email"]').fill(data.email);
    await this.page.locator('input[id*="first_name"]').fill(data.firstName);
    await this.page.locator('input[id*="last_name"]').fill(data.lastName);
  }

  async fillStep3(data: LeadData) {
    // Transaction stage
    await this.page.locator('select[id*="grade"]').selectOption({ label: data.transactionStage });

    // Offer price
    await this.page.locator('input[id*="price"]').fill(data.offerPrice);
  }

  async fillStep4(data: LeadData) {
    // Agency / Referring company
    await this.page.locator('select[id*="referring_company"]').selectOption({ label: data.agency });

    // Wait for branch to populate after agency selection
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

  async submitLead() {
    await this.page.getByRole('button', { name: /create lead/i }).click();
  }

  async getCreatedCaseId(): Promise<string> {
    // After creation, case ID appears in URL e.g. /cases/12345
    await this.page.waitForURL(/\/cases\/\d+/, { timeout: 30000 });
    const url = this.page.url();
    const match = url.match(/\/cases\/(\d+)/);
    if (!match) throw new Error(`Could not extract case ID from URL: ${url}`);
    return match[1];
  }
}
