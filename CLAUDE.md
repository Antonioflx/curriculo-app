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
├── dto/                           # classes com class-validator (entrada e saída)
├── constants/                     # constantes e listas fixas do módulo
├── types/                         # interfaces e types do módulo
└── strategies/ ...                # só onde fizer sentido (ex.: auth/jwt)
```

Organização do módulo:
- Na raiz ficam só `*.module.ts` e `*.controller.ts`. Todo o resto vai para subpasta.
- Crie só as pastas que o módulo usa; nada de pasta vazia ou com um arquivo sem necessidade de crescer.
- Interface ou type compartilhado entre service e repository vive em `types/`, nunca declarado dentro do repository.
- Erros do Prisma (P2002 duplicado, P2025 não encontrado, P2003 referência inválida) são traduzidos com `@HandlePrismaErrors({...})` nos métodos do repository, nunca com `try/catch` repetido. Os padrões podem ser sobrescritos por método.
- Interface ou type usado em parâmetro de método decorado (controller, repository) é importado com `import type` (exigência do `isolatedModules` com `emitDecoratorMetadata`).
- Imports dentro do módulo são relativos e de um nível (`../types/...`); de outro módulo ou de `common`, usa o alias `@/`.

Regras:
- **Controller** não tem regra de negócio. **Service** não usa `PrismaService` nem monta query. **Repository** não tem regra de negócio.
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
- Conventional Commits (`feat:`, `fix:`, `chore:`...) e branches por feature.
- Testes com Jest: services e repositories no backend; hooks e componentes críticos no frontend.
- Nomes de código em inglês; textos da interface em português.
- Variáveis de ambiente validadas no boot (Zod no `web`, `@nestjs/config` + schema no `api`). Nunca commitar `.env`.

## Comandos

Na raiz (copie `.env.example` para `.env` antes):

- `pnpm db:up` / `pnpm db:down`: sobe e derruba o Postgres local (Docker).
- `pnpm dev`: backend em modo watch (porta 3001, prefixo `/api`).
- `pnpm test`, `pnpm lint`, `pnpm build`: delegam ao backend.
- `pnpm --filter backend test:e2e`: e2e (precisa do Postgres no ar).
- `pnpm --filter backend prisma:migrate`: cria/aplica migrations. Depois, `pnpm --filter backend prisma:generate` (o Prisma 7 não gera o client sozinho; ele sai em `src/generated`, ignorado pelo git).

Notas do backend:

- O Nest 12 é ESM-only: `tsconfig` com `module: nodenext` e Jest rodando com `--experimental-vm-modules`. Alias de import: `@/*` → `src/*`.
- Versões fixas (`.npmrc` com `save-exact`). TypeScript fica na 6.x porque o `ts-jest` não aceita a 7. Prisma CLI e client precisam estar na mesma versão.
- Scripts de build de dependências são liberados em `pnpm-workspace.yaml` (`allowBuilds`); só `argon2` e Prisma.
