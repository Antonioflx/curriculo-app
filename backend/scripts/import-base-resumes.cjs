/**
 * Importa os currículos base de uma pasta (uma subpasta por tag, cada uma com um .html ou .pdf) e os salva no
 * banco local como currículos BASE do usuário, cada um com a tag da pasta. Gasta tokens do Gemini (1 por arquivo).
 *
 * Uso: pnpm build && node scripts/import-base-resumes.cjs <pasta> <email> [nome]
 * Se o usuário não existe, é criado; a senha vem de SEED_PASSWORD ou é gerada e mostrada uma vez.
 * Idempotente: currículo com o mesmo título já salvo é pulado (não gasta IA).
 */
const { randomBytes } = require('node:crypto');
const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { extname, join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { AuthService } = require('../dist/src/modules/auth/services/auth.service.js');
const { UsersService } = require('../dist/src/modules/users/services/users.service.js');
const { TagsService } = require('../dist/src/modules/tags/services/tags.service.js');
const { ResumesService } = require('../dist/src/modules/resumes/services/resumes.service.js');
const { findResumeFileProblem } = require('../dist/src/common/utils/resume-file.utils.js');

const MIME_BY_EXTENSION = { '.html': 'text/html', '.pdf': 'application/pdf' };

/** Prefere o HTML (sem OCR); cai para o PDF. */
function pickFile(dir) {
  const files = readdirSync(dir).filter((name) => MIME_BY_EXTENSION[extname(name).toLowerCase()]);
  const best = files.find((name) => extname(name).toLowerCase() === '.html') ?? files[0];
  return best ? join(dir, best) : null;
}

async function findOrCreateUser(app, email, name) {
  const existing = await app.get(UsersService).findByEmail(email);
  if (existing) return existing.id;

  const password = process.env.SEED_PASSWORD ?? randomBytes(12).toString('base64url');
  const { user } = await app.get(AuthService).register({ name, email, password }, {});
  console.log(`usuário criado: ${email}${process.env.SEED_PASSWORD ? '' : `  senha gerada (guarde): ${password}`}`);
  return user.id;
}

async function findOrCreateTag(app, userId, name) {
  const tags = app.get(TagsService);
  const existing = (await tags.list(userId)).find((tag) => tag.name === name);
  return existing ?? tags.create(userId, name);
}

(async () => {
  const [root, email, name = 'Antonio'] = process.argv.slice(2);
  if (!root || !email || !existsSync(root)) throw new Error('Uso: node scripts/import-base-resumes.cjs <pasta> <email> [nome]');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const userId = await findOrCreateUser(app, email, name);
    const resumes = app.get(ResumesService);
    const saved = new Set((await resumes.list(userId, {})).map((resume) => resume.title));

    for (const tagName of readdirSync(root).filter((entry) => statSync(join(root, entry)).isDirectory())) {
      const title = `Currículo ${tagName}`;
      const path = pickFile(join(root, tagName));
      if (!path) continue;
      if (saved.has(title)) {
        console.log(`- ${title}: já existe, pulado`);
        continue;
      }

      const file = { mimeType: MIME_BY_EXTENSION[extname(path).toLowerCase()], data: readFileSync(path) };
      const problem = findResumeFileProblem(file);
      if (problem) {
        console.log(`- ${title}: arquivo recusado (${problem})`);
        continue;
      }

      const t0 = Date.now();
      const content = await resumes.importFile({ file });
      const tag = await findOrCreateTag(app, userId, tagName);
      const resume = await resumes.create(userId, { title, content, tagIds: [tag.id] });
      console.log(`- ${title}: salvo (${resume.id}, tag ${tagName}, ${Date.now() - t0} ms)`);
    }
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
