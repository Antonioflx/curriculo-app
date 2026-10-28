/**
 * Verificação manual do currículo ajustado, com o Gemini de verdade (gasta tokens). Usa a vaga mais recente do
 * usuário, o currículo base da tag informada e as sugestões aceitas / respostas de um JSON, e mostra o que mudou.
 * Ainda não existe o módulo `suggestions`: nada é salvo.
 *
 * Uso: pnpm build && node scripts/build-adjusted.cjs <email> <tag> <entrada.json>
 * entrada.json: { "accepted": [{ "target", "proposal" }], "answered": [{ "target", "question", "answer" }] }
 */
const { readFileSync } = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { UsersService } = require('../dist/src/modules/users/services/users.service.js');
const { JobsService } = require('../dist/src/modules/jobs/services/jobs.service.js');
const { ResumesService } = require('../dist/src/modules/resumes/services/resumes.service.js');
const { AiService } = require('../dist/src/modules/ai/services/ai.service.js');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function printDiff(before, after) {
  const field = (label, a, b) => {
    if (!same(a, b)) console.log(`\n[${label}]\n  antes : ${a}\n  depois: ${b}`);
  };
  field('headline', before.header.headline, after.header.headline);
  field('resumo', before.summary, after.summary);

  before.experiences.forEach((old, i) => {
    const now = after.experiences[i];
    const added = now.bullets.filter((bullet) => !old.bullets.includes(bullet));
    const removed = old.bullets.filter((bullet) => !now.bullets.includes(bullet));
    const moved = !added.length && !removed.length && !same(old.bullets, now.bullets);
    if (!added.length && !removed.length && !moved) return;
    console.log(`\n[${old.company} — bullets]${moved ? ' (só mudou a ordem)' : ''}`);
    for (const bullet of removed) console.log(`  - ${bullet}`);
    for (const bullet of added) console.log(`  + ${bullet}`);
  });

  before.skills.forEach((old, i) => {
    const now = after.skills.find((skill) => skill.category === old.category) ?? after.skills[i];
    if (now && !same(old.items, now.items)) console.log(`\n[skills: ${old.category}]\n  antes : ${old.items.join(', ')}\n  depois: ${now.items.join(', ')}`);
  });
  if (after.skills.length !== before.skills.length) console.log(`\n[skills] categorias: ${before.skills.length} → ${after.skills.length}`);
}

(async () => {
  const [email, tag, inputPath] = process.argv.slice(2);
  if (!email || !tag || !inputPath) throw new Error('Uso: node scripts/build-adjusted.cjs <email> <tag> <entrada.json>');
  const { accepted = [], answered = [] } = JSON.parse(readFileSync(inputPath, 'utf8'));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const user = await app.get(UsersService).findByEmail(email);
    if (!user) throw new Error(`Usuário não encontrado: ${email}`);

    const jobs = app.get(JobsService);
    const [latest] = await jobs.list(user.id);
    const job = await jobs.get(user.id, latest.id);

    const resumes = app.get(ResumesService);
    const base = (await resumes.list(user.id, { kind: 'BASE' })).find((resume) => resume.tags.some((t) => t.tag.name === tag));
    if (!base) throw new Error(`Sem currículo base com a tag ${tag}`);
    const baseContent = (await resumes.get(user.id, base.id)).content;

    const t0 = Date.now();
    const { data, usage } = await app.get(AiService).buildAdjusted({ job: job.extracted, baseContent, accepted, answered });
    console.log(`vaga: ${job.title} (${job.company}) | base: ${base.title} | ${Date.now() - t0} ms ${JSON.stringify(usage)}`);
    printDiff(baseContent, data);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
