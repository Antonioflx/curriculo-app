import { IsNotEmpty } from 'class-validator';
import { Text, Trim } from '@/common/decorators/validation.decorators';
import { TAG_NAME_MAX } from '@/modules/tags/constants/tag.constants';

export class TagNameDto {
  @Trim({ lowercase: true })
  @IsNotEmpty()
  @Text(TAG_NAME_MAX)
  name: string;
}
