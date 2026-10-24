import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { INPUT_LIMITS } from '../constants/input-limits';
import { FileToBody, IMAGE_UPLOAD_OPTIONS } from './file-to-body.interceptor';

describe('FileToBody', () => {
  const next = { handle: jest.fn().mockReturnValue('proximo') } as unknown as CallHandler;
  const run = (request: Record<string, unknown>) => {
    const Interceptor = FileToBody('image');
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    return new Interceptor().intercept(context, next);
  };

  beforeEach(() => jest.clearAllMocks());

  it('põe o arquivo recebido no campo do body, como imagem (tipo + conteúdo), sem perder os outros campos', () => {
    const buffer = Buffer.from([1, 2, 3]);
    const request = { body: { text: 'Vaga' }, file: { mimetype: 'image/png', buffer } };

    const result = run(request);

    expect(request.body).toEqual({ text: 'Vaga', image: { mimeType: 'image/png', data: buffer } });
    expect(result).toBe('proximo');
  });

  it('sem arquivo não mexe no body e segue em frente', () => {
    const request = { body: { text: 'Vaga' } };
    run(request);
    expect(request.body).toEqual({ text: 'Vaga' });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('o upload é limitado a 1 arquivo em memória, com teto de tamanho e de campos', () => {
    expect(IMAGE_UPLOAD_OPTIONS.limits).toMatchObject({ fileSize: INPUT_LIMITS.imageBytes, files: 1 });
    expect(IMAGE_UPLOAD_OPTIONS.limits.fields).toBeLessThanOrEqual(10);
  });
});
