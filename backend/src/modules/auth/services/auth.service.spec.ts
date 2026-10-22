import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventLogger } from '@/common/logging/event-logger';
import { UsersService } from '@/modules/users/services/users.service';
import { INVALID_CREDENTIALS_MESSAGE } from '../constants/auth.constants';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionsRepository } from '../repositories/sessions.repository';
import { TokensService } from './tokens.service';

const meta = { ip: '1.1.1.1', userAgent: 'jest', requestId: 'req-1' };
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

describe('AuthService', () => {
  const users = { create: jest.fn(), findByEmail: jest.fn() };
  const sessions = {
    create: jest.fn(),
    findByRefreshHash: jest.fn(),
    findActive: jest.fn(),
    rotate: jest.fn(),
    revokeFamily: jest.fn(),
    revokeFamilyOf: jest.fn(),
  };
  const passwords = { hash: jest.fn(), verify: jest.fn(), isCommon: jest.fn() };
  const tokens = { signAccess: jest.fn(), generateRefreshToken: jest.fn(), hashRefreshToken: jest.fn() };
  const events = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = new AuthService(
    users as unknown as UsersService,
    sessions as unknown as SessionsRepository,
    passwords as unknown as PasswordService,
    tokens as unknown as TokensService,
    events as unknown as EventLogger,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tokens.generateRefreshToken.mockReturnValue('novo-refresh');
    tokens.hashRefreshToken.mockImplementation((t: string) => `hash(${t})`);
    tokens.signAccess.mockResolvedValue('access');
  });

  describe('register', () => {
    it('recusa senha comum', async () => {
      passwords.isCommon.mockReturnValue(true);
      await expect(
        service.register({ name: 'Ana', email: 'a@a.com', password: 'password123' }, meta),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('cria o usuário com o hash e abre a sessão', async () => {
      passwords.isCommon.mockReturnValue(false);
      passwords.hash.mockResolvedValue('argon-hash');
      users.create.mockResolvedValue({ id: 'u1' });
      sessions.create.mockResolvedValue({ id: 's1' });

      const result = await service.register({ name: 'Ana', email: 'a@a.com', password: 'Segredo!2026' }, meta);

      expect(users.create).toHaveBeenCalledWith({ name: 'Ana', email: 'a@a.com', passwordHash: 'argon-hash' });
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', refreshTokenHash: 'hash(novo-refresh)' }),
      );
      expect(result.tokens).toEqual({ accessToken: 'access', refreshToken: 'novo-refresh' });
    });
  });

  describe('login', () => {
    it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
      users.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = await service.login({ email: 'x@x.com', password: 'qualquer123' }, meta).catch((e) => e);

      users.findByEmail.mockResolvedValueOnce({ id: 'u1', passwordHash: 'h' });
      passwords.verify.mockResolvedValue(false);
      const wrongPassword = await service.login({ email: 'a@a.com', password: 'errada1234' }, meta).catch((e) => e);

      for (const error of [unknownEmail, wrongPassword]) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      }
      expect(events.warn).toHaveBeenCalledTimes(2);
    });

    it('verifica a senha mesmo sem usuário, para igualar o tempo', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.verify.mockResolvedValue(false);
      await service.login({ email: 'x@x.com', password: 'qualquer123' }, meta).catch(() => undefined);
      expect(passwords.verify).toHaveBeenCalledWith(null, 'qualquer123');
    });

    it('abre a sessão com credenciais válidas', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'h' });
      passwords.verify.mockResolvedValue(true);
      sessions.create.mockResolvedValue({ id: 's1' });

      const result = await service.login({ email: 'a@a.com', password: 'Segredo!2026' }, meta);

      expect(result.tokens.accessToken).toBe('access');
      expect(events.info).toHaveBeenCalledWith('login', expect.objectContaining({ userId: 'u1' }));
    });
  });

  describe('refresh', () => {
    const current = { id: 's1', userId: 'u1', familyId: 'f1', revokedAt: null, expiresAt: future() };

    it('rejeita refresh desconhecido', async () => {
      sessions.findByRefreshHash.mockResolvedValue(null);
      await expect(service.refresh('x', meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revokeFamily).not.toHaveBeenCalled();
    });

    it('rejeita refresh expirado', async () => {
      sessions.findByRefreshHash.mockResolvedValue({ ...current, expiresAt: past() });
      await expect(service.refresh('x', meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.rotate).not.toHaveBeenCalled();
    });

    it('revoga a família inteira quando um refresh já revogado é reusado', async () => {
      sessions.findByRefreshHash.mockResolvedValue({ ...current, revokedAt: past() });
      await expect(service.refresh('x', meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revokeFamily).toHaveBeenCalledWith('f1');
      expect(events.warn).toHaveBeenCalledWith('refresh_reuse_detected', expect.objectContaining({ familyId: 'f1' }));
    });

    it('trata a corrida (rotação perdida) como reuso', async () => {
      sessions.findByRefreshHash.mockResolvedValue(current);
      sessions.rotate.mockResolvedValue(null);
      await expect(service.refresh('x', meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revokeFamily).toHaveBeenCalledWith('f1');
    });

    it('rotaciona mantendo a família e devolve novos tokens', async () => {
      sessions.findByRefreshHash.mockResolvedValue(current);
      sessions.rotate.mockResolvedValue({ id: 's2' });

      const result = await service.refresh('velho', meta);

      expect(sessions.rotate).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ userId: 'u1', familyId: 'f1', refreshTokenHash: 'hash(novo-refresh)' }),
      );
      expect(tokens.signAccess).toHaveBeenCalledWith('u1', 's2');
      expect(result).toEqual({ accessToken: 'access', refreshToken: 'novo-refresh' });
    });
  });

  describe('validateSession', () => {
    it('aceita sessão ativa', async () => {
      sessions.findActive.mockResolvedValue({ id: 's1' });
      await expect(service.validateSession({ sub: 'u1', sid: 's1' })).resolves.toEqual({
        userId: 'u1',
        sessionId: 's1',
      });
    });

    it('fecha o acesso quando a sessão foi revogada ou expirou', async () => {
      sessions.findActive.mockResolvedValue(null);
      await expect(service.validateSession({ sub: 'u1', sid: 's1' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita payload malformado sem consultar o banco', async () => {
      await expect(
        service.validateSession({ sub: 1, sid: null } as unknown as { sub: string; sid: string }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.findActive).not.toHaveBeenCalled();
    });
  });

  it('logout revoga a família da sessão do usuário', async () => {
    await service.logout({ userId: 'u1', sessionId: 's1' }, meta);
    expect(sessions.revokeFamilyOf).toHaveBeenCalledWith('s1', 'u1');
  });
});
