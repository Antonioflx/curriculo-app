import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { HandlePrismaErrors } from './handle-prisma-errors.decorator';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('falha', { code, clientVersion: 'test' });

class FakeRepository {
  constructor(private readonly behavior: () => Promise<string>) {}

  @HandlePrismaErrors()
  withDefaults() {
    return this.behavior();
  }

  @HandlePrismaErrors({ P2002: () => new ConflictException('E-mail já cadastrado') })
  withOverride() {
    return this.behavior();
  }
}

const failingWith = (error: unknown) => new FakeRepository(() => Promise.reject(error));

describe('HandlePrismaErrors', () => {
  it('devolve o resultado quando não há erro, preservando o this', async () => {
    await expect(new FakeRepository(() => Promise.resolve('ok')).withDefaults()).resolves.toBe('ok');
  });

  it('traduz os códigos padrão', async () => {
    await expect(failingWith(prismaError('P2002')).withDefaults()).rejects.toBeInstanceOf(ConflictException);
    await expect(failingWith(prismaError('P2025')).withDefaults()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('permite sobrescrever a mensagem por método', async () => {
    await expect(failingWith(prismaError('P2002')).withOverride()).rejects.toMatchObject({
      message: 'E-mail já cadastrado',
    });
  });

  it('mantém os padrões para os códigos que não foram sobrescritos', async () => {
    await expect(failingWith(prismaError('P2025')).withOverride()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('repassa erros do Prisma sem mapeamento e erros que não são do Prisma', async () => {
    const unmapped = prismaError('P9999');
    await expect(failingWith(unmapped).withDefaults()).rejects.toBe(unmapped);

    const generic = new Error('conexão caiu');
    await expect(failingWith(generic).withDefaults()).rejects.toBe(generic);
  });
});
