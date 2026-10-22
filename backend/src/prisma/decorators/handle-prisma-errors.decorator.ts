import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';

type ErrorFactory = () => Error;

/** Código de erro do Prisma → exception a lançar. */
export type PrismaErrorMap = Partial<Record<string, ErrorFactory>>;

const DEFAULT_ERRORS: PrismaErrorMap = {
  P2002: () => new ConflictException('Registro já existe'),
  P2003: () => new BadRequestException('Referência inválida'),
  P2025: () => new NotFoundException('Registro não encontrado'),
};

/**
 * Traduz erros conhecidos do Prisma em exceptions do Nest nos métodos de um repository.
 * Os padrões (P2002, P2003, P2025) podem ser sobrescritos por método; qualquer outro erro segue adiante.
 *
 * @example
 * @HandlePrismaErrors({ P2002: () => new ConflictException('E-mail já cadastrado') })
 * create(data: CreateUserData) { return this.prisma.user.create({ data }); }
 */
export function HandlePrismaErrors(overrides: PrismaErrorMap = {}): MethodDecorator {
  const errors = { ...DEFAULT_ERRORS, ...overrides };

  return (_target, _key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      try {
        return await original.apply(this, args);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const toException = errors[error.code];
          if (toException) throw toException();
        }
        throw error;
      }
    };
    return descriptor;
  };
}
