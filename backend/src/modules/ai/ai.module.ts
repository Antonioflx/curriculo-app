import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { GEMINI_CLIENT, HTTP_FETCH } from './constants/ai.constants';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { AiService } from './services/ai.service';
import { LlmProviderRegistry } from './services/llm-provider.registry';

@Module({
  providers: [
    {
      provide: GEMINI_CLIENT,
      inject: [AppConfigService],
      // Sem chave o cliente não existe: o provider fica "indisponível" e a cadeia segue para o próximo.
      useFactory: (config: AppConfigService) => {
        const apiKey = config.get('GEMINI_API_KEY');
        return apiKey ? new GoogleGenAI({ apiKey }) : null;
      },
    },
    { provide: HTTP_FETCH, useValue: globalThis.fetch },
    GeminiProvider,
    GroqProvider,
    LlmProviderRegistry,
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
