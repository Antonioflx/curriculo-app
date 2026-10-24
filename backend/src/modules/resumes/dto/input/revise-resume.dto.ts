import { IsNotEmpty } from 'class-validator';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import { Text, Trim } from '@/common/decorators/validation.decorators';

/** Entrada de `POST /resumes/:id/revise`: o pedido do usuário no chat ("tira o bullet de SVG"). */
export class ReviseResumeDto {
  @Trim()
  @IsNotEmpty()
  @Text(INPUT_LIMITS.instruction)
  instruction: string;
}
