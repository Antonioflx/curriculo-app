import { resumeContent } from '@test/fixtures/resume-content';
import type { ResumeContent } from '../schemas/resume-content.schema';
import { findChangedExperience } from './resume-guards';

const base = resumeContent as ResumeContent;
const withExperience = (patch: Partial<ResumeContent['experiences'][number]>): ResumeContent => ({
  ...base,
  experiences: [{ ...base.experiences[0], ...patch }],
});

describe('findChangedExperience', () => {
  it('aceita o mesmo currículo e mudanças de ênfase (resumo, bullets, habilidades)', () => {
    expect(findChangedExperience(base, base)).toBeNull();
    expect(
      findChangedExperience(base, {
        ...withExperience({ bullets: ['Outro bullet', 'Mais um'], context: 'Contexto novo' }),
        summary: 'Resumo novo',
        skills: [{ category: 'Linguagens', items: ['SQL', 'TypeScript', 'Docker'] }],
      }),
    ).toBeNull();
  });

  it.each([
    ['empresa', { company: 'Outra' }],
    ['cargo', { role: 'CTO' }],
    ['data de início', { start: '2010-01' }],
    ['data de fim', { end: '2024-01' }],
  ])('detecta mudança de %s', (_name, patch) => {
    expect(findChangedExperience(base, withExperience(patch))).toContain('experiência 0 mudou');
  });

  it('detecta experiência inventada ou removida', () => {
    const invented = { ...base, experiences: [...base.experiences, base.experiences[0]] };
    expect(findChangedExperience(base, invented)).toContain('quantidade');
    expect(findChangedExperience(base, { ...base, experiences: [] })).toContain('quantidade');
  });
});
