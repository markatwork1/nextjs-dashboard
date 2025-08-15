// app/lib/data.ts
import { MongoClient, Db } from 'mongodb';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  LatestInvoice,          // ⬅️ add this import
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'nextjs_dashboard';
if (!MONGODB_URI) throw new Error('MONGODB_URI is not set in .env.local');

// Reuse one Mongo client across hot reloads in dev
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

/* =========================
   REVENUE
   ========================= */
export async function fetchRevenue(): Promise<Revenue[]> {
  try {
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const db = await getDb();
    // Project to the exact shape of Revenue so TS doesn't infer WithId<Document>
    const data = await db
      .collection('revenue')
      .aggregate<Revenue>([{ $project: { _id: 0, month: 1, revenue: 1 } }])
      .toArray();
    console.log('Data fetch completed after 3 seconds.');
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

/* =========================
   LATEST INVOICES (top 5)
   ========================= */
// ❗ Return LatestInvoice[] (amount: string) to satisfy the component prop type
export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  try {
    const db = await getDb();

    const raw = await db
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
            _id: 0,
            id: '$_id',
            amount: 1, // number (cents) -> we will format below
            name: '$customer.name',
            image_url: '$customer.image_url',
            email: '$customer.email',
          },
        },
      ])
      .toArray();

    // Convert amount (number/cents) -> formatted string for UI
    const latestInvoices: LatestInvoice[] = raw.map((inv) => ({
      id: inv.id,
      name: inv.name,
      image_url: inv.image_url,
      email: inv.email,
      amount: formatCurrency(inv.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

/* =========================
   CARD DATA
   ========================= */
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
            paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          },
        },
        { $project: { _id: 0, paid: 1, pending: 1 } },
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

/* =========================
   FILTERED INVOICES (paginated)
   ========================= */
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
): Promise<InvoicesTable[]> {
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const invoices = await db
      .collection('invoices')
      .aggregate<InvoicesTable>([
        {
          $lookup: {
            from: 'customers',
            localField: 'customer_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
        // Prepare string versions to mimic ILIKE on amount/date
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
            _id: 0,
            id: '$_id',
            customer_id: 1, // keep this to satisfy the type
            amount: 1,
            date: 1,
            status: 1,
            name: '$customer.name',
            email: '$customer.email',
            image_url: '$customer.image_url',
          },
        },
      ])
      .toArray();

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

/* =========================
   TOTAL PAGES for filtered invoices
   ========================= */
export async function fetchInvoicesPages(query: string): Promise<number> {
  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const res = await db
      .collection('invoices')
      .aggregate<{ count: number }>([
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
        { $project: { _id: 0, count: 1 } },
      ])
      .toArray();

    const count = res[0]?.count ?? 0;
    const totalPages = Math.ceil(Number(count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

/* =========================
   INVOICE BY ID (form)
   ========================= */
export async function fetchInvoiceById(id: string): Promise<InvoiceForm | undefined> {
  try {
    const db = await getDb();

    // Read from DB with status as string (Mongo doesn't enforce unions), then NARROW it.
    const doc = await db
      .collection<{ _id: string; customer_id: string; amount: number; status: string }>('invoices')
      .findOne({ _id: id }, { projection: { _id: 1, customer_id: 1, amount: 1, status: 1 } });

    if (!doc) return undefined;

    // Narrow string → 'paid' | 'pending' (fallback to 'pending' if unexpected)
    const narrowedStatus: InvoiceForm['status'] =
      doc.status === 'paid' || doc.status === 'pending' ? doc.status : 'pending';

    const invoice: InvoiceForm = {
      id: doc._id,
      customer_id: doc.customer_id,
      amount: doc.amount / 100, // convert cents to dollars for the form
      status: narrowedStatus,
    };

    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

/* =========================
   CUSTOMERS (id + name)
   ========================= */
export async function fetchCustomers(): Promise<CustomerField[]> {
  try {
    const db = await getDb();
    const rows = await db
      .collection<{ _id: string; name: string }>('customers')
      .find({}, { projection: { _id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray();

    const customers: CustomerField[] = rows.map((r) => ({ id: r._id, name: r.name }));
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

/* =========================
   FILTERED CUSTOMERS TABLE
   ========================= */
export async function fetchFilteredCustomers(query: string): Promise<CustomersTableType[]> {
  try {
    const db = await getDb();
    const regex = new RegExp(query, 'i');

    const data = await db
      .collection('customers')
      .aggregate<{
        id: string;
        name: string;
        email: string;
        image_url: string;
        total_invoices: number;
        total_pending: number;
        total_paid: number;
      }>([
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
            _id: 0,
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
      .toArray();

    // NOTE: These totals are numbers; if your table expects strings, change the return type
    // to FormattedCustomersTable[] and format here. Keeping numbers for now.
    return data as CustomersTableType[];
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}