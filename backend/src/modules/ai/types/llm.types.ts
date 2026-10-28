import type { Env } from '@/config/env.schema';

export type LlmProviderName = Env['LLM_PROVIDER'];

export interface LlmImage {
  mimeType: string;
  data: Buffer;
}

/** Documento anexo (PDF) que o modelo lê direto. */
export interface LlmDocument {
  mimeType: string;
  data: Buffer;
}

/** Pedido genérico a um LLM: o mesmo para qualquer provider. */
export interface LlmRequest {
  system: string;
  user: string;
  image?: LlmImage;
  document?: LlmDocument;
  /** JSON Schema da saída esperada (já filtrado para o subconjunto aceito pelos providers). */
  jsonSchema: object;
  temperature?: number;
  topK?: number;
  /** Instante (ms, `Date.now()`) em que a chamada inteira, com todos os providers, precisa ter terminado. */
  deadlineAt: number;
  /** É o último provider da cadeia? Então vale esperar o que o servidor pedir (dentro do prazo), em vez de falhar. */
  isLastProvider?: boolean;
}

export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse extends LlmUsage {
  /** Texto bruto devolvido pelo modelo (JSON). Quem chama valida. */
  text: string;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  /** Aceita imagem ou PDF no pedido? Quem não aceita fica fora da cadeia quando a tarefa envia um deles. */
  readonly supportsImages: boolean;
  /** Lança `LlmUnavailableError` quando não há capacidade/acesso (permite tentar o próximo provider). */
  generateJson(request: LlmRequest): Promise<LlmResponse>;
}

/** Opções por tarefa, declaradas com `@LlmTask`. */
export interface LlmTaskOptions {
  provider?: LlmProviderName;
  temperature?: number;
  topK?: number;
}
