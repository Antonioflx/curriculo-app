---
name: create-new-module-backend
description: Cria um módulo novo no backend do curriculo-app (NestJS) seguindo o padrão do projeto, com esqueleto gerado por script (module, controller, service+spec, repository, DTOs, constants, types, e2e). Use quando o usuário pedir um módulo/recurso novo (ex.: jobs, analyses, messages, settings, suggestions).
---

# Criar módulo novo no backend

O padrão está no `CLAUDE.md` (Backend). Esta skill transforma esse padrão em passos e gera o esqueleto. Não escreva a estrutura à mão.

## Passo a passo

1. **Entenda o recurso** em `docs/produto.md` (entidade, campos, regras, rotas do fluxo) e, se for IA, `docs/ia.md`. Se algo essencial faltar (campos, regras, limites), pergunte antes de gerar.
2. **Banco primeiro.** Confirme o model em `backend/prisma/schema.prisma` (com `userId` ou relação até o dono, índices para os filtros, `onDelete` pensado). Se precisar alterar: `pnpm --filter backend prisma:migrate` e depois `pnpm --filter backend prisma:generate`. Não edite migration já aplicada.
3. **Gere o esqueleto:**
   ```bash
   bash .claude/skills/create-new-module-backend/scaffold.sh <plural-kebab> <singular-kebab> [model-prisma]
   # ex.: scaffold.sh job-postings job-posting jobPosting
   ```
   Gera `modules/<plural>/` com `module`, `controller`, `services/` (+ spec), `repositories/`, `dto/` (create, update, response), `constants/`, `types/` e `test/<plural>.e2e-spec.ts`. Recusa se o módulo já existir.
4. **Adapte tudo que está marcado `TODO(scaffold)`:** campos de `types/`, DTOs, mensagens, e2e e specs. O esqueleto usa `name` como campo de exemplo.
5. **Registre** o módulo em `backend/src/app.module.ts` (`imports`).
6. **Escreva a regra de negócio** no service e os testes dela (ver "Regras do padrão").
7. **Verifique** (da pasta `backend/`): `pnpm format`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` (precisa do Postgres: `pnpm db:up`).
8. **Rode a skill `review-backend`** no módulo: `bash .claude/skills/review-backend/check.sh backend/src/modules/<plural>`.
9. **Atualize a documentação** se o módulo mudou contrato, convenção ou comando (`CLAUDE.md`, `docs/`).
10. **Não commite sem o "pode commitar" do usuário.** Resuma o que foi criado e sugira a mensagem (`feat(<plural>): ...`).

## Regras do padrão (resumo)

- Raiz do módulo só com `*.module.ts` e `*.controller.ts`; o resto em `services/`, `repositories/`, `dto/`, `constants/`, `types/` (só as pastas usadas; `strategies/` só onde fizer sentido). Spec ao lado do arquivo testado.
- **Controller:** só HTTP. `@CurrentUser('userId')` (nunca `userId` do body), `@UuidParam()`, responde sempre por DTO de saída. Rota é autenticada por padrão; `@Public()` só com motivo.
- **Service:** regra de negócio; sem `PrismaService`, sem query. Recebe dado já validado (DTO/borda), sem `typeof` repetido. Outro módulo só pelo **service exportado**. Limites com `assertBelowLimit`.
- **Repository:** único que fala com o Prisma. **Toda query filtra `userId`** (modelo filho: pela relação com o dono). Listas com `take`. Mais de uma escrita → `$transaction`. Erros com `@HandlePrismaErrors(...)`, nunca `try/catch`. Interface compartilhada vai em `types/` (`import type` em parâmetro decorado).
- **DTO:** decorators de `@/common/decorators/validation.decorators` (`@Text`, `@TextList`, `@Nested`, `@NestedList`, `@Trim`); toda string/lista com limite; update com `StrictPartialType` (recusa `null`, ao contrário do `PartialType`).
- Enums do Prisma só por `@/common/enums`; nunca importar de `@/generated` fora do repository.
- Logs só pelo `AppLogger` (`@/core/logger`), com ids; nunca conteúdo de currículo/vaga.
- Reuso: `@/common/utils` (`type`, `empty`, `text`, `date`, `limit`); sem `else if`, use early return.
- Recurso de outro usuário → **404**. Rota que chama IA: rate limit por usuário (`@Throttle`).
- Se for o módulo `ai` (ou usar LLM), siga `docs/ia.md`: prompts em arquivos versionados, saída validada por schema, sem SDK fora de `modules/ai`.

## Testes mínimos

- **Service:** cada regra e cada caminho de erro, com repository mockado (404, limites, estados inválidos).
- **E2E:** 401 sem login, ciclo feliz, **404 para recurso de outro usuário**, 400 para id/entrada inválida, 429 se houver rate limit. Use `@test/helpers/e2e` e `@test/fixtures/*`.
- Decorator ou util novo ganha spec.

## Saída para o usuário

Curta: módulo criado, rotas, regras implementadas, o que ficou pendente e resultado das verificações. Pergunte se pode commitar.
