import { ApiError, type GoogleGenAI, type Part } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import { GEMINI_CLIENT, MAX_RETRY_WAIT_SECONDS, MIN_ATTEMPT_MS } from '../constants/ai.constants';
import { isNetworkError, LlmUnavailableError, UNAVAILABLE_STATUS } from '../errors/llm-unavailable.error';
import type { LlmProvider, LlmRequest, LlmResponse } from '../types/llm.types';

/** Falhas rápidas: vale tentar de novo no mesmo modelo. */
const RETRYABLE_STATUS = new Set([429, 503]);
/** Falhas de capacidade do modelo: depois das tentativas, vale trocar para o modelo de fallback. */
const FALLBACK_STATUS = new Set([429, 503, 504]);
/** 504/timeout não é repetido no mesmo modelo: cada tentativa custaria o prazo inteiro. */
const RETRY_DELAYS_MS = [1_000, 2_000];

/** O Gemini responde chave inválida com 400 (não 401): é problema de acesso, não de pedido. */
function isInvalidKey(error: ApiError): boolean {
  return error.status === 400 && /API key not valid|API_KEY_INVALID/i.test(error.message);
}

/**
 * Único ponto do sistema que conhece o SDK do Gemini.
 *
 * Prazo: `request.deadlineAt` é o orçamento da chamada inteira (tentativas, esperas, troca de modelo e de provider);
 * `AI_TIMEOUT_MS` limita cada tentativa. Quando não há como atender, lança `LlmUnavailableError` para o
 * `AiService` poder tentar o próximo provider.
 */
@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  readonly supportsImages = true;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenAI | null,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async generateJson(request: LlmRequest): Promise<LlmResponse> {
    try {
      return await this.withModelFallback(request);
    } catch (error) {
      throw this.classify(error);
    }
  }

  private async withModelFallback(request: LlmRequest): Promise<LlmResponse> {
    const primary = this.config.get('GEMINI_MODEL');
    const fallback = this.config.get('GEMINI_FALLBACK_MODEL');
    const hasModelFallback = !!fallback && fallback !== primary;

    try {
      return await this.callWithRetry(primary, request, !!request.isLastProvider && !hasModelFallback);
    } catch (error) {
      if (!fallback || !hasModelFallback || !this.isFallbackError(error) || !this.hasTimeLeft(request)) throw error;

      this.logger.warn('ai_model_fallback', { from: primary, to: fallback, status: (error as ApiError).status });
      return this.callWithRetry(fallback, request, !!request.isLastProvider);
    }
  }

  private async callWithRetry(model: string, request: LlmRequest, mayWaitLong: boolean): Promise<LlmResponse> {
    for (const delay of RETRY_DELAYS_MS) {
      try {
        return await this.call(model, request);
      } catch (error) {
        const wait = this.retryWait(error, delay, request, mayWaitLong);
        if (wait === null) throw error;
        await this.sleep(wait);
      }
    }
    return this.call(model, request);
  }

  private async call(model: string, request: LlmRequest): Promise<LlmResponse> {
    const remaining = request.deadlineAt - Date.now();
    if (remaining < MIN_ATTEMPT_MS) throw new ApiError({ message: 'Tempo total da IA esgotado', status: 504 });

    const response = await this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: this.toParts(request) }],
      config: {
        systemInstruction: request.system,
        responseMimeType: 'application/json',
        responseJsonSchema: request.jsonSchema,
        temperature: request.temperature,
        topK: request.topK,
        httpOptions: { timeout: Math.min(this.config.get('AI_TIMEOUT_MS'), remaining) },
      },
    });

    const usage = response.usageMetadata;
    return {
      text: response.text ?? '',
      model,
      inputTokens: usage?.promptTokenCount ?? 0,
      // Os tokens de raciocínio ("thinking") são cobrados como saída.
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    };
  }

  /** Sem GEMINI_API_KEY o app sobe (dev/test), mas esta chamada fica indisponível e a cadeia segue para o próximo provider. */
  private get ai(): GoogleGenAI {
    if (!this.client) throw new LlmUnavailableError(this.name, 'GEMINI_API_KEY ausente');
    return this.client;
  }

  /** Falta de capacidade/acesso vira `LlmUnavailableError`; erro de pedido (400) segue como está. */
  private classify(error: unknown): unknown {
    if (error instanceof LlmUnavailableError) return error;
    if (error instanceof ApiError && (UNAVAILABLE_STATUS.has(error.status) || isInvalidKey(error))) {
      return new LlmUnavailableError(this.name, error.message, error.status, { cause: error });
    }
    if (isNetworkError(error))
      return new LlmUnavailableError(this.name, (error as Error).message, undefined, { cause: error });
    return error;
  }

  /**
   * Quanto esperar antes de repetir (ms), ou null se não vale repetir: erro que não é transitório, ou espera
   * (dica do Gemini, ou o padrão) que não cabe no orçamento. Espera acima de 10 s só para quem não tem mais
   * para onde ir (`mayWaitLong`); com outro modelo/provider à frente, é melhor trocar do que esperar.
   */
  private retryWait(error: unknown, defaultDelay: number, request: LlmRequest, mayWaitLong: boolean): number | null {
    if (!(error instanceof ApiError) || !RETRYABLE_STATUS.has(error.status)) return null;

    const hint = this.suggestedWaitSeconds(error) * 1000;
    const wait = hint > 0 ? hint : defaultDelay;
    if (wait > MAX_RETRY_WAIT_SECONDS * 1000 && !mayWaitLong) return null;
    return request.deadlineAt - Date.now() - wait >= MIN_ATTEMPT_MS ? wait : null;
  }

  /** O Gemini diz quanto esperar ("Please retry in 7h47m12.6s"). Sem a dica, vale a tentativa normal (0). */
  private suggestedWaitSeconds(error: ApiError): number {
    const match = /retry in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(error.message);
    if (!match) return 0;
    const [, hours = '0', minutes = '0', seconds = '0'] = match;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  private isFallbackError(error: unknown): boolean {
    return error instanceof ApiError && FALLBACK_STATUS.has(error.status);
  }

  private hasTimeLeft(request: LlmRequest): boolean {
    return request.deadlineAt - Date.now() >= MIN_ATTEMPT_MS;
  }

  private sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  /** Imagem ou PDF primeiro, depois o texto (ordem recomendada para entrada multimodal). */
  private toParts(request: LlmRequest): Part[] {
    const attachments = [request.image, request.document].filter((file) => file !== undefined);
    const parts: Part[] = attachments.map(({ mimeType, data }) => ({
      inlineData: { mimeType, data: data.toString('base64') },
    }));
    parts.push({ text: request.user });
    return parts;
  }
}
