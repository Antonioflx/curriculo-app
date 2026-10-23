import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import { AuthUser } from '@/common/types/app-request';
import { addSeconds, isPast } from '@/common/utils/date.utils';
import { UsersService } from '@/modules/users/services/users.service';
import { INVALID_CREDENTIALS_MESSAGE, invalidSession, REFRESH_TTL_SECONDS } from '../constants/auth.constants';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SessionsRepository } from '../repositories/sessions.repository';
import { CreateSessionData, RequestMeta, SessionTokens } from '../types/auth.types';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';

type SessionRecord = NonNullable<Awaited<ReturnType<SessionsRepository['findByRefreshHash']>>>;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly logger: AppLogger,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    if (this.passwords.isCommon(dto.password)) {
      throw new BadRequestException('Senha muito comum. Escolha outra.');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({ name: dto.name, email: dto.email, passwordHash });

    this.logger.info('register', { userId: user.id, requestId: meta.requestId });
    return { user, tokens: await this.startSession(user.id, randomUUID(), meta) };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.users.findByEmail(dto.email);
    const valid = await this.passwords.verify(user?.passwordHash ?? null, dto.password);

    if (!user || !valid) {
      this.logger.warn('login_failed', { userId: user?.id, ip: meta.ip, requestId: meta.requestId });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    this.logger.info('login', { userId: user.id, requestId: meta.requestId });
    return { user, tokens: await this.startSession(user.id, randomUUID(), meta) };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<SessionTokens> {
    const current = await this.sessions.findByRefreshHash(this.tokens.hashRefreshToken(refreshToken));
    if (!current) throw invalidSession();
    if (current.revokedAt) return this.rejectReuse(current, meta);
    if (isPast(current.expiresAt)) throw invalidSession();

    const next = this.buildSession(current.userId, current.familyId, meta);
    const rotated = await this.sessions.rotate(current.id, next.data);
    if (!rotated) return this.rejectReuse(current, meta);

    return { accessToken: await this.tokens.signAccess(current.userId, rotated.id), refreshToken: next.refreshToken };
  }

  async logout(auth: AuthUser, meta: RequestMeta) {
    await this.sessions.revokeFamilyOf(auth.sessionId, auth.userId);
    this.logger.info('logout', { userId: auth.userId, requestId: meta.requestId });
  }

  /** Chamado pela estratégia JWT a cada requisição: sessão revogada ou expirada fecha o acesso. */
  async validateSession(userId: string, sessionId: string): Promise<AuthUser> {
    const active = await this.sessions.findActive(sessionId, userId);
    if (!active) throw invalidSession();
    return { userId, sessionId };
  }

  private async startSession(userId: string, familyId: string, meta: RequestMeta): Promise<SessionTokens> {
    const { data, refreshToken } = this.buildSession(userId, familyId, meta);
    const session = await this.sessions.create(data);
    return { accessToken: await this.tokens.signAccess(userId, session.id), refreshToken };
  }

  private buildSession(userId: string, familyId: string, meta: RequestMeta) {
    const refreshToken = this.tokens.generateRefreshToken();
    const data: CreateSessionData = {
      userId,
      familyId,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt: addSeconds(new Date(), REFRESH_TTL_SECONDS),
      userAgent: meta.userAgent,
      ip: meta.ip,
    };
    return { data, refreshToken };
  }

  /** Refresh já usado: pode ser roubo. Revoga a família inteira. */
  private async rejectReuse(session: SessionRecord, meta: RequestMeta): Promise<never> {
    await this.sessions.revokeFamily(session.familyId);
    this.logger.warn('refresh_reuse_detected', {
      userId: session.userId,
      familyId: session.familyId,
      ip: meta.ip,
      requestId: meta.requestId,
    });
    throw invalidSession();
  }
}
