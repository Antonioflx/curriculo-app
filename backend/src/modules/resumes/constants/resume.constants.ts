import { NotFoundException } from '@nestjs/common';

export const MAX_BASE_RESUMES_PER_USER = 30;
export const MAX_TAGS_PER_RESUME = 10;
export const RESUME_LIST_LIMIT = 100;
export const RESUME_TITLE_MAX = 100;
export const COPY_SUFFIX = ' (cópia)';
export const RESUME_NOT_FOUND_MESSAGE = 'Currículo não encontrado';
export const ONLY_BASE_HAS_TAGS_MESSAGE = 'Só currículos base têm tags';

/** Erros do Prisma → exceptions, para os métodos do ResumesRepository. */
export const RESUME_ERRORS = {
  P2025: () => new NotFoundException(RESUME_NOT_FOUND_MESSAGE),
};
