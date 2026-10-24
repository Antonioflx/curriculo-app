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
