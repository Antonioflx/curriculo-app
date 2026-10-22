/**
 * Único ponto onde os enums do Prisma entram na aplicação.
 * Services e DTOs importam daqui, nunca de `@/generated`.
 */
export {
  MessageType,
  ResumeKind,
  ResumeStatus,
  SuggestionKind,
  SuggestionStatus,
  WritingTone,
} from '@/generated/prisma/enums';
