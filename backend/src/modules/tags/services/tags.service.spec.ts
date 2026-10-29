import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MAX_TAGS_PER_USER } from '../constants/tag.constants';
import { TagsRepository } from '../repositories/tags.repository';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByIds: jest.fn(),
    count: jest.fn(),
    rename: jest.fn(),
    delete: jest.fn(),
  };
  const service = new TagsService(repository as unknown as TagsRepository);

  beforeEach(() => jest.resetAllMocks());

  describe('create', () => {
    it('cria a tag abaixo do limite', async () => {
      repository.count.mockResolvedValue(MAX_TAGS_PER_USER - 1);
      repository.create.mockResolvedValue({ id: 't1', name: 'backend' });
      await expect(service.create('u1', 'backend')).resolves.toEqual({ id: 't1', name: 'backend' });
      expect(repository.create).toHaveBeenCalledWith('u1', 'backend');
    });

    it('recusa no limite de tags por usuário', async () => {
      repository.count.mockResolvedValue(MAX_TAGS_PER_USER);
      await expect(service.create('u1', 'backend')).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('assertOwned', () => {
    it('sem ids não consulta o banco', async () => {
      await expect(service.assertOwned('u1', [])).resolves.toEqual([]);
      expect(repository.findByIds).not.toHaveBeenCalled();
    });

    it('remove repetidos e devolve os ids únicos', async () => {
      repository.findByIds.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      await expect(service.assertOwned('u1', ['a', 'b', 'a'])).resolves.toEqual(['a', 'b']);
      expect(repository.findByIds).toHaveBeenCalledWith('u1', ['a', 'b']);
    });
    // comentarios
    it('404 se alguma tag não é do usuário', async () => {
      repository.findByIds.mockResolvedValue([{ id: 'a' }]);
      await expect(service.assertOwned('u1', ['a', 'b'])).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('rename e remove delegam ao repository com o userId', async () => {
    await service.rename('u1', 't1', 'novo');
    await service.remove('u1', 't1');
    expect(repository.rename).toHaveBeenCalledWith('u1', 't1', 'novo');
    expect(repository.delete).toHaveBeenCalledWith('u1', 't1');
  });
});
