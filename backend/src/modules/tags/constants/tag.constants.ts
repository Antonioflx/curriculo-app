import { ConflictException, NotFoundException } from '@nestjs/common';

export const MAX_TAGS_PER_USER = 50;
export const TAG_LIST_LIMIT = 200;
export const TAG_NAME_MAX = 40;
export const TAG_NOT_FOUND_MESSAGE = 'Tag não encontrada';

/** Erros do Prisma → exceptions, para os métodos do TagsRepository. */
export const TAG_ERRORS = {
  P2002: () => new ConflictException('Tag já existe'),
  P2025: () => new NotFoundException(TAG_NOT_FOUND_MESSAGE),
};
