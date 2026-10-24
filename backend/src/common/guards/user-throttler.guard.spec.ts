import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import type { Reflector } from '@nestjs/core';
import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  const guard = new UserThrottlerGuard({} as ThrottlerModuleOptions, {} as ThrottlerStorage, {} as Reflector);
  const trackerOf = (req: Record<string, unknown>) =>
    (guard as unknown as { getTracker: (r: Record<string, unknown>) => Promise<string> }).getTracker(req);

  it('usuário logado é contado pelo seu id, mesmo trocando de IP', async () => {
    const user = { userId: 'u1', sessionId: 's1' };
    expect(await trackerOf({ user, ip: '1.1.1.1' })).toBe('user:u1');
    expect(await trackerOf({ user, ip: '2.2.2.2' })).toBe('user:u1');
  });

  it('usuários diferentes atrás do mesmo IP têm contagens separadas', async () => {
    const a = await trackerOf({ user: { userId: 'u1' }, ip: '1.1.1.1' });
    const b = await trackerOf({ user: { userId: 'u2' }, ip: '1.1.1.1' });
    expect(a).not.toBe(b);
  });

  it('sem usuário (ou id inválido) cai no IP, para a rota nunca ficar sem limite', async () => {
    expect(await trackerOf({ ip: '3.3.3.3' })).toBe('ip:3.3.3.3');
    expect(await trackerOf({ user: { userId: 123 }, ip: '3.3.3.3' })).toBe('ip:3.3.3.3');
  });
});
