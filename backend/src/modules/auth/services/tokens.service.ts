import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class TokensService {
  constructor(private readonly jwt: JwtService) {}

  signAccess(userId: string, sessionId: string): Promise<string> {
    const payload: JwtPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload);
  }

  /** Valor opaco de 32 bytes; só o hash vai para o banco. */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
