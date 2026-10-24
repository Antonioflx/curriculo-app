import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UuidParam } from '@/common/decorators/uuid-param.decorator';
import { FileToBody, IMAGE_UPLOAD_OPTIONS } from '@/common/interceptors/file-to-body.interceptor';
import { AiRateLimit } from '@/modules/ai/decorators/ai-rate-limit.decorator';
import { CreateJobDto } from './dto/input/create-job.dto';
import { JobResponseDto, JobSummaryDto } from './dto/output/job-response.dto';
import { JobsService } from './services/jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** `multipart/form-data` (campos `text` e `image`) ou JSON só com `text`. */
  @AiRateLimit()
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_OPTIONS), FileToBody('image'))
  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateJobDto): Promise<JobResponseDto> {
    return JobResponseDto.from(await this.jobs.create(userId, dto));
  }

  @Get()
  async list(@CurrentUser('userId') userId: string): Promise<JobSummaryDto[]> {
    return (await this.jobs.list(userId)).map((job) => JobSummaryDto.from(job));
  }

  @Get(':id')
  async get(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<JobResponseDto> {
    return JobResponseDto.from(await this.jobs.get(userId, id));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<void> {
    await this.jobs.remove(userId, id);
  }
}
