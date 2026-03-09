import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';

/**
 * EnquiryDetailPage
 * -----------------
 * Detail view for a single enquiry/lead.
 * Agents view client info, property details, and can convert to a conveyance.
 *
 * Route: /enquiries/:id
 */
export class EnquiryDetailPage extends BasePage {

  readonly propertyAddress: Locator;
    readonly propertyValue: Locator;
    readonly transactionType: Locator;
    readonly clientName: Locator;
    readonly clientEmail: Locator;
    readonly statusBadge: Locator;
    readonly enquiryReference: Locator;
    readonly convertToConveyanceButton: Locator;
    readonly generateQuoteButton: Locator;
    readonly markAsLostButton: Locator;
    readonly editButton: Locator;
    readonly quotesSection: Locator;
    readonly quoteRows: Locator;
    readonly activityFeed: Locator;
    readonly addNoteInput: Locator;
    readonly addNoteButton: Locator;

  constructor(page: Page) {
        super(page);
        this.propertyAddress = page.getByTestId('enquiry-property-address');
        this.propertyValue = page.getByTestId('enquiry-property-value');
        this.transactionType = page.getByTestId('enquiry-transaction-type');
        this.clientName = page.getByTestId('enquiry-client-name');
        this.clientEmail = page.getByTestId('enquiry-client-email');
        this.statusBadge = page.getByTestId('enquiry-status-badge');
        this.enquiryReference = page.getByTestId('enquiry-reference');
        this.convertToConveyanceButton = page.getByRole('button', { name: /convert.*conveyance|instruct/i });
        this.generateQuoteButton = page.getByRole('button', { name: /generate.*quote|create.*quote/i });
        this.markAsLostButton = page.getByRole('button', { name: /mark.*lost|lost/i });
        this.editButton = page.getByRole('link', { name: /edit/i });
        this.quotesSection = page.getByTestId('enquiry-quotes-section');
        this.quoteRows = page.getByTestId('quote-row');
        this.activityFeed = page.getByTestId('activity-feed');
        this.addNoteInput = page.getByPlaceholder(/add.*note|write.*note/i);
        this.addNoteButton = page.getByRole('button', { name: /add note|save note/i });
  }

  async goto(enquiryId: string): Promise<void> {
        await this.page.goto(`/enquiries/${enquiryId}`);
        await this.waitForPageLoad();
  }

  async convertToConveyance(): Promise<void> {
        await this.convertToConveyanceButton.click();
        await this.waitForPageLoad();
        await expect(this.page).toHaveURL(/conveyances|confirm/);
  }

  async generateQuote(): Promise<void> {
        await this.generateQuoteButton.click();
        await this.waitForPageLoad();
  }

  async markAsLost(reason?: string): Promise<void> {
        await this.markAsLostButton.click();
        if (reason) {
                const reasonSelect = this.page.getByLabel(/reason/i);
                await reasonSelect.selectOption({ label: reason });
        }
        await this.page.getByRole('button', { name: /confirm/i }).click();
        await this.waitForTurboStream();
        await expect(this.statusBadge).toContainText(/lost/i);
  }

  async addNote(noteText: string): Promise<void> {
        await this.addNoteInput.fill(noteText);
        await this.addNoteButton.click();
        await this.waitForTurboStream();
        await expect(this.activityFeed).toContainText(noteText);
  }

  async getStatus(): Promise<string> {
        return (await this.statusBadge.textContent())?.trim() || '';
  }

  async expectStatus(status: string): Promise<void> {
        await expect(this.statusBadge).toContainText(status);
  }

  async expectPropertyAddress(address: string): Promise<void> {
        await expect(this.propertyAddress).toContainText(address);
  }

  async expectConvertButtonVisible(): Promise<void> {
        await expect(this.convertToConveyanceButton).toBeVisible();
  }

  async expectQuoteCount(count: number): Promise<void> {
        await expect(this.quoteRows).toHaveCount(count);
  }
}
