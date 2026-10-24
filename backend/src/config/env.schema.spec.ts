import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL, validateEnv } from './env.schema';

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
  GEMINI_API_KEY: 'chave-de-teste',
};

describe('validateEnv', () => {
  it('aceita a configuração de desenvolvimento, inclusive o segredo de exemplo e sem chave de IA', () => {
    expect(validateEnv(base)).toMatchObject({ NODE_ENV: 'development', PORT: 3001, LLM_PROVIDER: 'gemini' });
  });

  it('recusa segredo curto e variável ausente', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'curto' })).toThrow('JWT_SECRET');
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow('DATABASE_URL');
  });

  describe('IA', () => {
    it('aplica os padrões de modelo e timeout', () => {
      expect(validateEnv(base)).toMatchObject({
        GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
        AI_TIMEOUT_MS: 30_000,
        AI_TOTAL_TIMEOUT_MS: 60_000,
      });
    });

    it('variável vazia no .env vale como não definida', () => {
      const env = validateEnv({ ...base, GEMINI_API_KEY: '', GEMINI_MODEL: '' });
      expect(env.GEMINI_API_KEY).toBeUndefined();
      expect(env.GEMINI_MODEL).toBe(DEFAULT_GEMINI_MODEL);
    });

    it('provider de fallback: aceita groq, vazio vale como ausente e o modelo do Groq tem padrão', () => {
      const env = validateEnv({ ...base, LLM_FALLBACK_PROVIDER: 'groq' });
      expect(env).toMatchObject({
        LLM_PROVIDER: 'gemini',
        LLM_FALLBACK_PROVIDER: 'groq',
        GROQ_MODEL: DEFAULT_GROQ_MODEL,
      });
      expect(
        validateEnv({ ...base, LLM_FALLBACK_PROVIDER: '', GROQ_API_KEY: '' }).LLM_FALLBACK_PROVIDER,
      ).toBeUndefined();
      expect(validateEnv({ ...base, LLM_PROVIDER: 'groq', LLM_FALLBACK_PROVIDER: 'gemini' }).LLM_PROVIDER).toBe('groq');
    });

    it('o fallback precisa ser diferente do provider principal e conhecido', () => {
      expect(() => validateEnv({ ...base, LLM_FALLBACK_PROVIDER: 'gemini' })).toThrow('LLM_FALLBACK_PROVIDER');
      expect(() => validateEnv({ ...base, LLM_FALLBACK_PROVIDER: 'outro' })).toThrow('LLM_FALLBACK_PROVIDER');
    });

    it('recusa timeout fora da faixa e provider desconhecido', () => {
      expect(() => validateEnv({ ...base, AI_TIMEOUT_MS: '10' })).toThrow('AI_TIMEOUT_MS');
      expect(() => validateEnv({ ...base, AI_TOTAL_TIMEOUT_MS: '999999' })).toThrow('AI_TOTAL_TIMEOUT_MS');
      expect(() => validateEnv({ ...base, LLM_PROVIDER: 'outro' })).toThrow('LLM_PROVIDER');
    });
  });

  describe('produção', () => {
    it('aceita uma configuração segura', () => {
      expect(validateEnv(production).NODE_ENV).toBe('production');
    });

    it('aceita produção com Gemini e fallback no Groq quando as duas chaves existem', () => {
      const env = validateEnv({ ...production, LLM_FALLBACK_PROVIDER: 'groq', GROQ_API_KEY: 'chave-groq' });
      expect(env.LLM_FALLBACK_PROVIDER).toBe('groq');
    });

    it.each([
      ['segredo de exemplo', { JWT_SECRET: base.JWT_SECRET }, 'JWT_SECRET'],
      ['origem sem https', { WEB_ORIGIN: 'http://app.exemplo.com' }, 'WEB_ORIGIN'],
      ['banco sem SSL', { DATABASE_URL: 'postgresql://u:p@host/db' }, 'DATABASE_URL'],
      ['sslmode=disable', { DATABASE_URL: 'postgresql://u:p@host/db?sslmode=disable' }, 'DATABASE_URL'],
      ['chave de IA ausente', { GEMINI_API_KEY: '' }, 'GEMINI_API_KEY'],
      ['fallback groq sem GROQ_API_KEY', { LLM_FALLBACK_PROVIDER: 'groq' }, 'GROQ_API_KEY'],
      ['groq como principal sem GROQ_API_KEY', { LLM_PROVIDER: 'groq', GEMINI_API_KEY: '' }, 'GROQ_API_KEY'],
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
