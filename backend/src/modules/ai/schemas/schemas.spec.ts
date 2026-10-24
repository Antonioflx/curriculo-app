import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RESUME_CONTENT_LIMITS as L } from '@/common/constants/resume-content.limits';
import { ResumeContentDto } from '@/modules/resumes/dto/input/resume-content.dto';
import { resumeContent } from '@test/fixtures/resume-content';
import { extractJobSchema } from './extract-job.schema';
import { resumeContentSchema } from './resume-content.schema';

const withExperience = (patch: object) => ({
  ...resumeContent,
  experiences: [{ ...resumeContent.experiences[0], ...patch }],
});
const dtoErrors = (plain: unknown) =>
  validate(plainToInstance(ResumeContentDto, plain), { whitelist: true, forbidNonWhitelisted: true });

describe('resumeContentSchema (Zod) × ResumeContentDto (class-validator)', () => {
  // O DTO é a fonte da verdade do que o app aceita; o schema da IA não pode ser mais frouxo nem mais rígido.
  const cases: [string, unknown, boolean][] = [
    ['currículo válido (emprego atual, end = null)', resumeContent, true],
    ['end preenchido', withExperience({ end: '2024-06' }), true],
    ['bullet no limite', withExperience({ bullets: ['x'.repeat(L.experiences.bullet)] }), true],
    ['bullet acima do limite', withExperience({ bullets: ['x'.repeat(L.experiences.bullet + 1)] }), false],
    ['bullets demais', withExperience({ bullets: Array(L.experiences.bullets + 1).fill('a') }), false],
    ['resumo acima do limite', { ...resumeContent, summary: 'x'.repeat(L.summary + 1) }, false],
    ['e-mail inválido', { ...resumeContent, header: { ...resumeContent.header, email: 'não-é-email' } }, false],
    [
      'link javascript:',
      { ...resumeContent, header: { ...resumeContent.header, links: [{ label: 'x', url: 'javascript:alert(1)' }] } },
      false,
    ],
    ['seção ausente', { ...resumeContent, header: undefined }, false],
    ['end ausente', withExperience({ end: undefined }), false],
  ];

  it.each(cases)('%s', async (_name, input, valid) => {
    expect(resumeContentSchema.safeParse(input).success).toBe(valid);
    expect((await dtoErrors(input)).length === 0).toBe(valid);
  });
});

describe('extractJobSchema', () => {
  const job = {
    title: 'Dev',
    company: null,
    contactEmail: null,
    stacks: [],
    requirements: [],
    niceToHave: [],
    seniority: null,
    contractModel: null,
  };

  it('aceita campos nulos e listas vazias (vaga com poucas informações)', () => {
    expect(extractJobSchema.safeParse(job).success).toBe(true);
  });

  it('recusa e-mail inválido e campo faltando', () => {
    expect(extractJobSchema.safeParse({ ...job, contactEmail: 'rh' }).success).toBe(false);
    expect(extractJobSchema.safeParse({ ...job, stacks: undefined }).success).toBe(false);
  });
});
