import { NestExpressApplication } from '@nestjs/platform-express';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import { PrismaService } from '@/prisma/prisma.service';
import { resumeContent } from '@test/fixtures/resume-content';
import { api, cleanupUsers, createTestApp, signUp } from '@test/helpers/e2e';

const usage = { model: 'modelo-teste', inputTokens: 10, outputTokens: 20 };
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32, 0x20)]);
const html = (text = 'Antonio, Dev Backend') =>
  Buffer.from(`<html><head><style>p{}</style></head><body><script>x()</script><p>${text}</p><b>40%</b></body></html>`);
const PDF = { filename: 'cv.pdf', contentType: 'application/pdf' };

describe('Importar currículo (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ai: Awaited<ReturnType<typeof createTestApp>>['ai'];
  // Usuário novo a cada teste: o limite de IA (10/min) conta toda requisição, até as recusadas.
  let ana: ReturnType<typeof api>;

  beforeAll(async () => {
    ({ app, prisma, ai } = await createTestApp());
  });

  afterAll(() => cleanupUsers(app, prisma));

  beforeEach(async () => {
    ai.extractResume.mockReset();
    ai.extractResume.mockResolvedValue({ data: resumeContent, usage });
    ana = api(app, (await signUp(app)).cookie);
  });

  const aiInput = () => ai.extractResume.mock.calls[0][0] as { text?: string; document?: { mimeType: string } };

  it('exige login', async () => {
    await api(app).post('/api/resumes/import').attach('file', pdf(), PDF).expect(401);
    expect(ai.extractResume).not.toHaveBeenCalled();
  });

  it('PDF vai inteiro para a IA e o content volta como rascunho, sem salvar nada', async () => {
    const res = await ana.post('/api/resumes/import').attach('file', pdf(), PDF).expect(201);

    expect(aiInput().document?.mimeType).toBe('application/pdf');
    expect(aiInput().text).toBeUndefined();
    expect(res.body).toEqual({ content: resumeContent });
    expect((await ana.get('/api/resumes').expect(200)).body).toEqual([]);
  });

  it('HTML vira texto limpo (sem script nem estilo) antes de ir para a IA', async () => {
    await ana
      .post('/api/resumes/import')
      .attach('file', html(), { filename: 'cv.html', contentType: 'text/html' })
      .expect(201);

    expect(aiInput().text).toBe('Antonio, Dev Backend\n**40%**');
    expect(aiInput().document).toBeUndefined();
  });

  it.each([
    ['tipo não permitido', Buffer.from('texto'), 'text/plain'],
    ['PDF falso', html(), 'application/pdf'],
    ['HTML sem texto', Buffer.from('<div><script>x()</script></div>'), 'text/html'],
    ['HTML com texto demais', html('x'.repeat(INPUT_LIMITS.resumeText + 1)), 'text/html'],
  ])('recusa %s (400) sem chamar a IA', async (_name, data, contentType) => {
    await ana.post('/api/resumes/import').attach('file', data, { filename: 'cv', contentType }).expect(400);
    expect(ai.extractResume).not.toHaveBeenCalled();
  });

  it('recusa a requisição sem arquivo (400)', async () => {
    await ana.post('/api/resumes/import').field('outro', '1').expect(400);
    expect(ai.extractResume).not.toHaveBeenCalled();
  });

  it('arquivo acima de 5 MB é recusado antes de chegar ao service', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(INPUT_LIMITS.resumeFileBytes)]);
    const res = await ana.post('/api/resumes/import').attach('file', big, PDF);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(ai.extractResume).not.toHaveBeenCalled();
  });

  it('limita as chamadas de IA por minuto (429)', async () => {
    for (let i = 0; i < 10; i++) await ana.post('/api/resumes/import').attach('file', pdf(), PDF);
    await ana.post('/api/resumes/import').attach('file', pdf(), PDF).expect(429);
  });
});
