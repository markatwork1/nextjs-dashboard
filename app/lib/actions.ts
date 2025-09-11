'use server';

import { z } from 'zod';
import { MongoClient, ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

function getMongoConfig() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env.local');
  }
  return { MONGODB_URI, DB_NAME };
}

async function getDb() {
  const { MONGODB_URI, DB_NAME } = getMongoConfig();
  const client = await new MongoClient(MONGODB_URI).connect();
  return client.db(DB_NAME);
}

export async function createInvoice(prevState: State, formData: FormData): Promise<State> {
  const validated = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Missing Fields. Failed to Create Invoice.' };
  }
  const { customerId, amount, status } = validated.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date();
  try {
    const db = await getDb();
    await db.collection('invoices').insertOne({
      customer_id: ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId,
      amount: amountInCents,
      status,
      date,
    });
    revalidatePath('/dashboard/invoices');
    return { message: null, errors: {} };
  } catch (err) {
    return { message: 'Database Error: Failed to Create Invoice.' };
  }
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
): Promise<State> {
  const validated = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Missing Fields. Failed to Update Invoice.' };
  }
  const { customerId, amount, status } = validated.data;
  const amountInCents = Math.round(amount * 100);
  try {
    const db = await getDb();
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    await db.collection('invoices').updateOne(filter as any, {
      $set: {
        customer_id: ObjectId.isValid(customerId) ? new ObjectId(customerId) : customerId,
        amount: amountInCents,
        status,
      },
    });
    revalidatePath('/dashboard/invoices');
    return { message: null, errors: {} };
  } catch (err) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }
}

export async function deleteInvoice(id: string) {
  try {
    const db = await getDb();
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    await db.collection('invoices').deleteOne(filter as any);
    revalidatePath('/dashboard/invoices');
  } catch (err) {
    throw new Error('Failed to Delete Invoice');
  }
}