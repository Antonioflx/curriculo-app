import 'reflect-metadata';
import { UserThrottlerGuard } from '@/common/guards/user-throttler.guard';
import { AI_RATE_LIMIT_PER_MINUTE } from '../constants/ai.constants';
import { AiRateLimit } from './ai-rate-limit.decorator';

class Routes {
  @AiRateLimit()
  limited() {}

  open() {}
}

describe('@AiRateLimit', () => {
  const limited = Routes.prototype.limited;

  it('liga o guard por usuário na rota', () => {
    expect(Reflect.getMetadata('__guards__', limited)).toContain(UserThrottlerGuard);
  });

  it('define o limite de chamadas por minuto', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', limited)).toBe(AI_RATE_LIMIT_PER_MINUTE);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', limited)).toBe(60_000);
  });

  it('rota sem o decorator não é afetada', () => {
    expect(Reflect.getMetadata('__guards__', Routes.prototype.open)).toBeUndefined();
  });
});
