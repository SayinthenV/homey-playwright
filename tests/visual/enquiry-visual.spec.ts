import { test, expect } from '@playwright/test';
import { EnquiryListPage } from '../../pages/enquiries/EnquiryListPage';
import { EnquiryDetailPage } from '../../pages/enquiries/EnquiryDetailPage';
import { NewEnquiryPage } from '../../pages/enquiries/NewEnquiryPage';
import { PercyHelper } from '../../helpers/PercyHelper';
import { AppliHelper } from '../../helpers/AppliHelper';
import { loadManifest } from '../../fixtures/test-data.setup';

/**
 * Visual regression tests — Enquiry pages
 *
 * Percy: runs when PERCY_TOKEN is set
 * Applitools: runs when APPLITOOLS_API_KEY is set
 * Both are no-ops locally without the env vars.
 */

test.describe('Enquiry List — Visual', () => {
  test.use({ storageState: '.auth/agent.json' });

  test('enquiry list — full page snapshot', async ({ page }) => {
    const listPage = new EnquiryListPage(page);
    const percy = new PercyHelper(page);
    const appli = new AppliHelper(page, {
      testName: 'Enquiry List - Agent - Full Page',
    });

    await listPage.goto();
    await appli.open();

    // Full page
    await percy.snapshot({
      name: 'Enquiry List - Agent - Full Page',
      fullPage: true,
      hideSelectors: ['time', '[datetime]'],
    });
    await appli.checkWindow('Enquiry List - Agent - Full Page', true);

    await appli.close(false);
  });

  test('enquiry list — responsive snapshots', async ({ page }) => {
    const listPage = new EnquiryListPage(page);
    const percy = new PercyHelper(page);

    await listPage.goto();

    await percy.responsiveSnapshot('Enquiry List - Agent - Responsive');
  });

  test('enquiry list — search results snapshot', async ({ page }) => {
    const listPage = new EnquiryListPage(page);
    const percy = new PercyHelper(page);

    await listPage.goto();
    await listPage.search('Test Property');
    await page.waitForTimeout(500); // let Turbo stream update

    await percy.snapshot({
      name: 'Enquiry List - Search Results',
      fullPage: false,
    });
  });

  test('enquiry list — empty state snapshot', async ({ page }) => {
    const listPage = new EnquiryListPage(page);
    const percy = new PercyHelper(page);

    await listPage.goto();
    await listPage.search('ZZZNOMATCH99999');
    await page.waitForTimeout(500);

    await percy.snapshot({
      name: 'Enquiry List - Empty State',
      fullPage: false,
    });
  });
});

test.describe('Enquiry Detail — Visual', () => {
  test.use({ storageState: '.auth/agent.json' });

  test('enquiry detail — overview tab snapshot', async ({ page }) => {
    const manifest = loadManifest();
    test.skip(!manifest || manifest.enquiries.length === 0, 'No test data manifest');

    const enquiry = manifest!.enquiries[0];
    const detailPage = new EnquiryDetailPage(page);
    const percy = new PercyHelper(page);
    const appli = new AppliHelper(page, {
      testName: 'Enquiry Detail - Overview Tab',
    });

    await detailPage.goto(enquiry.id);
    await appli.open();

    await percy.snapshot({
      name: 'Enquiry Detail - Overview Tab',
      fullPage: true,
      hideSelectors: ['time', '[datetime]', '.relative-time'],
    });
    await appli.checkWindow('Enquiry Detail - Overview Tab', true);

    await appli.close(false);
  });

  test('enquiry detail — action panel snapshot', async ({ page }) => {
    const manifest = loadManifest();
    test.skip(!manifest || manifest.enquiries.length === 0, 'No test data manifest');

    const enquiry = manifest!.enquiries[0];
    const detailPage = new EnquiryDetailPage(page);
    const percy = new PercyHelper(page);

    await detailPage.goto(enquiry.id);

    await percy.componentSnapshot(
      'Enquiry Detail - Action Panel',
      '[data-testid="action-panel"], .action-panel, aside.actions',
    );
  });
});

test.describe('New Enquiry Wizard — Visual', () => {
  test.use({ storageState: '.auth/agent.json' });

  test('new enquiry — step 1 snapshot', async ({ page }) => {
    const wizardPage = new NewEnquiryPage(page);
    const percy = new PercyHelper(page);

    await wizardPage.goto();

    await percy.snapshot({
      name: 'New Enquiry Wizard - Step 1 - Property Details',
      fullPage: false,
    });
  });

  test('new enquiry — step 1 validation errors snapshot', async ({ page }) => {
    const wizardPage = new NewEnquiryPage(page);
    const percy = new PercyHelper(page);

    await wizardPage.goto();
    // Trigger validation by clicking Next without filling in fields
    await page.getByRole('button', { name: /next|continue/i }).first().click().catch(() => {});
    await page.waitForTimeout(300);

    await percy.snapshot({
      name: 'New Enquiry Wizard - Step 1 - Validation Errors',
      fullPage: false,
    });
  });
});
