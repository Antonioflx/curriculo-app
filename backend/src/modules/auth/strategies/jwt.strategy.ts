import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AppConfigService } from '@/config/app-config.service';
import { AuthUser } from '@/common/types/app-request';
import { AuthService } from '../services/auth.service';
import { SESSION_COOKIE } from '../constants/auth.constants';
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

  validate(payload: JwtPayload): Promise<AuthUser> {
    return this.auth.validateSession(payload);
  }
}
