import { Injectable, NotFoundException } from '@nestjs/common';
import { assertBelowLimit } from '@/common/utils/limit.utils';
import { AiService } from '@/modules/ai/services/ai.service';
import { JOB_NOT_FOUND_MESSAGE, MAX_JOBS_PER_USER } from '../constants/job.constants';
import { CreateJobDto } from '../dto/input/create-job.dto';
import { JobsRepository } from '../repositories/jobs.repository';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobs: JobsRepository,
    private readonly ai: AiService,
  ) {}

  /** O DTO já garantiu texto aparado e dentro do limite, ou imagem válida (ou os dois). */
  async create(userId: string, dto: CreateJobDto) {
    // Antes de gastar IA.
    assertBelowLimit(await this.jobs.count(userId), MAX_JOBS_PER_USER, 'vagas');

    const { data } = await this.ai.extractJob({ text: dto.text, image: dto.image });
    return this.jobs.create(userId, {
      rawText: dto.text,
      title: data.title,
      company: data.company,
      contactEmail: data.contactEmail,
      extracted: data,
    });
  }

  list(userId: string) {
    return this.jobs.findAll(userId);
  }

  async get(userId: string, id: string) {
    const job = await this.jobs.findById(userId, id);
    if (!job) throw new NotFoundException(JOB_NOT_FOUND_MESSAGE);
    return job;
  }

  async remove(userId: string, id: string) {
    await this.jobs.delete(userId, id);
  }
}
