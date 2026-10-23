import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { normalizeText } from '../utils/text.utils';

const EMAIL_LIMIT = 5;

/**
 * Limite por e-mail alvo (além do limite por IP do ThrottlerGuard global).
 * Sem e-mail válido no corpo, cai no IP para não deixar a rota sem limite.
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? normalizeText(body.email, { lowercase: true }) : null;
    return Promise.resolve(email ? `email:${email}` : `ip:${String(req.ip)}`);
  }

  protected override handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({ ...requestProps, limit: EMAIL_LIMIT });
  }
}
