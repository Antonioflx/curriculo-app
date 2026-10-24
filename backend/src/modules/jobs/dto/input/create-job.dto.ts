import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import { IsImageUpload } from '@/common/decorators/image-upload.decorator';
import { Text, Trim } from '@/common/decorators/validation.decorators';
import type { UploadedImage } from '@/common/types/uploaded-image';

/**
 * Entrada de `POST /jobs`: o texto da vaga, a imagem dela, ou os dois (multipart ou JSON só com texto).
 * Toda regra de entrada mora aqui: o service e a IA recebem o dado já aparado, dentro dos limites e coerente.
 */
export class CreateJobDto {
  /** Obrigatório quando não há imagem. Com imagem, é opcional, mas se vier precisa respeitar o limite. */
  @Trim({ emptyAsUndefined: true })
  @ValidateIf((dto: CreateJobDto) => dto.image === undefined || dto.text !== undefined)
  @IsNotEmpty({ message: 'Envie o texto ou a imagem da vaga' })
  @Text(INPUT_LIMITS.jobText)
  text?: string;

  /** Preenchida pelo `FileToBody('image')` a partir do upload; JPEG, PNG ou WEBP de até 5 MB. */
  @IsOptional()
  @IsImageUpload()
  image?: UploadedImage;
}
