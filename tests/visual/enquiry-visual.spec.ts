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
  test.use({ storageState: 'playwright/.auth/agent.json' });


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
