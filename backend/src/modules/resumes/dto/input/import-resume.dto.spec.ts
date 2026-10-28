import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportResumeDto } from './import-resume.dto';

const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(16, 0x20)]);
const html = Buffer.from('<html><body><p>Antonio</p></body></html>');

const errorsOf = async (plain: object) =>
  (await validate(plainToInstance(ImportResumeDto, plain), { whitelist: true, forbidNonWhitelisted: true })).flatMap(
    (error) => Object.values(error.constraints ?? {}),
  );

describe('ImportResumeDto (entrada de POST /resumes/import)', () => {
  it.each([
    ['PDF', { file: { mimeType: 'application/pdf', data: pdf } }],
    ['HTML', { file: { mimeType: 'text/html', data: html } }],
  ])('aceita %s', async (_name, plain) => {
    expect(await errorsOf(plain)).toEqual([]);
  });

  it('o Buffer atravessa a transformação do DTO intacto', () => {
    const dto = plainToInstance(ImportResumeDto, { file: { mimeType: 'application/pdf', data: pdf } });
    expect(Buffer.isBuffer(dto.file.data)).toBe(true);
    expect(dto.file.data.equals(pdf)).toBe(true);
  });

  it.each([
    ['sem arquivo', {}],
    ['tipo não permitido', { file: { mimeType: 'image/png', data: pdf } }],
    ['PDF falso (conteúdo é HTML)', { file: { mimeType: 'application/pdf', data: html } }],
    ['arquivo como texto', { file: '%PDF-1.7' }],
  ])('recusa: %s', async (_name, plain) => {
    expect(await errorsOf(plain)).toHaveLength(1);
  });

  it('recusa campo desconhecido (forbidNonWhitelisted)', async () => {
    expect(await errorsOf({ file: { mimeType: 'application/pdf', data: pdf }, extra: 1 })).toHaveLength(1);
  });
});
