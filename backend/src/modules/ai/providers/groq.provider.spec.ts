import type { AppConfigService } from '@/config/app-config.service';
import { LlmUnavailableError } from '../errors/llm-unavailable.error';
import type { LlmRequest } from '../types/llm.types';
import { GroqProvider } from './groq.provider';

const completion = (content = '{"ok":true}') =>
  new Response(
    JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 40 } }),
    {
      status: 200,
    },
  );
const failure = (status: number, message = 'falhou', headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message } }), { status, headers });

describe('GroqProvider', () => {
  const http = jest.fn();
  let settings: Record<string, unknown>;

  const makeRequest = (totalMs = 60_000): LlmRequest => ({
    system: 'sistema',
    user: 'usuário',
    jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    temperature: 0.2,
    topK: 1,
    deadlineAt: Date.now() + totalMs,
  });

  const build = () => {
    const config = { get: (key: string) => settings[key] } as unknown as AppConfigService;
    const provider = new GroqProvider(http as unknown as typeof fetch, config);
    const sleep = jest.fn().mockResolvedValue(undefined);
    (provider as unknown as { sleep: typeof sleep }).sleep = sleep;
    return { provider, sleep };
  };
  const sentBody = () => JSON.parse(http.mock.calls[0][1].body);

  beforeEach(() => {
    jest.resetAllMocks();
    settings = { GROQ_API_KEY: 'chave-de-teste', GROQ_MODEL: 'openai/gpt-oss-120b', AI_TIMEOUT_MS: 30_000 };
  });

  it('não aceita imagem (fica fora da cadeia quando a tarefa envia imagem)', () => {
    expect(build().provider.supportsImages).toBe(false);
  });

  it('chama a API compatível com OpenAI com chave, JSON Schema estrito e limites', async () => {
    http.mockResolvedValue(completion());

    await build().provider.generateJson(makeRequest());

    const [url, init] = http.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer chave-de-teste', 'Content-Type': 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(sentBody()).toEqual({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'sistema' },
        { role: 'user', content: 'usuário' },
      ],
      temperature: 0.2,
      max_completion_tokens: 6000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'resposta',
          strict: true,
          schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
      reasoning_effort: 'low',
    });
  });

  it('só os modelos gpt-oss recebem reasoning_effort', async () => {
    http.mockResolvedValue(completion());
    settings.GROQ_MODEL = 'qwen/qwen3.8-27b';

    await build().provider.generateJson(makeRequest());

    expect(sentBody().model).toBe('qwen/qwen3.8-27b');
    expect(sentBody()).not.toHaveProperty('reasoning_effort');
  });

  it('tira o `format` do schema (o modo estrito do Groq recusa "uri"), sem mexer em propriedades com esse nome', async () => {
    http.mockResolvedValue(completion());
    const request = {
      ...makeRequest(),
      jsonSchema: {
        type: 'object',
        properties: { format: { type: 'string' }, url: { type: 'string', format: 'uri' } },
      },
    };

    await build().provider.generateJson(request);

    expect(sentBody().response_format.json_schema.schema).toEqual({
      type: 'object',
      properties: { format: { type: 'string' }, url: { type: 'string' } },
    });
    // o pedido original não é alterado (o próximo provider da cadeia ainda o usa)
    expect(request.jsonSchema.properties.url).toHaveProperty('format', 'uri');
  });

  describe('JSON inválido gerado pelo modelo (400 json_validate_failed)', () => {
    const generationFailure = () =>
      new Response(JSON.stringify({ error: { message: 'Failed to validate JSON.', code: 'json_validate_failed' } }), {
        status: 400,
      });

    it('tenta mais uma vez, na hora, e devolve o sucesso', async () => {
      http.mockResolvedValueOnce(generationFailure()).mockResolvedValueOnce(completion());
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).resolves.toMatchObject({ outputTokens: 40 });
      expect(http).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(0);
    });

    it('se continuar falhando, desiste depois de 3 chamadas com o erro de pedido (não é indisponibilidade)', async () => {
      http.mockImplementation(() => Promise.resolve(generationFailure()));
      const error = await build()
        .provider.generateJson(makeRequest())
        .catch((e: unknown) => e);

      expect(http).toHaveBeenCalledTimes(3);
      expect(error).not.toBeInstanceOf(LlmUnavailableError);
      expect((error as Error).message).toBe('Groq 400: Failed to validate JSON.');
    });
  });

  it('devolve o texto, o modelo e os tokens', async () => {
    http.mockResolvedValue(completion('{"a":1}'));
    await expect(build().provider.generateJson(makeRequest())).resolves.toEqual({
      text: '{"a":1}',
      model: 'openai/gpt-oss-120b',
      inputTokens: 100,
      outputTokens: 40,
    });
  });

  it('sem GROQ_API_KEY fica indisponível, sem chamar a rede', async () => {
    settings.GROQ_API_KEY = undefined;
    await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(http).not.toHaveBeenCalled();
  });

  describe('erros', () => {
    it.each([401, 403, 404, 500])('o status %i vira LlmUnavailableError, sem repetir', async (status) => {
      http.mockResolvedValue(failure(status, 'motivo do provedor'));
      await expect(build().provider.generateJson(makeRequest())).rejects.toMatchObject({
        name: 'LlmUnavailableError',
        provider: 'groq',
        status,
        message: `Groq ${status}: motivo do provedor`,
      });
      expect(http).toHaveBeenCalledTimes(1);
    });

    it('erro de pedido (400) não é indisponibilidade: não aciona outro provider', async () => {
      http.mockResolvedValue(failure(400, 'schema inválido'));
      const error = await build()
        .provider.generateJson(makeRequest())
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(LlmUnavailableError);
      expect((error as Error).message).toBe('Groq 400: schema inválido');
    });

    it('falha de rede vira indisponibilidade', async () => {
      http.mockRejectedValue(new TypeError('fetch failed'));
      await expect(build().provider.generateJson(makeRequest())).rejects.toBeInstanceOf(LlmUnavailableError);
    });

    it('erro de programação segue como está', async () => {
      http.mockRejectedValue(new TypeError('Cannot read properties of undefined'));
      await expect(build().provider.generateJson(makeRequest())).rejects.not.toBeInstanceOf(LlmUnavailableError);
    });
  });

  describe('retry', () => {
    it('429 com retry-after curto espera o que o Groq pediu e repete', async () => {
      http
        .mockResolvedValueOnce(failure(429, 'limite por minuto', { 'retry-after': '3' }))
        .mockResolvedValueOnce(completion());
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).resolves.toMatchObject({ outputTokens: 40 });
      expect(sleep).toHaveBeenCalledWith(3_000);
      expect(http).toHaveBeenCalledTimes(2);
    });

    it('429 com retry-after longo (cota diária) não espera: fica indisponível', async () => {
      http.mockResolvedValue(failure(429, 'cota diária', { 'retry-after': '3600' }));
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 429 });
      expect(sleep).not.toHaveBeenCalled();
      expect(http).toHaveBeenCalledTimes(1);
    });

    describe('último provider da cadeia', () => {
      it('espera o que o Groq pediu mesmo acima de 10 s (ex.: 33 s do limite por minuto), se couber no prazo', async () => {
        http
          .mockResolvedValueOnce(failure(429, 'limite de tokens de saída por minuto', { 'retry-after': '33' }))
          .mockResolvedValueOnce(completion());
        const { provider, sleep } = build();

        await expect(provider.generateJson({ ...makeRequest(), isLastProvider: true })).resolves.toMatchObject({
          outputTokens: 40,
        });
        expect(sleep).toHaveBeenCalledWith(33_000);
      });

      it('com outro provider depois dele, não espera: a cadeia segue', async () => {
        http.mockResolvedValue(failure(429, 'limite', { 'retry-after': '33' }));
        const { provider, sleep } = build();

        await expect(provider.generateJson({ ...makeRequest(), isLastProvider: false })).rejects.toMatchObject({
          status: 429,
        });
        expect(sleep).not.toHaveBeenCalled();
      });

      it('cota diária (espera de horas) nunca cabe no prazo: falha mesmo sendo o último', async () => {
        http.mockResolvedValue(failure(429, 'cota diária', { 'retry-after': '28800' }));
        const { provider, sleep } = build();

        await expect(provider.generateJson({ ...makeRequest(), isLastProvider: true })).rejects.toMatchObject({
          status: 429,
        });
        expect(sleep).not.toHaveBeenCalled();
      });
    });

    it('503 sem cabeçalho usa espera crescente e desiste depois de 3 tentativas', async () => {
      http.mockResolvedValue(failure(503));
      const { provider, sleep } = build();

      await expect(provider.generateJson(makeRequest())).rejects.toMatchObject({ status: 503 });
      expect(http).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
    });

    it('não espera mais do que sobra do orçamento total', async () => {
      http.mockResolvedValue(failure(429, 'limite', { 'retry-after': '5' }));
      const { provider, sleep } = build();

      // Sobram ~4 s: esperar 5 s deixaria menos que o mínimo para uma nova tentativa.
      await expect(provider.generateJson(makeRequest(4_000))).rejects.toMatchObject({ status: 429 });
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('prazo total', () => {
    it('o timeout da tentativa é o menor entre AI_TIMEOUT_MS e o que sobra', async () => {
      http.mockImplementation(() => Promise.resolve(completion()));
      const timeout = jest.spyOn(AbortSignal, 'timeout');

      await build().provider.generateJson(makeRequest(10_000));
      expect(timeout.mock.calls[0][0]).toBeLessThanOrEqual(10_000);

      await build().provider.generateJson(makeRequest(120_000));
      expect(timeout.mock.calls[1][0]).toBe(30_000);
      timeout.mockRestore();
    });

    it('um pedido que já chega sem tempo nem chama a rede', async () => {
      await expect(build().provider.generateJson(makeRequest(500))).rejects.toMatchObject({ status: 504 });
      expect(http).not.toHaveBeenCalled();
    });
  });
});
