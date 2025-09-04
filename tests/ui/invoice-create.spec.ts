import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.fill('input[name="email"]', 'user@nextmail.com');
  await page.fill('input[name="password"]', '123456');
  const loginButton = page.locator('form button');
  await expect(loginButton).toBeVisible();
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  const errorMessage = page.locator('div[aria-live="polite"] p');
  if (await errorMessage.isVisible()) {
    const errorText = await errorMessage.textContent();
    throw new Error('Login failed: ' + errorText);
  }
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('main').getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
}

test('Create a new invoice via UI', async ({ page }) => {
  await login(page);

  // Go to the Create Invoice page
  await page.goto('/dashboard/invoices/create');
  // Create page doesn't render an H1; verify breadcrumbs and form controls instead
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs).toContainText(/invoices/i);
  await expect(breadcrumbs).toContainText(/create invoice/i);
  // Ensure form fields are present
  await expect(page.getByLabel('Choose customer')).toBeVisible();
  await expect(page.getByLabel('Choose an amount')).toBeVisible();

  // Fill out the form
  // Select a known customer by label
  await page.getByLabel('Choose customer').selectOption({ label: 'Evil Rabbit' });

  // Use a distinctive amount that is unlikely to collide
  const amount = '111.33';
  const formattedAmount = '$111.33';
  await page.getByLabel('Choose an amount').fill(amount);

  // Choose status
  await page.getByRole('radio', { name: 'Paid' }).check();

  // Submit the form
  await expect(page.getByTestId('create-invoice-submit')).toBeEnabled();
  await page.getByTestId('create-invoice-submit').click();

  // Expect redirect back to invoices page
  await expect(page).toHaveURL('/dashboard/invoices');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/invoices/i);

  // Verify the new invoice appears in the table (desktop) with the chosen customer and amount
  const table = page.locator('table');
  if (await table.isVisible()) {
    const row = table
      .getByRole('row')
      .filter({ has: page.getByText('Evil Rabbit') })
      .filter({ has: page.getByText(formattedAmount) });
    await expect(row).toHaveCount(1, { timeout: 15000 });
  } else {
    // Fallback for mobile layout: look for cards list
    await expect(page.getByText('Evil Rabbit')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(formattedAmount)).toBeVisible({ timeout: 15000 });
  }
});
