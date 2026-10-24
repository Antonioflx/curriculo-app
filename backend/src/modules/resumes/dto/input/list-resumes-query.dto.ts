import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ResumeKind } from '@/common/enums';

export class ListResumesQueryDto {
  @IsOptional()
  @IsUUID('all')
  tagId?: string;

  @IsOptional()
  @IsEnum(ResumeKind)
  kind: ResumeKind = ResumeKind.BASE;
}
