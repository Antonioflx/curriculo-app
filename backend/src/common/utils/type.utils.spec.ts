import { isNonEmptyString, isString } from './type.utils';

describe('type.utils', () => {
  it.each(['', 'a', ' '])('isString(%p) é true', (value) => {
    expect(isString(value)).toBe(true);
  });

  it.each([null, undefined, 1, {}, [], ['a']])('isString(%p) é false', (value) => {
    expect(isString(value)).toBe(false);
    expect(isNonEmptyString(value)).toBe(false);
  });

  it('isNonEmptyString recusa string vazia e aceita as demais', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('a')).toBe(true);
  });
});
