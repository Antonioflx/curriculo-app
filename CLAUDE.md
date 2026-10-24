# curriculo-app

App para guardar currículos e, a partir de uma vaga (texto ou imagem), escolher o melhor currículo, apontar ajustes e gerar as mensagens de candidatura com IA (Gemini).

Repositório: `github.com/Antonioflx/curriculo-app` (monolito em monorepo: um frontend, um backend).

Detalhes que não cabem aqui:
- @docs/produto.md — requisitos, páginas, fluxos e modelo de dados
- @docs/ia.md — integração com Gemini, prompts e regras de escrita dos currículos
- @docs/seguranca.md — autenticação, cookies e controles do OWASP Top 10:2025

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, shadcn/ui, Tailwind CSS, TanStack Query, React Hook Form + Zod |
| Backend | NestJS, TypeScript, Prisma, class-validator |
| Banco | PostgreSQL (Neon, via integração da Vercel) |
| IA | Gemini (`@google/genai`), saída estruturada com JSON Schema |
| PDF | `puppeteer-core` + `@sparticuz/chromium` numa função da `api` (HTML do currículo → PDF) |
| Deploy | Vercel (dois projetos: `web` e `api`) |
| Gerenciador | pnpm workspaces |

## Estrutura do repositório

```
curriculo-app/
├── frontend/         # Next.js
├── backend/          # NestJS
├── docs/
├── docker-compose.yml  # Postgres local (dev)
├── pnpm-workspace.yaml
└── package.json
```

O frontend chama o backend **pela mesma origem**: `next.config` reescreve `/api/:path*` para `<URL do backend>/api/:path*` (o backend usa o prefixo global `api`). Assim os cookies HttpOnly setados pelo backend ficam no domínio do `web` e não há CORS nem cookie de terceiros.

## Frontend (`frontend`) — feature-based

```
src/
├── app/                       # só rotas e layouts; sem regra de negócio
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   └── (app)/
│       ├── curriculos/page.tsx
│       ├── curriculos/[id]/page.tsx
│       ├── chat/page.tsx
│       └── configuracoes/page.tsx
├── features/
│   ├── auth/          # components/, hooks/, api/, schemas/, types.ts
│   ├── resumes/
│   ├── chat/
│   └── settings/
├── shared/
│   ├── ui/            # componentes do shadcn/ui + componentes genéricos do app
│   ├── hooks/
│   ├── components/    # layout, header, sidebar
│   └── utils/
├── lib/               # http client, query client, env
└── middleware.ts      # redireciona para /login sem cookie de sessão
```

Regras:
- **Alias de import:** `@/features/*`, `@/shared/*`, `@/lib/*`. Nunca `../../..`.
- Uma feature **não importa de outra feature**. O que for comum sobe para `shared/`.
- Cada feature expõe só o que é público por um `index.ts`.
- `shared/ui` é o único lugar com componentes do shadcn (`components.json` aponta para lá).
- Chamadas HTTP só em `features/*/api/*`, sempre via `lib/http`. Componentes usam hooks do TanStack Query, nunca `fetch` direto.
- Formulários: React Hook Form + schema Zod da própria feature.
- O `middleware.ts` só checa se o cookie existe (UX). Quem autoriza de verdade é o backend.

## Backend (`backend`) — módulos em camadas

Arquitetura **modular em camadas** (padrão do NestJS), sem Clean/Hexagonal: o projeto é simples e essas arquiteturas adicionariam camadas sem ganho.

```
src/
├── main.ts
├── app.module.ts
├── common/            # guards, filters, interceptors, decorators, pipes
├── core/              # serviços globais da aplicação (logger)
├── config/            # validação das variáveis de ambiente
├── prisma/            # PrismaService
└── modules/
    ├── auth/
    ├── users/
    ├── resumes/
    ├── tags/
    ├── jobs/          # vagas extraídas
    ├── analyses/      # avaliação vaga × currículos
    ├── messages/      # e-mail e respostas de formulário
    ├── settings/      # instruções de escrita do usuário
    ├── suggestions/   # sugestões da análise (ênfase e perguntas de fato)
    ├── render/        # content → HTML (preview) e HTML → PDF
    └── ai/            # cliente do Gemini e prompts
```

