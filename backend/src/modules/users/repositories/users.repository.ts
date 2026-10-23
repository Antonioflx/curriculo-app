import { Injectable } from '@nestjs/common';
import { HandlePrismaErrors } from '@/prisma/decorators/handle-prisma-errors.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { USER_ERRORS } from '../constants/user.constants';
import type { CreateUserData } from '../types/user.types';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  @HandlePrismaErrors(USER_ERRORS)
  create(data: CreateUserData) {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
