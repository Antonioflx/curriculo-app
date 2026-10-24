import { ApiError, type GoogleGenAI } from '@google/genai';
import type { AppConfigService } from '@/config/app-config.service';
import type { AppLogger } from '@/core/logger/services/app-logger.service';
import { LlmUnavailableError } from '../errors/llm-unavailable.error';
import type { LlmRequest } from '../types/llm.types';
import { GeminiProvider } from './gemini.provider';

const apiError = (status: number, message = `erro ${status}`) => new ApiError({ message, status });
const reply = (text = '{"ok":true}') => ({
  text,
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, thoughtsTokenCount: 70 },
});

describe('GeminiProvider', () => {
  const generateContent = jest.fn();
  const client = { models: { generateContent } } as unknown as GoogleGenAI;
  const logger = { warn: jest.fn() };
  let settings: Record<string, unknown>;

  /** Pedido com orçamento de `totalMs` a partir de agora (o relógio pode estar falso nos testes de prazo). */
  const makeRequest = (totalMs = 60_000, extra: Partial<LlmRequest> = {}): LlmRequest => ({
    system: 'sistema',
    user: 'usuário',
    jsonSchema: { type: 'object' },
    temperature: 0.2,
    topK: 1,
    deadlineAt: Date.now() + totalMs,
    ...extra,
  });

  const build = (gemini: GoogleGenAI | null = client) => {
    const config = { get: (key: string) => settings[key] } as unknown as AppConfigService;
    const provider = new GeminiProvider(gemini, config, logger as unknown as AppLogger);
    const sleep = jest.fn().mockResolvedValue(undefined);
    (provider as unknown as { sleep: typeof sleep }).sleep = sleep;
    return { provider, sleep };
  };
  const modelsCalled = () => generateContent.mock.calls.map(([args]) => args.model);

  beforeEach(() => {
    jest.resetAllMocks();
    settings = { GEMINI_MODEL: 'modelo-principal', GEMINI_FALLBACK_MODEL: undefined, AI_TIMEOUT_MS: 30_000 };
  });

  it('aceita imagem', () => {
    expect(build().provider.supportsImages).toBe(true);
  });

  it('monta a chamada com instrução de sistema, JSON Schema, amostragem e timeout', async () => {
    generateContent.mockResolvedValue(reply());
    const { provider } = build();

    await provider.generateJson(makeRequest(60_000, { image: { mimeType: 'image/png', data: Buffer.from('abc') } }));

    expect(generateContent).toHaveBeenCalledWith({
      model: 'modelo-principal',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: Buffer.from('abc').toString('base64') } },
            { text: 'usuário' },
          ],
        },
      ],
      config: {
        systemInstruction: 'sistema',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        temperature: 0.2,
        topK: 1,
        httpOptions: { timeout: 30_000 },
      },
    });
  });

  it('sem imagem manda só o texto', async () => {
    generateContent.mockResolvedValue(reply());
    await build().provider.generateJson(makeRequest());
    expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual([{ text: 'usuário' }]);
  });

  it('devolve texto, modelo e tokens, somando o raciocínio à saída', async () => {
    generateContent.mockResolvedValue(reply('{"a":1}'));
    await expect(build().provider.generateJson(makeRequest())).resolves.toEqual({
      text: '{"a":1}',
      model: 'modelo-principal',
      inputTokens: 100,
      outputTokens: 100,
    });
  });

  describe('indisponibilidade (permite tentar outro provider)', () => {
    it('sem cliente (sem GEMINI_API_KEY)', async () => {
      await expect(build(null).provider.generateJson(makeRequest())).rejects.toBeInstanceOf(LlmUnavailableError);
    });

    it.each([401, 403, 404, 429, 500, 503, 504])(
      'o status %i vira LlmUnavailableError, com o status',
      async (status) => {
        generateContent.mockRejectedValue(apiError(status));
        await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({
          name: 'LlmUnavailableError',
          provider: 'gemini',
          status,
        });
      },
    );

    it('falha de rede (o SDK embrulha como Error genérico) também', async () => {
      generateContent.mockRejectedValue(new Error('exception TypeError: fetch failed sending request'));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(LlmUnavailableError);
    });

    it('chave inválida (400 API_KEY_INVALID) é indisponibilidade: aciona o fallback de provider', async () => {
      generateContent.mockRejectedValueOnce(apiError(400, 'API key not valid. Please pass a valid API key.'));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(LlmUnavailableError);
    });

    it('erro de pedido (400) e erro de programação seguem como estão, sem acionar o fallback de provider', async () => {
      generateContent.mockRejectedValueOnce(apiError(400));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(ApiError);

      generateContent.mockRejectedValueOnce(new TypeError('Cannot read properties of undefined'));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(TypeError);
    });
  });

  describe('retry', () => {
    it.each([429, 503])('repete após %i e devolve o sucesso', async (status) => {
      generateContent.mockRejectedValueOnce(apiError(status)).mockResolvedValueOnce(reply());
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).resolves.toMatchObject({ model: 'modelo-principal' });
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(1_000);
    });

    it('desiste depois de 3 tentativas, com espera crescente', async () => {
      generateContent.mockRejectedValue(apiError(503));
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 503 });
      expect(generateContent).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
    });

    it.each([400, 401, 404, 504])('não repete %i no mesmo modelo', async (status) => {
      generateContent.mockRejectedValue(apiError(status));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeDefined();
      expect(generateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('dica de espera do Gemini', () => {
    const quotaError = (wait: string) => apiError(429, `Quota exceeded. Please retry in ${wait}.`);

    it.each(['7h47m12.60779605s', '2m5s', '45.5s', '11s'])(
      'espera de %s (cota diária ou longa) não é repetida no mesmo modelo',
      async (wait) => {
        generateContent.mockRejectedValue(quotaError(wait));
        const { provider, sleep } = build();

        await expect(provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 429 });
        expect(generateContent).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
      },
    );

    it.each(['3.2s', '10s'])('espera curta de %s ainda vale repetir', async (wait) => {
      generateContent.mockRejectedValueOnce(quotaError(wait)).mockResolvedValueOnce(reply());
      await expect(build().provider.generateJson(makeRequest())).resolves.toMatchObject({ model: 'modelo-principal' });
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('cota esgotada no principal vai direto para o fallback, que tem cota própria', async () => {
      settings.GEMINI_FALLBACK_MODEL = 'modelo-reserva';
      generateContent.mockRejectedValueOnce(quotaError('7h47m12s')).mockResolvedValueOnce(reply());

      const result = await build().provider.generateJson(makeRequest());

      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-reserva']);
      expect(result.model).toBe('modelo-reserva');
    });

    it('429 sem dica de espera continua sendo repetido', async () => {
      generateContent.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(reply());
      await build().provider.generateJson(makeRequest());
      expect(generateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('modelo de fallback', () => {
    beforeEach(() => {
      settings.GEMINI_FALLBACK_MODEL = 'modelo-reserva';
    });

    it('usa o fallback quando o principal esgota as tentativas por sobrecarga, e registra', async () => {
      generateContent.mockRejectedValueOnce(apiError(503)).mockRejectedValueOnce(apiError(503));
      generateContent.mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce(reply());

      const result = await build().provider.generateJson(makeRequest());

      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-principal', 'modelo-principal', 'modelo-reserva']);
      expect(result.model).toBe('modelo-reserva');
      expect(logger.warn).toHaveBeenCalledWith('ai_model_fallback', {
        from: 'modelo-principal',
        to: 'modelo-reserva',
        status: 503,
      });
    });

    it('timeout (504) vai direto para o fallback, sem repetir o principal', async () => {
      generateContent.mockRejectedValueOnce(apiError(504)).mockResolvedValueOnce(reply());
      await build().provider.generateJson(makeRequest());
      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-reserva']);
    });

    it('erro do pedido (400) não troca de modelo', async () => {
      generateContent.mockRejectedValue(apiError(400));
      await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 400 });
      expect(modelsCalled()).toEqual(['modelo-principal']);
    });

    it('se o fallback também falha, o erro dele sobe', async () => {
      generateContent.mockRejectedValue(apiError(504));
      await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 504 });
      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-reserva']);
    });

    it('fallback igual ao principal ou ausente não faz nova chamada', async () => {
      generateContent.mockRejectedValue(apiError(504));
      settings.GEMINI_FALLBACK_MODEL = 'modelo-principal';
      await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 504 });
      settings.GEMINI_FALLBACK_MODEL = undefined;
      await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 504 });
      expect(generateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('prazo total (vem no pedido, compartilhado com os outros providers)', () => {
    /** Relógio falso: as esperas e as chamadas avançam o tempo, e o código lê Date.now(). */
    const withClock = async (run: (clock: { advance: (ms: number) => void }) => Promise<void>) => {
      let now = 1_000_000;
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
      try {
        await run({ advance: (ms) => (now += ms) });
      } finally {
        spy.mockRestore();
      }
    };

    it('o timeout de cada tentativa nunca passa do que sobra do orçamento', async () => {
      generateContent.mockResolvedValue(reply());

      await withClock(async () => {
        await build().provider.generateJson(makeRequest(10_000));
      });

      expect(generateContent.mock.calls[0][0].config.httpOptions).toEqual({ timeout: 10_000 });
    });

    it('esgotado o orçamento, não faz outra tentativa nem tenta o fallback', async () => {
      settings.GEMINI_FALLBACK_MODEL = 'modelo-reserva';

      await withClock(async (clock) => {
        const { provider, sleep } = build();
        sleep.mockImplementation((ms: number) => clock.advance(ms));
        generateContent.mockImplementation(() => {
          clock.advance(4_000); // cada tentativa demora 4 s e falha por sobrecarga
          return Promise.reject(apiError(503));
        });

        await expect(provider.generateJson(makeRequest(10_000))).rejects.toMatchObject({ status: 503 });
      });

      // 4 s + 1 s de espera + 4 s = 9 s: a próxima espera (2 s) não deixa tempo para outra tentativa, nem para o fallback.
      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-principal']);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('não espera por uma nova tentativa que não caberia no orçamento: devolve o erro original', async () => {
      await withClock(async (clock) => {
        const { provider, sleep } = build();
        sleep.mockImplementation((ms: number) => clock.advance(ms));
        generateContent.mockImplementation(() => {
          clock.advance(3_500);
          return Promise.reject(apiError(503));
        });

        // Sobram 1,5 s: nem esperar 1 s deixaria o mínimo para outra tentativa.
        await expect(provider.generateJson(makeRequest(5_000))).rejects.toMatchObject({ status: 503 });
        expect(sleep).not.toHaveBeenCalled();
        expect(generateContent).toHaveBeenCalledTimes(1);
      });
    });

    describe('último provider da cadeia (nenhuma alternativa depois dele)', () => {
      const rateLimited = (wait: string) => apiError(429, `Rate limit. Please retry in ${wait}.`);

      it('espera o que o servidor pediu, mesmo acima de 10 s, se couber no prazo', async () => {
        generateContent.mockRejectedValueOnce(rateLimited('33.18s')).mockResolvedValueOnce(reply());
        const { provider, sleep } = build();

        await expect(provider.generateJson(makeRequest(60_000, { isLastProvider: true }))).resolves.toMatchObject({
          model: 'modelo-principal',
        });
        expect(sleep).toHaveBeenCalledWith(33_180);
      });

      it('com outro provider depois dele, não espera: devolve a indisponibilidade para a cadeia seguir', async () => {
        generateContent.mockRejectedValue(rateLimited('33.18s'));
        const { provider, sleep } = build();

        await expect(provider.generateJson(makeRequest(60_000, { isLastProvider: false }))).rejects.toMatchObject({
          status: 429,
        });
        expect(sleep).not.toHaveBeenCalled();
      });

      it('se a espera não cabe no prazo (ex.: cota diária, "7h47m"), falha mesmo sendo o último', async () => {
        generateContent.mockRejectedValue(rateLimited('7h47m12s'));
        const { provider, sleep } = build();

        await expect(provider.generateJson(makeRequest(60_000, { isLastProvider: true }))).rejects.toMatchObject({
          status: 429,
        });
        expect(sleep).not.toHaveBeenCalled();
      });

      it('com modelo de fallback do próprio Gemini, prefere trocar de modelo a esperar', async () => {
        settings.GEMINI_FALLBACK_MODEL = 'modelo-reserva';
        generateContent.mockRejectedValueOnce(rateLimited('33s')).mockResolvedValueOnce(reply());
        const { provider, sleep } = build();

        const result = await provider.generateJson(makeRequest(60_000, { isLastProvider: true }));

        expect(result.model).toBe('modelo-reserva');
        expect(sleep).not.toHaveBeenCalled();
      });

      it('a dica curta do servidor vale em qualquer posição da cadeia (em vez do atraso fixo)', async () => {
        generateContent.mockRejectedValueOnce(rateLimited('3.2s')).mockResolvedValueOnce(reply());
        const { provider, sleep } = build();

        await provider.generateJson(makeRequest(60_000, { isLastProvider: false }));

        expect(sleep).toHaveBeenCalledWith(3_200);
      });
    });

    it('um pedido que já chega sem tempo nem chama o SDK', async () => {
      await expect(build().provider.generateJson(makeRequest(500))).rejects.toMatchObject({ status: 504 });
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('com tempo de sobra o fallback continua sendo usado', async () => {
      settings.GEMINI_FALLBACK_MODEL = 'modelo-reserva';
      generateContent.mockRejectedValueOnce(apiError(504)).mockResolvedValueOnce(reply());

      await withClock(async () => {
        await build().provider.generateJson(makeRequest());
      });

      expect(modelsCalled()).toEqual(['modelo-principal', 'modelo-reserva']);
    });
  });
});
