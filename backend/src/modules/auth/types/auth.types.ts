export interface JwtPayload {
  sub: string;
  sid: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/** Metadados da requisição que o service grava na sessão e nos logs. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  requestId: string;
}

export interface CreateSessionData {
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}
