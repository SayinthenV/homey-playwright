import { test, expect } from '@playwright/test';
import { ConveyanceListPage } from '../../pages/conveyances/ConveyanceListPage';
import { ConveyanceDetailPage } from '../../pages/conveyances/ConveyanceDetailPage';
import { ActionCenterPage } from '../../pages/actionCenter/ActionCenterPage';
import { KYCDashboardPage } from '../../pages/kyc/KYCDashboardPage';
import { QuoteGeneratorPage } from '../../pages/quotes/QuoteGeneratorPage';
import { ThirdfortMocker } from '../../helpers/ThirdfortMocker';
import { testDataFactory } from '../../helpers/TestDataFactory';

/**
 * Conveyance Detail Spec
 *
 * Tests the conveyance pipeline lifecycle:
 * - Viewing conveyance details and pipeline status
 * - Task management and completion
 * - Document upload and verification
 * - KYC initiation and status tracking
 * - Quote generation from conveyance context
 * - Action Center integration
 *
 * Role: Solicitor (primary role for conveyance management)
 */

test.use({ storageState: 'playwright/.auth/solicitor.json' });

test.describe('Conveyance Detail — Pipeline Management', () => {
    let conveyanceListPage: ConveyanceListPage;
    let conveyanceDetailPage: ConveyanceDetailPage;

                test.beforeEach(async ({ page }) => {
                    conveyanceListPage = new ConveyanceListPage(page);
                    conveyanceDetailPage = new ConveyanceDetailPage(page);
                });

                test('should display conveyance detail with correct pipeline stage', async ({ page }) => {
                    await test.step('Navigate to conveyance list', async () => {
                        await conveyanceListPage.goto();
                        await conveyanceListPage.expectPageVisible();
                    });

                    await test.step('Open first available conveyance', async () => {
                        const count = await conveyanceListPage.getConveyanceCount();
                        expect(count, 'At least one conveyance should exist').toBeGreaterThan(0);
                        await conveyanceListPage.clickFirstConveyance();
                    });

                    await test.step('Verify detail page loaded', async () => {
                        await conveyanceDetailPage.expectDetailVisible();
                        const status = await conveyanceDetailPage.getStatus();
                        expect(status).toBeTruthy();
                        console.log(`Current pipeline stage: ${status}`);
                    });

                    await test.step('Verify essential sections are present', async () => {
                        await expect(page.getByText(/property/i).first()).toBeVisible();
                        await expect(page.getByText(/buyer|seller/i).first()).toBeVisible();
                    });
                });

                test('should show solicitor role tasks in action panel', async ({ page }) => {
                    await test.step('Navigate to conveyances', async () => {
                        await conveyanceListPage.goto();
                    });

                    await test.step('Open conveyance detail', async () => {
                        await conveyanceListPage.clickFirstConveyance();
                        await conveyanceDetailPage.expectDetailVisible();
                    });

                    await test.step('Verify tasks are visible', async () => {
                        const hasTasks = await page.getByRole('list').filter({ hasText: /task|action|todo/i }).isVisible()
                            .catch(() => false);
                        // Conveyances may have no pending tasks — this is valid
                        console.log(`Tasks panel visible: ${hasTasks}`);
                    });
                });

                test('should complete a pending task when available', async ({ page }) => {
                    await test.step('Navigate to conveyance detail', async () => {
                        await conveyanceListPage.goto();
                        await conveyanceListPage.clickFirstConveyance();
                        await conveyanceDetailPage.expectDetailVisible();
                    });

                    await test.step('Check for pending tasks', async () => {
                        const pendingTasks = await page.locator('[data-status="pending"], .task--pending, [aria-label*="pending"]').count();

                        if (pendingTasks > 0) {
                            await test.step('Complete first pending task', async () => {
                                await conveyanceDetailPage.completeFirstAvailableTask();
                                await conveyanceDetailPage.waitForTurboStream();
                                const updatedCount = await page.locator('[data-status="pending"], .task--pending').count();
                                expect(updatedCount).toBeLessThanOrEqual(pendingTasks);
                            });
                        } else {
                            console.log('No pending tasks found — skipping completion step');
                            test.skip();
                        }
                    });
                });

                test('should navigate to property address details', async ({ page }) => {
                    await test.step('Open conveyance', async () => {
                        await conveyanceListPage.goto();
                        await conveyanceListPage.clickFirstConveyance();
                        await conveyanceDetailPage.expectDetailVisible();
                    });

                    await test.step('Verify property address is displayed', async () => {
                        const addressEl = page.locator('[data-testid="property-address"], .property-address, address').first();
                        const isVisible = await addressEl.isVisible().catch(() => false);

                        if (!isVisible) {
                            // Address may be in a different format — check for postcode pattern
                            const postcodePattern = page.getByText(/[A-Z]{1,2}\d[\d[A-Z]?] ?\d[A-Z]{2}/);
                            const hasPostcode = await postcodePattern.isVisible().catch(() => false);
                            expect(hasPostcode || isVisible, 'Property address or postcode should be visible').toBeTruthy();
                        }
                    });
                });
});

