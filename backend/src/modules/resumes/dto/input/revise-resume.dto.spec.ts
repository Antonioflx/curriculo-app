import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import { ReviseResumeDto } from './revise-resume.dto';

const parse = (plain: object) => plainToInstance(ReviseResumeDto, plain);
const errorsOf = async (plain: object) =>
  (await validate(parse(plain), { whitelist: true, forbidNonWhitelisted: true })).length;

describe('ReviseResumeDto (entrada de POST /resumes/:id/revise)', () => {
  it('aceita um pedido normal e o entrega aparado', async () => {
    expect(await errorsOf({ instruction: '  Tira o bullet de SVG  ' })).toBe(0);
    expect(parse({ instruction: '  Tira o bullet de SVG  ' }).instruction).toBe('Tira o bullet de SVG');
  });

  it('aceita exatamente o limite e recusa um caractere a mais', async () => {
    expect(await errorsOf({ instruction: 'x'.repeat(INPUT_LIMITS.instruction) })).toBe(0);
    expect(await errorsOf({ instruction: 'x'.repeat(INPUT_LIMITS.instruction + 1) })).toBeGreaterThan(0);
  });

  it.each([{}, { instruction: '' }, { instruction: '   ' }, { instruction: 42 }, { instruction: ['a'] }])(
    'recusa pedido ausente, vazio ou que não é texto: %p',
    async (plain) => {
      expect(await errorsOf(plain)).toBeGreaterThan(0);
    },
  );

  it('recusa campo desconhecido', async () => {
    expect(await errorsOf({ instruction: 'ok', content: {} })).toBeGreaterThan(0);
  });
});
