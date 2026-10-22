import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { AppRequest } from '../types/app-request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Defesa CSRF: métodos que alteram estado só passam com Origin igual à origem do web. */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: AppConfigService) {
    this.allowedOrigin = new URL(config.get('WEB_ORIGIN')).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (request.headers.origin !== this.allowedOrigin) {
      throw new ForbiddenException('Origem não permitida');
    }
    return true;
  }
}
