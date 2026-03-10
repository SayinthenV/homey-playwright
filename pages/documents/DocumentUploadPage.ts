import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { BasePage } from '../base/BasePage';

/**
 * DocumentUploadPage - Homey Document Management POM
 * Handles file uploads (Active Storage), drag-and-drop, document list,
 * filtering, status tracking, and deletion within the Homey platform.
 */

export type DocumentCategory = 'identity' | 'property' | 'mortgage' | 'survey' | 'legal' | 'other';
export type DocumentStatus = 'pending' | 'uploaded' | 'under_review' | 'verified' | 'rejected';

export interface UploadedDocument {
    name: string;
    category: DocumentCategory;
    status: DocumentStatus;
    uploadedAt?: string;
}

export class DocumentUploadPage extends BasePage {
    private readonly fileInput: Locator;
    private readonly dropZone: Locator;
    private readonly uploadButton: Locator;
    private readonly uploadModal: Locator;
    private readonly categorySelect: Locator;
    private readonly documentNameInput: Locator;
    private readonly uploadSubmitButton: Locator;
    private readonly cancelUploadButton: Locator;
    private readonly documentItems: Locator;
    private readonly emptyState: Locator;
    private readonly categoryFilter: Locator;
    private readonly statusFilter: Locator;
    private readonly searchInput: Locator;
    private readonly uploadProgressBar: Locator;
    private readonly uploadSuccessMessage: Locator;
    private readonly uploadErrorMessage: Locator;

  constructor(page: Page) {
        super(page);

      this.fileInput = page.locator('input[type="file"]').first();
        this.dropZone = page.locator('[data-controller="upload"], [data-testid="drop-zone"], .upload-zone, .dropzone').first();
        this.uploadButton = page.getByRole('button', { name: /upload.*document|add.*document/i }).first();
        this.uploadModal = page.getByRole('dialog').first();
        this.categorySelect = page.getByLabel(/category|document.*type/i).first();
        this.documentNameInput = page.getByLabel(/document.*name|name/i).first();
        this.uploadSubmitButton = page.getByRole('button', { name: /upload|save|confirm/i }).first();
        this.cancelUploadButton = page.getByRole('button', { name: /cancel/i }).first();
        this.documentItems = page.locator('[data-testid="document-item"], .document-item, .document-row');
        this.emptyState = page.getByText(/no documents|upload your first/i).first();
        this.categoryFilter = page.locator('[data-testid="category-filter"], select[name*="category"]').first();
        this.statusFilter = page.locator('[data-testid="status-filter"], select[name*="status"]').first();
        this.searchInput = page.getByPlaceholder(/search documents/i).first();
        this.uploadProgressBar = page.locator('[role="progressbar"], .upload-progress').first();
        this.uploadSuccessMessage = page.getByText(/uploaded successfully|document.*added/i).first();
        this.uploadErrorMessage = page.getByText(/upload failed|error.*upload/i).first();
  }

  async goto(conveyanceId: string): Promise<void> {
        await this.page.goto(`${process.env.BASE_URL}/conveyances/${conveyanceId}/documents`);
        await this.waitForPageLoad();
  }

  /**
     * Upload a file using the standard file input.
     * Handles optional modal for category/name metadata.
     */
  async uploadFile(
        filePath: string,
        options: { category?: DocumentCategory; name?: string } = {}
      ): Promise<void> {
        if (!fs.existsSync(filePath)) {
                throw new Error(`[DocumentUploadPage] File not found: ${filePath}`);
        }

      const hasUploadBtn = await this.uploadButton.isVisible().catch(() => false);
        if (hasUploadBtn) {
                await this.uploadButton.click();
                await this.waitForTurboFrame('document-upload').catch(() => {});
        }

      await this.fileInput.setInputFiles(filePath);
        await this.page.waitForTimeout(300);

      const modalVisible = await this.uploadModal.isVisible().catch(() => false);
        if (modalVisible) {
                if (options.name) await this.documentNameInput.fill(options.name);
                if (options.category) await this.categorySelect.selectOption(options.category);
                await this.uploadSubmitButton.click();
        }

      await this.waitForUploadComplete();
  }

  /**
     * Simulate drag-and-drop file upload.
     * Falls back to standard file input if no drop zone visible.
     */
  async dragAndDropUpload(filePath: string): Promise<void> {
        const dropZoneVisible = await this.dropZone.isVisible().catch(() => false);
        if (!dropZoneVisible) {
                await this.uploadFile(filePath);
                return;
        }
        await this.dropZone.dispatchEvent('dragenter');
        await this.page.waitForTimeout(100);
        await this.fileInput.setInputFiles(filePath);
        await this.waitForUploadComplete();
  }

  /**
     * Upload multiple files in sequence.
     */
  async uploadMultipleFiles(
        files: Array<{ path: string; category?: DocumentCategory; name?: string }>
      ): Promise<void> {
        for (const file of files) {
                await this.uploadFile(file.path, { category: file.category, name: file.name });
                await this.page.waitForTimeout(500);
        }
  }

