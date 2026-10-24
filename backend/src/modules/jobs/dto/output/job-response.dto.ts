import type { ExtractedJob } from '@/modules/ai/schemas/extract-job.schema';
import type { JobEntity, JobSummary } from '@/modules/jobs/types/job.types';

/** Item de listagem: só o necessário para escolher a vaga. */
export class JobSummaryDto {
  id: string;
  title: string;
  company: string | null;
  createdAt: Date;

  static from(job: JobSummary): JobSummaryDto {
    return { id: job.id, title: job.title, company: job.company, createdAt: job.createdAt };
  }
}

/** Vaga completa, achatada: nunca devolve o texto bruto enviado nem campos internos. */
export class JobResponseDto extends JobSummaryDto {
  contactEmail: string | null;
  stacks: string[];
  requirements: string[];
  niceToHave: string[];
  seniority: string | null;
  contractModel: string | null;

  static override from(job: JobEntity): JobResponseDto {
    const extracted = job.extracted as ExtractedJob;
    return {
      ...JobSummaryDto.from(job),
      contactEmail: job.contactEmail,
      stacks: extracted.stacks,
      requirements: extracted.requirements,
      niceToHave: extracted.niceToHave,
      seniority: extracted.seniority,
      contractModel: extracted.contractModel,
    };
  }
}
