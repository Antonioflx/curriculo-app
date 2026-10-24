import { ResumeKind, ResumeStatus } from '@/common/enums';
import { TagResponseDto } from '@/modules/tags/dto/output/tag-response.dto';
import type { ResumeEntity, ResumeSummary } from '@/modules/resumes/types/resume.types';

export class ResumeSummaryDto {
  id: string;
  title: string;
  kind: ResumeKind;
  status: ResumeStatus | null;
  parentId: string | null;
  jobId: string | null;
  tags: TagResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  static from(resume: ResumeSummary): ResumeSummaryDto {
    return {
      id: resume.id,
      title: resume.title,
      kind: resume.kind,
      status: resume.status,
      parentId: resume.parentId,
      jobId: resume.jobId,
      tags: resume.tags.map(({ tag }) => TagResponseDto.from(tag)),
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }
}

export class ResumeResponseDto extends ResumeSummaryDto {
  content: unknown;

  static override from(resume: ResumeEntity): ResumeResponseDto {
    return { ...ResumeSummaryDto.from(resume), content: resume.content };
  }
}
