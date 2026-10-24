import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Nested, NestedList, Text, TextList, Trim } from './validation.decorators';

class Child {
  @Text(3)
  name: string;
}

class Sample {
  @Trim({ lowercase: true })
  @Text(10)
  label: string;

  @TextList(2, 3)
  tags: string[];

  @Nested(Child)
  child: Child;

  @NestedList(Child, 2)
  children: Child[];
}

const valid = { label: '  ABC  ', tags: ['a', 'b'], child: { name: 'xyz' }, children: [{ name: 'a' }] };
const check = (plain: object) =>
  validate(plainToInstance(Sample, plain), { whitelist: true, forbidNonWhitelisted: true });

describe('validation decorators', () => {
  describe('Trim({ emptyAsUndefined })', () => {
    class Form {
      @Trim({ emptyAsUndefined: true })
      note?: string;
    }
    const noteOf = (value: unknown) => plainToInstance(Form, { note: value }).note;

    it('texto vazio ou só com espaços vira undefined (campo não enviado)', () => {
      expect(noteOf('')).toBeUndefined();
      expect(noteOf('   ')).toBeUndefined();
    });

    it('texto com conteúdo é só aparado; o que não é texto passa como veio', () => {
      expect(noteOf('  oi  ')).toBe('oi');
      expect(noteOf(5)).toBe(5);
      expect(noteOf(undefined)).toBeUndefined();
    });

    it('sem a opção, vazio continua vazio', () => {
      class Plain {
        @Trim()
        note?: string;
      }
      expect(plainToInstance(Plain, { note: '  ' }).note).toBe('');
    });
  });

  it('aceita um objeto válido e aplica o Trim', async () => {
    expect(await check(valid)).toHaveLength(0);
    expect(plainToInstance(Sample, valid).label).toBe('abc');
  });

  it('Text limita o tamanho e exige string', async () => {
    expect(await check({ ...valid, label: 'x'.repeat(11) })).not.toHaveLength(0);
    expect(await check({ ...valid, label: 5 })).not.toHaveLength(0);
  });

  it('TextList limita itens e tamanho de cada item', async () => {
    expect(await check({ ...valid, tags: ['a', 'b', 'c'] })).not.toHaveLength(0);
    expect(await check({ ...valid, tags: ['abcd'] })).not.toHaveLength(0);
    expect(await check({ ...valid, tags: 'a' })).not.toHaveLength(0);
  });

  it('Nested exige o objeto e valida os campos dele', async () => {
    expect(await check({ ...valid, child: undefined })).not.toHaveLength(0);
    expect(await check({ ...valid, child: { name: 'longo demais' } })).not.toHaveLength(0);
    expect(await check({ ...valid, child: { name: 'ok', extra: 1 } })).not.toHaveLength(0);
  });

  it('NestedList limita itens e valida cada um', async () => {
    expect(await check({ ...valid, children: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })).not.toHaveLength(0);
    expect(await check({ ...valid, children: [{ name: 'longo demais' }] })).not.toHaveLength(0);
  });
});
