import { StrictPartialType } from '@/common/dto/strict-partial-type';
import { CreateResumeDto } from './create-resume.dto';

export class UpdateResumeDto extends StrictPartialType(CreateResumeDto) {}
