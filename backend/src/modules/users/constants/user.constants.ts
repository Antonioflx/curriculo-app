import { ConflictException } from '@nestjs/common';

export const USER_NOT_FOUND_MESSAGE = 'Usuário não encontrado';

/** Erros do Prisma → exceptions, para os métodos do UsersRepository. */
export const USER_ERRORS = {
  P2002: () => new ConflictException('E-mail já cadastrado'),
};
