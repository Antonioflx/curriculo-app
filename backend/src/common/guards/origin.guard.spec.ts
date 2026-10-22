import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { OriginGuard } from './origin.guard';

const config = { get: () => 'http://localhost:3000' } as unknown as AppConfigService;

function contextFor(method: string, origin?: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers: { origin } }) }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  const guard = new OriginGuard(config);

  it('libera métodos seguros sem Origin', () => {
    expect(guard.canActivate(contextFor('GET'))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('libera %s com a Origin do web', (method) => {
    expect(guard.canActivate(contextFor(method, 'http://localhost:3000'))).toBe(true);
  });

  it.each([undefined, 'http://evil.com', 'http://localhost:3000.evil.com'])(
    'bloqueia POST com Origin %s',
    (origin) => {
      expect(() => guard.canActivate(contextFor('POST', origin))).toThrow(ForbiddenException);
    },
  );
});
