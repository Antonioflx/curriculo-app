import { Logger } from '@nestjs/common';
import { requestContext } from '../../context/request-context';
import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  const logger = new AppLogger();
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  beforeEach(() => jest.clearAllMocks());
  afterAll(() => jest.restoreAllMocks());

  const lastJson = (spy: jest.SpyInstance) => JSON.parse(spy.mock.calls[0][0] as string);

  it('info, warn e error escrevem JSON com o evento e os campos, cada um no seu nível', () => {
    logger.info('login', { userId: 'u1' });
    logger.warn('login_failed', { ip: '1.1.1.1' });
    logger.error('boom');

    expect(lastJson(log)).toEqual({ event: 'login', userId: 'u1' });
    expect(lastJson(warn)).toEqual({ event: 'login_failed', ip: '1.1.1.1' });
    expect(lastJson(error)).toEqual({ event: 'boom' });
  });

  it('mascara chaves sensíveis em qualquer nível, sem diferenciar maiúsculas', () => {
    logger.info('evento', {
      userId: 'u1',
      Password: 'segredo',
      nested: { refreshToken: 'abc', list: [{ content: 'currículo inteiro', id: 1 }] },
    });

    expect(lastJson(log)).toEqual({
      event: 'evento',
      userId: 'u1',
      Password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', list: [{ content: '[REDACTED]', id: 1 }] },
    });
  });

  describe('contexto da requisição', () => {
    it('anexa requestId e userId sozinho, sem quem loga repassar', () => {
      requestContext.run({ requestId: 'req-1', userId: 'u1' }, () => logger.info('algo', { extra: 1 }));
      expect(lastJson(log)).toEqual({ event: 'algo', requestId: 'req-1', userId: 'u1', extra: 1 });
    });

    it('sem usuário identificado mantém só o requestId', () => {
      requestContext.run({ requestId: 'req-1' }, () => logger.warn('algo'));
      expect(lastJson(warn)).toEqual({ event: 'algo', requestId: 'req-1' });
    });

    it('um campo explícito prevalece (ex.: userId da conta alvo de um login falho)', () => {
      requestContext.run({ requestId: 'req-1', userId: 'u1' }, () => logger.info('algo', { userId: 'outro' }));
      expect(lastJson(log).userId).toBe('outro');
    });

    it('fora de uma requisição não inventa ids', () => {
      logger.error('algo');
      expect(lastJson(error)).toEqual({ event: 'algo' });
    });
  });

  it('não deixa o campo `event` ser sobrescrito pelos campos', () => {
    logger.info('real', { userId: 'u1' });
    expect(lastJson(log).event).toBe('real');
  });

  it('corta estruturas muito profundas', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'x' } } } } } };
    logger.info('evento', deep);
    expect(JSON.stringify(lastJson(log))).toContain('[TRUNCATED]');
  });
});
