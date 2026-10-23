import { validateEnv } from './env.schema';

const base = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'troque-por-um-segredo-com-no-minimo-32-caracteres',
};
const production = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://app.exemplo.com',
  DATABASE_URL: 'postgresql://u:p@host/db?sslmode=require',
  JWT_SECRET: 'x'.repeat(48),
};

describe('validateEnv', () => {
  it('aceita a configuração de desenvolvimento, inclusive o segredo de exemplo', () => {
    expect(validateEnv(base)).toMatchObject({ NODE_ENV: 'development', PORT: 3001 });
  });

  it('recusa segredo curto e variável ausente', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'curto' })).toThrow('JWT_SECRET');
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow('DATABASE_URL');
  });

  describe('produção', () => {
    it('aceita uma configuração segura', () => {
      expect(validateEnv(production).NODE_ENV).toBe('production');
    });

    it.each([
      ['segredo de exemplo', { JWT_SECRET: base.JWT_SECRET }, 'JWT_SECRET'],
      ['origem sem https', { WEB_ORIGIN: 'http://app.exemplo.com' }, 'WEB_ORIGIN'],
      ['banco sem SSL', { DATABASE_URL: 'postgresql://u:p@host/db' }, 'DATABASE_URL'],
      ['sslmode=disable', { DATABASE_URL: 'postgresql://u:p@host/db?sslmode=disable' }, 'DATABASE_URL'],
    ])('recusa %s', (_name, override, key) => {
      expect(() => validateEnv({ ...production, ...override })).toThrow(key);
    });

    it('a mensagem de erro não revela o valor do segredo', () => {
      try {
        validateEnv({ ...production, JWT_SECRET: base.JWT_SECRET });
        throw new Error('deveria falhar');
      } catch (error) {
        expect((error as Error).message).not.toContain(base.JWT_SECRET);
      }
    });
  });
});