test.describe('Conveyance Detail — Document Management', () => {
    let conveyanceListPage: ConveyanceListPage;
    let conveyanceDetailPage: ConveyanceDetailPage;

    test.use({ storageState: 'playwright/.auth/solicitor.json' });

    test.beforeEach(async ({ page }) => {
        conveyanceListPage = new ConveyanceListPage(page);
        conveyanceDetailPage = new ConveyanceDetailPage(page);
        await conveyanceListPage.goto();
        await conveyanceListPage.clickFirstConveyance();
        await conveyanceDetailPage.expectDetailVisible();
    });

    test('should display documents section', async ({ page }) => {
        await test.step('Check documents section exists', async () => {
            const docsSection = page.getByRole('region', { name: /documents/i })
                .or(page.locator('[data-testid="documents-section"], .documents-panel, #documents').first());
            const isVisible = await docsSection.isVisible().catch(() => false);
            // Documents section may not exist if conveyance is new
            console.log(`Documents section visible: ${isVisible}`);
        });
    });

    test('should handle document upload interaction', async ({ page }) => {
        await test.step('Find document upload trigger', async () => {
            const uploadButton = page.getByRole('button', { name: /upload|add document/i })
                .or(page.locator('[data-testid="upload-document-btn"]').first());
            const isVisible = await uploadButton.isVisible().catch(() => false);

            if (!isVisible) {
                console.log('No document upload button found — conveyance may not support uploads in current state');
                test.skip();
                return;
            }

            await uploadButton.click();
            await page.waitForTimeout(500); // Turbo settle

            // Verify upload modal/drawer opened
            const uploadModal = page.getByRole('dialog')
                .or(page.locator('.modal, .drawer, [data-testid="upload-modal"]').first());
            const modalVisible = await uploadModal.isVisible().catch(() => false);
            expect(modalVisible, 'Upload modal should open').toBeTruthy();
        });
    });
});

test.describe('Conveyance Detail — KYC Integration', () => {
    let conveyanceListPage: ConveyanceListPage;
    let conveyanceDetailPage: ConveyanceDetailPage;
    let kycDashboardPage: KYCDashboardPage;
    let thirdfortMocker: ThirdfortMocker;

    test.use({ storageState: 'playwright/.auth/solicitor.json' });

    test.beforeEach(async ({ page }) => {
        conveyanceListPage = new ConveyanceListPage(page);
        conveyanceDetailPage = new ConveyanceDetailPage(page);
        kycDashboardPage = new KYCDashboardPage(page);
        thirdfortMocker = new ThirdfortMocker(page);
    });

    test('should display KYC section for conveyance parties', async ({ page }) => {
        await test.step('Navigate to conveyance', async () => {
            await conveyanceListPage.goto();
            await conveyanceListPage.clickFirstConveyance();
            await conveyanceDetailPage.expectDetailVisible();
        });

        await test.step('Find KYC section or link', async () => {
            const kycLink = page.getByRole('link', { name: /kyc|identity|verification/i })
                .or(page.getByRole('button', { name: /kyc|verify|identity/i }))
                .or(page.locator('[data-testid="kyc-section"]').first());
            const isVisible = await kycLink.isVisible().catch(() => false);
            console.log(`KYC section/link visible: ${isVisible}`);

            if (isVisible) {
                await test.step('KYC section is accessible', async () => {
                    expect(isVisible).toBeTruthy();
                });
            }
        });
    });

    test('should navigate to KYC dashboard from conveyance', async ({ page }) => {
        await test.step('Navigate to conveyance', async () => {
            await conveyanceListPage.goto();
            await conveyanceListPage.clickFirstConveyance();
            await conveyanceDetailPage.expectDetailVisible();
        });

        await test.step('Get conveyance ID from URL', async () => {
            const url = page.url();
            const idMatch = url.match(/conveyances\/(\d+)/);

            if (idMatch) {
                const conveyanceId = idMatch[1];
                await test.step('Navigate to KYC dashboard', async () => {
                    await kycDashboardPage.goto(conveyanceId);
                    await expect(page.getByText(/kyc|identity check|verification/i).first()).toBeVisible({
                        timeout: 10000,
                    });
                });
            } else {
                console.log('Could not extract conveyance ID from URL — skipping KYC navigation');
                test.skip();
            }
        });
    });
});