Cada módulo segue o mesmo formato:

```
resumes/
├── resumes.module.ts
├── resumes.controller.ts          # HTTP: recebe DTO, chama service, devolve DTO
├── services/
│   ├── resumes.service.ts         # regra de negócio
│   └── resumes.service.spec.ts    # o spec fica ao lado do arquivo que testa
├── repositories/
│   └── resumes.repository.ts      # único lugar que fala com o Prisma
├── dto/
│   ├── input/                     # ENTRADA: class-validator (tipo, normalização, limites, regras entre campos)
│   └── output/                    # SAÍDA: dado enxuto, mapeado com from()
├── constants/                     # constantes e listas fixas do módulo
├── types/                         # interfaces e types do módulo
└── strategies/ ...                # só onde fizer sentido (ex.: auth/jwt)
```

Para criar um módulo novo use a skill `create-new-module-backend` (gera o esqueleto neste formato); depois rode a `review-backend`.

Organização do módulo:
- Na raiz ficam só `*.module.ts` e `*.controller.ts`. Todo o resto vai para subpasta.
- Crie só as pastas que o módulo usa; nada de pasta vazia ou com um arquivo sem necessidade de crescer.
- Interface ou type compartilhado entre service e repository vive em `types/`, nunca declarado dentro do repository.
- Erros do Prisma (P2002 duplicado, P2025 não encontrado, P2003 referência inválida) são traduzidos com `@HandlePrismaErrors({...})` nos métodos do repository, nunca com `try/catch` repetido. Os padrões podem ser sobrescritos por método.
- Interface ou type usado em parâmetro de método decorado (controller, repository) é importado com `import type` (exigência do `isolatedModules` com `emitDecoratorMetadata`).
- **DTO é a borda do módulo.** `dto/input/` recebe e valida tudo que vem de fora (tipo, `@Trim`, limite de tamanho, formato, regras entre campos, upload com `FileToBody` + `@IsImageUpload()`); o service e a IA recebem dado já válido e não validam entrada. `dto/output/` devolve só o que o cliente usa: sem `userId`, `passwordHash` nem texto bruto, listagem em resumo e detalhe completo. Pré-condição de negócio (ex.: "tem currículo base?") fica no service. Limites de entrada em `@/common/constants/input-limits`.
- DTOs usam os decorators compostos de `@/common/decorators/validation.decorators` (`@Text(max)`, `@TextList`, `@Nested`, `@NestedList`, `@Trim`), nunca `@IsString()` + `@MaxLength()` repetidos. Toda string e lista de entrada tem limite. Controllers usam `@CurrentUser('userId')` e `@UuidParam()`.
- Testes e2e usam `@test/helpers/e2e` (`createTestApp`, `signUp`, `api`) e `@test/fixtures/*`; não recriar helpers por arquivo.
- Imports dentro do módulo são relativos e de um nível (`../types/...`); de outro módulo, de `common` ou de dentro de `dto/input|output` (que fica a dois níveis), use o alias `@/`.

Regras:
- **Controller** não tem regra de negócio. **Service** não usa `PrismaService` nem monta query. **Repository** não tem regra de negócio.
- Logs só pelo `AppLogger` de `@/core/logger` (`this.logger.info|warn|error('evento', { ids })`); nunca `console.*` nem `Logger` do Nest direto. `requestId` e `userId` da requisição entram sozinhos (contexto em `@/core/context`); não os repasse. Chaves sensíveis (senha, token, `content`, `rawText`) são mascaradas, mas passe só ids. Rotas que chamam a IA levam `@AiRateLimit()`.
- Enums do Prisma entram na aplicação só por `@/common/enums`; services e DTOs nunca importam de `@/generated`.
- Toda dependência entra pelo construtor (injeção do Nest). Services dependem de classes injetáveis, o que permite mockar nos testes.
- Toda query de dado do usuário filtra por `userId` **no repository** (ver docs/seguranca.md).
- Um módulo usa outro só pelo service exportado, nunca pelo repository dele.
- `ai/` expõe uma interface `LlmProvider` com uma implementação `GeminiProvider`. Os outros módulos não conhecem o SDK do Gemini.
- Erros: exceptions do Nest (`NotFoundException` etc.) + um filtro global que nunca devolve stack trace.

