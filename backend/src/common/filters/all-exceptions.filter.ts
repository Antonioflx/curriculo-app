import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import { isString } from '../utils/type.utils';
import { AppRequest } from '../types/app-request';

const INTERNAL_MESSAGE = 'Erro interno do servidor';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<AppRequest>();

    const { statusCode, message } = this.normalize(exception);

    this.logEvent(exception, statusCode, request);

    response.status(statusCode).json({ statusCode, message, requestId: request.id });
  }

  private logEvent(exception: unknown, statusCode: number, request: AppRequest) {
    if (statusCode >= 500) {
      this.logger.error('unhandled_exception', {
        requestId: request.id,
        userId: request.user?.userId,
        error: exception instanceof Error ? exception.message : 'unknown',
      });
      return;
    }

    if (!this.isAccessDenied(statusCode, request)) return;

    this.logger.warn('access_denied', {
      statusCode,
      userId: request.user?.userId,
      requestId: request.id,
      method: request.method,
      path: request.path,
    });
  }

  /** A09: 403 e 404 de quem está logado (recurso alheio) ficam registrados, sem conteúdo. */
  private isAccessDenied(statusCode: number, request: AppRequest): boolean {
    if (statusCode === HttpStatus.FORBIDDEN) return true;
    return statusCode === HttpStatus.NOT_FOUND && !!request.user;
  }

  private normalize(exception: unknown): { statusCode: number; message: string | string[] } {
    if (!(exception instanceof HttpException)) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_MESSAGE };
    }
    const statusCode = exception.getStatus();
    if (statusCode >= 500) return { statusCode, message: INTERNAL_MESSAGE };

    const body = exception.getResponse();
    if (isString(body)) return { statusCode, message: body };
    const message = (body as { message?: string | string[] }).message;
    return { statusCode, message: message ?? exception.message };
  }
}
