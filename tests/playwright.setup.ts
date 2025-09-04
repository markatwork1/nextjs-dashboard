import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { users, customers, invoices, revenue } from '../app/lib/placeholder-data';
import bcrypt from 'bcrypt';

// Load local .env for defaults
dotenv.config({ path: process.cwd() + '/.env' });

export default async function globalSetup() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:3000';
  const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Ensure indexes
    await Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('customers').createIndex({ email: 1 }),
      db.collection('invoices').createIndex({ customer_id: 1 }),
      db.collection('revenue').createIndex({ month: 1 }, { unique: true }),
    ]);

    // Seed users (hash passwords)
    await Promise.all(users.map(async (u) => {
      const hashed = await bcrypt.hash(u.password, 10);
      await db.collection('users').updateOne({ _id: u.id as any }, { $set: { _id: u.id as any, name: u.name, email: u.email, password: hashed } }, { upsert: true });
    }));

    // Seed customers
    await Promise.all(customers.map(async (c) => {
      await db.collection('customers').updateOne({ _id: c.id as any }, { $set: { _id: c.id as any, name: c.name, email: c.email, image_url: c.image_url } }, { upsert: true });
    }));

    // Seed invoices (use provided id scheme)
    await Promise.all(invoices.map(async (inv: any) => {
      const invoiceId = typeof inv.id !== 'undefined' ? inv.id : `${inv.customer_id}-${inv.date}`;
      await db.collection('invoices').updateOne({ _id: invoiceId }, { $set: { _id: invoiceId, customer_id: inv.customer_id, amount: inv.amount, status: inv.status, date: new Date(inv.date) } }, { upsert: true });
    }));

    // Seed revenue
    await Promise.all(revenue.map(async (r) => {
      await db.collection('revenue').updateOne({ month: r.month }, { $set: { month: r.month, revenue: r.revenue } }, { upsert: true });
    }));

    console.log('✅ Database seeded by Playwright globalSetup');
  } catch (e) {
    console.error('❌ Global setup seeding failed:', e);
  } finally {
    await client.close();
  }
}
