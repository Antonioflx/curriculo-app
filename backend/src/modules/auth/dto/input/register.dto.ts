import { IsNotEmpty } from 'class-validator';
import { Text, Trim } from '@/common/decorators/validation.decorators';
import { LoginDto } from './login.dto';

export class RegisterDto extends LoginDto {
  @Trim()
  @IsNotEmpty()
  @Text(100)
  name: string;
}
