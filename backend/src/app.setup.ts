import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Configuração HTTP compartilhada entre o bootstrap e os testes e2e. */
export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
}
