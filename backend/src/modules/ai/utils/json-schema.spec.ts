import { z } from 'zod';
import { omitSchemaKeywords, toLlmJsonSchema } from './json-schema';

type Node = { [key: string]: Node & unknown };

describe('toLlmJsonSchema', () => {
  const schema = z.object({
    name: z.string().max(10).describe('o nome'),
    email: z.email().nullable(),
    kind: z.enum(['A', 'B']),
    tags: z.array(z.string().max(5)).max(3),
    notes: z.array(z.string()).max(2).describe('observações'),
    pattern: z.string(),
    nested: z.object({ items: z.array(z.object({ id: z.string() })).max(4) }),
  });
  const json = toLlmJsonSchema(schema) as Node;

  it('remove $schema e palavras que o Gemini não aceita (maxLength)', () => {
    expect(JSON.stringify(json)).not.toMatch(/\$schema|maxLength|minLength/);
  });

  it('mantém tipo, propriedades, obrigatórios, enum, formato e nulos', () => {
    expect(json.type).toBe('object');
    expect(json.required).toEqual(expect.arrayContaining(['name', 'email', 'kind', 'tags']));
    expect(json.properties.kind.enum).toEqual(['A', 'B']);
    expect(json.properties.name.description).toBe('o nome');
    expect(JSON.stringify(json.properties.email)).toContain('"format":"email"');
    expect(JSON.stringify(json.properties.email)).toContain('"type":"null"');
  });

  it('não envia maxItems (estoura a complexidade do Gemini) e passa o limite para a descrição', () => {
    expect(JSON.stringify(json)).not.toContain('maxItems');
    expect(json.properties.tags.description).toBe('até 3 itens');
    expect(json.properties.notes.description).toBe('observações — até 2 itens');
    expect(json.properties.nested.properties.items.description).toBe('até 4 itens');
  });

  it('nome de propriedade igual a palavra-chave do schema não é descartado', () => {
    expect(json.properties.pattern.type).toBe('string');
  });
});

describe('omitSchemaKeywords', () => {
  const schema = {
    type: 'object',
    properties: {
      format: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      links: { type: 'array', items: { type: 'object', properties: { href: { type: 'string', format: 'uri' } } } },
      maybe: { anyOf: [{ type: 'string', format: 'email' }, { type: 'null' }] },
    },
  };
  const result = omitSchemaKeywords(schema, ['format']) as typeof schema;

  it('remove a palavra-chave em todos os níveis (itens, anyOf)', () => {
    expect(JSON.stringify(result)).not.toContain('"uri"');
    expect(JSON.stringify(result)).not.toContain('"email"');
    expect(result.properties.links.items.properties.href).toEqual({ type: 'string' });
  });

  it('não confunde com uma propriedade que se chama igual à palavra-chave', () => {
    expect(result.properties.format).toEqual({ type: 'string' });
  });

  it('não altera o schema original', () => {
    expect(schema.properties.url.format).toBe('uri');
  });
});
