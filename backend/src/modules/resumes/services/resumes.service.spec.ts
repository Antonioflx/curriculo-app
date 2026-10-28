import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ResumeKind } from '@/common/enums';
import { AiService } from '@/modules/ai/services/ai.service';
import { TagsService } from '@/modules/tags/services/tags.service';
import { resumeContent } from '@test/fixtures/resume-content';
import { COPY_SUFFIX, MAX_BASE_RESUMES_PER_USER, RESUME_TITLE_MAX } from '../constants/resume.constants';
import { CreateResumeDto } from '../dto/input/create-resume.dto';
import { ReviseResumeDto } from '../dto/input/revise-resume.dto';
import { UpdateResumeDto } from '../dto/input/update-resume.dto';
import { ResumesRepository } from '../repositories/resumes.repository';
import { ResumesService } from './resumes.service';

describe('ResumesService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    countBase: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tags = { assertOwned: jest.fn() };
  const ai = { reviseResume: jest.fn(), extractResume: jest.fn() };
  const service = new ResumesService(
    repository as unknown as ResumesRepository,
    tags as unknown as TagsService,
    ai as unknown as AiService,
  );

  const createDto = (extra: object = {}) =>
    ({ title: 'Backend', content: resumeContent, ...extra }) as unknown as CreateResumeDto;
  const updateDto = (extra: object) => extra as UpdateResumeDto;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.countBase.mockResolvedValue(0);
    tags.assertOwned.mockImplementation((_userId: string, ids: string[]) => Promise.resolve(ids));
  });

  describe('create', () => {
    it('valida as tags do usuário e grava com os ids únicos', async () => {
      tags.assertOwned.mockResolvedValue(['t1']);
      await service.create('u1', createDto({ tagIds: ['t1', 't1'] }));

      expect(tags.assertOwned).toHaveBeenCalledWith('u1', ['t1', 't1']);
      expect(repository.create).toHaveBeenCalledWith('u1', {
        title: 'Backend',
        content: resumeContent,
        tagIds: ['t1'],
      });
    });

    it('sem tagIds cria sem tags', async () => {
      await service.create('u1', createDto());
      expect(repository.create).toHaveBeenCalledWith('u1', expect.objectContaining({ tagIds: [] }));
    });

    it('recusa quando atinge o teto de currículos base', async () => {
      repository.countBase.mockResolvedValue(MAX_BASE_RESUMES_PER_USER);
      await expect(service.create('u1', createDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propaga o 404 de tag alheia sem criar nada', async () => {
      tags.assertOwned.mockRejectedValue(new NotFoundException());
      await expect(service.create('u1', createDto({ tagIds: ['x'] }))).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('devolve o currículo do usuário', async () => {
      repository.findById.mockResolvedValue({ id: 'r1' });
      await expect(service.get('u1', 'r1')).resolves.toEqual({ id: 'r1' });
      expect(repository.findById).toHaveBeenCalledWith('u1', 'r1');
    });

    it('404 quando não existe ou é de outro usuário', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.get('u1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('sem tagIds não consulta o currículo nem as tags', async () => {
      await service.update('u1', 'r1', updateDto({ title: 'Novo' }));
      expect(repository.findById).not.toHaveBeenCalled();
      expect(tags.assertOwned).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('u1', 'r1', {
        title: 'Novo',
        content: undefined,
        tagIds: undefined,
      });
    });

    it('troca as tags de um currículo base depois de validá-las', async () => {
      repository.findById.mockResolvedValue({ id: 'r1', kind: ResumeKind.BASE });
      await service.update('u1', 'r1', updateDto({ tagIds: ['t2'] }));
      expect(tags.assertOwned).toHaveBeenCalledWith('u1', ['t2']);
      expect(repository.update).toHaveBeenCalledWith('u1', 'r1', expect.objectContaining({ tagIds: ['t2'] }));
    });

    it('recusa tags em currículo ajustado', async () => {
      repository.findById.mockResolvedValue({ id: 'r1', kind: ResumeKind.ADJUSTED });
      await expect(service.update('u1', 'r1', updateDto({ tagIds: ['t2'] }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('duplicate', () => {
    const source = {
      id: 'r1',
      title: 'Backend',
      content: resumeContent,
      tags: [{ tag: { id: 't1', name: 'backend' } }],
    };

    it('copia conteúdo e tags com o sufixo no título', async () => {
      repository.findById.mockResolvedValue(source);
      await service.duplicate('u1', 'r1');
      expect(repository.create).toHaveBeenCalledWith('u1', {
        title: `Backend${COPY_SUFFIX}`,
        content: resumeContent,
        tagIds: ['t1'],
      });
    });

    it('trunca o título para caber no limite', async () => {
      repository.findById.mockResolvedValue({ ...source, title: 'x'.repeat(RESUME_TITLE_MAX) });
      await service.duplicate('u1', 'r1');
      const { title } = repository.create.mock.calls[0][1];
      expect(title).toHaveLength(RESUME_TITLE_MAX);
      expect(title.endsWith(COPY_SUFFIX)).toBe(true);
    });

    it('respeita o teto de currículos', async () => {
      repository.findById.mockResolvedValue(source);
      repository.countBase.mockResolvedValue(MAX_BASE_RESUMES_PER_USER);
      await expect(service.duplicate('u1', 'r1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('importFile', () => {
    const pdfFile = { mimeType: 'application/pdf', data: Buffer.from('%PDF-1.7 conteudo') };
    const htmlFile = {
      mimeType: 'text/html',
      data: Buffer.from('<html><body><p>Antonio</p><strong>40%</strong></body></html>'),
    };

    beforeEach(() => ai.extractResume.mockResolvedValue({ data: resumeContent, usage: {} }));

    it('PDF vai à IA como documento e devolve o content, sem salvar', async () => {
      const content = await service.importFile({ file: pdfFile });

      expect(ai.extractResume).toHaveBeenCalledWith({ document: pdfFile });
      expect(content).toBe(resumeContent);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('HTML vai à IA como texto limpo', async () => {
      await service.importFile({ file: htmlFile });
      expect(ai.extractResume).toHaveBeenCalledWith({ text: 'Antonio\n**40%**' });
    });

    it('se a IA falha, o erro sobe', async () => {
      ai.extractResume.mockRejectedValue(new Error('IA fora'));
      await expect(service.importFile({ file: pdfFile })).rejects.toThrow('IA fora');
    });
  });

  describe('revise', () => {
    const current = { id: 'r1', content: resumeContent, tags: [] };
    const dto = { instruction: 'Encurta o resumo' } as ReviseResumeDto;
    const revised = { ...resumeContent, summary: 'Resumo curto' };

    it('manda à IA o currículo atual e o pedido, e grava o content devolvido', async () => {
      repository.findById.mockResolvedValue(current);
      ai.reviseResume.mockResolvedValue({ data: revised, usage: { model: 'm', inputTokens: 1, outputTokens: 1 } });
      repository.update.mockResolvedValue({ ...current, content: revised });

      const result = await service.revise('u1', 'r1', dto);

      expect(ai.reviseResume).toHaveBeenCalledWith({ content: resumeContent, instruction: 'Encurta o resumo' });
      expect(repository.update).toHaveBeenCalledWith('u1', 'r1', { content: revised });
      expect(result.content).toEqual(revised);
    });

    it('currículo de outro usuário dá 404 antes de gastar IA', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.revise('u1', 'r1', dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findById).toHaveBeenCalledWith('u1', 'r1');
      expect(ai.reviseResume).not.toHaveBeenCalled();
    });

    it('content inválido no banco dá 422 antes de gastar IA', async () => {
      repository.findById.mockResolvedValue({ ...current, content: { header: 'x' } });

      await expect(service.revise('u1', 'r1', dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(ai.reviseResume).not.toHaveBeenCalled();
    });

    it('se a IA falha, nada é gravado', async () => {
      repository.findById.mockResolvedValue(current);
      ai.reviseResume.mockRejectedValue(new Error('IA fora'));

      await expect(service.revise('u1', 'r1', dto)).rejects.toThrow('IA fora');
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  it('remove delega ao repository com o userId', async () => {
    await service.remove('u1', 'r1');
    expect(repository.delete).toHaveBeenCalledWith('u1', 'r1');
  });
});
