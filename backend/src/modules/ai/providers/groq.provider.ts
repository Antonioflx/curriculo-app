import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { HTTP_FETCH, MAX_RETRY_WAIT_SECONDS, MIN_ATTEMPT_MS } from '../constants/ai.constants';
import { isNetworkError, LlmUnavailableError, UNAVAILABLE_STATUS } from '../errors/llm-unavailable.error';
import type { LlmProvider, LlmRequest, LlmResponse } from '../types/llm.types';
import { omitSchemaKeywords } from '../utils/json-schema';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Teto da resposta, raciocínio incluído. O Groq limita tokens por minuto, então não vale pedir mais que o necessário. */
const MAX_COMPLETION_TOKENS = 6_000;
/** Os modelos gpt-oss raciocinam; "low" corta tokens e latência nas nossas tarefas (e protege o limite por minuto). */
const REASONING_EFFORT = 'low';
/** O modo estrito recusa `format` com valores que não conhece (ex.: "uri"). O Zod valida o formato depois. */
const UNSUPPORTED_SCHEMA_KEYWORDS = ['format'];
const RETRYABLE_STATUS = new Set([429, 502, 503]);
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000];
/** O modelo às vezes gera um JSON que não cumpre o schema (400 `json_validate_failed`); é intermitente (medido no gpt-oss-120b) e uma nova amostragem costuma resolver. */
const GENERATION_FAILURE_CODE = 'json_validate_failed';
const MAX_GENERATION_RETRIES = 2;

interface GroqCompletion {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

interface GroqFailure {
  status: number;
  message: string;
  code?: string;
  retryAfter: number;
}

/**
 * Provider do Groq (API compatível com OpenAI), usado como alternativa quando o Gemini está indisponível.
 * Só texto: os modelos da conta não recebem imagem. Saída estruturada em modo estrito (`json_schema`).
 * Chamada HTTP direta, sem SDK, para não somar uma dependência; o `fetch` entra por injeção (testável).
 */
@Injectable()
export class GroqProvider implements LlmProvider {
  readonly name = 'groq' as const;
  readonly supportsImages = false;

  constructor(
    @Inject(HTTP_FETCH) private readonly http: typeof fetch,
    private readonly config: AppConfigService,
  ) {}

  async generateJson(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = this.config.get('GROQ_API_KEY');
    if (!apiKey) throw new LlmUnavailableError(this.name, 'GROQ_API_KEY ausente');

    const model = this.config.get('GROQ_MODEL');
    const body = JSON.stringify(this.toBody(model, request));

    for (let attempt = 0; ; attempt++) {
      const response = await this.post(apiKey, body, request);
      if (response.ok) return this.toResponse(model, (await response.json()) as GroqCompletion);

      const failure = await this.readFailure(response);
      const wait = this.waitBeforeRetry(failure, attempt, request);
      if (wait === null) throw this.toError(failure);
      await this.sleep(wait);
    }
  }

  private toBody(model: string, request: LlmRequest) {
    return {
      model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      temperature: request.temperature,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'resposta',
          strict: true,
          schema: omitSchemaKeywords(request.jsonSchema, UNSUPPORTED_SCHEMA_KEYWORDS),
        },
      },
      ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: REASONING_EFFORT }),
    };
  }

  private async post(apiKey: string, body: string, request: LlmRequest): Promise<Response> {
    const remaining = request.deadlineAt - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      throw new LlmUnavailableError(this.name, 'Tempo total da IA esgotado', 504);
    }

    try {
      return await this.http(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(Math.min(this.config.get('AI_TIMEOUT_MS'), remaining)),
      });
    } catch (error) {
      if (isNetworkError(error)) {
        throw new LlmUnavailableError(this.name, (error as Error).message, undefined, { cause: error });
      }
      throw error;
    }
  }

  private async readFailure(response: Response): Promise<GroqFailure> {
    const json = (await response.json().catch(() => ({}))) as GroqCompletion;
    return {
      status: response.status,
      message: json.error?.message ?? response.statusText,
      code: json.error?.code,
      retryAfter: Number(response.headers.get('retry-after')),
    };
  }

  /**
   * Quanto esperar antes de repetir (ms), ou null se não vale repetir: erro que não é transitório, tentativas
   * esgotadas, ou espera (cabeçalho `retry-after`) acima do aceitável ou do que sobra do orçamento.
   */
  private waitBeforeRetry(failure: GroqFailure, attempt: number, request: LlmRequest): number | null {
    if (failure.code === GENERATION_FAILURE_CODE) return attempt < MAX_GENERATION_RETRIES ? 0 : null;
    if (!RETRYABLE_STATUS.has(failure.status) || attempt >= DEFAULT_RETRY_DELAYS_MS.length) return null;

    const hasHint = Number.isFinite(failure.retryAfter) && failure.retryAfter > 0;
    const waitSeconds = hasHint ? failure.retryAfter : DEFAULT_RETRY_DELAYS_MS[attempt] / 1000;
    if (waitSeconds > MAX_RETRY_WAIT_SECONDS && !request.isLastProvider) return null;

    const waitMs = waitSeconds * 1000;
    return request.deadlineAt - Date.now() - waitMs >= MIN_ATTEMPT_MS ? waitMs : null;
  }

  private toResponse(model: string, json: GroqCompletion): LlmResponse {
    return {
      text: json.choices?.[0]?.message?.content ?? '',
      model,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      // Nos modelos de raciocínio os tokens de "thinking" já vêm dentro de completion_tokens.
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  private toError(failure: GroqFailure): Error {
    const message = `Groq ${failure.status}: ${failure.message}`;
    if (UNAVAILABLE_STATUS.has(failure.status)) return new LlmUnavailableError(this.name, message, failure.status);
    return new Error(message);
  }

  private sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
}
