import { ServiceUnavailableException } from '@nestjs/common';
import type { AppConfigService } from '@/config/app-config.service';
import type { GeminiProvider } from '../providers/gemini.provider';
import type { GroqProvider } from '../providers/groq.provider';
import { LlmProviderRegistry } from './llm-provider.registry';

describe('LlmProviderRegistry', () => {
  const gemini = { name: 'gemini', supportsImages: true } as unknown as GeminiProvider;
  const groq = { name: 'groq', supportsImages: false } as unknown as GroqProvider;
  const build = (settings: { LLM_PROVIDER: string; LLM_FALLBACK_PROVIDER?: string }) =>
    new LlmProviderRegistry(gemini, groq, {
      get: (key: keyof typeof settings) => settings[key],
    } as unknown as AppConfigService);

  it('sem fallback configurado a cadeia é só o provider padrão', () => {
    expect(build({ LLM_PROVIDER: 'gemini' }).chain()).toEqual([gemini]);
  });

  it('com fallback a cadeia é principal → fallback', () => {
    expect(build({ LLM_PROVIDER: 'gemini', LLM_FALLBACK_PROVIDER: 'groq' }).chain()).toEqual([gemini, groq]);
  });

  it('o provider pedido pela tarefa (@LlmTask) vira o principal', () => {
    expect(build({ LLM_PROVIDER: 'gemini', LLM_FALLBACK_PROVIDER: 'groq' }).chain('groq')).toEqual([groq]);
  });

  it('não repete o mesmo provider na cadeia', () => {
    expect(build({ LLM_PROVIDER: 'gemini', LLM_FALLBACK_PROVIDER: 'gemini' }).chain()).toEqual([gemini]);
  });

  it('pedido com imagem tira da cadeia quem não aceita imagem', () => {
    const registry = build({ LLM_PROVIDER: 'gemini', LLM_FALLBACK_PROVIDER: 'groq' });
    expect(registry.chain(undefined, true)).toEqual([gemini]);
    expect(registry.chain(undefined, false)).toEqual([gemini, groq]);
  });

  it('cadeia vazia responde "IA indisponível"', () => {
    const registry = build({ LLM_PROVIDER: 'groq' });
    expect(() => registry.chain(undefined, true)).toThrow(ServiceUnavailableException);
    expect(() => build({ LLM_PROVIDER: 'outro' }).chain()).toThrow(ServiceUnavailableException);
  });
});
