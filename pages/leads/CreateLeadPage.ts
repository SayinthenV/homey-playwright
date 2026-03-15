import { Page, Locator } from '@playwright/test';

// ─── Step data interfaces (match what create-lead.spec.ts passes) ────────────
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
	// legalOwnerRadio: the app renders the radio id as *_role_legal_owner.
	// Using .first() keeps strict-mode happy when multiple clients exist.
	readonly legalOwnerRadio: Locator;
    	readonly emailInput: Locator;
    	readonly firstNameInput: Locator;
    	readonly lastNameInput: Locator;
    	readonly transactionStageSelect: Locator;
    	readonly offerPriceInput: Locator;

	constructor(page: Page) {
        		this.page = page;

    		// The app renders the role radio id as *_role_legal_owner for all lead types.
    		// Keeping the old *_client_type / *_client_role patterns as fallbacks ensures
    		// forward-compatibility if the Rails attribute name ever changes.
    		this.legalOwnerRadio = page
        			.locator(
                        				'input[type="radio"][id*="role_legal_owner"], ' +
                        				'input[type="radio"][id*="client_type"], ' +
                        				'input[type="radio"][id*="client_role"]'
                        			)
        			.first();
        		this.emailInput = page.locator('input[id*="email"]').first();
        		this.firstNameInput = page.locator('input[id*="first_name"]').first();
        		this.lastNameInput = page.locator('input[id*="last_name"]').first();
        		// grade select is only present for sale/purchase/sale_and_purchase lead types
    		this.transactionStageSelect = page.locator('select[id*="grade"]').first();
        		this.offerPriceInput = page.locator('input[id*="price"]').first();
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

    		// Normalise lead type — maps CSV values to radio input selectors
    		const radioMap: Record<string, string> = {
                			'sale':               'input[id*="business_type_seller"]',
                			'purchase':           'input[id*="business_type_buyer"]',
                			'remortgage':         'input[id*="business_type_remortgage"]',
                			'transfer_of_equity': 'input[id*="business_type_transfer_of_equity"]',
                			'sale_and_purchase':  'input[id*="business_type_sale_and_purchase"]',
                			// Human-readable variants
                			'Sale':               'input[id*="business_type_seller"]',
                			'Purchase':           'input[id*="business_type_buyer"]',
                			'Remortgage':         'input[id*="business_type_remortgage"]',
                			'Transfer of Equity': 'input[id*="business_type_transfer_of_equity"]',
                			'Sale & Purchase':    'input[id*="business_type_sale_and_purchase"]',
            };

    		const radioSelector = radioMap[leadType];
        		if (!radioSelector) throw new Error(`Unknown lead type: ${leadType}`);
        		await this.page.locator(radioSelector).first().click({ force: true });

    		// ── Postcode ──────────────────────────────────────────────────────────
    		// For Sale & Purchase the form renders TWO property sections — use .first()
    		// MUST use pressSequentially (not fill) so Stimulus keyboard listeners fire.
    		const postcodeInput = this.page.locator('#postcode_search_leads_property_form').first();
        		await postcodeInput.click();
        		await postcodeInput.pressSequentially(postcode, { delay: 50 });
        		// Small wait to let Stimulus process the postcode blur event
    		await this.page.waitForTimeout(300);
        		await postcodeInput.press('Tab');

    		// Wait for address_search placeholder to change to indicate the postcode
    		// lookup completed and the building-number field is now active.
    		await this.page.waitForFunction(
                			() => {
                                				const el = document.querySelector('input[id*="address_search"]') as HTMLInputElement | null;
                                				if (!el) return false;
                                				const ph = el.placeholder.toLowerCase();
                                				return ph.includes('flat') || ph.includes('building') || ph.includes('number');
                            },
                { timeout: 20000 }
                		);

    		// ── Building Number ───────────────────────────────────────────────────
    		// MUST use pressSequentially so Stimulus keyboard listeners fire the address lookup
    		const buildingSearchInput = this.page.locator('input[id*="address_search"]').first();
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
        		// Click "Legal owner" radio.
    		// Strategy 1: click the visible label so the hidden radio gets selected.
    		// Strategy 2 (fallback): force-click the radio input directly.
    		const legalOwnerLabel = this.page
        			.locator('label')
        			.filter({ hasText: /legal\s+owner/i })
        			.first();

    		try {
                			await legalOwnerLabel.waitFor({ state: 'visible', timeout: 5000 });
                			await legalOwnerLabel.click();
            } catch {
                			// Label not found — fall back to clicking the radio input directly.
        			await this.legalOwnerRadio.waitFor({ state: 'attached', timeout: 10000 });
                			await this.legalOwnerRadio.click({ force: true });
            }

    		await this.emailInput.fill(data.email);
        		await this.firstNameInput.fill(data.firstName);
        		await this.lastNameInput.fill(data.lastName);
    }

	// ── Step 3: Transaction ───────────────────────────────────────────────────
	async fillStep3(data: Step3Data) {
        		// The grade (transaction stage) select is ONLY rendered for sale, purchase,
    		// and sale_and_purchase lead types. It does NOT appear for remortgage or
    		// transfer_of_equity. Guard with isVisible() before attempting to select.
    		const gradeSelect = this.page.locator('select[id*="grade"]').first();
        		const gradeVisible = await gradeSelect.isVisible().catch(() => false);

    		if (gradeVisible) {
                			try {
                                				await gradeSelect.selectOption({ value: data.transactionStage });
                            } catch {
                                				await gradeSelect.selectOption({ label: data.transactionStage });
                            }
            }

    		// offer_price is also sale/purchase-specific; guard it the same way.
    		const priceInput = this.page.locator('input[id*="offer_price"]').first();
        		const priceVisible = await priceInput.isVisible().catch(() => false);
        		if (priceVisible) {
                    			await priceInput.fill(data.offerPrice);
                }
    }

	// ── Step 4: Details ───────────────────────────────────────────────────────
	async fillStep4(data: Step4Data) {
        		const agencySelect = this.page.locator('select[id*="referring_company"]');

    		// Verify the requested agency exists in the dropdown before selecting.
    		// This gives an immediate, actionable error rather than a 15 s timeout.
    		const availableOptions = await agencySelect.locator('option').allTextContents();
        		const optionExists = availableOptions.some(o => o.trim() === data.agency);
        		if (!optionExists) {
                    			throw new Error(
                                    				`Agency "${data.agency}" not found in referring_company select.\n` +
                                    				`Available options: ${availableOptions.map(o => o.trim()).filter(Boolean).join(', ')}`
                                    			);
                }

    		await agencySelect.selectOption({ label: data.agency });

    		// Wait for branch options to load after agency selection (Stimulus async update)
    		await this.page.waitForFunction(
                			() => {
                                				const branchSelect = document.querySelector('select[id*="branch_id"]') as HTMLSelectElement | null;
                                				return branchSelect && branchSelect.options.length > 1;
                            },
                { timeout: 10000 }
                		);

    		await this.page.locator('select[id*="branch_id"]').selectOption({ label: data.branch });
    }
}
