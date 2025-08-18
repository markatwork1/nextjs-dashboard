// app/query/route.ts
import { MongoClient } from 'mongodb';

export const runtime = 'nodejs'; // Mongo driver requires Node runtime
const MONGODB_URI = process.env.MONGODB_URI!;
// Removed stray 'p' character
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not set in .env.local');
}

// Reuse the client across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

async function listInvoices() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Join invoices -> customers and return amount + customer name where amount = 666
  return db
    .collection('invoices')
    .aggregate([
      { $match: { amount: 666 } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id', // invoices.customer_id
          foreignField: '_id',       // customers._id
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
      { $project: { _id: 0, amount: 1, name: '$customer.name' } },
    ])
    .toArray();
}

export async function GET() {
  try {
    const data = await listInvoices();
    return Response.json(data);
  } catch (error: any) {
    console.error('Query failed:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}