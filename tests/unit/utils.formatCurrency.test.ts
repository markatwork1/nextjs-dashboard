import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/app/lib/utils';

describe('formatCurrency', () => {
  it('formats cents to USD string', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(123)).toBe('$1.23');
    expect(formatCurrency(987654)).toBe('$9,876.54');
  });
});
