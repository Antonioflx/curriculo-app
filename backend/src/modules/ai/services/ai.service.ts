import { BadGatewayException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { z } from 'zod';
import { AppConfigService } from '@/config/app-config.service';
import { AppLogger } from '@/core/logger/services/app-logger.service';
import {
  AI_FAILURE_MESSAGE,
  AI_UNAVAILABLE_MESSAGE,
  AI_INVALID_RESPONSE_MESSAGE,
  MIN_ATTEMPT_MS,
  type AI_TASKS,
} from '../constants/ai.constants';
import { getLlmTaskOptions, LlmTask } from '../decorators/llm-task.decorator';
import { LlmUnavailableError } from '../errors/llm-unavailable.error';
import { analyzeFitPrompt } from '../prompts/analyze-fit.prompt';
import { answerQuestionPrompt } from '../prompts/answer-question.prompt';
import { buildAdjustedPrompt } from '../prompts/build-adjusted.prompt';
import { extractJobPrompt } from '../prompts/extract-job.prompt';
import { extractResumePrompt } from '../prompts/extract-resume.prompt';
import { reviseResumePrompt } from '../prompts/revise-resume.prompt';
import { writeEmailPrompt } from '../prompts/write-email.prompt';
import { buildAnalyzeFitSchema } from '../schemas/analyze-fit.schema';
import { extractJobSchema } from '../schemas/extract-job.schema';
import { resumeContentSchema } from '../schemas/resume-content.schema';
import { answerSchema, emailSchema } from '../schemas/text-output.schema';
import type {
  AiResult,
  AnalyzeFitInput,
  AnswerQuestionInput,
  BuildAdjustedInput,
  ExtractJobInput,
  ExtractResumeInput,
  ReviseResumeInput,
  WriteEmailInput,
} from '../types/ai.types';
import type { LlmDocument, LlmImage, LlmProvider, LlmRequest } from '../types/llm.types';
import { toLlmJsonSchema } from '../utils/json-schema';
import { findChangedExperience, removeInventedSkills } from '../utils/resume-guards';
import { LlmProviderRegistry } from './llm-provider.registry';

type AiTaskName = (typeof AI_TASKS)[number];

interface TaskCall<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  image?: LlmImage;
  document?: LlmDocument;
}

