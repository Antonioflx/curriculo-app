import { z } from 'zod';
import { str, strList } from './helpers';

export const extractJobSchema = z.object({
  title: str(150),
  company: str(150).nullable(),
  contactEmail: z.email().max(254).nullable(),
  stacks: strList(30, 60),
  requirements: strList(40, 300),
  niceToHave: strList(40, 300),
  seniority: str(60).nullable(),
  contractModel: str(60).nullable(),
});

export type ExtractedJob = z.infer<typeof extractJobSchema>;
