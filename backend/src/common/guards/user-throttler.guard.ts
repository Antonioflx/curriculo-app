import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isString } from '../utils/type.utils';

/**
 * Limite por usuário logado (além do limite por IP do ThrottlerGuard global).
 * Roda depois do JwtAuthGuard global, então `req.user` já existe; sem usuário cai no IP.
 * Use com `@Throttle(...)`, ou pelo `@AiRateLimit()` nas rotas que chamam a IA.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { userId?: unknown } | undefined;
    return Promise.resolve(isString(user?.userId) ? `user:${user.userId}` : `ip:${String(req.ip)}`);
  }
}
