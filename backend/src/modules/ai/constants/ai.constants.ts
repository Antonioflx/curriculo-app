export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');
export const HTTP_FETCH = Symbol('HTTP_FETCH');

/** Espera máxima que vale a pena para repetir no mesmo modelo/provider. Acima disso (ex.: cota diária) passa ao próximo. */
export const MAX_RETRY_WAIT_SECONDS = 10;
/** Com menos tempo que isso no orçamento, nova tentativa não compensa. */
export const MIN_ATTEMPT_MS = 2_000;
export const LLM_TASK_METADATA = 'llm:task';

/** Chamadas de IA por minuto, por usuário (e por IP), nas rotas com @AiRateLimit. */
export const AI_RATE_LIMIT_PER_MINUTE = 10;

export const AI_UNAVAILABLE_MESSAGE = 'IA indisponível no momento';
export const AI_FAILURE_MESSAGE = 'Falha ao consultar a IA';
export const AI_INVALID_RESPONSE_MESSAGE = 'Resposta da IA inválida';

export const AI_TASKS = [
  'extractJob',
  'extractResume',
  'analyzeFit',
  'buildAdjusted',
  'reviseResume',
  'writeEmail',
  'answerQuestion',
] as const;
