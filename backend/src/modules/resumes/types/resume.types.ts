import { ResumeKind, ResumeStatus } from '@/common/enums';

export interface ResumeTagRef {
  tag: { id: string; name: string };
}

/** Currículo sem o `content` (listagens). */
export interface ResumeSummary {
  id: string;
  title: string;
  kind: ResumeKind;
  status: ResumeStatus | null;
  parentId: string | null;
  jobId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: ResumeTagRef[];
}

export interface ResumeEntity extends ResumeSummary {
  content: unknown;
}

export interface CreateResumeData {
  title: string;
  content: Record<string, unknown>;
  tagIds: string[];
}

export interface UpdateResumeData {
  title?: string;
  content?: Record<string, unknown>;
  tagIds?: string[];
}

export interface ListResumesFilter {
  kind: ResumeKind;
  tagId?: string;
}
