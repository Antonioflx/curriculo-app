import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppRequest, AuthUser } from '../types/app-request';

/** `@CurrentUser()` devolve o usuário logado; `@CurrentUser('userId')` devolve só o campo. */
export const CurrentUser = createParamDecorator((key: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  if (!request.user) {
    throw new Error('CurrentUser usado em rota sem autenticação');
  }
  return key ? request.user[key] : request.user;
});
