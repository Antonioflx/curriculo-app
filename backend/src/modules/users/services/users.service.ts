import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserData } from '../types/user.types';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  create(data: CreateUserData) {
    return this.users.create(data);
  }

  findByEmail(email: string) {
    return this.users.findByEmail(email);
  }

  async getById(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }
}
