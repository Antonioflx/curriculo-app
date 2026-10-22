import { Injectable, Logger } from '@nestjs/common';

export type EventFields = Record<string, unknown>;

/**
 * Log estruturado (JSON) de eventos de segurança e de erro.
 * Passe só ids e metadados: nunca senha, token nem conteúdo de currículo ou vaga.
 */
@Injectable()
export class EventLogger {
  private readonly logger = new Logger('Event');

  info(event: string, fields: EventFields = {}) {
    this.logger.log(JSON.stringify({ event, ...fields }));
  }

  warn(event: string, fields: EventFields = {}) {
    this.logger.warn(JSON.stringify({ event, ...fields }));
  }

  error(event: string, fields: EventFields = {}) {
    this.logger.error(JSON.stringify({ event, ...fields }));
  }
}
