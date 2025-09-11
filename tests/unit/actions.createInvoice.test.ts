import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startMemoryMongo, stopMemoryMongo } from './helpers/mongo-memory';
import { createInvoice, updateInvoice, deleteInvoice, type State } from '../../app/lib/actions';
import { MongoClient, ObjectId } from 'mongodb';

function form(entries: Record<string, any>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, String(v));
  return fd;
}

function formatCentsToUSD(cents: number | undefined | null): string {
  if (typeof cents !== 'number') return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// Mock next/cache revalidatePath to avoid Next runtime requirements in unit tests
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

describe('Invoice actions', () => {
  let mongod: any;
  let client: MongoClient;
  let customerObjectId: ObjectId;
  let customerIdString: string;
  let customerName: string;

  beforeAll(async () => {
    mongod = await startMemoryMongo();
    client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const customers = db.collection('customers');
  // Seed one customer (ObjectId)
  customerName = 'Test Customer';
  const res = await customers.insertOne({ name: customerName, email: 'test@example.com' });
  customerObjectId = res.insertedId as ObjectId;
  customerIdString = customerObjectId.toString();
  });

  afterAll(async () => {
    await client.close();
    await stopMemoryMongo(mongod);
  });

  it('creates an invoice', async () => {
    const state: State = { message: null, errors: {} };
  const res = await createInvoice(state, form({ customerId: customerIdString, amount: '123.45', status: 'paid' }));
    expect(res.message).toBeNull();
    const db = client.db(process.env.MONGODB_DB);
  const inv = await db.collection('invoices').findOne({ customer_id: customerObjectId, amount: 12345 });
    expect(inv).toBeTruthy();
    if (inv) {
      // Human-readable output for created invoice
      console.log(
        `Created invoice ${inv._id}: customer="${customerName}", amount=${formatCentsToUSD(inv.amount)}, status=${inv.status}`
      );
    }
  });

  it('updates an invoice', async () => {
  const db = client.db(process.env.MONGODB_DB);
  const { insertedId } = await db.collection('invoices').insertOne({ customer_id: customerObjectId, amount: 100, status: 'pending', date: new Date() });
  const before = await db.collection('invoices').findOne({ _id: insertedId });
    const state: State = { message: null, errors: {} };
  const res = await updateInvoice(String(insertedId), state, form({ customerId: customerIdString, amount: '200.50', status: 'paid' }));
    expect(res.message).toBeNull();
  const inv = await db.collection('invoices').findOne({ _id: insertedId });
    expect(inv?.amount).toBe(20050);
    expect(inv?.status).toBe('paid');
    // Human-readable output for updated invoice (before/after)
    console.log(
      `Updated invoice ${insertedId}: before amount=${formatCentsToUSD(before?.amount)}, status=${before?.status} -> after amount=${formatCentsToUSD(inv?.amount)}, status=${inv?.status}, customer="${customerName}"`
    );
  });

  it('deletes an invoice', async () => {
  const db = client.db(process.env.MONGODB_DB);
  const { insertedId } = await db.collection('invoices').insertOne({ customer_id: customerObjectId, amount: 500, status: 'pending', date: new Date() });
  const toDelete = await db.collection('invoices').findOne({ _id: insertedId });
  // Human-readable output before deletion
  console.log(
    `Deleting invoice ${insertedId}: customer="${customerName}", amount=${formatCentsToUSD(toDelete?.amount)}, status=${toDelete?.status}`
  );
  await deleteInvoice(String(insertedId));
  const inv = await db.collection('invoices').findOne({ _id: insertedId });
    expect(inv).toBeNull();
    console.log(`Deleted invoice ${insertedId}`);
  });
});
