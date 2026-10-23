---
name: commit
description: Cria commits no padrão do curriculo-app (Conventional Commits em português, um commit por propósito, stage explícito, verificações antes). Use quando o usuário pedir para commitar ou depois de ele confirmar. Nunca commita sem confirmação.
---

# Commit

## Regra de ouro

**Só commite depois do "pode commitar" do usuário, a cada vez.** Autorização anterior não vale para o próximo commit. Sem confirmação: termine, rode as verificações, resuma e pergunte (sugerindo a divisão e as mensagens). Nunca `push`, `--amend`, `reset --hard`, `--no-verify` ou força sem pedido explícito.

## Passo a passo

1. **Portão:** `bash .claude/skills/commit/preflight.sh [--e2e]` (use `--e2e` se mudou `backend/src` ou `backend/test`; precisa do Postgres: `pnpm db:up`). Ele mostra o `git status`, barra `.env`/segredo/arquivo solto e roda formato, `tsc`, lint e testes. Se bloquear, corrija antes de seguir; não contorne.
2. **Revise o que entra:** `git status --short` e `git diff --stat`. Arquivo inesperado (temporário, log, `.env`, saída de comando) fica de fora ou é removido.
3. **Divida por propósito.** Um commit = uma intenção (`feat`, `fix`, `refactor`, `chore`, `test`, `docs`). Se o mesmo arquivo serve a dois propósitos e não dá para separar sem edição interativa, junte em um commit e explique no corpo. Mudanças de `.claude/` (skills) vão em commit próprio.
4. **Stage explícito por caminho** (`git add <paths>`). Evite `git add -A` às cegas. Exclusões: `git add -A . ':!.claude'`.
5. **Mensagem** (formato abaixo) e `git commit -m "..."`. Hooks rodam; se falharem, corrija a causa e crie um commit novo.
6. **Confirme:** `git log --oneline -n <N>` e `git status --short` (deve ficar limpo). Relate os hashes.

## Formato da mensagem

```
<tipo>(<escopo>): <resumo no imperativo, minúsculo, sem ponto final>

- o que mudou e por quê, em tópicos curtos
- o comportamento novo ou o bug corrigido
```

- **Idioma:** português (código e nomes de arquivos seguem em inglês).
- **Tipos:** `feat` (funcionalidade), `fix` (bug), `refactor` (sem mudar comportamento), `test`, `docs`, `chore` (config, deps, skills, tooling), `perf`.
- **Escopo:** módulo ou área: `auth`, `resumes`, `tags`, `core`, `backend`, `skills`, `docker`... Omita se atravessar tudo.
- **Resumo:** até ~72 caracteres. Descreve o resultado, não o arquivo (`fix(backend): PATCH com null devolve 400`, não `altera update-resume.dto.ts`).
- **Corpo:** só quando o "porquê" não cabe no título. Tópicos, não parágrafos.
- Sem `Co-Authored-By` ou assinatura, a menos que o projeto/usuário peça.

Exemplos do histórico:
- `feat(backend): módulos tags e resumes`
- `refactor(backend): utils compartilhados e log de acesso negado`
- `chore(skills): review-backend com mais checagens e regras de estilo`

## Branches

O `CLAUDE.md` pede branch por feature. Hoje o trabalho está na `main`; se for uma feature nova e o usuário não disse o contrário, pergunte antes se quer criar `feat/<nome>`. Nunca crie ou troque de branch sem avisar.

## Aviso de fim de linha

`warning: LF will be replaced by CRLF` é do Windows e inofensivo (o `.gitattributes` cuida disso). Pode filtrar com `grep -v warning`.

## Saída para o usuário

Curta: o que entrou em cada commit (hash + mensagem), resultado do portão e, se algo ficou de fora, o motivo. Não repita o diff.
