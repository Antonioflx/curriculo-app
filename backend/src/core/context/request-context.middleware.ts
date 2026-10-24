import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from '@/common/types/app-request';
import { requestContext } from './request-context';

/**
 * Primeiro middleware do app: dá um id à requisição (`req.id` e header `x-request-id`) e abre o contexto
 * que o logger lê. Roda antes do parser de body, então até o erro 413 sai com `requestId`.
 */
export function requestContextMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  req.id = randomUUID();
  res.setHeader('x-request-id', req.id);
  requestContext.run({ requestId: req.id }, next);
}
