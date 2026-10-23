import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { omit, resumeContent } from '@test/fixtures/resume-content';
import { ResumeContentDto } from './resume-content.dto';

const check = (plain: unknown) =>
  validate(plainToInstance(ResumeContentDto, plain), { whitelist: true, forbidNonWhitelisted: true });
const withExperience = (patch: object) => ({
  ...resumeContent,
  experiences: [{ ...resumeContent.experiences[0], ...patch }],
});

describe('ResumeContentDto', () => {
  it('aceita um currículo válido, com emprego atual (end = null)', async () => {
    expect(await check(resumeContent)).toHaveLength(0);
  });

  it('exige end quando não é null', async () => {
    const withoutEnd = omit(resumeContent.experiences[0], 'end');
    expect(await check({ ...resumeContent, experiences: [withoutEnd] })).not.toHaveLength(0);
    expect(await check(withExperience({ end: '2024-06' }))).toHaveLength(0);
  });

  it('rejeita campo desconhecido em qualquer nível', async () => {
    expect(await check({ ...resumeContent, role: 'admin' })).not.toHaveLength(0);
    expect(await check(withExperience({ salary: 1000 }))).not.toHaveLength(0);
  });

  it('rejeita seção ausente', async () => {
    const withoutHeader = omit(resumeContent, 'header');
    expect(await check(withoutHeader)).not.toHaveLength(0);
  });

  it('aplica os limites de tamanho', async () => {
    expect(await check({ ...resumeContent, summary: 'x'.repeat(1501) })).not.toHaveLength(0);
    expect(await check(withExperience({ bullets: Array(16).fill('a') }))).not.toHaveLength(0);
    expect(await check(withExperience({ bullets: ['x'.repeat(401)] }))).not.toHaveLength(0);
  });

  it('só aceita links http(s) válidos', async () => {
    const withLink = (url: string) => ({
      ...resumeContent,
      header: { ...resumeContent.header, links: [{ label: 'x', url }] },
    });
    expect(await check(withLink('javascript:alert(1)'))).not.toHaveLength(0);
    expect(await check(withLink('não é url'))).not.toHaveLength(0);
    expect(await check(withLink('https://exemplo.com/perfil'))).toHaveLength(0);
  });
});
