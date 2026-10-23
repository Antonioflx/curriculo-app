import { z } from 'zod';

/** Trecho do JWT_SECRET do `.env.example`: se aparecer em produção, o boot falha. */
export const JWT_SECRET_PLACEHOLDER = 'troque-por-um-segredo';
const SECURE_SSL_MODE = /sslmode=(require|verify-ca|verify-full)/;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter no mínimo 32 caracteres'),
  })
  .superRefine((env, ctx) => {
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
