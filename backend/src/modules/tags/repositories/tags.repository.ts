import { Injectable } from '@nestjs/common';
import { HandlePrismaErrors } from '@/prisma/decorators/handle-prisma-errors.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { TAG_ERRORS, TAG_LIST_LIMIT } from '../constants/tag.constants';

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  @HandlePrismaErrors(TAG_ERRORS)
  create(userId: string, name: string) {
    return this.prisma.tag.create({ data: { userId, name } });
  }

  findAll(userId: string) {
    return this.prisma.tag.findMany({ where: { userId }, orderBy: { name: 'asc' }, take: TAG_LIST_LIMIT });
  }

  findByIds(userId: string, ids: string[]) {
    return this.prisma.tag.findMany({ where: { userId, id: { in: ids } }, take: ids.length });
  }

  count(userId: string) {
    return this.prisma.tag.count({ where: { userId } });
  }

  @HandlePrismaErrors(TAG_ERRORS)
  rename(userId: string, id: string, name: string) {
    return this.prisma.tag.update({ where: { id, userId }, data: { name } });
  }

  @HandlePrismaErrors(TAG_ERRORS)
  delete(userId: string, id: string) {
    return this.prisma.tag.delete({ where: { id, userId } });
  }
}
