import { UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/auth.types';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const auth = { validateSession: jest.fn() };
  const config = { get: () => 'x'.repeat(32) } as unknown as AppConfigService;
  const strategy = new JwtStrategy(config, auth as unknown as AuthService);

  beforeEach(() => jest.resetAllMocks());

  it('entrega ao service o userId e o sessionId já validados', async () => {
    auth.validateSession.mockResolvedValue({ userId: 'u1', sessionId: 's1' });
    await expect(strategy.validate({ sub: 'u1', sid: 's1' })).resolves.toEqual({ userId: 'u1', sessionId: 's1' });
    expect(auth.validateSession).toHaveBeenCalledWith('u1', 's1');
  });

  it.each([{ sub: 1, sid: 's1' }, { sub: 'u1', sid: null }, { sub: '', sid: 's1' }, { sid: 's1' }, {}])(
    'rejeita payload malformado %p sem consultar o banco',
    async (payload) => {
      await expect(strategy.validate(payload as unknown as JwtPayload)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auth.validateSession).not.toHaveBeenCalled();
    },
  );
});
