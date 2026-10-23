import { Injectable } from '@nestjs/common';
import { ResumeKind } from '@/common/enums';
import { Prisma } from '@/generated/prisma/client';
import { HandlePrismaErrors } from '@/prisma/decorators/handle-prisma-errors.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { RESUME_ERRORS, RESUME_LIST_LIMIT } from '../constants/resume.constants';
import type { CreateResumeData, ListResumesFilter, UpdateResumeData } from '../types/resume.types';

const WITH_TAGS = { tags: { select: { tag: { select: { id: true, name: true } } } } } as const;

const toTagLinks = (tagIds: string[]) => tagIds.map((tagId) => ({ tagId }));
const toJson = (content: Record<string, unknown>) => content as Prisma.InputJsonObject;

@Injectable()
export class ResumesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria sempre um currículo BASE; ajustados nascem do módulo de análises. */
  @HandlePrismaErrors()
  create(userId: string, data: CreateResumeData) {
    return this.prisma.resume.create({
      data: {
        userId,
        kind: ResumeKind.BASE,
        title: data.title,
        content: toJson(data.content),
        tags: { create: toTagLinks(data.tagIds) },
      },
      include: WITH_TAGS,
    });
  }

  findAll(userId: string, filter: ListResumesFilter) {
    return this.prisma.resume.findMany({
      where: {
        userId,
        kind: filter.kind,
        ...(filter.tagId && { tags: { some: { tagId: filter.tagId } } }),
      },
      omit: { content: true },
      include: WITH_TAGS,
      orderBy: { updatedAt: 'desc' },
      take: RESUME_LIST_LIMIT,
    });
  }

  findById(userId: string, id: string) {
    return this.prisma.resume.findFirst({ where: { id, userId }, include: WITH_TAGS });
  }

  countBase(userId: string) {
    return this.prisma.resume.count({ where: { userId, kind: ResumeKind.BASE } });
  }

  /** Trocar as tags e editar o resto acontece numa só escrita (atômica). */
  @HandlePrismaErrors(RESUME_ERRORS)
  update(userId: string, id: string, data: UpdateResumeData) {
    return this.prisma.resume.update({
      where: { id, userId },
      data: {
        title: data.title,
        content: data.content && toJson(data.content),
        ...(data.tagIds && { tags: { deleteMany: {}, create: toTagLinks(data.tagIds) } }),
      },
      include: WITH_TAGS,
    });
  }

  @HandlePrismaErrors(RESUME_ERRORS)
  delete(userId: string, id: string) {
    return this.prisma.resume.delete({ where: { id, userId } });
  }
}
