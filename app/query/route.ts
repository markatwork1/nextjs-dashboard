// app/query/route.ts
import { MongoClient } from 'mongodb';

export const runtime = 'nodejs'; // Mongo driver requires Node runtime

const MONGODB_URI = process.env.MONGODB_URI!;
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

async function listInvoices(amountFilter: number) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Join invoices -> customers and return amount + customer name
  return db
    .collection('invoices')
    .aggregate([
      { $match: { amount: amountFilter } },
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const amountParam = url.searchParams.get('amount');

    // Default to 666 to preserve the original query test
    const amount = amountParam !== null ? Number(amountParam) : 666;

    if (!Number.isFinite(amount)) {
      return Response.json({ error: 'Invalid amount query parameter' }, { status: 400 });
    }

    const data = await listInvoices(amount);
    return Response.json(data);
  } catch (error: any) {
    console.error('Query failed:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}