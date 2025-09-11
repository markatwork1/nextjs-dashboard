import { test, expect } from '@playwright/test';

// Force desktop layout for deterministic selectors
test.use({ viewport: { width: 1280, height: 900 } });

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
  // Select a random customer from the dropdown (excluding the disabled placeholder)
  const optionLocator = page.locator('#customer option:not([disabled])');
  const customerOptions = await optionLocator.allInnerTexts();
  if (customerOptions.length === 0) {
    throw new Error('No customers available in the dropdown');
  }
  const randomIndex = Math.floor(Math.random() * customerOptions.length);
  const customerName = customerOptions[randomIndex].trim();
  await page.getByLabel('Choose customer').selectOption({ label: customerName });

  // Use a distinctive amount that is unlikely to collide
  // Generate a random amount under 1000 with 2 decimals (>= 1.00 to pass validation)
  const randomAmount = Math.max(1, Math.random() * 999.99);
  const amount = randomAmount.toFixed(2);
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
  await page.getByLabel('Choose an amount').fill(amount);

  // Choose status
  await page.getByRole('radio', { name: 'Paid' }).check();

  // Submit the form
  await expect(page.getByTestId('create-invoice-submit')).toBeEnabled();
  await page.getByTestId('create-invoice-submit').click();

  // Expect redirect back to invoices page
  await expect(page).toHaveURL(/\/dashboard\/invoices(\?.*)?$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/invoices/i);

  // Filter by cents value to uniquely identify the created invoice
  const centsQuery = Math.round(Number(amount) * 100).toString();
  const search = page.getByPlaceholder('Search invoices...');
  await expect(search).toBeVisible();
  await search.fill(centsQuery);
  await search.press('Enter');

  const table = page.locator('table');
  await expect(table).toBeVisible();
  const row = table
    .getByRole('row')
    .filter({ has: page.getByText(customerName) })
    .filter({ has: page.getByText(formattedAmount) });
  await expect(row).toHaveCount(1, { timeout: 20000 });

  // Verify persistence in the database to avoid false positives
  const amountCents = Math.round(Number(amount) * 100);
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'nextjs_dashboard';
  // If DB env is not configured in this environment, skip persistence check
  if (!uri) {
    return;
  }
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const customer = await db.collection('customers').findOne({ name: customerName });
    if (!customer?._id) {
      throw new Error(`Customer not found in DB: ${customerName}`);
    }
    // Retry briefly in case of slight lag between UI and DB query
    const deadline = Date.now() + 5000;
    let found = null as any;
    while (Date.now() < deadline && !found) {
      found = await db.collection('invoices').findOne({ customer_id: customer._id, amount: amountCents });
      if (!found) await new Promise((r) => setTimeout(r, 250));
    }
    expect(found, `Invoice not found in DB for ${customerName} with ${formattedAmount}`).toBeTruthy();
  } finally {
    await client.close();
  }
});
