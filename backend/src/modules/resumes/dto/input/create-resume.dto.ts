import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Nested, Text, Trim } from '@/common/decorators/validation.decorators';
import { MAX_TAGS_PER_RESUME, RESUME_TITLE_MAX } from '../constants/resume.constants';
import { ResumeContentDto } from './resume-content.dto';

export class CreateResumeDto {
  @Trim()
  @IsNotEmpty()
  @Text(RESUME_TITLE_MAX)
  title: string;

  @Nested(ResumeContentDto)
  content: ResumeContentDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_RESUME)
  @IsUUID('all', { each: true })
  tagIds?: string[];
}
