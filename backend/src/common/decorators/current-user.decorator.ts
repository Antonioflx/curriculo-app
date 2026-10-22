import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppRequest, AuthUser } from '../types/app-request';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  if (!request.user) {
    throw new Error('CurrentUser usado em rota sem autenticação');
  }
  return request.user;
});
