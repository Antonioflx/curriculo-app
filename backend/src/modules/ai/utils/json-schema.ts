import { z } from 'zod';

/**
 * Palavras do JSON Schema que o Gemini aceita. As demais (maxLength, pattern...) são descartadas.
 * `minItems`/`maxItems` também ficam de fora de propósito: em schemas aninhados eles estouram a complexidade
 * aceita pelo Gemini (400 INVALID_ARGUMENT). O limite de itens vai para a descrição e o Zod o valida depois.
 */
const SUPPORTED_KEYWORDS = new Set([
  '$id',
  '$defs',
  '$ref',
  '$anchor',
  'type',
  'format',
  'title',
  'description',
  'enum',
  'items',
  'prefixItems',
  'minimum',
  'maximum',
  'anyOf',
  'oneOf',
  'properties',
  'additionalProperties',
  'required',
  'propertyOrdering',
]);

/** Zod → JSON Schema reduzido ao subconjunto aceito pelo LLM. A validação completa continua sendo do Zod. */
export function toLlmJsonSchema(schema: z.ZodType): object {
  return sanitize(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })) as object;
}

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (typeof node !== 'object' || node === null) return node;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!SUPPORTED_KEYWORDS.has(key)) continue;
    result[key] = key === 'properties' || key === '$defs' ? sanitizeMap(value) : sanitize(value);
  }
  return withItemLimit(node, result);
}

/** Troca o `maxItems` descartado por uma dica na descrição, para o modelo respeitar o limite. */
function withItemLimit(original: object, sanitized: Record<string, unknown>): Record<string, unknown> {
  const maxItems = (original as { maxItems?: unknown }).maxItems;
  if (typeof maxItems !== 'number') return sanitized;

  const hint = `até ${maxItems} itens`;
  const description = typeof sanitized.description === 'string' ? `${sanitized.description} — ${hint}` : hint;
  return { ...sanitized, description };
}

/** `properties` é um mapa nome → schema: os nomes são livres, só os valores são schemas. */
function sanitizeMap(map: unknown): unknown {
  if (typeof map !== 'object' || map === null) return map;
  return Object.fromEntries(Object.entries(map).map(([name, schema]) => [name, sanitize(schema)]));
}

/**
 * Remove palavras-chave do schema em qualquer nível (os nomes de propriedades ficam como estão).
 * Ex.: `format`, que o modo estrito do Groq recusa quando não conhece o valor ("uri"); o Zod continua validando.
 */
export function omitSchemaKeywords(schema: object, keywords: readonly string[]): object {
  return omit(schema, new Set(keywords)) as object;
}

function omit(node: unknown, keywords: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) return node.map((item) => omit(item, keywords));
  if (typeof node !== 'object' || node === null) return node;

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !keywords.has(key))
      .map(([key, value]) => [
        key,
        key === 'properties' || key === '$defs' ? omitFromMap(value, keywords) : omit(value, keywords),
      ]),
  );
}

function omitFromMap(map: unknown, keywords: ReadonlySet<string>): unknown {
  if (typeof map !== 'object' || map === null) return map;
  return Object.fromEntries(Object.entries(map).map(([name, schema]) => [name, omit(schema, keywords)]));
}
