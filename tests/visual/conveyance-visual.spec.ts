import { test } from '@playwright/test';
import { ConveyanceListPage } from '../../pages/conveyances/ConveyanceListPage';
import { ConveyanceDetailPage } from '../../pages/conveyances/ConveyanceDetailPage';
import { ActionCenterPage } from '../../pages/actionCenter/ActionCenterPage';
import { PercyHelper } from '../../helpers/PercyHelper';
import { AppliHelper } from '../../helpers/AppliHelper';
import { loadManifest } from '../../fixtures/test-data.setup';


/**
 * Visual regression tests — Conveyance pages
 * Percy + Applitools, both are no-ops without their respective env vars.
 */


test.describe('Conveyance List — Visual', () => {
    test.use({ storageState: 'playwright/.auth/solicitor.json' });


                test('conveyance list — full page snapshot', async ({ page }) => {
                      const listPage = new ConveyanceListPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, { testName: 'Conveyance List - Solicitor' });


                         await listPage.goto();
                      await appli.open();


                         await percy.snapshot({
                                 name: 'Conveyance List - Solicitor - Full Page',
                                 fullPage: true,
                                 hideSelectors: ['time', '[datetime]', '.relative-time'],
                         });
                      await appli.checkWindow('Conveyance List - Solicitor - Full Page', true);
                      await appli.close(false);
                });


                test('conveyance list — responsive snapshots', async ({ page }) => {
                      const listPage = new ConveyanceListPage(page);
                      const percy = new PercyHelper(page);


                         await listPage.goto();
                      await percy.responsiveSnapshot('Conveyance List - Responsive');
                });


                test('conveyance list — status filter active snapshot', async ({ page }) => {
                      const listPage = new ConveyanceListPage(page);
                      const percy = new PercyHelper(page);


                         await listPage.goto();
                      // Apply status filter if available
                         const filterBtn = page.locator('[data-testid="status-filter"], select[name="status"]').first();
                      if (await filterBtn.isVisible().catch(() => false)) {
                              await filterBtn.selectOption('active').catch(() => {});
                              await page.waitForTimeout(500);
                      }


                         await percy.snapshot({
                                 name: 'Conveyance List - Status Filter Active',
                                 fullPage: false,
                         });
                });
});


test.describe('Conveyance Detail — Visual', () => {
    test.use({ storageState: 'playwright/.auth/solicitor.json' });


                test('conveyance detail — overview tab', async ({ page }) => {
