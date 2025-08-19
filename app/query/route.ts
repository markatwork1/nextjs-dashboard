// app/query/route.ts
import { MongoClient } from 'mongodb';

export const runtime = 'nodejs'; // Mongo driver requires Node runtime

// Lazy initialization to avoid build-time connection attempts
function getMongoConfig() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
  
  if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set. Please set it in your local .env.local file for development, or in your deployment environment variables for production.');
  }
  
  return { MONGODB_URI, DB_NAME };
}

// Reuse the client across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  const { MONGODB_URI } = getMongoConfig();
  
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(MONGODB_URI).connect();
  }
  
  return global._mongoClientPromise;
}

async function listInvoices() {
  const { DB_NAME } = getMongoConfig();
  const client = await getClientPromise();
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