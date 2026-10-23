import { normalizeText } from './text.utils';

describe('normalizeText', () => {
  it('remove espaços das pontas', () => {
    expect(normalizeText('  Ana  Maria ')).toBe('Ana  Maria');
  });

  it('só põe em minúsculas quando pedido', () => {
    expect(normalizeText(' ABC ')).toBe('ABC');
    expect(normalizeText(' ABC ', { lowercase: true })).toBe('abc');
  });
});