  /**
     * Generate and upload a minimal test PDF.
     * Useful in CI where real documents aren't available.
     */
  async uploadTestPdf(
        fileName = 'test-document.pdf',
        options: { category?: DocumentCategory } = {}
      ): Promise<string> {
        const tmpDir = path.join(process.cwd(), 'test-results', 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpPath = path.join(tmpDir, fileName);

      const pdfContent = `%PDF-1.4
      1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
      2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
      3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
      xref
      0 4
      0000000000 65535 f
      0000000009 00000 n
      0000000058 00000 n
      0000000115 00000 n
      trailer<</Size 4/Root 1 0 R>>
      startxref
      191
      %%EOF`;

      fs.writeFileSync(tmpPath, pdfContent);
        await this.uploadFile(tmpPath, { category: options.category ?? 'other', name: fileName });
        return tmpPath;
  }

  /**
     * Wait for Active Storage direct upload to complete.
     * Direct uploads fire Turbo Stream events when done.
     */
  async waitForUploadComplete(timeout = 30000): Promise<void> {
        const progressVisible = await this.uploadProgressBar.isVisible().catch(() => false);
        if (progressVisible) {
                await this.uploadProgressBar.waitFor({ state: 'hidden', timeout });
        }
        await this.waitForTurboStream('append').catch(() => {});
        await this.page.waitForTimeout(500);
  }

  // ─── Document list ────────────────────────────────────────────────────────

  async getDocumentCount(): Promise<number> {
        return this.documentItems.count();
  }

  async getDocumentNames(): Promise<string[]> {
        const count = await this.documentItems.count();
        const names: string[] = [];
        for (let i = 0; i < count; i++) {
                const nameEl = this.documentItems.nth(i)
                  .locator('.document-name, [data-testid="doc-name"], td:first-child').first();
                const text = await nameEl.textContent().catch(() => '');
                if (text) names.push(text.trim());
        }
        return names;
  }

  async getDocumentStatus(documentName: string): Promise<DocumentStatus | null> {
        const item = this.documentItems.filter({ hasText: documentName }).first();
        const statusEl = item.locator('[data-status], .document-status, [data-testid="doc-status"]').first();
        const dataAttr = await statusEl.getAttribute('data-status').catch(() => null);
        if (dataAttr) return dataAttr as DocumentStatus;
        const text = await statusEl.textContent().catch(() => null);
        return text ? (text.trim().toLowerCase().replace(/\s+/g, '_') as DocumentStatus) : null;
  }

  async deleteDocument(documentName: string): Promise<void> {
        const item = this.documentItems.filter({ hasText: documentName }).first();
        const deleteButton = item.getByRole('button', { name: /delete|remove/i })
          .or(item.locator('[data-testid="delete-doc-btn"]').first());
        await deleteButton.click();

      const confirmButton = this.page.getByRole('button', { name: /confirm|yes.*delete/i }).first();
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmButton.click();
                await this.waitForTurboStream('remove').catch(() => {});
        }
  }

  async filterByCategory(category: DocumentCategory): Promise<void> {
        await this.categoryFilter.selectOption(category);
        await this.waitForTurboStream().catch(() => {});
  }

  async filterByStatus(status: DocumentStatus): Promise<void> {
        await this.statusFilter.selectOption(status);
        await this.waitForTurboStream().catch(() => {});
  }

  async search(query: string): Promise<void> {
        await this.searchInput.fill(query);
        await this.page.keyboard.press('Enter');
        await this.waitForTurboStream().catch(() => {});
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async expectDocumentVisible(documentName: string): Promise<void> {
        await expect(this.documentItems.filter({ hasText: documentName }).first())
          .toBeVisible({ timeout: 10000 });
  }

  async expectDocumentCount(count: number): Promise<void> {
        await expect(this.documentItems).toHaveCount(count, { timeout: 10000 });
  }

  async expectUploadSuccess(): Promise<void> {
        await expect(this.uploadSuccessMessage).toBeVisible({ timeout: 15000 });
  }

  async expectUploadError(): Promise<void> {
        await expect(this.uploadErrorMessage).toBeVisible({ timeout: 10000 });
  }

  async expectDocumentStatus(documentName: string, status: DocumentStatus): Promise<void> {
        const item = this.documentItems.filter({ hasText: documentName }).first();
        const statusEl = item.locator('[data-status], .document-status').first();
        await expect(statusEl).toHaveAttribute('data-status', status, { timeout: 10000 })
          .catch(async () => {
                    await expect(statusEl).toContainText(status.replace(/_/g, ' '), { timeout: 10000 });
          });
  }

  async expectEmptyState(): Promise<void> {
        await expect(this.emptyState).toBeVisible({ timeout: 5000 });
  }

  async expectDropZoneActive(): Promise<void> {
        await expect(this.dropZone).toBeVisible({ timeout: 5000 });
  }
}
