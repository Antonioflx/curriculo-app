import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '@/prisma/prisma.service';
import { resumeContent } from '@test/fixtures/resume-content';
import { api, cleanupUsers, createTestApp, signUp } from '@test/helpers/e2e';

/** Currículo no limite máximo permitido pelos DTOs (vários bullets de 400 caracteres). */
const maxResumeContent = () => ({
  ...resumeContent,
  experiences: Array.from({ length: 20 }, () => ({
    company: 'Acme',
    role: 'Dev',
    start: '2020-01',
    end: null,
    context: 'x'.repeat(500),
    bullets: Array(15).fill('x'.repeat(400)),
  })),
});

describe('Limites e entradas inválidas (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ana: ReturnType<typeof api>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ana = api(app, (await signUp(app)).cookie);
  });

  afterAll(() => cleanupUsers(app, prisma));

  it('corpo acima do teto dá 413 (não 500)', async () => {
    const res = await ana
      .post('/api/tags')
      .send({ name: 'x'.repeat(300_000) })
      .expect(413);
    expect(res.body.message).toBe('Corpo da requisição muito grande');
    // O contexto da requisição abre antes do parser de body: até este erro sai com requestId.
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(res.body.requestId).toBeDefined();
  });

  it('JSON malformado dá 400', async () => {
    await ana.post('/api/tags').set('Content-Type', 'application/json').send('{"name": ').expect(400);
  });

  it('um currículo no limite máximo dos DTOs cabe no teto do corpo', async () => {
    await ana.post('/api/resumes').send({ title: 'Máximo', content: maxResumeContent() }).expect(201);
  });

  describe('PATCH com null em campo obrigatório', () => {
    it.each([{ title: null }, { content: null }])('%p dá 400 (não 500)', async (body) => {
      const created = await ana.post('/api/resumes').send({ title: 'x', content: resumeContent }).expect(201);
      await ana.patch(`/api/resumes/${created.body.id}`).send(body).expect(400);
    });
  });
});
