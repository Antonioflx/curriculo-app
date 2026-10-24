import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import { AppRequest } from '../types/app-request';
import { isString } from '../utils/type.utils';

const INTERNAL_MESSAGE = 'Erro interno do servidor';
/** Indisponibilidade de dependência (ex.: IA). A mensagem é escrita por nós, é segura e ajuda o usuário. */
const EXPOSED_SERVER_ERRORS: ReadonlySet<number> = new Set([
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
  HttpStatus.GATEWAY_TIMEOUT,
]);
const DEFAULT_CLIENT_ERROR_MESSAGE = 'Requisição inválida';
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Corpo da requisição muito grande',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de conteúdo não suportado',
};

interface NormalizedError {
  statusCode: number;
  message: string | string[];
}

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
    if (this.isMasked(statusCode)) {
      this.logger.error('unhandled_exception', {
        error: exception instanceof Error ? exception.message : 'unknown',
      });
      return;
    }

    if (!this.isAccessDenied(statusCode, request)) return;

    this.logger.warn('access_denied', {
      statusCode,
      method: request.method,
      path: request.path,
    });
  }

  /** A09: 403 e 404 de quem está logado (recurso alheio) ficam registrados, sem conteúdo. */
  private isAccessDenied(statusCode: number, request: AppRequest): boolean {
    if (statusCode === HttpStatus.FORBIDDEN) return true;
    return statusCode === HttpStatus.NOT_FOUND && !!request.user;
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) return this.fromHttpException(exception);

    const statusCode = this.clientErrorStatus(exception);
    if (!statusCode) return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_MESSAGE };
    return { statusCode, message: CLIENT_ERROR_MESSAGES[statusCode] ?? DEFAULT_CLIENT_ERROR_MESSAGE };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const statusCode = exception.getStatus();
    if (this.isMasked(statusCode)) return { statusCode, message: INTERNAL_MESSAGE };

    const body = exception.getResponse();
    if (isString(body)) return { statusCode, message: body };
    const message = (body as { message?: string | string[] }).message;
    return { statusCode, message: message ?? exception.message };
  }

  /** 5xx inesperado: a mensagem não sai do servidor (só vai para o log). */ private isMasked(
    statusCode: number,
  ): boolean {
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && !EXPOSED_SERVER_ERRORS.has(statusCode);
  }
  /** O parser de body (http-errors) lança erros 4xx com `status` que não são `HttpException` do Nest. */
  private clientErrorStatus(exception: unknown): number | null {
    if (typeof exception !== 'object' || exception === null) return null;
    const status = (exception as { status?: unknown }).status;
    if (!Number.isInteger(status)) return null;
    const code = status as number;
    return code >= 400 && code < 500 ? code : null;
  }
}
