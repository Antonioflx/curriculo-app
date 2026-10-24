/**
 * Limites de tamanho do `content` do currículo. Fonte única: o DTO (class-validator) e o schema
 * de saída da IA (Zod) usam estes números, então os dois nunca divergem.
 */
export const RESUME_CONTENT_LIMITS = {
  header: { name: 100, headline: 150, location: 100, phone: 30, email: 254, links: 10, linkLabel: 50, linkUrl: 300 },
  summary: 1500,
  experiences: { max: 20, company: 100, role: 100, date: 20, context: 500, bullets: 15, bullet: 400 },
  skills: { max: 15, category: 60, items: 40, item: 60 },
  education: { max: 10, course: 120, institution: 120, date: 20 },
  languages: { max: 10, name: 50, level: 50 },
} as const;
