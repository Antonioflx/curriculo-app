import 'reflect-metadata';
import { LLM_TASK_METADATA } from '../constants/ai.constants';
import type { LlmTaskOptions } from '../types/llm.types';

/**
 * Declara como uma tarefa de IA deve ser executada (provider, temperatura, topK).
 * O método só descreve o pedido; o `AiService.run` lê estas opções pelo nome do método.
 *
 * @example
 * @LlmTask({ temperature: 0, topK: 1 })
 * extractJob(input: ExtractJobInput) { ... }
 */
export const LlmTask =
  (options: LlmTaskOptions): MethodDecorator =>
  (target, propertyKey) => {
    Reflect.defineMetadata(LLM_TASK_METADATA, options, target, propertyKey);
  };

export const getLlmTaskOptions = (target: object, task: string): LlmTaskOptions =>
  (Reflect.getMetadata(LLM_TASK_METADATA, target, task) as LlmTaskOptions | undefined) ?? {};
