import type { WritingTone } from '@/common/enums';
import type { ExtractedJob } from '../schemas/extract-job.schema';
import type { ResumeContent } from '../schemas/resume-content.schema';
import type { LlmImage, LlmUsage } from './llm.types';

export interface AiResult<T> {
  data: T;
  usage: LlmUsage;
}

export interface ExtractJobInput {
  text?: string;
  image?: LlmImage;
}

export interface CandidateResume {
  id: string;
  title: string;
  tags: string[];
  content: ResumeContent;
}

export interface AnalyzeFitInput {
  job: ExtractedJob;
  /** Ao menos um: quem chama (`analyses`) garante, com a mensagem útil ao usuário. */
  resumes: [CandidateResume, ...CandidateResume[]];
}

export interface AcceptedSuggestion {
  target: string;
  proposal: string;
}

export interface AnsweredQuestion {
  target: string;
  question: string;
  answer: string;
}

export interface BuildAdjustedInput {
  job: ExtractedJob;
  baseContent: ResumeContent;
  accepted: AcceptedSuggestion[];
  answered: AnsweredQuestion[];
}

export interface ReviseResumeInput {
  content: ResumeContent;
  instruction: string;
}

export interface WritingSettingsInput {
  tone: WritingTone;
  instructions: string;
  opening?: string | null;
  signature?: string | null;
}

export interface WriteEmailInput {
  job: ExtractedJob;
  content: ResumeContent;
  settings: WritingSettingsInput;
}

export interface AnswerQuestionInput extends WriteEmailInput {
  question: string;
}
