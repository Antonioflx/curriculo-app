import { z } from 'zod';
import { str } from './helpers';

export const emailSchema = z.object({ subject: str(150), body: str(3000) });
export type GeneratedEmail = z.infer<typeof emailSchema>;

export const answerSchema = z.object({ answer: str(5000) });
export type GeneratedAnswer = z.infer<typeof answerSchema>;
