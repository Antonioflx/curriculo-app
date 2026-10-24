import type { LlmProviderName } from '../types/llm.types';

/**
 * O provider não conseguiu atender por falta de capacidade ou de acesso: cota, 429, 5xx, timeout, falha de rede,
 * chave ausente ou modelo indisponível. Tentar outro provider pode resolver. Erro de pedido (400) não é isto.
 */
export class LlmUnavailableError extends Error {
  constructor(
    readonly provider: LlmProviderName,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmUnavailableError';
  }
}

/** Status HTTP que indicam indisponibilidade do provider (inclui chave inválida e modelo aposentado). */
export const UNAVAILABLE_STATUS: ReadonlySet<number> = new Set([401, 403, 404, 408, 429, 500, 502, 503, 504]);

/** Falha de rede/timeout vinda do SDK ou do fetch (o SDK embrulha como Error genérico). */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /fetch failed|timeout|timed out|aborted|econnreset|econnrefused|etimedout|enotfound|socket hang up/i.test(
    `${error.name} ${error.message}`,
  );
}
