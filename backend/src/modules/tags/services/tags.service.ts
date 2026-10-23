import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_TAGS_PER_USER, TAG_NOT_FOUND_MESSAGE } from '../constants/tag.constants';
import { TagsRepository } from '../repositories/tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly tags: TagsRepository) {}

  async create(userId: string, name: string) {
    if ((await this.tags.count(userId)) >= MAX_TAGS_PER_USER) {
      throw new BadRequestException(`Limite de ${MAX_TAGS_PER_USER} tags atingido`);
    }
    return this.tags.create(userId, name);
  }

  list(userId: string) {
    return this.tags.findAll(userId);
  }

  rename(userId: string, id: string, name: string) {
    return this.tags.rename(userId, id, name);
  }

  async remove(userId: string, id: string) {
    await this.tags.delete(userId, id);
  }

  /** Garante que todas as tags são do usuário (senão 404) e devolve os ids sem repetição. */
  async assertOwned(userId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return unique;

    const found = await this.tags.findByIds(userId, unique);
    if (found.length !== unique.length) throw new NotFoundException(TAG_NOT_FOUND_MESSAGE);
    return unique;
  }
}
