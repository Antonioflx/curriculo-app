import { Injectable, NotFoundException } from '@nestjs/common';
import { isEmpty } from '@/common/utils/empty.utils';
import { assertBelowLimit } from '@/common/utils/limit.utils';
import { MAX_TAGS_PER_USER, TAG_NOT_FOUND_MESSAGE } from '../constants/tag.constants';
import { TagsRepository } from '../repositories/tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly tags: TagsRepository) {}

  async create(userId: string, name: string) {
    assertBelowLimit(await this.tags.count(userId), MAX_TAGS_PER_USER, 'tags');
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
    if (isEmpty(unique)) return unique;

    const found = await this.tags.findByIds(userId, unique);
    if (found.length !== unique.length) throw new NotFoundException(TAG_NOT_FOUND_MESSAGE);
    return unique;
  }
}