## Preview e PDF

- Um único renderizador no backend (`render/`) transforma o `content` do currículo em HTML. O preview e o PDF usam **o mesmo HTML**; nunca ter dois templates.
- Todo texto do `content` é escapado no renderizador (o conteúdo vem do usuário e da IA). O preview é exibido num `<iframe sandbox>` sem scripts.
- O PDF nunca é editado: edita-se o `content` e gera-se de novo.
- Na Vercel, a rota de PDF precisa de memória e `maxDuration` maiores; usar `@sparticuz/chromium-min` se o pacote estourar o limite de tamanho da função.

## Convenções gerais

- TypeScript `strict` nos dois apps.
- Formatação por Biome (aspas simples, 120 colunas, 2 espaços); não discuta estilo em review, rode `pnpm format`.
- Dado não confiável (payload de JWT, body, cookie) é validado na borda (DTO, strategy, guard); o service recebe tipos já corretos e não repete `typeof`. Use `@/common/utils` (`type`, `empty`, `text`, `date`, `limit`) em vez de reescrever checagens e formatações.
- Sem `else if`/`else` encadeado: use guard clauses com early return (`if (...) return;` / `throw`) e métodos privados pequenos.
- Conventional Commits (`feat:`, `fix:`, `chore:`...) e branches por feature.
- Testes com Jest: services e repositories no backend; hooks e componentes críticos no frontend.
- Nomes de código em inglês; textos da interface em português.
- Variáveis de ambiente validadas no boot (Zod no `web`, `@nestjs/config` + schema no `api`). Cada app tem o próprio `.env` (`backend/.env`, `frontend/.env`), ignorado pelo git; só o `.env.example` (sem valores reais) é versionado. Em produção o boot recusa segredo de exemplo, origem sem https e banco sem `sslmode=require`.

## Comandos

Na raiz (copie `backend/.env.example` para `backend/.env` antes; cada app tem o seu `.env`, a raiz não tem):

- `pnpm db:up` / `pnpm db:down`: sobe e derruba o Postgres local (Docker). O compose só importa `POSTGRES_*` de `backend/.env` (`--env-file`); nenhum outro segredo entra no container, e a porta só abre em 127.0.0.1.
- `pnpm dev`: backend em modo watch (porta 3001, prefixo `/api`).
- `pnpm test`, `pnpm lint`, `pnpm build`: delegam ao backend.
- `pnpm format` / `pnpm format:check`: Biome (só formatador) em cada app, cada um com o próprio `biome.json` (`backend/biome.json` hoje; o `frontend/` terá o dele). Rode `pnpm format` antes de pedir commit.
- `pnpm --filter backend test:e2e`: e2e (precisa do Postgres no ar).
- `pnpm --filter backend prisma:migrate`: cria/aplica migrations. Depois, `pnpm --filter backend prisma:generate` (o Prisma 7 não gera o client sozinho; ele sai em `src/generated`, ignorado pelo git).

Notas do backend:

- O Nest 12 é ESM-only: `tsconfig` com `module: nodenext` e Jest rodando com `--experimental-vm-modules`. Alias de import: `@/*` → `src/*`.
- Versões fixas (`.npmrc` com `save-exact`). TypeScript fica na 6.x porque o `ts-jest` não aceita a 7. Prisma CLI e client precisam estar na mesma versão.
- IA: `AiService` (tarefas) → `LlmProviderRegistry` (cadeia de providers) → `GeminiProvider` / `GroqProvider`. Variáveis `LLM_PROVIDER`, `LLM_FALLBACK_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `AI_TIMEOUT_MS`, `AI_TOTAL_TIMEOUT_MS` (as chaves só no `backend/.env`; em produção são obrigatórias para os providers configurados). Modelo, fallback, cotas e lições em `docs/ia.md`. O Jest não alcança as APIs: use `pnpm --filter backend ai:smoke` (fluxo completo) e `ai:bench` (compara modelos antes de trocar).
- Scripts de build de dependências são liberados em `pnpm-workspace.yaml` (`allowBuilds`); só `argon2` e Prisma.
