'use server';
// Node.js runtime declaration for Next.js (do not export in 'use server' files)
const runtime = 'nodejs';

import bcrypt from 'bcryptjs';

import { setAuthCookie } from './auth-session';

export async function authenticate(
  prevState: State | undefined,
  formData: FormData,
): Promise<State> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/dashboard');

  if (!email || !password) {
    return { message: 'Email and password are required.', errors: {} };
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return { message: 'Invalid credentials.', errors: {} };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { message: 'Invalid credentials.', errors: {} };
    }

  // Set session cookie for authenticated user
  await setAuthCookie({ email: user.email, name: user.name, _id: user._id.toString() });
  // On success, return a redirect signal
  return { message: null, errors: {}, redirect: redirectTo };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return { message: 'Something went wrong.', errors: {} };
  }
}




import { z } from 'zod';
import { revalidatePath } from 'next/cache';
// import { redirect } from 'next/navigation'; // Removed: not available in current Next.js version
import { MongoClient, ObjectId } from 'mongodb';


const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set. Please set it in your local .env.local file for development, or in your deployment environment variables for production.');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}


const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ?? (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], { invalid_type_error: 'Please select an invoice status.' }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  redirect?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData): Promise<State> {
  
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    await db.collection('invoices').insertOne({
      customer_id: customerId,
      amount: amountInCents,
      status,
      date: new Date(date),
    });
  } catch (error) {
    // If a database error occurs, return a more specific error.
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  // This return is unreachable, but required for type safety
  return { message: null, errors: {} };
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
): Promise<State> {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    let filter;
    if (ObjectId.isValid(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      filter = { _id: id };
    }
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
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  // This return is unreachable, but required for type safety
  return { message: null, errors: {} };
}

export async function deleteInvoice(id: string) {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    let filter;
    if (ObjectId.isValid(id)) {
      filter = { _id: new ObjectId(id) };
    } else {
      filter = { _id: id };
    }
    await db.collection('invoices').deleteOne(filter as any);
    revalidatePath('/dashboard/invoices');
  } catch (error) {
    console.error(error);
    throw new Error('Failed to Delete Invoice');
  }
}