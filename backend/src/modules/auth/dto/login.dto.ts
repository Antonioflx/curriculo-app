import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '@/common/decorators/validation.decorators';

export class LoginDto {
  @Trim({ lowercase: true })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
