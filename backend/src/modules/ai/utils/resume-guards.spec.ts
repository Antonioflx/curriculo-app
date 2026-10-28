import { resumeContent } from '@test/fixtures/resume-content';
import type { ResumeContent } from '../schemas/resume-content.schema';
import { findChangedExperience, removeInventedSkills } from './resume-guards';

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

describe('removeInventedSkills', () => {
  const withSkills = (...skills: ResumeContent['skills']): ResumeContent => ({
    ...(resumeContent as ResumeContent),
    skills,
  });
  const base = withSkills({ category: 'Backend', items: ['Node.js', 'NestJS'] });

  it('mantém o que já estava no currículo base, em qualquer ordem', () => {
    const adjusted = withSkills({ category: 'Backend', items: ['NestJS', 'Node.js'] });
    expect(removeInventedSkills(base, adjusted, [])).toEqual({ content: adjusted, removed: [] });
  });

  it('remove a habilidade que o usuário não mostrou e devolve quais saíram', () => {
    const adjusted = withSkills({ category: 'Backend', items: ['Node.js', 'Linux', 'Kafka'] });
    const { content, removed } = removeInventedSkills(base, adjusted, []);
    expect(content.skills).toEqual([{ category: 'Backend', items: ['Node.js'] }]);
    expect(removed).toEqual(['Linux', 'Kafka']);
  });

  it('aceita habilidade que o usuário citou na própria resposta (sem diferenciar maiúsculas)', () => {
    const adjusted = withSkills({ category: 'Backend', items: ['Node.js', 'Redis'] });
    expect(removeInventedSkills(base, adjusted, ['Usei redis para cache']).removed).toEqual([]);
  });

  it('descarta a categoria que ficou vazia e não toca no resto do currículo', () => {
    const adjusted = {
      ...withSkills({ category: 'Backend', items: ['Node.js'] }, { category: 'SO', items: ['Linux'] }),
      summary: 'novo',
    };
    const { content } = removeInventedSkills(base, adjusted, []);
    expect(content.skills.map((skill) => skill.category)).toEqual(['Backend']);
    expect(content.summary).toBe('novo');
  });
});
