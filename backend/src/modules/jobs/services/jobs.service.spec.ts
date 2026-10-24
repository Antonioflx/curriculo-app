import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AiService } from '@/modules/ai/services/ai.service';
import type { ExtractedJob } from '@/modules/ai/schemas/extract-job.schema';
import { MAX_JOBS_PER_USER } from '../constants/job.constants';
import type { CreateJobDto } from '../dto/input/create-job.dto';
import type { JobsRepository } from '../repositories/jobs.repository';
import { JobsService } from './jobs.service';

const extracted: ExtractedJob = {
  title: 'Dev Backend',
  company: 'Acme',
  contactEmail: 'rh@acme.com',
  stacks: ['Node.js'],
  requirements: ['APIs REST'],
  niceToHave: ['AWS'],
  seniority: 'Pleno',
  contractModel: 'CLT',
};
const image = { mimeType: 'image/png', data: Buffer.from('imagem') };

describe('JobsService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const ai = { extractJob: jest.fn() };
  const service = new JobsService(repository as unknown as JobsRepository, ai as unknown as AiService);

  beforeEach(() => {
    jest.resetAllMocks();
    repository.count.mockResolvedValue(0);
    ai.extractJob.mockResolvedValue({ data: extracted, usage: { model: 'm', inputTokens: 1, outputTokens: 1 } });
    repository.create.mockImplementation((_userId: string, data: unknown) =>
      Promise.resolve({ id: 'j1', ...(data as object) }),
    );
  });

  describe('create', () => {
    it('manda à IA exatamente o que o DTO validou (texto e imagem)', async () => {
      await service.create('u1', { text: 'Vaga de Dev', image } as CreateJobDto);
      expect(ai.extractJob).toHaveBeenCalledWith({ text: 'Vaga de Dev', image });
    });

    it('grava o texto enviado e os campos extraídos; a imagem nunca é gravada', async () => {
      await service.create('u1', { text: 'Vaga de Dev', image } as CreateJobDto);

      expect(repository.create).toHaveBeenCalledWith('u1', {
        rawText: 'Vaga de Dev',
        title: 'Dev Backend',
        company: 'Acme',
        contactEmail: 'rh@acme.com',
        extracted,
      });
      expect(JSON.stringify(repository.create.mock.calls)).not.toContain('imagem');
    });

    it('vaga só por imagem não grava texto bruto', async () => {
      await service.create('u1', { image } as CreateJobDto);
      expect(repository.create.mock.calls[0][1].rawText).toBeUndefined();
    });

    it('no teto de vagas recusa ANTES de gastar IA', async () => {
      repository.count.mockResolvedValue(MAX_JOBS_PER_USER);

      await expect(service.create('u1', { text: 'Vaga' } as CreateJobDto)).rejects.toBeInstanceOf(BadRequestException);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it('se a IA falha, nada é gravado', async () => {
      ai.extractJob.mockRejectedValue(new Error('IA fora'));

      await expect(service.create('u1', { text: 'Vaga' } as CreateJobDto)).rejects.toThrow('IA fora');
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  it('list e get consultam só as vagas do usuário', async () => {
    repository.findById.mockResolvedValue({ id: 'j1' });
    await service.list('u1');
    await expect(service.get('u1', 'j1')).resolves.toEqual({ id: 'j1' });

    expect(repository.findAll).toHaveBeenCalledWith('u1');
    expect(repository.findById).toHaveBeenCalledWith('u1', 'j1');
  });

  it('get devolve 404 quando a vaga não existe ou é de outro usuário', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.get('u1', 'j1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove delega ao repository com o userId', async () => {
    await service.remove('u1', 'j1');
    expect(repository.delete).toHaveBeenCalledWith('u1', 'j1');
  });
});
