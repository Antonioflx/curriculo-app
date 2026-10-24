import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UuidParam } from '@/common/decorators/uuid-param.decorator';
import { AiRateLimit } from '@/modules/ai/decorators/ai-rate-limit.decorator';
import { CreateResumeDto } from './dto/input/create-resume.dto';
import { ListResumesQueryDto } from './dto/input/list-resumes-query.dto';
import { ReviseResumeDto } from './dto/input/revise-resume.dto';
import { ResumeResponseDto, ResumeSummaryDto } from './dto/output/resume-response.dto';
import { UpdateResumeDto } from './dto/input/update-resume.dto';
import { ResumesService } from './services/resumes.service';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateResumeDto): Promise<ResumeResponseDto> {
    return ResumeResponseDto.from(await this.resumes.create(userId, dto));
  }

  @Get()
  async list(@CurrentUser('userId') userId: string, @Query() query: ListResumesQueryDto): Promise<ResumeSummaryDto[]> {
    return (await this.resumes.list(userId, query)).map((resume) => ResumeSummaryDto.from(resume));
  }

  @Get(':id')
  async get(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<ResumeResponseDto> {
    return ResumeResponseDto.from(await this.resumes.get(userId, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @UuidParam() id: string,
    @Body() dto: UpdateResumeDto,
  ): Promise<ResumeResponseDto> {
    return ResumeResponseDto.from(await this.resumes.update(userId, id, dto));
  }

  /** Revisão pelo chat. Gasta IA, então tem limite por usuário. */ @AiRateLimit() @Post(':id/revise') async revise(
    @CurrentUser('userId') userId: string,
    @UuidParam() id: string,
    @Body() dto: ReviseResumeDto,
  ): Promise<ResumeResponseDto> {
    return ResumeResponseDto.from(await this.resumes.revise(userId, id, dto));
  }
  @Post(':id/duplicate')
  async duplicate(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<ResumeResponseDto> {
    return ResumeResponseDto.from(await this.resumes.duplicate(userId, id));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<void> {
    await this.resumes.remove(userId, id);
  }
}
