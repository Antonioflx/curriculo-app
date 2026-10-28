import { z } from 'zod';
import { RESUME_CONTENT_LIMITS as L } from '@/common/constants/resume-content.limits';
import { str, strList } from './helpers';

/** Espelho do `ResumeContentDto` (mesmos limites, via `RESUME_CONTENT_LIMITS`). */
export const resumeContentSchema = z.object({
  header: z.object({
    name: str(L.header.name),
    headline: str(L.header.headline),
    location: str(L.header.location),
    phone: str(L.header.phone),
    // Opcional: string vazia = sem e-mail. A regra fica num refine para o JSON Schema do modelo continuar `string`.
    email: str(L.header.email).refine((email) => email === '' || z.email().safeParse(email).success),
    links: z
      .array(z.object({ label: str(L.header.linkLabel), url: z.url({ protocol: /^https?$/ }).max(L.header.linkUrl) }))
      .max(L.header.links),
  }),
  summary: str(L.summary),
  experiences: z
    .array(
      z.object({
        company: str(L.experiences.company),
        role: str(L.experiences.role),
        start: str(L.experiences.date),
        end: str(L.experiences.date).nullable(),
        context: str(L.experiences.context),
        bullets: strList(L.experiences.bullets, L.experiences.bullet),
      }),
    )
    .max(L.experiences.max),
  skills: z
    .array(z.object({ category: str(L.skills.category), items: strList(L.skills.items, L.skills.item) }))
    .max(L.skills.max),
  education: z
    .array(
      z.object({
        course: str(L.education.course),
        institution: str(L.education.institution),
        start: str(L.education.date),
        end: str(L.education.date),
      }),
    )
    .max(L.education.max),
  languages: z.array(z.object({ name: str(L.languages.name), level: str(L.languages.level) })).max(L.languages.max),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;
