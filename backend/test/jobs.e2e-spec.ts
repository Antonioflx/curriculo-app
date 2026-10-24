import { ServiceUnavailableException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { INPUT_LIMITS } from '@/common/constants/input-limits';
import type { UploadedImage } from '@/common/types/uploaded-image';
import { PrismaService } from '@/prisma/prisma.service';
import { api, cleanupUsers, createTestApp, signUp } from '@test/helpers/e2e';

const extracted = {
  title: 'Desenvolvedor Backend Pleno',
  company: 'Acme',
  contactEmail: 'talentos@acme.com',
  stacks: ['Node.js', 'PostgreSQL'],
  requirements: ['3+ anos com APIs REST'],
  niceToHave: ['AWS'],
  seniority: 'Pleno',
  contractModel: 'CLT',
};
const usage = { model: 'modelo-teste', inputTokens: 10, outputTokens: 20 };
const jpeg = (size = 64) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

describe('Vagas (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ai: Awaited<ReturnType<typeof createTestApp>>['ai'];
  // Usuários novos a cada teste: o limite de IA (10/min) conta toda requisição, até as recusadas na validação.
  let ana: ReturnType<typeof api>;
  let bruno: ReturnType<typeof api>;

  beforeAll(async () => {
    ({ app, prisma, ai } = await createTestApp());
  });

  afterAll(() => cleanupUsers(app, prisma));

  beforeEach(async () => {
    ai.extractJob.mockReset();
    ai.extractJob.mockResolvedValue({ data: extracted, usage });
    ana = api(app, (await signUp(app)).cookie);
    bruno = api(app, (await signUp(app)).cookie);
  });

  /** O que a IA recebeu na primeira chamada. */
  const aiInput = () => ai.extractJob.mock.calls[0][0] as { text?: string; image?: UploadedImage };

  const createJob = async (client = ana) =>
    (await client.post('/api/jobs').send({ text: 'Vaga de Dev Backend' }).expect(201)).body as { id: string };

  it('exige login', async () => {
    await api(app).post('/api/jobs').send({ text: 'x' }).expect(401);
    await api(app).get('/api/jobs').expect(401);
    expect(ai.extractJob).not.toHaveBeenCalled();
  });

  describe('entrada validada no DTO', () => {
    it('JSON só com texto: aparado, enviado à IA e devolvido num formato enxuto', async () => {
      const res = await ana.post('/api/jobs').send({ text: '  Vaga de Dev Backend  ' }).expect(201);

      expect(aiInput()).toEqual({ text: 'Vaga de Dev Backend', image: undefined });
      expect(res.body).toEqual({
        id: expect.any(String),
        title: 'Desenvolvedor Backend Pleno',
        company: 'Acme',
        createdAt: expect.any(String),
        contactEmail: 'talentos@acme.com',
        stacks: ['Node.js', 'PostgreSQL'],
        requirements: ['3+ anos com APIs REST'],
        niceToHave: ['AWS'],
        seniority: 'Pleno',
        contractModel: 'CLT',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/rawText|userId|extracted/);
    });

    it('multipart com texto e imagem: a IA recebe a imagem como tipo + conteúdo, e só o texto é gravado', async () => {
      const bytes = jpeg();
      const res = await ana
        .post('/api/jobs')
        .field('text', 'Vaga de Dev')
        .attach('image', bytes, { filename: 'vaga.jpg', contentType: 'image/jpeg' })
        .expect(201);

      expect(aiInput().text).toBe('Vaga de Dev');
      expect(aiInput().image?.mimeType).toBe('image/jpeg');
      expect(Buffer.from(aiInput().image?.data ?? []).equals(bytes)).toBe(true);

      const stored = await prisma.jobPosting.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.rawText).toBe('Vaga de Dev');
    });

    it('multipart só com a imagem (o formulário manda text="") é aceito', async () => {
      await ana
        .post('/api/jobs')
        .field('text', '')
        .attach('image', png(), { filename: 'vaga.png', contentType: 'image/png' })
        .expect(201);

      expect(aiInput().text).toBeUndefined();
      expect(aiInput().image?.mimeType).toBe('image/png');
    });

    it.each([
      ['nada enviado', {}],
      ['texto em branco', { text: '   ' }],
    ])('recusa %s com a mensagem útil, sem chamar a IA', async (_name, body) => {
      const res = await ana.post('/api/jobs').send(body).expect(400);
      expect(res.body.message).toContain('Envie o texto ou a imagem da vaga');
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it('recusa texto acima do limite, texto que não é texto e campo desconhecido', async () => {
      await ana
        .post('/api/jobs')
        .send({ text: 'x'.repeat(INPUT_LIMITS.jobText + 1) })
        .expect(400);
      await ana
        .post('/api/jobs')
        .send({ text: { $gt: '' } })
        .expect(400);
      await ana.post('/api/jobs').send({ text: 'Vaga', userId: 'outro-usuario' }).expect(400);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it.each([
      ['tipo não permitido (gif)', 'image/gif', jpeg()],
      ['conteúdo que não bate com o tipo declarado', 'image/png', jpeg()],
      ['arquivo de texto disfarçado de imagem', 'image/jpeg', Buffer.from('<script>alert(1)</script>')],
    ])('recusa imagem com %s, sem chamar a IA', async (_name, contentType, bytes) => {
      await ana.post('/api/jobs').attach('image', bytes, { filename: 'vaga.jpg', contentType }).expect(400);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it('recusa imagem acima de 5 MB, sem chamar a IA', async () => {
      const big = jpeg(INPUT_LIMITS.imageBytes);

      // Ao estourar o limite o servidor responde 413 e corta o envio: o cliente pode ver o 413 ou a conexão fechada.
      const outcome = await ana
        .post('/api/jobs')
        .attach('image', big, { filename: 'vaga.jpg', contentType: 'image/jpeg' })
        .then(
          (res) => res.status,
          (error: { code?: string; status?: number }) => error.status ?? error.code,
        );

      expect([413, 'ECONNRESET', 'EPIPE']).toContain(outcome);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });

    it('imagem forjada por JSON ou por campo de texto é recusada: só o upload de verdade vira imagem', async () => {
      const forged = { mimeType: 'image/png', data: { type: 'Buffer', data: [137, 80, 78, 71, 13, 10, 26, 10] } };
      await ana.post('/api/jobs').send({ image: forged }).expect(400);
      await ana.post('/api/jobs').field('image', 'data:image/png;base64,AAAA').expect(400);
      expect(ai.extractJob).not.toHaveBeenCalled();
    });
  });

  describe('IA indisponível ou lenta demais', () => {
    it('devolve 503 com a mensagem útil, não grava a vaga e deixa o usuário tentar de novo', async () => {
      ai.extractJob.mockRejectedValue(new ServiceUnavailableException('IA indisponível no momento'));

      const res = await ana.post('/api/jobs').send({ text: 'Vaga' }).expect(503);

      expect(res.body.message).toBe('IA indisponível no momento');
      expect((await ana.get('/api/jobs').expect(200)).body).toEqual([]);
    });

    it('limita as chamadas de IA por usuário (429) e as outras contas não são afetadas', async () => {
      for (let i = 0; i < 10; i++) await ana.post('/api/jobs').send({ text: 'Vaga' }).expect(201);
      await ana.post('/api/jobs').send({ text: 'Vaga' }).expect(429);
      await bruno.post('/api/jobs').send({ text: 'Vaga' }).expect(201);
    });
  });

  describe('leitura e exclusão', () => {
    it('lista com dados mínimos, abre a vaga completa e exclui', async () => {
      const { id } = await createJob();

      const list = (await ana.get('/api/jobs').expect(200)).body as object[];
      expect(list).toEqual([
        { id, title: 'Desenvolvedor Backend Pleno', company: 'Acme', createdAt: expect.any(String) },
      ]);

      const one = await ana.get(`/api/jobs/${id}`).expect(200);
      expect(one.body.stacks).toEqual(['Node.js', 'PostgreSQL']);

      await ana.delete(`/api/jobs/${id}`).expect(204);
      await ana.get(`/api/jobs/${id}`).expect(404);
    });

    it('vaga de outro usuário dá 404 em leitura e exclusão, e some da listagem dele', async () => {
      const { id } = await createJob(ana);

      await bruno.get(`/api/jobs/${id}`).expect(404);
      await bruno.delete(`/api/jobs/${id}`).expect(404);
      expect((await bruno.get('/api/jobs').expect(200)).body).toEqual([]);
      await ana.get(`/api/jobs/${id}`).expect(200);
    });

    it('id malformado dá 400', async () => {
      await ana.get('/api/jobs/nao-e-uuid').expect(400);
      await ana.delete('/api/jobs/nao-e-uuid').expect(400);
    });
  });
});
