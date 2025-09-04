import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  // Wait for login form to be visible
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.fill('input[name="email"]', 'user@nextmail.com');
  await page.fill('input[name="password"]', '123456');
  const loginButton = page.locator('form button');
  await expect(loginButton).toBeVisible();
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  // Check for login error message
  const errorMessage = page.locator('div[aria-live="polite"] p');
  if (await errorMessage.isVisible()) {
    const errorText = await errorMessage.textContent();
    throw new Error('Login failed: ' + errorText);
  }
  // Confirm dashboard navigation after login
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('main').getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
});

test('Navigate to Dashboard page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/dashboard/i);
});

test('Navigate to Invoices page', async ({ page }) => {
  await page.goto('/dashboard/invoices');
  await expect(page).toHaveURL('/dashboard/invoices');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/invoices/i);
});

test('Navigate to Customers page', async ({ page }) => {
  await page.goto('/dashboard/customers');
  await expect(page).toHaveURL('/dashboard/customers');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/customers/i);
});

// Updated: breadcrumbs exist on create/edit pages, not the invoices list page
test('Breadcrumbs are visible on Create Invoice page', async ({ page }) => {
  await page.goto('/dashboard/invoices/create');
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs).toContainText(/invoices/i);
  await expect(breadcrumbs).toContainText(/create invoice/i);
});

test('Sidebar navigation works', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: /Invoices/i }).click();
  await expect(page).toHaveURL('/dashboard/invoices');
  await page.getByRole('link', { name: /Customers/i }).click();
  await expect(page).toHaveURL('/dashboard/customers');
});
