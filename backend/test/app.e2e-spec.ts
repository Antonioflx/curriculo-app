import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { api, cleanupUsers, cookieHeader, createTestApp, newEmail } from '@test/helpers/e2e';

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const server = () => app.getHttpServer();
  const post = (path: string) => api(app).post(path);
  const register = (email = newEmail()) =>
    post('/api/auth/register').send({ name: 'Ana Teste', email, password: 'Segredo!2026' });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(() => cleanupUsers(app, prisma));

  describe('infra', () => {
    it('GET /api/health é público', async () => {
      const res = await request(server()).get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('rota inexistente devolve o formato padrão de erro, sem stack', async () => {
      const res = await request(server()).get('/api/nao-existe').expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.any(String),
        requestId: res.headers['x-request-id'],
      });
      expect(res.text).not.toContain('at ');
    });
  });

  describe('auth', () => {
    it('register seta os dois cookies com os atributos da doc de segurança e não vaza o hash', async () => {
      const res = await register().expect(201);

      expect(res.body.user).toEqual(expect.objectContaining({ name: 'Ana Teste' }));
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

      const [session, refresh] = [cookieHeader(res, 'session_token'), cookieHeader(res, 'refresh_token')];
      expect(session).toContain('session_token=');
      expect(refresh).toContain('refresh_token=');

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const sessionCookie = setCookie.find((c) => c.startsWith('session_token='))!;
      const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='))!;
      expect(sessionCookie).toMatch(/HttpOnly/);
      expect(sessionCookie).toMatch(/Secure/);
      expect(sessionCookie).toMatch(/SameSite=Lax/);
      expect(sessionCookie).toMatch(/Path=\/;/);
      expect(sessionCookie).toMatch(/Max-Age=900/);
      expect(refreshCookie).toMatch(/HttpOnly/);
      expect(refreshCookie).toMatch(/Secure/);
      expect(refreshCookie).toMatch(/SameSite=Strict/);
      expect(refreshCookie).toMatch(/Path=\/api\/auth\/refresh/);
      expect(refreshCookie).toMatch(/Max-Age=604800/);
    });

    it('guarda só o hash do refresh no banco', async () => {
      const email = newEmail();
      const res = await register(email).expect(201);
      const refreshValue = cookieHeader(res, 'refresh_token').split('=')[1];

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].refreshTokenHash).not.toBe(refreshValue);
      expect(sessions[0].refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejeita e-mail duplicado, senha comum e campos extras', async () => {
      const email = newEmail();
      await register(email).expect(201);
      await register(email).expect(409);

      await post('/api/auth/register').send({ name: 'Ana', email: newEmail(), password: 'password123' }).expect(400);

      await post('/api/auth/register')
        .send({ name: 'Ana', email: newEmail(), password: 'Segredo!2026', role: 'admin' })
        .expect(400);
    });

    it('bloqueia POST sem Origin (CSRF)', async () => {
      await request(server()).post('/api/auth/login').send({ email: 'a@a.com', password: 'Segredo!2026' }).expect(403);
    });

    it('login com erro devolve a mesma mensagem para e-mail inexistente e senha errada', async () => {
      const email = newEmail();
      await register(email).expect(201);

      const login = (body: object) => post('/api/auth/login').send(body);
      const wrongPassword = await login({ email, password: 'SenhaErrada!1' }).expect(401);
      const unknownEmail = await login({ email: newEmail(), password: 'SenhaErrada!1' }).expect(401);

      expect(wrongPassword.body.message).toBe('E-mail ou senha inválidos');
      expect(unknownEmail.body.message).toBe('E-mail ou senha inválidos');
    });

    it('/auth/me exige sessão e devolve o usuário logado', async () => {
      await request(server()).get('/api/auth/me').expect(401);

      const reg = await register().expect(201);
      const me = await request(server())
        .get('/api/auth/me')
        .set('Cookie', cookieHeader(reg, 'session_token'))
        .expect(200);
      expect(me.body.user.id).toBe(reg.body.user.id);
    });

    it('refresh rotaciona e o reuso do refresh antigo revoga a família inteira', async () => {
      const reg = await register().expect(201);
      const oldRefresh = cookieHeader(reg, 'refresh_token');

      const refreshed = await post('/api/auth/refresh').set('Cookie', oldRefresh).expect(204);
      const newSession = cookieHeader(refreshed, 'session_token');
      const newRefresh = cookieHeader(refreshed, 'refresh_token');
      expect(newRefresh).not.toBe(oldRefresh);

      await request(server()).get('/api/auth/me').set('Cookie', newSession).expect(200);

      // reuso do refresh antigo: 401 e derruba tudo da família
      await post('/api/auth/refresh').set('Cookie', oldRefresh).expect(401);
      await post('/api/auth/refresh').set('Cookie', newRefresh).expect(401);
      await request(server()).get('/api/auth/me').set('Cookie', newSession).expect(401);
    });

    it('dois refreshes simultâneos com o mesmo token: só um vence e a família é revogada', async () => {
      const reg = await register().expect(201);
      const refresh = cookieHeader(reg, 'refresh_token');

      const [a, b] = await Promise.all([
        post('/api/auth/refresh').set('Cookie', refresh),
        post('/api/auth/refresh').set('Cookie', refresh),
      ]);
      expect([a.status, b.status].sort()).toEqual([204, 401]);

      // O perdedor é tratado como reuso: a sessão que o vencedor acabou de criar também cai.
      const winner = a.status === 204 ? a : b;
      await post('/api/auth/refresh').set('Cookie', cookieHeader(winner, 'refresh_token')).expect(401);
      await request(server()).get('/api/auth/me').set('Cookie', cookieHeader(winner, 'session_token')).expect(401);
    });

    it('refresh sem cookie devolve 401 e limpa os cookies', async () => {
      const res = await post('/api/auth/refresh').expect(401);
      const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
      expect(setCookie.some((c) => c.startsWith('refresh_token=;'))).toBe(true);
    });

    it('logout revoga no servidor: o token antigo para de valer', async () => {
      const reg = await register().expect(201);
      const session = cookieHeader(reg, 'session_token');
      const refresh = cookieHeader(reg, 'refresh_token');

      await post('/api/auth/logout').set('Cookie', session).expect(204);

      await request(server()).get('/api/auth/me').set('Cookie', session).expect(401);
      await post('/api/auth/refresh').set('Cookie', refresh).expect(401);
    });

    it('limita tentativas de login por e-mail', async () => {
      const email = newEmail();
      const attempt = () => post('/api/auth/login').send({ email, password: 'SenhaErrada!1' });

      for (let i = 0; i < 5; i++) await attempt().expect(401);
      await attempt().expect(429);
    });
  });
});
