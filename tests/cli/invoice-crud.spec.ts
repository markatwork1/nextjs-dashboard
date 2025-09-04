import { test, expect } from '@playwright/test';
import { MongoClient } from 'mongodb';

test('invoice document exists and has correct data', async () => {
  require('dotenv').config({ path: process.cwd() + '/.env.local' });
  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
  if (!MONGODB_URI || !DB_NAME) {
    throw new Error('MONGODB_URI and MONGODB_DB environment variables are required for Playwright tests.');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const invoices = await db.collection('invoices').find({}).toArray();
  expect(invoices.length).toBeGreaterThan(0);
  console.log(`\u2705 Found ${invoices.length} invoice(s) in the database.`);
  invoices.forEach((inv, idx) => {
    console.log(`Invoice #${idx + 1}: amount = $${(inv.amount / 100).toFixed(2)}, status = ${inv.status}, customer_id = ${inv.customer_id}`);
  });
  const invoice = invoices[0];
  expect(invoice).toHaveProperty('amount');
  expect(invoice).toHaveProperty('customer_id');
  expect(invoice).toHaveProperty('status');
  await client.close();
});
