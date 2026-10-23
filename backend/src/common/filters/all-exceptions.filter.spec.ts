import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventLogger } from '../logging/event-logger';
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
  new AllExceptionsFilter(events as unknown as EventLogger).catch(exception, host);
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
    expect(events.error).toHaveBeenCalledWith('unhandled_exception', expect.objectContaining({ requestId: 'req-1' }));
  });

  it('esconde a mensagem de HttpException 5xx', () => {
    const { body } = run(new InternalServerErrorException('detalhe interno'));
    expect(body.message).toBe('Erro interno do servidor');
  });

  describe('log de acesso negado (A09)', () => {
    it('registra 404 de usuário logado, com userId, rota e sem conteúdo', () => {
      const { events } = run(new NotFoundException(), { user: { userId: 'u1', sessionId: 's1' } });
      expect(events.warn).toHaveBeenCalledWith('access_denied', {
        statusCode: 404,
        userId: 'u1',
        requestId: 'req-1',
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
