import type { ExtractedJob } from '@/modules/ai/schemas/extract-job.schema';

export interface CreateJobData {
  /** Texto enviado pelo usuário. A imagem nunca é guardada: só o que a IA extraiu dela. */
  rawText?: string;
  title: string;
  company: string | null;
  contactEmail: string | null;
  extracted: ExtractedJob;
}

/** Vaga sem o `rawText` (pode ser grande e o usuário já o conhece): é tudo que o app devolve e usa. */
export interface JobEntity {
  id: string;
  title: string;
  company: string | null;
  contactEmail: string | null;
  extracted: unknown;
  createdAt: Date;
}

/** Linha de listagem: sem o `extracted` (que é o pesado). */
export type JobSummary = Pick<JobEntity, 'id' | 'title' | 'company' | 'createdAt'>;
