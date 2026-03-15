import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@hackathon.dev';
const TEST_PASSWORD = 'TestPass123!';

test.describe('Hackathon Flow: Start → Live View → Reset', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. Login with email/password', async ({ page }) => {
    await page.goto('/');

    // Wait for login page to load
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/01-login-page.png' });

    // Click "Sign in with Email" to reveal the email form
    await page.locator('.email-toggle-button').click();

    // Fill in credentials
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.screenshot({ path: 'e2e/screenshots/02-credentials-filled.png' });

    // Submit
    await page.locator('[data-testid="email-submit"]').click();

    // Wait for dashboard to load (indicates successful auth)
    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/03-dashboard-loaded.png' });
  });

  test('2. Start Hackathon from Dashboard', async ({ page }) => {
    // Login first
    await page.goto('/');
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 15000 });
    await page.locator('.email-toggle-button').click();
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="email-submit"]').click();
    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });

    // Wait for dashboard to fully load (either Start or Reset button must appear)
    const eitherButton = page.locator('.dashboard-start-btn, .dashboard-reset-btn');
    await expect(eitherButton.first()).toBeVisible({ timeout: 15000 });

    // If hackathon is already running from a previous run, reset first
    const resetBtn = page.locator('.dashboard-reset-btn');
    if (await resetBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await resetBtn.click();
      await expect(page.locator('.dashboard-start-btn')).toBeVisible({ timeout: 15000 });
    }

    // Click "Start Hackathon"
    const startBtn = page.locator('.dashboard-start-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Verify hackathon is running - timer should appear
    await expect(page.locator('.dashboard-active-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.dashboard-status-label')).toHaveText('Live');
    await page.screenshot({ path: 'e2e/screenshots/04-hackathon-started.png' });

    // Verify timer is counting
    const timerEl = page.locator('.dashboard-timer');
    await expect(timerEl).toBeVisible();
    const timerText = await timerEl.textContent();
    expect(timerText).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test('3. Start Hackathon and verify Live View loads with team cards', async ({ page }) => {
    // Login first
    await page.goto('/');
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 15000 });
    await page.locator('.email-toggle-button').click();
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="email-submit"]').click();
    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });

    // Wait for dashboard to fully load (either Start or Reset button must appear)
    const eitherBtn = page.locator('.dashboard-start-btn, .dashboard-reset-btn');
    await expect(eitherBtn.first()).toBeVisible({ timeout: 15000 });

    // Reset first to ensure a clean state
    const resetBtn = page.locator('.dashboard-reset-btn');
    if (await resetBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await resetBtn.click();
      await expect(page.locator('.dashboard-start-btn')).toBeVisible({ timeout: 15000 });
    }

    // Start hackathon
    const startBtn = page.locator('.dashboard-start-btn');
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await expect(page.locator('.dashboard-active-container')).toBeVisible({ timeout: 10000 });

    // Navigate to Live View via sidebar
    await page.locator('a[href="/live"]').click();
    await expect(page.locator('.lv-page')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'e2e/screenshots/05-live-view-initial.png' });

    // Verify all 10 team cards are rendered
    const cards = page.locator('.lv-card');
    await expect(cards).toHaveCount(10);

    // Verify team codes are visible
    await expect(page.locator('.lv-team-code').first()).toBeVisible();
    const firstCode = await page.locator('.lv-team-code').first().textContent();
    expect(firstCode).toBe('T01');
    await page.screenshot({ path: 'e2e/screenshots/06-live-view-teams.png' });
  });

  test('4. Reset Hackathon and verify cleanup', async ({ page }) => {
    // Login first
    await page.goto('/');
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 15000 });
    await page.locator('.email-toggle-button').click();
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="email-submit"]').click();
    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });

    // Check if hackathon is running (if not, start it first)
    const resetBtn = page.locator('.dashboard-reset-btn');
    const startBtn = page.locator('.dashboard-start-btn');

    // If start button is visible, start the hackathon first
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await expect(page.locator('.dashboard-active-container')).toBeVisible({ timeout: 10000 });
    }

    // Now click Reset
    await expect(resetBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/09-before-reset.png' });
    await resetBtn.click();

    // Verify the start button reappears (hackathon is reset)
    await expect(page.locator('.dashboard-start-btn')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/10-after-reset.png' });

    // Navigate to Live View to verify cleanup
    await page.goto('/live');
    await expect(page.locator('.lv-page')).toBeVisible({ timeout: 15000 });

    // After reset, teams should be idle with no terminal output
    // Wait a moment for data to clear
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/11-live-view-after-reset.png' });

    // All cards should be in idle state (no active cards)
    const activeCards = page.locator('.lv-card--active');
    await expect(activeCards).toHaveCount(0, { timeout: 10000 });
  });
});
