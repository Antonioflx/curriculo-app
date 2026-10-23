import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { ResumeKind } from '@/common/enums';
import { TagsService } from '@/modules/tags/services/tags.service';
import {
  COPY_SUFFIX,
  MAX_BASE_RESUMES_PER_USER,
  RESUME_NOT_FOUND_MESSAGE,
  RESUME_TITLE_MAX,
} from '../constants/resume.constants';
import { CreateResumeDto } from '../dto/create-resume.dto';
import { ListResumesQueryDto } from '../dto/list-resumes-query.dto';
import { UpdateResumeDto } from '../dto/update-resume.dto';
import { ResumesRepository } from '../repositories/resumes.repository';

@Injectable()
export class ResumesService {
  constructor(
    private readonly resumes: ResumesRepository,
    private readonly tags: TagsService,
  ) {}

  async create(userId: string, dto: CreateResumeDto) {
    await this.assertUnderLimit(userId);
    const tagIds = await this.tags.assertOwned(userId, dto.tagIds ?? []);
    return this.resumes.create(userId, { title: dto.title, content: instanceToPlain(dto.content), tagIds });
  }

  list(userId: string, query: ListResumesQueryDto) {
    return this.resumes.findAll(userId, { kind: query.kind, tagId: query.tagId });
  }

  async get(userId: string, id: string) {
    const resume = await this.resumes.findById(userId, id);
    if (!resume) throw new NotFoundException(RESUME_NOT_FOUND_MESSAGE);
    return resume;
  }

  async update(userId: string, id: string, dto: UpdateResumeDto) {
    let tagIds: string[] | undefined;
    if (dto.tagIds) {
      const current = await this.get(userId, id);
      if (current.kind !== ResumeKind.BASE) throw new BadRequestException('Só currículos base têm tags');
      tagIds = await this.tags.assertOwned(userId, dto.tagIds);
    }
    return this.resumes.update(userId, id, {
      title: dto.title,
      content: dto.content && instanceToPlain(dto.content),
      tagIds,
    });
  }

  async duplicate(userId: string, id: string) {
    const source = await this.get(userId, id);
    await this.assertUnderLimit(userId);
    const title = source.title.slice(0, RESUME_TITLE_MAX - COPY_SUFFIX.length) + COPY_SUFFIX;
    return this.resumes.create(userId, {
      title,
      content: source.content as Record<string, unknown>,
      tagIds: source.tags.map(({ tag }) => tag.id),
    });
  }

  async remove(userId: string, id: string) {
    await this.resumes.delete(userId, id);
  }

  private async assertUnderLimit(userId: string) {
    if ((await this.resumes.countBase(userId)) >= MAX_BASE_RESUMES_PER_USER) {
      throw new BadRequestException(`Limite de ${MAX_BASE_RESUMES_PER_USER} currículos base atingido`);
    }
  }
}
