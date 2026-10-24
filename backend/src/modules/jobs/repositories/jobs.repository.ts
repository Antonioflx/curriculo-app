import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import { HandlePrismaErrors } from '@/prisma/decorators/handle-prisma-errors.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { JOB_ERRORS, JOB_LIST_LIMIT } from '../constants/job.constants';
import type { CreateJobData } from '../types/job.types';

/** Só o que o app devolve e usa: o `rawText` (pode ser grande) nunca é lido de volta. */
const JOB_FIELDS = {
  id: true,
  title: true,
  company: true,
  contactEmail: true,
  extracted: true,
  createdAt: true,
} as const;
const SUMMARY_FIELDS = { id: true, title: true, company: true, createdAt: true } as const;

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @HandlePrismaErrors()
  create(userId: string, data: CreateJobData) {
    return this.prisma.jobPosting.create({
      data: {
        userId,
        rawText: data.rawText,
        title: data.title,
        company: data.company,
        contactEmail: data.contactEmail,
        extracted: data.extracted as Prisma.InputJsonObject,
      },
      select: JOB_FIELDS,
    });
  }

  findAll(userId: string) {
    return this.prisma.jobPosting.findMany({
      where: { userId },
      select: SUMMARY_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: JOB_LIST_LIMIT,
    });
  }

  findById(userId: string, id: string) {
    return this.prisma.jobPosting.findFirst({ where: { id, userId }, select: JOB_FIELDS });
  }

  count(userId: string) {
    return this.prisma.jobPosting.count({ where: { userId } });
  }

  @HandlePrismaErrors(JOB_ERRORS)
  delete(userId: string, id: string) {
    return this.prisma.jobPosting.delete({ where: { id, userId } });
  }
}
