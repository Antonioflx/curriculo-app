import { MAX_REDACT_DEPTH, REDACTED_KEYS, REDACTED_VALUE, TRUNCATED_VALUE } from '../constants/logger.constants';

/** Copia o valor mascarando chaves sensíveis em qualquer nível (objetos e arrays). */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACT_DEPTH) return TRUNCATED_VALUE;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : redact(item, depth + 1),
    ]),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
