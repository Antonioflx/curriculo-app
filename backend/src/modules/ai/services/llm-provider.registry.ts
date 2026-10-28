import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { AI_UNAVAILABLE_MESSAGE } from '../constants/ai.constants';
import { GeminiProvider } from '../providers/gemini.provider';
import { GroqProvider } from '../providers/groq.provider';
import type { LlmProvider, LlmProviderName } from '../types/llm.types';

/**
 * Monta a cadeia de providers de uma chamada: o principal (o do `@LlmTask` ou `LLM_PROVIDER`) e, depois,
 * o `LLM_FALLBACK_PROVIDER`, se houver. Quem não aceita imagem nem PDF sai da cadeia quando o pedido leva um deles.
 */
@Injectable()
export class LlmProviderRegistry {
  private readonly providers: ReadonlyMap<LlmProviderName, LlmProvider>;

  constructor(
    gemini: GeminiProvider,
    groq: GroqProvider,
    private readonly config: AppConfigService,
  ) {
    // Para adicionar outro provider (ex.: Claude): criar a classe, incluí-la aqui e em LLM_PROVIDERS no env.schema.
    this.providers = new Map<LlmProviderName, LlmProvider>([
      [gemini.name, gemini],
      [groq.name, groq],
    ]);
  }

  chain(preferred?: LlmProviderName, needsAttachment = false): LlmProvider[] {
    const names = [preferred ?? this.config.get('LLM_PROVIDER'), this.config.get('LLM_FALLBACK_PROVIDER')];
    const chain = [...new Set(names)]
      .map((name) => (name ? this.providers.get(name) : undefined))
      .filter((provider): provider is LlmProvider => !!provider && (!needsAttachment || provider.supportsImages));

    if (chain.length === 0) throw new ServiceUnavailableException(AI_UNAVAILABLE_MESSAGE);
    return chain;
  }
}
