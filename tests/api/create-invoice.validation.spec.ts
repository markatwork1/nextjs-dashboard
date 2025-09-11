import { expect } from 'chai';
import { setupTestDb } from './helpers/mongo';
import { createInvoice } from '../../app/lib/actions';

function formData(data: Record<string,string>): FormData {
  const fd = new FormData();
  for (const [k,v] of Object.entries(data)) fd.set(k,v);
  return fd;
}

describe('createInvoice validation', () => {
  let close: () => Promise<void>;
  before(async () => {
    const ctx = await setupTestDb();
    close = ctx.close;
  });
  after(async () => { await close(); });

  it('fails with missing fields', async () => {
    const fd = formData({});
    const state = await createInvoice({ message: null, errors: {} }, fd);
    expect(state.message).to.match(/Missing Fields/i);
    expect(state.errors).to.have.property('customerId');
  });

  it('fails with zero amount', async () => {
    const fd = formData({ customerId: 'abc', amount: '0', status: 'paid' });
    const state = await createInvoice({ message: null, errors: {} }, fd);
    expect(state.errors?.amount?.[0]).to.match(/greater than \$0/i);
  });
});
