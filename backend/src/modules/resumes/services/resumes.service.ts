import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { ResumeKind } from '@/common/enums';
import { htmlToText } from '@/common/utils/html-text.utils';
import { assertBelowLimit } from '@/common/utils/limit.utils';
import { detectResumeFileKind } from '@/common/utils/resume-file.utils';
import { AiService } from '@/modules/ai/services/ai.service';
import { type ResumeContent, resumeContentSchema } from '@/modules/ai/schemas/resume-content.schema';
import { TagsService } from '@/modules/tags/services/tags.service';
import {
  COPY_SUFFIX,
  INVALID_CONTENT_MESSAGE,
  MAX_BASE_RESUMES_PER_USER,
  ONLY_BASE_HAS_TAGS_MESSAGE,
  RESUME_NOT_FOUND_MESSAGE,
  RESUME_TITLE_MAX,
} from '../constants/resume.constants';
import { CreateResumeDto } from '../dto/input/create-resume.dto';
import { ImportResumeDto } from '../dto/input/import-resume.dto';
import { ListResumesQueryDto } from '../dto/input/list-resumes-query.dto';
import { ReviseResumeDto } from '../dto/input/revise-resume.dto';
import { UpdateResumeDto } from '../dto/input/update-resume.dto';
import { ResumesRepository } from '../repositories/resumes.repository';

@Injectable()
export class ResumesService {
  constructor(
    private readonly resumes: ResumesRepository,
    private readonly tags: TagsService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, dto: CreateResumeDto) {
    await this.assertUnderLimit(userId);
    const tagIds = await this.tags.assertOwned(userId, dto.tagIds ?? []);
    return this.resumes.create(userId, { title: dto.title, content: instanceToPlain(dto.content), tagIds });
  }

  /** Lê o PDF ou HTML com a IA e devolve o `content` como rascunho; nada é salvo até o usuário criar o currículo. */
  async importFile(dto: ImportResumeDto) {
    const { mimeType, data } = dto.file;
    const input =
      detectResumeFileKind(data) === 'pdf'
        ? { document: { mimeType, data } }
        : { text: htmlToText(data.toString('utf8')) };
    const { data: content } = await this.ai.extractResume(input);
    return content;
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
    return this.resumes.update(userId, id, {
      title: dto.title,
      content: dto.content && instanceToPlain(dto.content),
      tagIds: await this.resolveTagIds(userId, id, dto.tagIds),
    });
  }

  /** Pedido do usuário no chat: a IA devolve o content inteiro revisado, que substitui o atual. */
  async revise(userId: string, id: string, dto: ReviseResumeDto) {
    const current = await this.get(userId, id);
    const { data } = await this.ai.reviseResume({
      content: this.parseContent(current.content),
      instruction: dto.instruction,
    });
    return this.resumes.update(userId, id, { content: data });
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

  /** O content vem do banco como JSON solto: confere o formato antes de mandar para a IA. */
  private parseContent(content: unknown): ResumeContent {
    const parsed = resumeContentSchema.safeParse(content);
    if (!parsed.success) throw new UnprocessableEntityException(INVALID_CONTENT_MESSAGE);
    return parsed.data;
  }

  private async assertUnderLimit(userId: string) {
    assertBelowLimit(await this.resumes.countBase(userId), MAX_BASE_RESUMES_PER_USER, 'currículos base');
  }

  /** `undefined` = não mexer nas tags. Tags só existem em currículo base e precisam ser do usuário. */
  private async resolveTagIds(userId: string, id: string, tagIds?: string[]) {
    if (!tagIds) return undefined;
    const current = await this.get(userId, id);
    if (current.kind !== ResumeKind.BASE) throw new BadRequestException(ONLY_BASE_HAS_TAGS_MESSAGE);
    return this.tags.assertOwned(userId, tagIds);
  }
}
