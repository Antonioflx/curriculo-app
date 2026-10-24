import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { requestContextMiddleware } from './core/context/request-context.middleware';

/**
 * Teto do corpo JSON. Maior que o `content` de um currículo no limite dos DTOs (~160 KB);
 * o padrão do Express (100 KB) recusaria um currículo válido.
 */
export const JSON_BODY_LIMIT = '256kb';

/** Configuração HTTP compartilhada entre o bootstrap e os testes e2e. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  // Primeiro de todos: até um erro do parser de body já sai com requestId e entra no log com ele.
  app.use(requestContextMiddleware);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
}
