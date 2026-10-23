import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { EventLogger } from '../logging/event-logger';
import { AppRequest } from '../types/app-request';

const INTERNAL_MESSAGE = 'Erro interno do servidor';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly events: EventLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<AppRequest>();

    const { statusCode, message } = this.normalize(exception);

    if (statusCode >= 500) {
      this.events.error('unhandled_exception', {
        requestId: request.id,
        userId: request.user?.userId,
        error: exception instanceof Error ? exception.message : 'unknown',
      });
    } else if (statusCode === HttpStatus.FORBIDDEN || (statusCode === HttpStatus.NOT_FOUND && request.user)) {
      // A09: 403 e 404 de quem está logado (recurso alheio) ficam registrados, sem conteúdo.
      this.events.warn('access_denied', {
        statusCode,
        userId: request.user?.userId,
        requestId: request.id,
        method: request.method,
        path: request.path,
      });
    }

    response.status(statusCode).json({ statusCode, message, requestId: request.id });
  }

  private normalize(exception: unknown): { statusCode: number; message: string | string[] } {
    if (!(exception instanceof HttpException)) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_MESSAGE };
    }
    const statusCode = exception.getStatus();
    if (statusCode >= 500) return { statusCode, message: INTERNAL_MESSAGE };

    const body = exception.getResponse();
    if (typeof body === 'string') return { statusCode, message: body };
    const message = (body as { message?: string | string[] }).message;
    return { statusCode, message: message ?? exception.message };
  }
}
