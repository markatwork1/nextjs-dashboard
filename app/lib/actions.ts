'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
// import { redirect } from 'next/navigation';
import { MongoClient } from 'mongodb';
 
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});
 

const CreateInvoice = FormSchema.omit({ id: true, date: true });

import { ObjectId } from 'mongodb';
// MongoDB connection setup
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  const amountInCents = amount * 100;
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const filter = {
    $or: [
      ObjectId.isValid(id) ? { _id: new ObjectId(id) } : {},
      { _id: id },
    ],
  };
  await db.collection('invoices').updateOne(
    filter as any,
    {
      $set: {
        customer_id: customerId,
        amount: amountInCents,
        status,
      },
    }
  );
  revalidatePath('/dashboard/invoices');
  // Use router.push on the client after mutation, or return a value to trigger navigation in the form
}
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set. Please set it in your local .env.local file for development, or in your deployment environment variables for production.');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
const clientPromise =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

export async function createInvoice(formData: FormData) {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0]; // Format date to YYYY-MM-DD

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection('invoices').insertOne({
    customer_id: customerId,
    amount: amountInCents,
    status,
    date: new Date(date),
  });
  revalidatePath('/dashboard/invoices');
  // Use router.push on the client after mutation, or return a value to trigger navigation in the form
}