import type { ExtractedJob } from '@/modules/ai/schemas/extract-job.schema';
import { JobResponseDto, JobSummaryDto } from './job-response.dto';

const extracted: ExtractedJob = {
  title: 'Dev Backend',
  company: 'Acme',
  contactEmail: 'rh@acme.com',
  stacks: ['Node.js', 'Docker'],
  requirements: ['APIs REST'],
  niceToHave: ['AWS'],
  seniority: 'Pleno',
  contractModel: 'CLT',
};
const createdAt = new Date('2026-10-23T12:00:00Z');
// O que o Prisma poderia devolver além do que o app expõe.
const row = {
  id: 'j1',
  title: 'Dev Backend',
  company: 'Acme',
  contactEmail: 'rh@acme.com',
  extracted,
  createdAt,
  userId: 'u1',
  rawText: 'TEXTO BRUTO GRANDE QUE O USUÁRIO ENVIOU',
};

describe('saída de vagas (dados enxutos)', () => {
  it('JobResponseDto achata a vaga extraída e expõe só os campos públicos', () => {
    const dto = JobResponseDto.from(row);

    expect(dto).toEqual({
      id: 'j1',
      title: 'Dev Backend',
      company: 'Acme',
      createdAt,
      contactEmail: 'rh@acme.com',
      stacks: ['Node.js', 'Docker'],
      requirements: ['APIs REST'],
      niceToHave: ['AWS'],
      seniority: 'Pleno',
      contractModel: 'CLT',
    });
    expect(JSON.stringify(dto)).not.toMatch(/userId|rawText|TEXTO BRUTO|extracted/);
  });

  it('JobSummaryDto (listagem) traz só o necessário para escolher a vaga', () => {
    expect(JobSummaryDto.from(row)).toEqual({ id: 'j1', title: 'Dev Backend', company: 'Acme', createdAt });
    expect(Object.keys(JobSummaryDto.from(row))).toHaveLength(4);
  });
});
