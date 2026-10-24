import { isNetworkError, LlmUnavailableError, UNAVAILABLE_STATUS } from './llm-unavailable.error';

describe('llm-unavailable.error', () => {
  it('guarda o provider, o status e a causa', () => {
    const cause = new Error('origem');
    const error = new LlmUnavailableError('groq', 'sem cota', 429, { cause });
    expect(error).toMatchObject({ name: 'LlmUnavailableError', provider: 'groq', status: 429, message: 'sem cota' });
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });

  it('falta de capacidade ou acesso vale como indisponível; erro de pedido (400) não', () => {
    for (const status of [401, 403, 404, 408, 429, 500, 502, 503, 504])
      expect(UNAVAILABLE_STATUS.has(status)).toBe(true);
    for (const status of [400, 413, 422]) expect(UNAVAILABLE_STATUS.has(status)).toBe(false);
  });

  it.each([
    'exception TypeError: fetch failed sending request',
    'The operation was aborted due to timeout',
    'connect ETIMEDOUT 1.2.3.4:443',
    'getaddrinfo ENOTFOUND api.groq.com',
    'socket hang up',
  ])('reconhece falha de rede: %s', (message) => {
    expect(isNetworkError(new Error(message))).toBe(true);
  });

  it('não confunde erro de programação nem valor que não é Error', () => {
    expect(isNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isNetworkError('fetch failed')).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});
