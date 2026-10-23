#!/usr/bin/env bash
# Portão antes de commitar: higiene de arquivos + verificações do backend.
# Uso: bash .claude/skills/commit/preflight.sh [--e2e]
# Sai com código 1 se algo bloqueia o commit.
cd "$(git rev-parse --show-toplevel)" || exit 1

fail=0
step() { echo; echo "== $1"; }
block() { echo "BLOQUEIA: $1"; fail=1; }

step "Arquivos alterados"
git status --short
[ -z "$(git status --short)" ] && { echo "Nada para commitar."; exit 0; }

step "Higiene (.env, segredos, arquivos soltos)"
tracked_env=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$')
[ -n "$tracked_env" ] && block ".env versionado: $tracked_env"
staged_env=$(git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$')
[ -n "$staged_env" ] && block ".env no stage: $staged_env"
secrets=$(git grep -nIE "(SECRET|API_KEY|PASSWORD|TOKEN)[A-Z_]*=[^[:space:]]{6,}" -- . \
  ':!*.env.example' ':!*.md' ':!*.spec.ts' ':!backend/test' ':!.claude' 2>/dev/null)
[ -n "$secrets" ] && block "segredo literal: $secrets"
odd=$(git ls-files --others --exclude-standard | grep -E '(^|/)(tmp|temp)[^/]*$|\.log$|^backend/[0-9]|\.orig$|\.rej$|~$')
[ -n "$odd" ] && block "arquivo suspeito (temporário/solto): $odd"
[ "$fail" = 0 ] && echo "ok"

if git status --short | grep -q " backend/\|^.. backend/\|backend/"; then
  step "Backend: formato, tipos, lint, testes"
  (
    cd backend || exit 1
    pnpm format:check 2>&1 | tail -1 || exit 1
    pnpm exec tsc --noEmit 2>&1 | head -10
    [ "${PIPESTATUS[0]}" = 0 ] || exit 1
    pnpm exec eslint "src/**/*.ts" "test/**/*.ts" 2>&1 | tail -10
    [ "${PIPESTATUS[0]}" = 0 ] || exit 1
    pnpm test 2>&1 | grep -E "Tests:|Suites:|FAIL|●"
    [ "${PIPESTATUS[0]}" = 0 ] || exit 1
    if [ "$1" = "--e2e" ]; then
      pnpm test:e2e 2>&1 | grep -E "Tests:|Suites:|FAIL|●"
      [ "${PIPESTATUS[0]}" = 0 ] || exit 1
    fi
  ) || block "verificação do backend falhou"
  [ "$1" = "--e2e" ] || echo "(e2e não rodou; use --e2e quando mudar src/ ou test/ e o Postgres estiver no ar)"
fi

echo
if [ "$fail" = 0 ]; then echo "Pronto para commitar."; else echo "NÃO COMMITE: corrija o que bloqueia."; fi
exit $fail
