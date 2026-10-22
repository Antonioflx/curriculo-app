import { Injectable } from '@nestjs/common';
import { CookieOptions, Response } from 'express';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_SECONDS,
  SESSION_COOKIE,
} from '../constants/auth.constants';
import { SessionTokens } from '../types/auth.types';

const SESSION_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

const REFRESH_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
};

/** Os cookies de sessão são setados só pelo backend. */
@Injectable()
export class AuthCookiesService {
  set(res: Response, tokens: SessionTokens) {
    res.cookie(SESSION_COOKIE, tokens.accessToken, { ...SESSION_OPTIONS, maxAge: ACCESS_TTL_SECONDS * 1000 });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...REFRESH_OPTIONS, maxAge: REFRESH_TTL_SECONDS * 1000 });
  }

  clear(res: Response) {
    res.clearCookie(SESSION_COOKIE, SESSION_OPTIONS);
    res.clearCookie(REFRESH_COOKIE, REFRESH_OPTIONS);
  }
}
