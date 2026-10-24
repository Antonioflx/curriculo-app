import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import { CreateJobDto } from './create-job.dto';

const jpeg = (size = 32) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const image = { mimeType: 'image/jpeg', data: jpeg() };

const parse = (plain: object) => plainToInstance(CreateJobDto, plain);
const errorsOf = async (plain: object) =>
  (await validate(parse(plain), { whitelist: true, forbidNonWhitelisted: true })).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
const NEEDS_SOURCE = 'Envie o texto ou a imagem da vaga';

describe('CreateJobDto (entrada de POST /jobs)', () => {
  describe('o que é aceito', () => {
    it.each([
      ['só o texto', { text: 'Vaga de Dev Backend' }],
      ['só a imagem', { image }],
      ['texto e imagem', { text: 'Vaga de Dev Backend', image }],
      ['texto vazio junto com a imagem (formulário multipart manda text="")', { text: '', image }],
      ['texto só com espaços junto com a imagem', { text: '   ', image }],
      ['texto no limite exato', { text: 'x'.repeat(INPUT_LIMITS.jobText) }],
    ])('%s', async (_name, plain) => {
      expect(await errorsOf(plain)).toEqual([]);
    });

    it('o texto chega aparado ao service; o vazio chega como "não enviado"', () => {
      expect(parse({ text: '  Vaga de Dev  ' }).text).toBe('Vaga de Dev');
      expect(parse({ text: '   ', image }).text).toBeUndefined();
    });

    it('o Buffer da imagem atravessa a transformação do DTO intacto', () => {
      const dto = parse({ image });
      expect(Buffer.isBuffer(dto.image?.data)).toBe(true);
      expect(dto.image?.data.equals(image.data)).toBe(true);
    });
  });

  describe('texto e imagem: pelo menos um', () => {
    it.each([
      ['nada enviado', {}],
      ['texto vazio e sem imagem', { text: '' }],
      ['texto só com espaços e sem imagem', { text: '   \n\t ' }],
    ])('recusa %s com a mensagem útil', async (_name, plain) => {
      expect(await errorsOf(plain)).toContain(NEEDS_SOURCE);
    });
  });

  describe('texto', () => {
    it('recusa texto acima do limite, com ou sem imagem', async () => {
      const text = 'x'.repeat(INPUT_LIMITS.jobText + 1);
      expect(await errorsOf({ text })).not.toEqual([]);
      expect(await errorsOf({ text, image })).not.toEqual([]);
    });

    it('recusa o que não é texto', async () => {
      expect(await errorsOf({ text: 123 })).not.toEqual([]);
      expect(await errorsOf({ text: { $gt: '' } })).not.toEqual([]);
      expect(await errorsOf({ text: ['a'] })).not.toEqual([]);
    });
  });

  describe('imagem', () => {
    it.each([
      ['tipo fora da lista (gif)', { mimeType: 'image/gif', data: jpeg() }],
      ['PDF', { mimeType: 'application/pdf', data: jpeg() }],
      ['conteúdo que não bate com o tipo declarado', { mimeType: 'image/png', data: jpeg() }],
      ['arquivo disfarçado de imagem', { mimeType: 'image/jpeg', data: Buffer.from('<script>alert(1)</script>') }],
      ['vazia', { mimeType: 'image/jpeg', data: Buffer.alloc(0) }],
      ['acima de 5 MB', { mimeType: 'image/jpeg', data: jpeg(INPUT_LIMITS.imageBytes) }],
    ])('recusa %s', async (_name, bad) => {
      expect(await errorsOf({ image: bad })).not.toEqual([]);
      expect(await errorsOf({ text: 'Vaga válida', image: bad })).not.toEqual([]);
    });

    it('aceita PNG e WEBP quando o conteúdo bate', async () => {
      expect(await errorsOf({ image: { mimeType: 'image/png', data: png() } })).toEqual([]);
    });

    it('não aceita imagem forjada por JSON (o Buffer só nasce do upload)', async () => {
      const forged = { mimeType: 'image/png', data: { type: 'Buffer', data: [137, 80, 78, 71, 13, 10, 26, 10] } };
      expect(await errorsOf({ image: forged })).toEqual(['Imagem inválida']);
      expect(await errorsOf({ image: 'data:image/png;base64,AAAA' })).toEqual(['Imagem inválida']);
    });
  });

  it('recusa campo que não existe no DTO (whitelist estrita)', async () => {
    expect(await errorsOf({ text: 'Vaga', userId: 'outro-usuario', rawText: 'x' })).not.toEqual([]);
  });
});
