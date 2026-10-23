import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthUser } from '@/common/types/app-request';
import { isNonEmptyString } from '@/common/utils/type.utils';
import { AppConfigService } from '@/config/app-config.service';
import { invalidSession, SESSION_COOKIE } from '../constants/auth.constants';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: (req: Request) => (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? null,
      secretOrKey: config.get('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  /** Borda do sistema: o payload é validado aqui, e o service já recebe `userId` e `sessionId` como string. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!isNonEmptyString(payload.sub) || !isNonEmptyString(payload.sid)) throw invalidSession();
    return this.auth.validateSession(payload.sub, payload.sid);
  }
}
