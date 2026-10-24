import { z } from 'zod';

/** Trecho do JWT_SECRET do `.env.example`: se aparecer em produção, o boot falha. */
export const JWT_SECRET_PLACEHOLDER = 'troque-por-um-segredo';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';
const SECURE_SSL_MODE = /sslmode=(require|verify-ca|verify-full)/;

const LLM_PROVIDERS = ['gemini', 'groq'] as const;

/** `VAR=` vazio no .env vale como "não definida". */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter no mínimo 32 caracteres'),
    LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('gemini'),
    LLM_FALLBACK_PROVIDER: z.preprocess(emptyToUndefined, z.enum(LLM_PROVIDERS).optional()),
    GEMINI_API_KEY: optionalText(),
    GEMINI_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default(DEFAULT_GEMINI_MODEL)),
    GEMINI_FALLBACK_MODEL: optionalText(),
    GROQ_API_KEY: optionalText(),
    GROQ_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default(DEFAULT_GROQ_MODEL)),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    AI_TOTAL_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300_000).default(60_000),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_FALLBACK_PROVIDER === env.LLM_PROVIDER) {
      ctx.addIssue({
        code: 'custom',
        path: ['LLM_FALLBACK_PROVIDER'],
        message: 'precisa ser diferente de LLM_PROVIDER',
      });
    }

    if (env.NODE_ENV !== 'production') return;

    if (env.JWT_SECRET.includes(JWT_SECRET_PLACEHOLDER)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'valor de exemplo não é aceito em produção' });
    }
    if (!env.WEB_ORIGIN.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'precisa ser https em produção' });
    }
    if (!SECURE_SSL_MODE.test(env.DATABASE_URL)) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'exige sslmode=require em produção' });
    }

    const keys = { gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY };
    for (const provider of [env.LLM_PROVIDER, env.LLM_FALLBACK_PROVIDER]) {
      if (provider && !keys[provider]) {
        ctx.addIssue({
          code: 'custom',
          path: [`${provider.toUpperCase()}_API_KEY`],
          message: `obrigatória em produção: ${provider} está configurado como provider`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** A mensagem de erro cita só a chave e o motivo, nunca o valor (segredos não vão para o log). */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Variáveis de ambiente inválidas: ${issues}`);
  }
  return result.data;
}
