// app/lib/data.ts
import { MongoClient, Db } from 'mongodb';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) throw new Error('MONGODB_URI is not set in .env.local');

// Reuse a single Mongo client across hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}
const clientPromise =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(MONGODB_URI).connect());

async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export async function fetchRevenue() {
  try {
    const db = await getDb();
    const data = (await db.collection('revenue').find({}).toArray()) as Revenue[];
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const db = await getDb();
    const data = (await db
      .collection('invoices')
      .aggregate<LatestInvoiceRaw>([
        { $sort: { date: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'customers',
            localField: 'customer_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
        {
          $project: {
            amount: 1,
            name: '$customer.name',
            image_url: '$customer.image_url',
            email: '$customer.email',
            id: '$_id',
          },
        },
      ])
      .toArray()) as unknown as LatestInvoiceRaw[];

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency((invoice as any).amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const db = await getDb();

    const invoiceCountPromise = db.collection('invoices').countDocuments({});
    const customerCountPromise = db.collection('customers').countDocuments({});
    const invoiceStatusPromise = db
      .collection('invoices')
      .aggregate<{ paid: number; pending: number }>([
        {
          $group: {
            _id: null,
            paid: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] },
            },
          },
        },
      ])
      .toArray();

    const [invoiceCount, customerCount, statusAgg] = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const sums = statusAgg[0] || { paid: 0, pending: 0 };

    return {
      numberOfInvoices: Number(invoiceCount ?? 0),
      numberOfCustomers: Number(customerCount ?? 0),
      totalPaidInvoices: formatCurrency(sums.paid ?? 0),
      totalPendingInvoices: formatCurrency(sums.pending ?? 0),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const pipeline = [
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
      // Prepare string versions for text matching against amount/date
      {
        $addFields: {
          amountStr: { $toString: '$amount' },
          dateStr: { $dateToString: { date: '$date', format: '%Y-%m-%d' } },
        },
      },
      {
        $match: {
          $or: [
            { 'customer.name': regex },
            { 'customer.email': regex },
            { status: regex },
            { amountStr: regex },
            { dateStr: regex },
          ],
        },
      },
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: ITEMS_PER_PAGE },
      {
        $project: {
          id: '$_id',
          amount: 1,
          date: 1,
          status: 1,
          name: '$customer.name',
          email: '$customer.email',
          image_url: '$customer.image_url',
        },
      },
    ];

    const invoices = (await db
      .collection('invoices')
      .aggregate<InvoicesTable>(pipeline)
      .toArray()) as unknown as InvoicesTable[];

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const pipeline = [
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
      {
        $addFields: {
          amountStr: { $toString: '$amount' },
          dateStr: { $dateToString: { date: '$date', format: '%Y-%m-%d' } },
        },
      },
      {
        $match: {
          $or: [
            { 'customer.name': regex },
            { 'customer.email': regex },
            { status: regex },
            { amountStr: regex },
            { dateStr: regex },
          ],
        },
      },
      { $count: 'count' },
    ];

    const res = await db.collection('invoices').aggregate(pipeline).toArray();
    const count = res[0]?.count ?? 0;
    const totalPages = Math.ceil(Number(count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const db = await getDb();
    const doc = (await db.collection('invoices').findOne({ _id: id })) as any;
    if (!doc) return undefined as unknown as InvoiceForm;

    const invoice: InvoiceForm = {
      id: doc._id,
      customer_id: doc.customer_id,
      amount: doc.amount / 100, // convert cents to dollars for the form
      status: doc.status,
    };

    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const db = await getDb();
    const rows = await db
      .collection('customers')
      .find({}, { projection: { _id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray();

    const customers: CustomerField[] = rows.map((r: any) => ({
      id: r._id,
      name: r.name,
    }));
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const data = (await db
      .collection('customers')
      .aggregate<CustomersTableType>([
        { $match: { $or: [{ name: regex }, { email: regex }] } },
        {
          $lookup: {
            from: 'invoices',
            localField: '_id',
            foreignField: 'customer_id',
            as: 'invoices',
          },
        },
        {
          $addFields: {
            total_invoices: { $size: '$invoices' },
            total_pending: {
              $sum: {
                $map: {
                  input: '$invoices',
                  as: 'i',
                  in: { $cond: [{ $eq: ['$$i.status', 'pending'] }, '$$i.amount', 0] },
                },
              },
            },
            total_paid: {
              $sum: {
                $map: {
                  input: '$invoices',
                  as: 'i',
                  in: { $cond: [{ $eq: ['$$i.status', 'paid'] }, '$$i.amount', 0] },
                },
              },
            },
          },
        },
        {
          $project: {
            id: '$_id',
            name: 1,
            email: 1,
            image_url: 1,
            total_invoices: 1,
            total_pending: 1,
            total_paid: 1,
          },
        },
        { $sort: { name: 1 } },
      ])
      .toArray()) as unknown as CustomersTableType[];

    const customers = data.map((customer: any) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending ?? 0),
      total_paid: formatCurrency(customer.total_paid ?? 0),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}