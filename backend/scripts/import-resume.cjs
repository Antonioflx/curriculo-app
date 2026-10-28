/**
 * Verificação manual da importação de currículo com o Gemini de verdade (gasta tokens, envia o arquivo à API).
 * Uso: pnpm build && node scripts/import-resume.cjs <arquivo.pdf|arquivo.html>   (precisa de GEMINI_API_KEY em backend/.env)
 * Passa pelo mesmo caminho da rota (`ResumesService.importFile`), sem salvar nada.
 */
const { readFileSync } = require('node:fs');
const { extname } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { ResumesService } = require('../dist/src/modules/resumes/services/resumes.service.js');
const { findResumeFileProblem } = require('../dist/src/common/utils/resume-file.utils.js');

const MIME_BY_EXTENSION = { '.pdf': 'application/pdf', '.html': 'text/html' };

(async () => {
  const path = process.argv[2];
  const mimeType = MIME_BY_EXTENSION[extname(path ?? '').toLowerCase()];
  if (!mimeType) throw new Error('Informe um arquivo .pdf ou .html');

  const file = { mimeType, data: readFileSync(path) };
  const problem = findResumeFileProblem(file);
  if (problem) throw new Error(`Arquivo recusado pela validação: ${problem}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const t0 = Date.now();
    const content = await app.get(ResumesService).importFile({ file });
    console.log(`importado em ${Date.now() - t0} ms`);
    console.log(JSON.stringify(content, null, 2));
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
});
