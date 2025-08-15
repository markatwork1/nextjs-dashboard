// app/seed/route.ts
import bcrypt from 'bcrypt';
import { MongoClient, Db } from 'mongodb';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

export const runtime = 'nodejs';

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) throw new Error('MONGODB_URI is not set in .env.local');

// Reuse client in dev
declare global { /* eslint-disable no-var */ var _mongoClientPromise: Promise<MongoClient> | undefined; }
const clientPromise =
  global._mongoClientPromise ?? (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

/** ---- Collection document types (string _id to match your seed data) ---- */
type UserDoc     = { _id: string; name: string; email: string; password: string };
type CustomerDoc = { _id: string; name: string; email: string; image_url: string };
type InvoiceDoc  = {
  _id: string;
  customer_id: string;                // references customers._id (string)
  amount: number;
  status: 'paid' | 'pending';
  date: Date;
};
type RevenueDoc  = { month: string; revenue: number };

async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<UserDoc>('users').createIndex({ email: 1 }, { unique: true }),
    db.collection<CustomerDoc>('customers').createIndex({ email: 1 }),
    db.collection<InvoiceDoc>('invoices').createIndex({ customer_id: 1 }),
    db.collection<RevenueDoc>('revenue').createIndex({ month: 1 }, { unique: true }),
  ]);
}

async function seedUsers(db: Db) {
  const col = db.collection<UserDoc>('users');
  await Promise.all(
    users.map(async (u) => {
      const _id = (u as any).id ?? u.email;              // tutorial data sometimes has id
      const hashed = await bcrypt.hash(u.password, 10);
      return col.updateOne(
        { _id },                                          // ✅ _id is string here
        { $setOnInsert: { _id, name: u.name, email: u.email, password: hashed } },
        { upsert: true }
      );
    })
  );
}

async function seedCustomers(db: Db) {
  const col = db.collection<CustomerDoc>('customers');
  await Promise.all(
    customers.map((c) =>
      col.updateOne(
        { _id: c.id },
        { $setOnInsert: { _id: c.id, name: c.name, email: c.email, image_url: c.image_url } },
        { upsert: true }
      )
    )
  );
}

async function seedInvoices(db: Db) {
  const col = db.collection<InvoiceDoc>('invoices');
  await Promise.all(
    invoices.map((inv) =>
      col.updateOne(
        { _id: (inv as any).id ?? `${inv.customer_id}-${inv.date}` },
        {
          $setOnInsert: {
            _id: (inv as any).id ?? `${inv.customer_id}-${inv.date}`,
            customer_id: inv.customer_id,
            amount: inv.amount,
            status: (inv.status === 'paid' ? 'paid' : 'pending') as InvoiceDoc['status'],
            date: new Date(inv.date),
          },
        },
        { upsert: true }
      )
    )
  );
}

async function seedRevenue(db: Db) {
  const col = db.collection<RevenueDoc>('revenue');
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
    const db = await getDb();
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