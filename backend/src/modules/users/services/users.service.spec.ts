import { NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const repository = { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() };
  const service = new UsersService(repository as unknown as UsersRepository);

  beforeEach(() => jest.resetAllMocks());

  it('getById devolve o usuário encontrado', async () => {
    repository.findById.mockResolvedValue({ id: 'u1' });
    await expect(service.getById('u1')).resolves.toEqual({ id: 'u1' });
  });

  it('getById lança NotFound quando não existe', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getById('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
