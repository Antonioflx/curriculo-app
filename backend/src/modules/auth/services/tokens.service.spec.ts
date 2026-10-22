import { JwtService } from '@nestjs/jwt';
import { TokensService } from './tokens.service';

describe('TokensService', () => {
  const service = new TokensService({} as JwtService);

  it('gera refresh tokens aleatórios e distintos', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
  });

  it('o hash é determinístico (SHA-256 hex) e não revela o token', () => {
    const hash = service.hashRefreshToken('abc');
    expect(hash).toBe(service.hashRefreshToken('abc'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('abc');
  });
});
