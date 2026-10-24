import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { AiService } from '@/modules/ai/services/ai.service';
import { PrismaService } from '@/prisma/prisma.service';

export const WEB_ORIGIN = 'http://localhost:3000';

const createdEmails: string[] = [];
const randomOctet = () => Math.floor(Math.random() * 255);

/**
 * IA simulada: nenhum e2e chama Gemini/Groq de verdade (custo, cota e resultado instável).
 * Cada teste configura a tarefa de que precisa (`ai.extractJob.mockResolvedValue(...)`); sem configurar, a
 * tarefa falha alto em vez de devolver `undefined` e esconder um erro.
 */
export type AiTaskMock = jest.Mock<Promise<unknown>, [input: Record<string, unknown>]>;

export function createFakeAi() {
  const task = (name: string): AiTaskMock =>
    jest.fn((_input: Record<string, unknown>) => Promise.reject(new Error(`IA simulada: configure ${name} no teste`)));
  return {
    extractJob: task('extractJob'),
    analyzeFit: task('analyzeFit'),
    buildAdjusted: task('buildAdjusted'),
    reviseResume: task('reviseResume'),
    writeEmail: task('writeEmail'),
    answerQuestion: task('answerQuestion'),
  };
}

export async function createTestApp() {
  const ai = createFakeAi();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AiService)
    .useValue(ai)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), ai };
}

/** Remove os usuários criados pelo arquivo de teste (sessões, tags e currículos saem em cascata). */
export async function cleanupUsers(app: NestExpressApplication, prisma: PrismaService) {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
}

export const newEmail = () => {
  const email = `e2e-${randomUUID()}@test.local`;
  createdEmails.push(email);
  return email;
};

/** Cookies Secure não voltam em HTTP no cookie jar do supertest; repassa-se o header à mão. */
export const cookieHeader = (res: request.Response, ...names: string[]) => {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return names.map((name) => setCookie.find((c) => c.startsWith(`${name}=`))!.split(';')[0]).join('; ');
};

/**
 * Cliente HTTP de teste: já envia a Origin do web e um IP próprio por requisição
 * (o limite por IP não vaza entre testes). Com `cookie`, age como usuário logado.
 */
export function api(app: NestExpressApplication, cookie?: string) {
  const prepare = (req: request.Test) => {
    req.set('Origin', WEB_ORIGIN).set('X-Forwarded-For', `10.${randomOctet()}.${randomOctet()}.${randomOctet()}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const server = app.getHttpServer();
  return {
    get: (path: string) => prepare(request(server).get(path)),
    post: (path: string) => prepare(request(server).post(path)),
    patch: (path: string) => prepare(request(server).patch(path)),
    delete: (path: string) => prepare(request(server).delete(path)),
  };
}

/** Cadastra um usuário novo e devolve o cookie de sessão para usar em `api(app, cookie)`. */
export async function signUp(app: NestExpressApplication) {
  const res = await api(app)
    .post('/api/auth/register')
    .send({ name: 'Ana Teste', email: newEmail(), password: 'Segredo!2026' })
    .expect(201);
  return { cookie: cookieHeader(res, 'session_token'), userId: res.body.user.id as string };
}
