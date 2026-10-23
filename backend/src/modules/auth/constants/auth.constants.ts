import { UnauthorizedException } from '@nestjs/common';

export const SESSION_COOKIE = 'session_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export const REFRESH_COOKIE_PATH = '/api/auth/refresh';

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos';
export const INVALID_SESSION_MESSAGE = 'Sessão inválida';

export const invalidSession = () => new UnauthorizedException(INVALID_SESSION_MESSAGE);