/**
 * Tarefas de IA do app. Cada método monta o pedido (prompt + schema) e `run` executa:
 * escolhe o provider, chama, valida a resposta e registra tarefa, modelo, tokens e duração
 * (nunca o conteúdo). Resposta inválida vira erro tratado, nunca dado parcial.
 *
 * A ENTRADA chega validada: texto, limites, imagem e regras entre campos são checados nos DTOs de quem
 * chama (`jobs`, `resumes`, `messages`...). Aqui só se valida a SAÍDA do modelo, que é dado não confiável.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly providers: LlmProviderRegistry,
    private readonly logger: AppLogger,
    private readonly config: AppConfigService,
  ) {}

  @LlmTask({ temperature: 0, topK: 1 })
  async extractJob(input: ExtractJobInput) {
    return this.run('extractJob', {
      system: extractJobPrompt.system,
      user: extractJobPrompt.buildUser(input.text ?? '', !!input.image),
      image: input.image,
      schema: extractJobSchema,
    });
  }

  @LlmTask({ temperature: 0, topK: 1 })
  async extractResume(input: ExtractResumeInput) {
    return this.run('extractResume', {
      system: extractResumePrompt.system,
      user: extractResumePrompt.buildUser(input.text ?? '', !!input.document),
      document: input.document,
      schema: resumeContentSchema,
    });
  }

  @LlmTask({ temperature: 0.2 })
  async analyzeFit(input: AnalyzeFitInput) {
    const resumeIds = input.resumes.map((resume) => resume.id) as [string, ...string[]];
    return this.run('analyzeFit', {
      system: analyzeFitPrompt.system,
      user: analyzeFitPrompt.buildUser(input),
      schema: buildAnalyzeFitSchema(resumeIds),
    });
  }

  @LlmTask({ temperature: 0.2 })
  async buildAdjusted(input: BuildAdjustedInput) {
    const result = await this.run('buildAdjusted', {
      system: buildAdjustedPrompt.system,
      user: buildAdjustedPrompt.buildUser(input),
      schema: resumeContentSchema,
    });

    // Ajuste muda ênfase, não fatos: experiências inventadas ou alteradas derrubam a resposta.
    const problem = findChangedExperience(input.baseContent, result.data);
    if (problem) this.rejectResponse('buildAdjusted', problem);

    // Habilidade que o usuário não mostrou não entra, mesmo que a vaga peça (regra 2: lacuna não vira mentira).
    const { content, removed } = removeInventedSkills(
      input.baseContent,
      result.data,
      input.answered.map(({ answer }) => answer),
    );
    if (removed.length > 0)
      this.logger.warn('ai_invented_skills_removed', { task: 'buildAdjusted', count: removed.length });
    return { ...result, data: content };
  }

  @LlmTask({ temperature: 0.2 })
  async reviseResume(input: ReviseResumeInput) {
    return this.run('reviseResume', {
      system: reviseResumePrompt.system,
      user: reviseResumePrompt.buildUser(input),
      schema: resumeContentSchema,
    });
  }

  @LlmTask({ temperature: 0.7 })
  async writeEmail(input: WriteEmailInput) {
    return this.run('writeEmail', {
      system: writeEmailPrompt.system,
      user: writeEmailPrompt.buildUser(input),
      schema: emailSchema,
    });
  }

  @LlmTask({ temperature: 0.7 })
  async answerQuestion(input: AnswerQuestionInput) {
    return this.run('answerQuestion', {
      system: answerQuestionPrompt.system,
      user: answerQuestionPrompt.buildUser(input),
      schema: answerSchema,
    });
  }

  private async run<T>(task: AiTaskName, call: TaskCall<T>): Promise<AiResult<T>> {
    const options = getLlmTaskOptions(AiService.prototype, task);
    const chain = this.providers.chain(options.provider, !!(call.image || call.document));
    const startedAt = Date.now();
    const request: LlmRequest = {
      system: call.system,
      user: call.user,
      image: call.image,
      document: call.document,
      jsonSchema: toLlmJsonSchema(call.schema),
      temperature: options.temperature,
      topK: options.topK,
      deadlineAt: startedAt + this.config.get('AI_TOTAL_TIMEOUT_MS'),
    };

    const { provider, response } = await this.generate(task, chain, request, startedAt);
    const data = this.parse(task, call.schema, response.text);
    const usage = { model: response.model, inputTokens: response.inputTokens, outputTokens: response.outputTokens };

    this.logger.info('ai_call', { task, provider: provider.name, ...usage, durationMs: Date.now() - startedAt });
    return { data, usage };
  }

  /** Percorre a cadeia: passa ao próximo provider só se o atual está indisponível e ainda há tempo no orçamento. */
  private async generate(task: AiTaskName, chain: LlmProvider[], request: LlmRequest, startedAt: number) {
    for (const [index, provider] of chain.entries()) {
      try {
        const isLastProvider = index === chain.length - 1;
        return { provider, response: await provider.generateJson({ ...request, isLastProvider }) };
      } catch (error) {
        const next = chain[index + 1];
        if (!next || !(error instanceof LlmUnavailableError) || !this.hasTimeLeft(request)) {
          return this.rejectProviderFailure(task, provider.name, startedAt, error);
        }
        this.logger.warn('ai_provider_fallback', { task, from: provider.name, to: next.name, status: error.status });
      }
    }
    throw new ServiceUnavailableException(AI_UNAVAILABLE_MESSAGE);
  }

  private hasTimeLeft(request: LlmRequest): boolean {
    return request.deadlineAt - Date.now() >= MIN_ATTEMPT_MS;
  }

  private parse<T>(task: AiTaskName, schema: z.ZodType<T>, text: string): T {
    const json = this.parseJson(text);
    if (json === undefined) return this.rejectResponse(task, 'JSON inválido');

    const result = schema.safeParse(json);
    if (result.success) return result.data;

    // Só os caminhos dos campos inválidos: valores podem conter dados do usuário.
    return this.rejectResponse(task, `schema: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private rejectResponse(task: AiTaskName, reason: string): never {
    this.logger.warn('ai_invalid_response', { task, reason });
    throw new BadGatewayException(AI_INVALID_RESPONSE_MESSAGE);
  }

  /**
   * Erros já tratados passam. Indisponibilidade de todos os providers vira 503 e qualquer outra falha vira 502,
   * sempre genéricos para o cliente: o motivo fica só no log.
   */
  private rejectProviderFailure(task: AiTaskName, provider: string, startedAt: number, error: unknown): never {
    if (error instanceof HttpException) throw error;

    this.logger.error('ai_error', {
      task,
      provider,
      durationMs: Date.now() - startedAt,
      status: error instanceof LlmUnavailableError ? error.status : undefined,
      error: error instanceof Error ? error.message : 'unknown',
    });
    if (error instanceof LlmUnavailableError) throw new ServiceUnavailableException(AI_UNAVAILABLE_MESSAGE);
    throw new BadGatewayException(AI_FAILURE_MESSAGE);
  }
}
