import { IsResumeUpload } from '@/common/decorators/resume-upload.decorator';
import type { UploadedFile } from '@/common/types/uploaded-file';

/**
 * Entrada de `POST /resumes/import` (multipart, campo `file`): um currículo em PDF ou HTML de até 5 MB.
 * Toda regra mora aqui; o service recebe o arquivo já conferido (tipo, assinatura, tamanho e texto).
 */
export class ImportResumeDto {
  @IsResumeUpload()
  file!: UploadedFile;
}
