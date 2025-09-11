import { expect } from 'chai';
import { setupTestDb } from './helpers/mongo';
import { createInvoice } from '../../app/lib/actions';
import { ObjectId } from 'mongodb';

function formData(data: Record<string,string>): FormData {
  const fd = new FormData();
  for (const [k,v] of Object.entries(data)) fd.set(k,v);
  return fd;
}

describe('createInvoice success', () => {
  let close: () => Promise<void>;
  let customerId: string;
  let db: any;
  before(async () => {
    const ctx = await setupTestDb();
    close = ctx.close;
    db = ctx.db;
    customerId = new ObjectId().toString();
    await db.collection('customers').insertOne({ _id: new ObjectId(customerId), name: 'Test Customer', email: 't@test.com', image_url: '' });
  });
  after(async () => { await close(); });

  it('creates invoice and returns empty error state', async () => {
    const fd = formData({ customerId, amount: '123.45', status: 'paid' });
    const state = await createInvoice({ message: null, errors: {} }, fd);
    expect(state).to.deep.equal({ message: null, errors: {} });
    const invoice = await db.collection('invoices').findOne({ customer_id: new ObjectId(customerId) });
    expect(invoice).to.exist;
    expect(invoice!.amount).to.equal(12345);
    expect(invoice!.status).to.equal('paid');
  });
});
