import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, type Type } from '@nestjs/common';
import { INPUT_LIMITS } from '../constants/input-limits';
import type { AppRequest } from '../types/app-request';

type RequestWithFile = AppRequest & { file?: { mimetype: string; buffer: Buffer } };

/** Opções do `FileInterceptor` para uma imagem só, em memória, com o teto de tamanho e de campos. */
export const IMAGE_UPLOAD_OPTIONS = {
  limits: { fileSize: INPUT_LIMITS.imageBytes, files: 1, fields: 4, fieldSize: INPUT_LIMITS.jobText * 4 },
};

/** Opções do `FileInterceptor` para um currículo (PDF ou HTML) só, em memória, com o teto de tamanho. */
export const RESUME_UPLOAD_OPTIONS = {
  limits: { fileSize: INPUT_LIMITS.resumeFileBytes, files: 1, fields: 2 },
};

/**
 * Passa o arquivo recebido pelo `FileInterceptor` para dentro do body, no campo informado, como
 * `{ mimeType, data }`. Assim o arquivo é validado pelo DTO como qualquer outro campo (`@IsImageUpload()`,
 * `@IsResumeUpload()`), junto das regras entre campos. Use logo depois do `FileInterceptor`.
 */
export function FileToBody(field: string): Type<NestInterceptor> {
  @Injectable()
  class FileToBodyInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler) {
      const request = context.switchToHttp().getRequest<RequestWithFile>();
      if (request.file) {
        request.body = { ...request.body, [field]: { mimeType: request.file.mimetype, data: request.file.buffer } };
      }
      return next.handle();
    }
  }
  return FileToBodyInterceptor;
}
