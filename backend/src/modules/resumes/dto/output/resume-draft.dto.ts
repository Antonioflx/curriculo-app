import type { ResumeContent } from '@/modules/ai/schemas/resume-content.schema';

/** Currículo extraído de um arquivo: rascunho para o usuário revisar, ainda não salvo. */
export class ResumeDraftDto {
  content: ResumeContent;

  static from(content: ResumeContent): ResumeDraftDto {
    return { content };
  }
}
