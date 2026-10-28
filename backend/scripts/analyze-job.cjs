/**
 * Verificação manual do fluxo vaga → recomendação, com o Gemini de verdade (gasta tokens; envia a vaga e os
 * currículos base à API). Extrai a vaga (salva em `jobs`) e avalia contra os currículos base do usuário.
 * Ainda não existe o módulo `analyses`: o resultado só é impresso, não é salvo.
 *
 * Uso: pnpm build && node scripts/analyze-job.cjs <email> <imagem.png|jpg|webp | texto.txt>
 */
const { readFileSync } = require('node:fs');
const { extname } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { UsersService } = require('../dist/src/modules/users/services/users.service.js');
const { JobsService } = require('../dist/src/modules/jobs/services/jobs.service.js');
const { ResumesService } = require('../dist/src/modules/resumes/services/resumes.service.js');
const { AiService } = require('../dist/src/modules/ai/services/ai.service.js');
const { findImageProblem } = require('../dist/src/common/utils/image.utils.js');

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function readJobInput(path) {
  const mimeType = IMAGE_MIME[extname(path).toLowerCase()];
  if (!mimeType) return { text: readFileSync(path, 'utf8').trim() };

  const image = { mimeType, data: readFileSync(path) };
  const problem = findImageProblem(image);
  if (problem) throw new Error(`Imagem recusada: ${problem}`);
  return { image };
}

const step = async (name, fn) => {
  const t0 = Date.now();
  const result = await fn();
  console.log(`\n== ${name} (${Date.now() - t0} ms) ${JSON.stringify(result.usage ?? '')}`);
  return result;
};

(async () => {
  const [email, path] = process.argv.slice(2);
  if (!email || !path) throw new Error('Uso: node scripts/analyze-job.cjs <email> <imagem|texto>');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const user = await app.get(UsersService).findByEmail(email);
    if (!user) throw new Error(`Usuário não encontrado: ${email}`);

    const job = await step('extractJob (salva em jobs)', async () => {
      const saved = await app.get(JobsService).create(user.id, readJobInput(path));
      return { ...saved, usage: undefined };
    });
    console.log(JSON.stringify(job.extracted, null, 2));

    const resumes = app.get(ResumesService);
    const summaries = await resumes.list(user.id, { kind: 'BASE' });
    const candidates = await Promise.all(
      summaries
        .filter((resume) => resume.tags.length > 0)
        .map(async (resume) => ({
          id: resume.id,
          title: resume.title,
          tags: resume.tags.map(({ tag }) => tag.name),
          content: (await resumes.get(user.id, resume.id)).content,
        })),
    );
    console.log(`\ncurrículos base: ${candidates.map((resume) => `${resume.title} [${resume.tags}]`).join(', ')}`);

    const { data: fit } = await step('analyzeFit', () => app.get(AiService).analyzeFit({ job: job.extracted, resumes: candidates }));
    const recommended = candidates.find((resume) => resume.id === fit.recommendedResumeId);
    console.log(`\nRECOMENDADO: ${recommended?.title}\nmotivo: ${fit.reason}`);
    console.log('\nrequisitos:');
    for (const item of fit.requirements) console.log(` - [${item.status}] ${item.requirement}${item.evidence ? ` → ${item.evidence}` : ''}`);
    console.log('\npontos de atenção:');
    for (const item of fit.attentionPoints) console.log(` - ${JSON.stringify(item)}`);
    console.log('\nsugestões:');
    for (const item of fit.suggestions) console.log(` - ${JSON.stringify(item)}`);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
