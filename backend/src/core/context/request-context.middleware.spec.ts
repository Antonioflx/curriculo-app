import type { Response } from 'express';
import type { AppRequest } from '@/common/types/app-request';
import { requestContext } from './request-context';
import { requestContextMiddleware } from './request-context.middleware';

describe('requestContextMiddleware', () => {
  it('dá um id novo à requisição, devolve no header e abre o contexto antes de chamar o próximo', () => {
    const req = {} as AppRequest;
    const setHeader = jest.fn();
    let seenInside: string | undefined;

    requestContextMiddleware(req, { setHeader } as unknown as Response, () => {
      seenInside = requestContext.get()?.requestId;
    });

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    expect(seenInside).toBe(req.id);
  });

  it('cada requisição recebe um id diferente', () => {
    const [a, b] = [{} as AppRequest, {} as AppRequest];
    const res = { setHeader: jest.fn() } as unknown as Response;
    requestContextMiddleware(a, res, () => undefined);
    requestContextMiddleware(b, res, () => undefined);
    expect(a.id).not.toBe(b.id);
  });
});
