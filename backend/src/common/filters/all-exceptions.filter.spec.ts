import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventLogger } from '../logging/event-logger';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
  const events = { error: jest.fn() } as unknown as EventLogger;
  new AllExceptionsFilter(events).catch(exception, host);
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

  it('esconde o detalhe de erros inesperados e nunca devolve stack', () => {
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
});
