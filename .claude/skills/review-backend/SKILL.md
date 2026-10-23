---
name: review-backend
description: Revisa o código do backend do curriculo-app (NestJS) contra o padrão do projeto. Use ao terminar um módulo, antes de commitar, ou quando o usuário pedir review. Verifica estrutura de módulo, repetição, boas práticas, specs dos services e uso de decorators.
---

# Review do backend

Revise o que mudou (`git diff` + arquivos novos) ou o módulo indicado. Regras de referência: `CLAUDE.md` (seção Backend) e `docs/seguranca.md`.

## Passo 1: checagens objetivas

```bash
bash .claude/skills/review-backend/check.sh [backend/src/modules/<modulo>]
```

Sem argumento, varre todos os módulos. Trate cada item listado como achado. O script cobre estrutura, specs, fronteiras do Prisma, `userId` nas queries, limites de DTO, `ParseUUIDPipe`, rate limit de IA, SDK de LLM, versões exatas, env, `findMany` sem `take`, transação e migration. Itens 13, 14, 20 e 21 são heurísticas: confirme lendo o código antes de reportar. O restante abaixo é julgamento seu.

## Passo 2: julgamento (leia o código alterado)

### Padrão do projeto
- Raiz do módulo só com `*.module.ts` e `*.controller.ts`; o resto em `services/`, `repositories/`, `dto/`, `constants/`, `types/`.
- Controller sem regra de negócio; service sem `PrismaService` nem query; repository sem regra de negócio.
- Interface/type compartilhado em `types/`, não dentro do repository. `import type` para tipos em assinatura decorada.
- Módulo usa outro só pelo service exportado.
- Nomes de código em inglês, textos ao usuário em português.

### Repetição (compare com o que já existe)
Antes de aprovar código novo, procure se já existe algo igual: `grep` em `common/`, `prisma/` e nos outros módulos.
- Reimplementou algo de `common/` (logger, guards, tipos) ou de outro service?
- Mesmo bloco em 2+ lugares (validação, mapeamento DTO, montagem de resposta, `try/catch`)? Extraia para helper, decorator ou classe base.
- DTOs com os mesmos campos/transforms copiados? Use herança ou decorator composto.
- Constantes/mensagens duplicadas? Vão para `constants/`.
- Só extraia quando houver repetição real (2+ usos); não crie abstração para um caso.

### Decorators (importância)
Decorator existe para tirar código transversal do corpo dos métodos. Cobre `try/catch`, checagem de papel/permissão, metadata e validação que se repetem.
- Erro do Prisma: `@HandlePrismaErrors({...})` no repository, nunca `try/catch` manual.
- Rota pública: `@Public()`; usuário logado: `@CurrentUser()`; nunca ler `req.user` direto.
- Vários decorators sempre juntos em várias rotas? Componha com `applyDecorators`.
- Lógica transversal nova que aparece em 2+ métodos (ex.: parâmetros do `@LlmTask` no módulo `ai`, rate limit, auditoria) é candidata a decorator.
- Decorator deve ser pequeno, tipado e ter spec próprio.

### Boas práticas
- DTO de entrada com class-validator (limites de tamanho incluídos); `forbidNonWhitelisted` já é global.
- Resposta sempre por DTO de saída; nunca devolver entidade crua (`passwordHash`).
- Toda query de dado do usuário filtra por `userId` **no repository**; recurso alheio → 404, não 403.
- Operação com mais de uma escrita usa transação (no repository).
- Sem `any`, sem `console.log`, sem segredo no código. Log só com ids; nunca senha, token, currículo ou vaga.
- Falha fecha o acesso; mensagem de erro não vaza detalhe interno.
- Dependência nova: justificar (docs pedem poucas), versão exata.

### Segurança (OWASP, ver `docs/seguranca.md`)
- Rota nova é autenticada por padrão; cada `@Public()` precisa de motivo. Lista no fim do script.
- Id de recurso vem do token (`@CurrentUser()`), nunca do body. Query do repository filtra `userId` (item 13); em modelo filho (Analysis, Suggestion, GeneratedMessage) o filtro é pela relação com a vaga.
- Entrada limitada: string com `@MaxLength`, array com `@ArrayMaxSize`, id com `ParseUUIDPipe`. Texto da vaga até 20 mil caracteres, imagem até 5 MB.
- Rota que chama LLM tem rate limit por usuário e cota (custo), além do limite global.
- Mensagem de erro não revela se o recurso existe em outra conta.

### Performance e configuração
- Lista sem `take` ou sem paginação (item 20) vira problema com o tempo.
- Filtro ou ordenação novos pedem `@@index` no `schema.prisma`; mudança de schema vem com migration nova (nunca editar migration já aplicada).
- Variável de ambiente nova: `env.schema.ts` **e** `.env.example`.
- Evite N+1: relação lida em loop deve virar `include`/`select` numa só query.

### Quando o módulo existir
- **`ai/`:** vaga em `<vaga>...</vaga>` tratada como dado; saída validada por schema antes de salvar; regras fixas de escrita no `systemInstruction`; prompt em arquivo versionado de `prompts/`; log com tarefa, modelo, tokens e duração, sem conteúdo.
- **`render/`:** todo texto do `content` escapado; um único template serve preview e PDF.

### Testes
- **Todo service tem `.spec.ts` ao lado.** Cobre regra de negócio e caminhos de erro, com dependências mockadas.
- Decorator e helper compartilhado têm spec.
- Rota nova ou mudança de contrato: caso no e2e (`backend/test`), incluindo o negativo: sem login (401), **recurso de outro usuário (404)**, entrada inválida (400) e, se chama IA, limite excedido (429).
- Repository: ao menos coberto pelo e2e; destacar se uma query com `userId` ficou sem teste.

### Documentação
- Mudou convenção, comando ou regra? Atualizar `CLAUDE.md`/`docs/`.

## Saída

Seja breve. Agrupe por severidade e cite `arquivo:linha`:

- **Corrigir** (quebra regra do projeto, segurança, bug)
- **Melhorar** (repetição, boa prática, spec faltando)
- **Ok** (uma linha só, sem detalhar o que está certo)

Para cada achado: o problema em uma frase e a correção sugerida. Não reescreva o código a menos que peçam. Se o pedido for "corrigir", aplique os achados "Corrigir" e rode `pnpm exec tsc --noEmit` em `backend/`.
