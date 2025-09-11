import { describe, test, expect } from 'vitest';
import { formatCurrency } from '@/app/lib/utils';

type Case = { input: number; out: string };
const cases: Case[] = [
  { input: 100, out: '$1.00' },
  { input: 2500, out: '$25.00' },
  { input: 112233, out: '$1,122.33' },
];

describe('formatCurrency (concurrent)', () => {
  test.concurrent.each(cases)('formats %j', async ({ input, out }: Case) => {
    expect(formatCurrency(input)).toBe(out);
  });
});
