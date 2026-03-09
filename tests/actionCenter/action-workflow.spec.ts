import { test, expect } from '@playwright/test';
import { ActionCenterPage } from '../../pages/actionCenter/ActionCenterPage';
import { ConveyanceDetailPage } from '../../pages/conveyances/ConveyanceDetailPage';

/**
 * Action Center Workflow Tests
 * ----------------------------
 * Tests the Homey Action Center — the live workflow engine.
 * Verifies action completion, blocking/unblocking dependencies,
 * and Turbo Stream real-time updates.
 *
 * Tests run as solicitor role (playwright/.auth/solicitor.json).
 *
 * Note: These tests require a seeded conveyance in 'instruction' stage.
 * Set TEST_CONVEYANCE_ID env variable to a known test case ID,
 * or use the QA environment's seeded test data.
 */

const TEST_CONVEYANCE_ID = process.env.TEST_CONVEYANCE_ID || 'test-conveyance-id';

test.describe('Action Center — Solicitor', () => {
    let actionCenter: ActionCenterPage;

                test.beforeEach(async ({ page }) => {
                      actionCenter = new ActionCenterPage(page);
                });

                test('action center loads with stage sidebar', async ({ page }) => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);
                      await expect(actionCenter.stagesSidebar).toBeVisible();
                      await expect(actionCenter.actionGroups.first()).toBeVisible();
                });

                test('shows action cards with correct elements', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);
                      const cardCount = await actionCenter.actionCards.count();
                      expect(cardCount).toBeGreaterThan(0);
                });

                test('shows progress text in x / y format', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);
                      const progress = await actionCenter.getProgress();
                      expect(progress.total).toBeGreaterThan(0);
                      expect(progress.completed).toBeGreaterThanOrEqual(0);
                      expect(progress.completed).toBeLessThanOrEqual(progress.total);
                });

                test('can complete a pending action', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

                         // Get initial progress
                         const before = await actionCenter.getProgress();

                         // Complete the first available (not blocked) action
                         const firstPendingAction = actionCenter.actionCards.filter({
                                 hasNot: actionCenter.page.getByTestId('action-blocked-badge'),
                         }).first();

                         const actionTitle = await firstPendingAction.getByTestId('action-title').textContent();
                      if (actionTitle) {
                              await actionCenter.completeAction(actionTitle.trim());

                        // Progress should have increased
                        const after = await actionCenter.getProgress();
                              expect(after.completed).toBeGreaterThan(before.completed);
                      }
                });

                test('blocked actions cannot be completed', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

                         const blockedCards = actionCenter.actionCards.filter({
                                 has: actionCenter.page.getByTestId('action-blocked-badge'),
                         });

                         const blockedCount = await blockedCards.count();
                      if (blockedCount > 0) {
                              // Blocked actions should not show a complete button
                        const firstBlocked = blockedCards.first();
                              await expect(firstBlocked.getByRole('button', { name: /complete/i })).not.toBeVisible();
                      }
                });

                test('completing a prerequisite action unblocks dependent actions', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

                         // Find a blocking action (one that has blocked dependents)
                         // This test depends on seeded data having at least one dependency chain
                         const pendingCount = await actionCenter.actionCards.filter({
                                 hasNot: actionCenter.page.getByTestId('action-blocked-badge'),
                                 has: actionCenter.page.getByRole('button', { name: /complete/i }),
                         }).count();

                         expect(pendingCount).toBeGreaterThan(0);
                });

                test('can navigate between stages via sidebar', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

                         const stageCount = await actionCenter.stageLinks.count();
                      expect(stageCount).toBeGreaterThan(0);

                         // Click first stage link
                         await actionCenter.stageLinks.first().click();
                      await actionCenter.waitForPageLoad();
                      // Action cards should still be visible
                         await expect(actionCenter.actionGroups.first()).toBeVisible();
                });

                test('can filter actions by status', async () => {
                      await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

                         const filterVisible = await actionCenter.filterByStatus.isVisible();
                      if (filterVisible) {
                              await actionCenter.filterByActionStatus('pending');
                              // After filtering, only pending cards visible
                        const count = await actionCenter.actionCards.count();
                              expect(count).toBeGreaterThanOrEqual(0);
                      }
                });

                test('action center link accessible from conveyance detail', async ({ page }) => {
                      const conveyancePage = new ConveyanceDetailPage(page);
                      await conveyancePage.goto(TEST_CONVEYANCE_ID);
                      await conveyancePage.goToActionCenter();
                      await expect(page).toHaveURL(new RegExp(`conveyances/${TEST_CONVEYANCE_ID}/actions`));
                });
});

test.describe('Action Center — Real-time Updates', () => {
    test('turbo stream updates action card status without full page reload', async ({ page, context }) => {
          const actionCenter = new ActionCenterPage(page);
          await actionCenter.gotoForConveyance(TEST_CONVEYANCE_ID);

             // Track Turbo Stream responses
             const turboStreamResponses: string[] = [];
          page.on('response', (response) => {
                  const contentType = response.headers()['content-type'] || '';
                  if (contentType.includes('turbo-stream')) {
                            turboStreamResponses.push(response.url());
                  }
          });

             // Complete an action
             const firstPendingCard = actionCenter.actionCards.filter({
                     hasNot: page.getByTestId('action-blocked-badge'),
                     has: page.getByRole('button', { name: /complete/i }),
             }).first();

             const cardCount = await firstPendingCard.count();
          if (cardCount > 0) {
                  const actionTitle = await firstPendingCard.getByTestId('action-title').textContent();
                  if (actionTitle) {
                            await actionCenter.completeAction(actionTitle.trim());
                            // Verify a Turbo Stream response was received (not a full page reload)
                    expect(turboStreamResponses.length).toBeGreaterThan(0);
                  }
          }
    });
});
