import { z } from 'zod';
import { str } from './helpers';

const suggestionSchema = z
  .object({
    kind: z.enum(['EMPHASIS', 'FACT_QUESTION']),
    /** Caminho no content, ex.: "summary", "skills[0].items", "experiences[1].bullets". */
    target: str(120),
    proposal: str(500),
    /** Obrigatória em FACT_QUESTION e nula em EMPHASIS. */
    question: str(500).nullable(),
  })
  .refine((suggestion) => (suggestion.kind === 'FACT_QUESTION') === (suggestion.question !== null), {
    message: 'question é obrigatória em FACT_QUESTION e deve ser nula em EMPHASIS',
    path: ['question'],
  });

/** O schema nasce por chamada: `recommendedResumeId` só pode ser um dos currículos enviados. */
export const buildAnalyzeFitSchema = (resumeIds: [string, ...string[]]) =>
  z.object({
    recommendedResumeId: z.enum(resumeIds),
    reason: str(600),
    requirements: z
      .array(
        z.object({
          requirement: str(300),
          status: z.enum(['tem', 'parcial', 'nao_tem']),
          evidence: str(300).nullable(),
        }),
      )
      .max(40),
    attentionPoints: z.array(z.object({ requirement: str(300), advice: str(500) })).max(20),
    suggestions: z.array(suggestionSchema).max(20),
  });

export type FitAnalysis = z.infer<ReturnType<typeof buildAnalyzeFitSchema>>;
