// End-to-end money paths: the real SPA, driven in a browser, sourcing the seeded
// Hebrew world from the live backend. Each test asserts the backend was actually
// called (waitForResponse) so it can't pass on the demo fallback.
import { test, expect, type Page } from '@playwright/test';

const SEEDED_NOTIFICATION_COUNT = 9;

/** Enters the app via the demo button and lets the API auth settle. */
async function demoLogin(page: Page): Promise<void> {
  await page.goto('/');
  const demoBtn = page.locator('.auth-demo-btn');
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click();
  }
  // Best-effort token wait: a real (secured) backend stores a Bearer token via
  // ensureDemoApiAuth — wait for it so the next fetch carries it. MOCK_MODE serves
  // guarded routes anonymously (injected TEST_USER), so no token is ever stored —
  // don't block on it; the per-test response assertions prove the backend was served.
  await page
    .waitForFunction(
      () =>
        !!(
          localStorage.getItem('sensei_api_access_token_v1') ||
          sessionStorage.getItem('sensei_api_access_token_v1')
        ),
      undefined,
      { timeout: 8_000 },
    )
    .catch(() => undefined);
  // Ensure we're actually in the app before navigating on.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
}

test('calendar is served by GET /calendar after demo login', async ({ page }) => {
  await demoLogin(page);
  const calendar = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/calendar' && r.request().method() === 'GET' && r.ok(),
    { timeout: 20_000 },
  );
  await page.goto('/#/calendar');
  const res = await calendar;
  expect(res.ok()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('notification center is served by GET /notifications (9 seeded)', async ({ page }) => {
  await demoLogin(page);
  const notifications = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/notifications' && r.request().method() === 'GET' && r.ok(),
    { timeout: 20_000 },
  );
  await page.goto('/#/notifications');
  const res = await notifications;
  const rows = (await res.json()) as unknown[];
  expect(rows).toHaveLength(SEEDED_NOTIFICATION_COUNT);
  await expect(page.getByRole('heading', { name: 'מרכז ההתראות' })).toBeVisible();
  await expect(page.getByText('סיכום AI מוכן').first()).toBeVisible();
});

test('settings profile is served by GET /auth/me', async ({ page }) => {
  await demoLogin(page);
  const profile = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/auth/me' && r.request().method() === 'GET' && r.ok(),
    { timeout: 20_000 },
  );
  await page.goto('/#/settings');
  const res = await profile;
  const body = (await res.json()) as { full_name?: string };
  expect(body.full_name).toBe('ד״ר רותם שגב');
  await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible();
});

test('prep report renders content from the report API (no blocking error)', async ({ page }) => {
  await demoLogin(page);
  // The prep report is served by the report API — the per-patient
  // /next-meeting-report, or (when the patient has an upcoming meeting) the
  // per-meeting /meeting-reports/{meetingId}. Accept either; the page renders
  // from whichever the ReportPage requests.
  const report = page.waitForResponse((r) => {
    const path = new URL(r.url()).pathname;
    return (path.endsWith('/next-meeting-report') || path.includes('/meeting-reports/')) && r.ok();
  }, { timeout: 20_000 });
  await page.goto('/#/report/00000000-0000-4000-8000-0000000000a1');
  await report;
  await expect(page.getByRole('heading', { name: 'דוח הכנה לפגישה' })).toBeVisible();
  // the graceful path never surfaces the raw backend generation error
  await expect(page.getByText('ANTHROPIC_API_KEY')).toHaveCount(0);
});