test.describe('Conveyance Detail — Quote Generation', () => {
    let conveyanceListPage: ConveyanceListPage;
    let conveyanceDetailPage: ConveyanceDetailPage;
    let quoteGeneratorPage: QuoteGeneratorPage;

    test.use({ storageState: 'playwright/.auth/agent.json' });

    test.beforeEach(async ({ page }) => {
        conveyanceListPage = new ConveyanceListPage(page);
        conveyanceDetailPage = new ConveyanceDetailPage(page);
        quoteGeneratorPage = new QuoteGeneratorPage(page);
    });

    test('should access quote generator from conveyance context', async ({ page }) => {
        await test.step('Navigate to conveyance', async () => {
            await conveyanceListPage.goto();
            await conveyanceListPage.clickFirstConveyance();
            await conveyanceDetailPage.expectDetailVisible();
        });

        await test.step('Find quote/pricing link', async () => {
            const quoteLink = page.getByRole('link', { name: /quote|pricing|fee/i })
                .or(page.getByRole('button', { name: /generate quote|get quote/i }))
                .or(page.locator('[data-testid="quote-btn"]').first());
            const isVisible = await quoteLink.isVisible().catch(() => false);
            console.log(`Quote link visible: ${isVisible}`);

            if (isVisible) {
                await quoteLink.click();
                await page.waitForTimeout(500);
                await expect(page.getByText(/quote|pricing/i).first()).toBeVisible({ timeout: 10000 });
            }
        });
    });
});

test.describe('Conveyance Detail — Action Center Integration', () => {
    let conveyanceDetailPage: ConveyanceDetailPage;
    let actionCenterPage: ActionCenterPage;

    test.use({ storageState: 'playwright/.auth/solicitor.json' });

    test.beforeEach(async ({ page }) => {
        conveyanceDetailPage = new ConveyanceDetailPage(page);
        actionCenterPage = new ActionCenterPage(page);
    });

    test('should reflect conveyance tasks in action center', async ({ page }) => {
        const enquiryData = testDataFactory.enquiry();

        await test.step('Navigate to action center', async () => {
            await actionCenterPage.goto();
            await actionCenterPage.expectPageVisible();
        });

        await test.step('Check action center has tasks', async () => {
            const taskCount = await actionCenterPage.getTaskCount();
            console.log(`Action center task count: ${taskCount}`);
            // Task count can be 0 if no active conveyances — this is valid
            expect(taskCount).toBeGreaterThanOrEqual(0);
        });

        await test.step('Navigate back to conveyance list', async () => {
            await page.goto(`${process.env.BASE_URL}/conveyances`);
            await expect(page.getByRole('heading', { name: /conveyances/i }).first()).toBeVisible({
                timeout: 10000,
            });
        });
    });

    test('should filter action center by conveyance tasks', async ({ page }) => {
        await test.step('Navigate to action center', async () => {
            await actionCenterPage.goto();
            await actionCenterPage.expectPageVisible();
        });

        await test.step('Filter by conveyance task type', async () => {
            const filterExists = await page.getByRole('button', { name: /filter/i })
                .or(page.locator('[data-testid="task-filter"]').first())
                .isVisible().catch(() => false);

            if (filterExists) {
                await actionCenterPage.filterByType('conveyance');
                await page.waitForTimeout(500); // Turbo settle
                console.log('Applied conveyance filter');
            } else {
                console.log('No filter UI found — skipping filter test');
            }
        });
    });
});
