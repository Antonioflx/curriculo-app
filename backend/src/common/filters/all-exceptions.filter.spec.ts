import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown, request: object = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ id: 'req-1', method: 'GET', path: '/api/resumes/x', ...request }),
    }),
  } as unknown as ArgumentsHost;
  const events = { error: jest.fn(), warn: jest.fn() };
  new AllExceptionsFilter(events as unknown as AppLogger).catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0], events };
}

describe('AllExceptionsFilter', () => {
  it('devolve o formato padrão para HttpException', () => {
    const { status, body } = run(new NotFoundException('Currículo não encontrado'));
    expect(status).toBe(404);
    expect(body).toEqual({ statusCode: 404, message: 'Currículo não encontrado', requestId: 'req-1' });
  });

  it('mantém a lista de mensagens de validação', () => {
    const { body } = run(new BadRequestException(['email inválido', 'senha curta']));
    expect(body.message).toEqual(['email inválido', 'senha curta']);
  });

  it('esconde o detalhe de erros inesperados, nunca devolve stack e registra o erro', () => {
    const { status, body, events } = run(new Error('connection refused postgres://user:pass@host'));
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, message: 'Erro interno do servidor', requestId: 'req-1' });
    expect(JSON.stringify(body)).not.toContain('postgres');
    expect(events.error).toHaveBeenCalledWith('unhandled_exception', {
      error: 'connection refused postgres://user:pass@host',
    });
  });

  it('esconde a mensagem de um 500 inesperado, mesmo vindo como HttpException', () => {
    const { body, events } = run(new InternalServerErrorException('detalhe interno'));
    expect(body.message).toBe('Erro interno do servidor');
    expect(events.error).toHaveBeenCalledWith('unhandled_exception', expect.any(Object));
  });

  describe('indisponibilidade de dependência (ex.: IA)', () => {
    it.each([
      [new BadGatewayException('Falha ao consultar a IA'), 502],
      [new ServiceUnavailableException('IA indisponível no momento'), 503],
      [new GatewayTimeoutException('Tempo esgotado'), 504],
    ])('%p chega ao cliente com a mensagem que escrevemos', (exception, status) => {
      const { body, events } = run(exception);
      expect(body).toEqual({ statusCode: status, message: exception.message, requestId: 'req-1' });
      // Quem lançou já registrou o motivo (ai_error...): não vira "erro inesperado" em duplicidade.
      expect(events.error).not.toHaveBeenCalled();
    });
  });

  describe('erros do parser de body (http-errors, não são HttpException)', () => {
    it('413 vira resposta 413 em português, sem log de erro inesperado', () => {
      const { status, body, events } = run(Object.assign(new Error('request entity too large'), { status: 413 }));
      expect(status).toBe(413);
      expect(body.message).toBe('Corpo da requisição muito grande');
      expect(events.error).not.toHaveBeenCalled();
    });

    it('outro 4xx usa a mensagem genérica e não vaza a do parser', () => {
      const { status, body } = run(Object.assign(new Error('detalhe interno do parser'), { status: 400 }));
      expect(status).toBe(400);
      expect(body.message).toBe('Requisição inválida');
    });

    it('status 5xx, inválido ou ausente continua sendo 500', () => {
      expect(run(Object.assign(new Error('x'), { status: 502 })).status).toBe(500);
      expect(run(Object.assign(new Error('x'), { status: 'oops' })).status).toBe(500);
      expect(run('texto solto').status).toBe(500);
    });
  });

  describe('log de acesso negado (A09)', () => {
    it('registra 404 de usuário logado, com a rota e sem conteúdo (userId e requestId vêm do contexto)', () => {
      const { events } = run(new NotFoundException(), { user: { userId: 'u1', sessionId: 's1' } });
      expect(events.warn).toHaveBeenCalledWith('access_denied', {
        statusCode: 404,
        method: 'GET',
        path: '/api/resumes/x',
      });
    });

    it('registra 403 mesmo sem login (ex.: bloqueio de Origin)', () => {
      const { events } = run(new ForbiddenException());
      expect(events.warn).toHaveBeenCalledWith('access_denied', expect.objectContaining({ statusCode: 403 }));
    });

    it('não registra 404 anônimo nem erros de validação', () => {
      expect(run(new NotFoundException()).events.warn).not.toHaveBeenCalled();
      expect(run(new BadRequestException()).events.warn).not.toHaveBeenCalled();
    });
  });
});
