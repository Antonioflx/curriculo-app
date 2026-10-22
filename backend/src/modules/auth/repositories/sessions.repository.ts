import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateSessionData } from '../types/auth.types';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSessionData) {
    return this.prisma.session.create({ data });
  }

  /** Busca pelo hash do refresh: o userId ainda não é conhecido neste ponto. */
  findByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  findActive(id: string, userId: string) {
    return this.prisma.session.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /**
   * Rotação atômica: revoga a sessão atual só se ainda estiver ativa e cria a próxima.
   * Devolve null se outra requisição já a revogou (reuso concorrente).
   */
  rotate(currentId: string, next: CreateSessionData) {
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) return null;
      return tx.session.create({ data: next });
    });
  }

  async revokeFamily(familyId: string) {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Logout: revoga toda a família da sessão do usuário. */
  async revokeFamilyOf(id: string, userId: string) {
    const session = await this.prisma.session.findFirst({ where: { id, userId } });
    if (session) await this.revokeFamily(session.familyId);
  }
}
