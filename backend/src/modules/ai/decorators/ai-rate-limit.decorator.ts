import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserThrottlerGuard } from '@/common/guards/user-throttler.guard';
import { AI_RATE_LIMIT_PER_MINUTE } from '../constants/ai.constants';

/**
 * Limite de chamadas por minuto nas rotas que gastam IA (custo). Por usuário logado, e também por IP
 * (o `@Throttle` ajusta o limite do ThrottlerGuard global para esta rota).
 *
 * @example
 * @AiRateLimit()
 * @Post()
 * create(...) { ... }
 */
export const AiRateLimit = () =>
  applyDecorators(
    UseGuards(UserThrottlerGuard),
    Throttle({ default: { limit: AI_RATE_LIMIT_PER_MINUTE, ttl: 60_000 } }),
  );
