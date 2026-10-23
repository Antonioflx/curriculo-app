import { isEmpty, isNotEmpty } from './empty.utils';

describe('empty.utils', () => {
  it.each([null, undefined, '', [], new Set(), new Map()])('isEmpty(%p) é true', (value) => {
    expect(isEmpty(value)).toBe(true);
    expect(isNotEmpty(value)).toBe(false);
  });

  it.each(['a', ' ', [0], [undefined], new Set([1]), new Map([[1, 2]])])('isNotEmpty(%p) é true', (value) => {
    expect(isNotEmpty(value)).toBe(true);
    expect(isEmpty(value)).toBe(false);
  });

  it('isNotEmpty estreita o tipo', () => {
    const ids: string[] | undefined = ['a'];
    if (isNotEmpty(ids)) expect(ids.length).toBe(1);
  });
});
