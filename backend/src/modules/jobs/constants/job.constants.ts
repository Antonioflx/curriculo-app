import { NotFoundException } from '@nestjs/common';

export const MAX_JOBS_PER_USER = 200;
export const JOB_LIST_LIMIT = 100;
export const JOB_NOT_FOUND_MESSAGE = 'Vaga não encontrada';

/** Erros do Prisma → exceptions, para os métodos do JobsRepository. */
export const JOB_ERRORS = {
  P2025: () => new NotFoundException(JOB_NOT_FOUND_MESSAGE),
};
