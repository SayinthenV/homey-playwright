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
    test.use({ storageState: '.auth/solicitor.json' });

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
    test.use({ storageState: '.auth/solicitor.json' });

                test('conveyance detail — overview tab', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const detailPage = new ConveyanceDetailPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, { testName: 'Conveyance Detail - Overview' });

                         await detailPage.goto(conv.id);
                      await appli.open();

                         await percy.snapshot({
                                 name: 'Conveyance Detail - Overview Tab',
                                 fullPage: true,
                                 hideSelectors: ['time', '[datetime]', '.relative-time'],
                         });
                      await appli.checkWindow('Conveyance Detail - Overview Tab', true);
                      await appli.close(false);
                });

                test('conveyance detail — documents tab', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const detailPage = new ConveyanceDetailPage(page);
                      const percy = new PercyHelper(page);

                         await detailPage.goto(conv.id);

                         // Click documents tab
                         const docsTab = page.getByRole('tab', { name: /documents/i });
                      if (await docsTab.isVisible().catch(() => false)) {
                              await docsTab.click();
                              await page.waitForTimeout(500);
                      }

                         await percy.snapshot({
                                 name: 'Conveyance Detail - Documents Tab',
                                 fullPage: false,
                         });
                });

                test('conveyance detail — payments tab', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const detailPage = new ConveyanceDetailPage(page);
                      const percy = new PercyHelper(page);

                         await detailPage.goto(conv.id);

                         const paymentsTab = page.getByRole('tab', { name: /payments/i });
                      if (await paymentsTab.isVisible().catch(() => false)) {
                              await paymentsTab.click();
                              await page.waitForTimeout(500);
                      }

                         await percy.snapshot({
                                 name: 'Conveyance Detail - Payments Tab',
                                 fullPage: false,
                         });
                });

                test('conveyance detail — KYC tab', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const detailPage = new ConveyanceDetailPage(page);
                      const percy = new PercyHelper(page);

                         await detailPage.goto(conv.id);

                         const kycTab = page.getByRole('tab', { name: /kyc/i });
                      if (await kycTab.isVisible().catch(() => false)) {
                              await kycTab.click();
                              await page.waitForTimeout(500);
                      }

                         await percy.snapshot({
                                 name: 'Conveyance Detail - KYC Tab',
                                 fullPage: false,
                         });
                });
});

test.describe('Action Centre — Visual', () => {
    test.use({ storageState: '.auth/solicitor.json' });

                test('action centre — full page snapshot', async ({ page }) => {
                      const manifest = loadManifest();
                      test.skip(!manifest || manifest.conveyances.length === 0, 'No test data manifest');

                         const conv = manifest!.conveyances[0];
                      const actionPage = new ActionCenterPage(page);
                      const percy = new PercyHelper(page);
                      const appli = new AppliHelper(page, { testName: 'Action Centre - Solicitor' });

                         await actionPage.goto(conv.id);
                      await appli.open();

                         await percy.snapshot({
                                 name: 'Action Centre - Solicitor - Full Page',
                                 fullPage: true,
                                 hideSelectors: ['time', '[datetime]', '.relative-time'],
                         });
                      await appli.checkWindow('Action Centre - Full Page', true);
                      await appli.close(false);
                });
});
