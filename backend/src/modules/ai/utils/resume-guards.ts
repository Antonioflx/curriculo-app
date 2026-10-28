import type { ResumeContent } from '../schemas/resume-content.schema';

/**
 * "Ajuste muda ênfase, não fatos": o currículo ajustado precisa ter as mesmas experiências
 * (empresa, cargo e datas, na mesma ordem) do base. Devolve o primeiro problema, ou null se está ok.
 */
export function findChangedExperience(base: ResumeContent, adjusted: ResumeContent): string | null {
  if (base.experiences.length !== adjusted.experiences.length) return 'quantidade de experiências mudou';

  const changed = base.experiences.findIndex((experience, index) => {
    const next = adjusted.experiences[index];
    return (
      experience.company !== next.company ||
      experience.role !== next.role ||
      experience.start !== next.start ||
      experience.end !== next.end
    );
  });
  return changed === -1 ? null : `experiência ${changed} mudou (empresa, cargo ou datas)`;
}

/**
 * Habilidade nova só entra se o usuário a mostrou: o item precisa já aparecer no currículo base ou nas
 * respostas dele. O modelo costuma "completar" as habilidades com palavras-chave da vaga (ex.: Linux) que o
 * usuário não tem. Remove esses itens (e categorias que ficarem vazias) e devolve quais saíram, só para o log.
 */
export function removeInventedSkills(
  base: ResumeContent,
  adjusted: ResumeContent,
  userAnswers: string[],
): { content: ResumeContent; removed: string[] } {
  const known = [JSON.stringify(base), ...userAnswers].join('\n').toLowerCase();
  const removed: string[] = [];

  const skills = adjusted.skills
    .map((skill) => ({
      ...skill,
      items: skill.items.filter((item) => {
        if (known.includes(item.toLowerCase())) return true;
        removed.push(item);
        return false;
      }),
    }))
    .filter((skill) => skill.items.length > 0);

  return { content: { ...adjusted, skills }, removed };
}
