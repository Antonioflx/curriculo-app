import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { Nested, Text, Trim } from '../decorators/validation.decorators';
import { StrictPartialType } from './strict-partial-type';

class Child {
  @Text(5)
  label: string;
}

class Base {
  @Trim()
  @IsNotEmpty()
  @Text(10)
  title: string;

  @Nested(Child)
  child: Child;
}

class Update extends StrictPartialType(Base) {}

const check = (plain: object) =>
  validate(plainToInstance(Update, plain), { whitelist: true, forbidNonWhitelisted: true });

describe('StrictPartialType', () => {
  it('aceita corpo vazio e campos isolados (tudo opcional)', async () => {
    expect(await check({})).toHaveLength(0);
    expect(await check({ title: 'ok' })).toHaveLength(0);
    expect(await check({ child: { label: 'a' } })).toHaveLength(0);
  });

  it('continua validando o que foi enviado', async () => {
    expect(await check({ title: 'x'.repeat(11) })).not.toHaveLength(0);
    expect(await check({ title: '   ' })).not.toHaveLength(0);
    expect(await check({ child: { label: 'longo demais' } })).not.toHaveLength(0);
  });

  it('recusa null, que o PartialType deixaria passar', async () => {
    expect(await check({ title: null })).not.toHaveLength(0);
    expect(await check({ child: null })).not.toHaveLength(0);
  });

  it('mantém a transformação herdada (Trim)', () => {
    expect(plainToInstance(Update, { title: '  ab  ' }).title).toBe('ab');
  });

  it('recusa campo desconhecido', async () => {
    expect(await check({ outro: 1 })).not.toHaveLength(0);
  });
});
