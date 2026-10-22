import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { AppRequest } from '../types/app-request';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: AppRequest, res: Response, next: NextFunction) {
    req.id = randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  }
}
