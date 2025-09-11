import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function stabilizeForVisuals(page: Page) {
  // Ensure web fonts are loaded to avoid text reflow
  await page.evaluate(async () => {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  });
  // Let network settle after Suspense/DB requests
  await page.waitForLoadState('networkidle');
}

async function login(page: Page) {
  await page.goto('/login');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.fill('input[name="email"]', 'user@nextmail.com');
  await page.fill('input[name="password"]', '123456');
  const loginButton = page.locator('form button');
  await expect(loginButton).toBeVisible();
  await loginButton.click();
  // Ensure we land on dashboard
  await expect(page).toHaveURL(/\/dashboard/);
}

// Check if the exact baseline for the current browser/OS exists
function baselineExists(name: string): boolean {
  const fileName = name.endsWith('.png') ? name : `${name}.png`;
  const expectedPath = test.info().snapshotPath(fileName);
  return fs.existsSync(expectedPath);
}

// Public pages (no auth required)
test.describe('Public visual regressions', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  test('Home hero snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/');
    await stabilizeForVisuals(page);
    const welcome = page
      .getByText('Welcome to Acme.', { exact: false })
      .locator('xpath=ancestor::div[contains(@class, "rounded-lg")]');
    await expect(welcome).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('home-hero')).toBeTruthy();
    } else {
      test.skip(!baselineExists('home-hero.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await expect(welcome).toHaveScreenshot('home-hero.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Login form snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/login');
    await stabilizeForVisuals(page);
    const header = page
      .getByRole('heading', { level: 1, name: /please log in to continue\./i })
      .locator('xpath=ancestor::div[contains(@class, "rounded-lg")]');
    await expect(header).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('login-form')).toBeTruthy();
    } else {
      test.skip(!baselineExists('login-form.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await expect(header).toHaveScreenshot('login-form.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });
});

test.describe('Visual regressions', () => {
  // Force consistent rendering across runs
  // Match baseline snapshot viewport (height 720) so element dimensions are consistent
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  test.beforeAll(async ({ request }) => {
    // Ensure seed data exists for deterministic pages like edit invoice
    try {
      await request.get('/seed');
    } catch {}
  });
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard shell visual snapshot (SideNav)', async ({ page }) => {
    // Respect Playwright's snapshot update mode (CLI and UI mode)
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
  await page.goto('/dashboard');
    if (process.env.CI) {
      await expect(baselineExists('dashboard-sidenav')).toBeTruthy();
    } else {
      test.skip(
        !baselineExists('dashboard-sidenav.png') && !updating,
        'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.'
      );
    }
    // Sidebar exists on all dashboard pages
    const sideNav = page.locator('div.md\\:w-64');
    await expect(sideNav).toBeVisible();
    await stabilizeForVisuals(page);
    // Avoid hover states
    await page.mouse.move(0, 0);
    await expect(sideNav).toHaveScreenshot('dashboard-sidenav.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Invoices header + toolbar visual snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/dashboard/invoices');
    if (process.env.CI) {
      await expect(baselineExists('invoices-header')).toBeTruthy();
      await expect(baselineExists('invoices-toolbar')).toBeTruthy();
    } else {
      test.skip(
        (!baselineExists('invoices-header.png') || !baselineExists('invoices-toolbar.png')) && !updating,
        'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.'
      );
    }
    const header = page.getByRole('heading', { level: 1, name: /invoices/i }).locator('xpath=ancestor::div[1]');
    const toolbar = page.getByPlaceholder('Search invoices...').locator('xpath=ancestor::div[1]');
    await expect(header).toBeVisible();
    await expect(toolbar).toBeVisible();
    await stabilizeForVisuals(page);
    await page.mouse.move(0, 0);

    await expect(header).toHaveScreenshot('invoices-header.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
    await expect(toolbar).toHaveScreenshot('invoices-toolbar.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Dashboard header snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/dashboard');
  const header = page.getByRole('heading', { level: 1, name: /dashboard/i });
    await expect(header).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('dashboard-header')).toBeTruthy();
    } else {
      test.skip(!baselineExists('dashboard-header.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await stabilizeForVisuals(page);
    await page.mouse.move(0, 0);
    await expect(header).toHaveScreenshot('dashboard-header.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Customers header snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/dashboard/customers');
    const header = page.getByRole('heading', { level: 1, name: /customers/i }).first();
    await expect(header).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('customers-header')).toBeTruthy();
    } else {
      test.skip(!baselineExists('customers-header.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await stabilizeForVisuals(page);
    await page.mouse.move(0, 0);
    await expect(header).toHaveScreenshot('customers-header.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Create invoice form snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    await page.goto('/dashboard/invoices/create');
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('create-invoice-form')).toBeTruthy();
    } else {
      test.skip(!baselineExists('create-invoice-form.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await stabilizeForVisuals(page);
    await page.mouse.move(0, 0);
    await expect(form).toHaveScreenshot('create-invoice-form.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });

  test('Edit invoice breadcrumb snapshot', async ({ page }) => {
    const updating = (test.info().config.updateSnapshots ?? 'none') !== 'none';
    // Known seeded invoice id: concatenation of customer id and date
    const invoiceId = 'd6e15727-9fe1-4961-8c5b-ea44a9bd81aa-2022-12-06';
    await page.goto(`/dashboard/invoices/${invoiceId}/edit`);
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]').first();
    await expect(breadcrumb).toBeVisible();
    if (process.env.CI) {
      await expect(baselineExists('edit-invoice-breadcrumb')).toBeTruthy();
    } else {
      test.skip(!baselineExists('edit-invoice-breadcrumb.png') && !updating, 'Baseline missing. Enable "Update snapshots" in Playwright UI or run with --update-snapshots.');
    }
    await stabilizeForVisuals(page);
    await page.mouse.move(0, 0);
    await expect(breadcrumb).toHaveScreenshot('edit-invoice-breadcrumb.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.07,
      timeout: 20000,
    });
  });
});
