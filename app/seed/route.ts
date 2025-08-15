// app/seed/route.ts
import bcrypt from 'bcrypt';
import { MongoClient, Db } from 'mongodb';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

export const runtime = 'nodejs'; // Mongo driver needs Node runtime (not Edge)

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) throw new Error('MONGODB_URI is not set in .env.local');

// Reuse connection across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
const clientPromise =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('customers').createIndex({ email: 1 }),
    db.collection('invoices').createIndex({ customer_id: 1 }),
    db.collection('revenue').createIndex({ month: 1 }, { unique: true }),
  ]);
}

async function seedUsers(db: Db) {
  const col = db.collection('users');
  await Promise.all(
    users.map(async (u) => {
      const _id: string = u.id ?? u.email; // explicitly type as string
      const hashed = await bcrypt.hash(u.password, 10);
      return col.updateOne(
        { _id },
        {
          $setOnInsert: {
            _id,
            name: u.name,
            email: u.email,
            password: hashed,
          },
        },
        { upsert: true }
      );
    })
  );
}

async function seedCustomers(db: Db) {
  const col = db.collection('customers');
  await Promise.all(
    customers.map((c) =>
      col.updateOne(
        { _id: c.id },
        {
          $setOnInsert: {
            _id: c.id,
            name: c.name,
            email: c.email,
            image_url: c.image_url,
          },
        },
        { upsert: true }
      )
    )
  );
}

async function seedInvoices(db: Db) {
  const col = db.collection('invoices');
  await Promise.all(
    invoices.map((inv) =>
      col.updateOne(
        { _id: inv.id ?? `${inv.customer_id}-${inv.date}` },
        {
          $setOnInsert: {
            _id: inv.id ?? `${inv.customer_id}-${inv.date}`,
            customer_id: inv.customer_id,
            amount: inv.amount,
            status: inv.status,
            date: new Date(inv.date),
          },
        },
        { upsert: true }
      )
    )
  );
}

async function seedRevenue(db: Db) {
  const col = db.collection('revenue');
  await Promise.all(
    revenue.map((r) =>
      col.updateOne(
        { month: r.month },
        { $setOnInsert: { month: r.month, revenue: r.revenue } },
        { upsert: true }
      )
    )
  );
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    await ensureIndexes(db);
    await seedUsers(db);
    await seedCustomers(db);
    await seedInvoices(db);
    await seedRevenue(db);

    return Response.json({ message: 'Database seeded successfully (MongoDB)' });
  } catch (error: any) {
    console.error('Seed failed:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}