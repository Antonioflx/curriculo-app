import { IsEmail, MaxLength, MinLength } from 'class-validator';
import { Text, Trim } from '@/common/decorators/validation.decorators';

export class LoginDto {
  @Trim({ lowercase: true })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Text(128)
  @MinLength(8)
  password: string;
}
