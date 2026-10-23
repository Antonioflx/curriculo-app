import type { Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';

describe('AuthCookiesService', () => {
  const service = new AuthCookiesService();
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  const asResponse = () => res as unknown as Response;

  beforeEach(() => jest.resetAllMocks());

  it('seta session_token e refresh_token com os atributos da doc de segurança', () => {
    service.set(asResponse(), { accessToken: 'a', refreshToken: 'r' });

    expect(res.cookie).toHaveBeenCalledWith('session_token', 'a', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900_000,
    });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'r', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 604_800_000,
    });
  });

  it('limpa os dois cookies com o mesmo path com que foram criados', () => {
    service.clear(asResponse());

    expect(res.clearCookie).toHaveBeenCalledWith('session_token', expect.objectContaining({ path: '/' }));
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/api/auth/refresh' }),
    );
  });
});
