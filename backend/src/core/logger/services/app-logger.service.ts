import { Injectable, Logger } from '@nestjs/common';
import { requestContext } from '../../context/request-context';
import type { LogFields } from '../types/logger.types';
import { redact } from '../utils/redact';

/**
 * Log estruturado (JSON) da aplicação: `logger.info|warn|error('evento', { ...campos })`.
 * `requestId` e `userId` da requisição em andamento entram sozinhos (um campo explícito com o mesmo nome prevalece).
 * Passe só ids e metadados; chaves sensíveis são mascaradas por segurança, mas não conte com isso.
 */
@Injectable()
export class AppLogger {
  private readonly logger = new Logger('App');

  info(event: string, fields: LogFields = {}) {
    this.logger.log(this.serialize(event, fields));
  }

  warn(event: string, fields: LogFields = {}) {
    this.logger.warn(this.serialize(event, fields));
  }

  error(event: string, fields: LogFields = {}) {
    this.logger.error(this.serialize(event, fields));
  }

  private serialize(event: string, fields: LogFields): string {
    const { requestId, userId } = requestContext.get() ?? {};
    return JSON.stringify({ event, requestId, userId, ...(redact(fields) as LogFields) });
  }
}
