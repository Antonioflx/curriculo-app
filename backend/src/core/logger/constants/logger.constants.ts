export const REDACTED_VALUE = '[REDACTED]';
export const TRUNCATED_VALUE = '[TRUNCATED]';
export const MAX_REDACT_DEPTH = 4;

/** Chaves (em minúsculas) que nunca vão para o log: segredos e conteúdo do usuário (A09). */
export const REDACTED_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'content',
  'rawtext',
]);
