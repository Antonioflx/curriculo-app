import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { omit, resumeContent } from '@test/fixtures/resume-content';
import { api, cleanupUsers, createTestApp, signUp } from '@test/helpers/e2e';

describe('Tags e Resumes (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ana: ReturnType<typeof api>;
  let bruno: ReturnType<typeof api>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ana = api(app, (await signUp(app)).cookie);
    bruno = api(app, (await signUp(app)).cookie);
  });

  afterAll(() => cleanupUsers(app, prisma));

  const createTag = async (client: ReturnType<typeof api>, name: string) =>
    (await client.post('/api/tags').send({ name }).expect(201)).body as { id: string; name: string };

  const createResume = async (client: ReturnType<typeof api>, extra: object = {}) =>
    (
      await client
        .post('/api/resumes')
        .send({ title: 'Backend', content: resumeContent, ...extra })
        .expect(201)
    ).body as { id: string; title: string; tags: { id: string }[] };

  it('exige login em todas as rotas', async () => {
    const anonymous = api(app);
    await anonymous.get('/api/tags').expect(401);
    await anonymous.get('/api/resumes').expect(401);
    await anonymous.post('/api/resumes').send({}).expect(401);
  });

  describe('tags', () => {
    it('normaliza o nome, recusa duplicada e lista só as do usuário', async () => {
      const tag = await createTag(ana, '  Backend  ');
      expect(tag.name).toBe('backend');

      await ana.post('/api/tags').send({ name: 'BACKEND' }).expect(409);
      await bruno.post('/api/tags').send({ name: 'backend' }).expect(201);

      const list = await ana.get('/api/tags').expect(200);
      expect(list.body.map((t: { name: string }) => t.name)).toEqual(['backend']);
    });

    it('renomeia e exclui; tag de outro usuário dá 404', async () => {
      const tag = await createTag(ana, 'llm');
      await bruno.patch(`/api/tags/${tag.id}`).send({ name: 'x' }).expect(404);
      await bruno.delete(`/api/tags/${tag.id}`).expect(404);

      const renamed = await ana.patch(`/api/tags/${tag.id}`).send({ name: 'ia' }).expect(200);
      expect(renamed.body.name).toBe('ia');
      await ana.delete(`/api/tags/${tag.id}`).expect(204);
      await ana.delete(`/api/tags/${tag.id}`).expect(404);
    });

    it('id malformado dá 400 e nome vazio dá 400', async () => {
      await ana.delete('/api/tags/nao-e-uuid').expect(400);
      await ana.post('/api/tags').send({ name: '   ' }).expect(400);
    });
  });

  describe('resumes', () => {
    it('cria com tags, devolve o conteúdo e a listagem vem sem ele', async () => {
      const tag = await createTag(ana, 'fullstack');
      const resume = await createResume(ana, { title: 'Fullstack', tagIds: [tag.id] });
      expect(resume.tags).toEqual([{ id: tag.id, name: 'fullstack' }]);

      const full = await ana.get(`/api/resumes/${resume.id}`).expect(200);
      expect(full.body.content.header.name).toBe('Ana Teste');
      expect(full.body.kind).toBe('BASE');

      const list = await ana.get(`/api/resumes?tagId=${tag.id}`).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].id).toBe(resume.id);
      expect(list.body[0]).not.toHaveProperty('content');
    });

    it('valida o content: campo extra, link inválido e seção ausente dão 400', async () => {
      const send = (content: object) => ana.post('/api/resumes').send({ title: 'x', content });
      await send({ ...resumeContent, extra: 1 }).expect(400);
      await send({
        ...resumeContent,
        header: { ...resumeContent.header, links: [{ label: 'a', url: 'javascript:1' }] },
      }).expect(400);
      const withoutSummary = omit(resumeContent, 'summary');
      await send(withoutSummary).expect(400);
    });

    it('currículo de outro usuário dá 404 em leitura, edição, duplicação e exclusão', async () => {
      const resume = await createResume(ana);
      await bruno.get(`/api/resumes/${resume.id}`).expect(404);
      await bruno.patch(`/api/resumes/${resume.id}`).send({ title: 'invadido' }).expect(404);
      await bruno.post(`/api/resumes/${resume.id}/duplicate`).expect(404);
      await bruno.delete(`/api/resumes/${resume.id}`).expect(404);

      const untouched = await ana.get(`/api/resumes/${resume.id}`).expect(200);
      expect(untouched.body.title).toBe('Backend');
    });

    it('não aceita tag de outro usuário nem tag inexistente', async () => {
      const brunoTag = await createTag(bruno, 'segredo');
      await ana
        .post('/api/resumes')
        .send({ title: 'x', content: resumeContent, tagIds: [brunoTag.id] })
        .expect(404);
      await ana
        .post('/api/resumes')
        .send({ title: 'x', content: resumeContent, tagIds: [randomUUID()] })
        .expect(404);

      const resume = await createResume(ana);
      await ana
        .patch(`/api/resumes/${resume.id}`)
        .send({ tagIds: [brunoTag.id] })
        .expect(404);
    });

    it('edita título e substitui as tags numa só chamada', async () => {
      const [a, b] = [await createTag(ana, 'tag-a'), await createTag(ana, 'tag-b')];
      const resume = await createResume(ana, { tagIds: [a.id] });

      const updated = await ana
        .patch(`/api/resumes/${resume.id}`)
        .send({ title: 'Novo', tagIds: [b.id] })
        .expect(200);
      expect(updated.body.title).toBe('Novo');
      expect(updated.body.tags).toEqual([{ id: b.id, name: 'tag-b' }]);
    });

    it('duplica como base, com as mesmas tags e sufixo no título', async () => {
      const tag = await createTag(ana, 'para-copiar');
      const resume = await createResume(ana, { title: 'Original', tagIds: [tag.id] });

      const copy = await ana.post(`/api/resumes/${resume.id}/duplicate`).expect(201);
      expect(copy.body.id).not.toBe(resume.id);
      expect(copy.body.title).toBe('Original (cópia)');
      expect(copy.body.kind).toBe('BASE');
      expect(copy.body.tags).toEqual([{ id: tag.id, name: 'para-copiar' }]);
    });

    it('exclui e depois dá 404; id malformado dá 400', async () => {
      const resume = await createResume(ana);
      await ana.delete(`/api/resumes/${resume.id}`).expect(204);
      await ana.get(`/api/resumes/${resume.id}`).expect(404);
      await ana.get('/api/resumes/nao-e-uuid').expect(400);
    });
  });
});
