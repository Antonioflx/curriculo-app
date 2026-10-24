#!/usr/bin/env bash
# Checagens objetivas do review-backend.
# Uso: bash .claude/skills/review-backend/check.sh [backend/src/modules/<modulo>]
cd "$(git rev-parse --show-toplevel)" || exit 1

SRC=backend/src
TARGET=${1:-$SRC/modules}
count=0

report() {
  echo "## $1"
  if [ -n "$2" ]; then
    echo "$2"
    count=$((count + $(echo "$2" | wc -l)))
  else
    echo "ok"
  fi
  echo
}

# Se o alvo é um módulo, revisa só ele; senão, todos.
if [ -d "$TARGET/services" ] || [ -d "$TARGET/repositories" ] || [ -f "$TARGET"/*.module.ts ] 2>/dev/null; then
  MODULE_DIRS="$TARGET"
else
  MODULE_DIRS=$(find "$TARGET" -mindepth 1 -maxdepth 1 -type d)
fi

missing_spec() { # $1 = padrão do arquivo (services|repositories)
  for dir in $MODULE_DIRS; do
    find "$dir/$1" -name "*.ts" ! -name "*.spec.ts" ! -name "*.module.ts" 2>/dev/null | while read -r f; do
      [ -f "${f%.ts}.spec.ts" ] || echo "$f"
    done
  done
}

report "1. Service sem spec (obrigatório)" "$(missing_spec services)"
report "2. Repository sem spec (aviso: ao menos coberto pelo e2e)" "$(missing_spec repositories)"

report "3. Arquivo solto na raiz do módulo (só *.module.ts e *.controller.ts)" "$(
  for dir in $MODULE_DIRS; do
    find "$dir" -maxdepth 1 -type f ! -name "*.module.ts" ! -name "*.controller.ts"
  done
)"

report "4. @/generated fora de repositories, prisma/ e common/enums.ts" "$(
  grep -rn "@/generated" $SRC --include=*.ts |
    grep -v -E "^$SRC/(generated|prisma)/|/repositories/|^$SRC/common/enums.ts"
)"

report "5. PrismaService fora de repository, prisma/ e *.module.ts" "$(
  grep -rln "PrismaService" $SRC --include=*.ts |
    grep -v -E "^$SRC/prisma/|/repositories/|\.module\.ts$"
)"

report "6. Erro do Prisma tratado na mão (use @HandlePrismaErrors)" "$(
  grep -rn "PrismaClientKnownRequestError" $SRC --include=*.ts |
    grep -v -E "^$SRC/(prisma/decorators|generated)/"
)"

report "7. Controller usando repository" "$(grep -rn "Repository" $TARGET --include=*.controller.ts)"

report "8. Repository de outro módulo importado" "$(
  grep -rnE "@/modules/[a-z-]+/repositories/" $SRC/modules --include=*.ts | while IFS= read -r line; do
    file=${line%%:*}
    own=$(echo "$file" | sed -E 's#.*/modules/([^/]+)/.*#\1#')
    imp=$(echo "$line" | sed -E 's#.*@/modules/([^/]+)/repositories.*#\1#')
    [ "$own" != "$imp" ] && echo "$line"
  done
)"

report "9. interface/type exportado dentro de repository (mover para types/)" "$(
  grep -rnE "^export (interface|type) " $TARGET --include=*.ts | grep "/repositories/"
)"

report "10. Import relativo com 2+ níveis (use o alias @/)" "$(grep -rnE "from '\.\./\.\./" $TARGET --include=*.ts)"

report "11. console.* em código de produção" "$(
  grep -rnE "console\.(log|error|warn|debug)" $SRC --include=*.ts | grep -v -E "\.spec\.ts|^$SRC/generated/"
)"

report "12. passwordHash em DTO ou controller (vazamento)" "$(
  grep -rn "passwordHash" $TARGET --include=*.dto.ts --include=*.controller.ts |
    grep -v -E ":[0-9]+:\s*(//|/\*|\*)"
)"

REPO_FILES=$(find "$TARGET" -path '*/repositories/*.ts' ! -name '*.spec.ts' 2>/dev/null)
DTO_FILES=$(find "$TARGET" -path '*/dto/*.dto.ts' 2>/dev/null)

# Modelos com dono (direto ou via vaga). `session` fica de fora: é interno do auth (busca por hash do refresh).
report "13. Query sem userId no repository (heurística: userId nas 8 linhas seguintes)" "$(
  for f in $REPO_FILES; do
    awk -v F="$f" '
      { l[NR] = $0 }
      END {
        for (i = 1; i <= NR; i++)
          if (l[i] ~ /(prisma|tx)\.(resume|tag|jobPosting|writingSettings|analysis|suggestion|generatedMessage)\.(find|update|delete|count|upsert)/) {
            ok = 0
            for (j = i; j <= i + 8 && j <= NR; j++) if (l[j] ~ /userId/) ok = 1
            if (!ok) print F ":" i ": " l[i]
          }
      }' "$f"
  done
)"

report "14. DTO de entrada sem limite de tamanho (@MaxLength / @ArrayMaxSize)" "$(
  for f in $DTO_FILES; do
    awk -v F="$f" '
      /^[[:space:]]*@/ { block = block $0 "\n"; next }
      /^[[:space:]]+[A-Za-z_]+[?!]?:/ {
        if (block ~ /@(IsString|IsArray)\(/ && block !~ /@(MaxLength|Length|ArrayMaxSize|IsIn|IsEnum|IsUUID)\(/)
          print F ":" FNR ": " $0
        block = ""; next
      }
      /[^[:space:]]/ { block = "" }' "$f"
  done
)"

report "15. @Param sem ParseUUIDPipe (id malformado deve dar 400)" "$(
  grep -rnE "@Param\(['\"][A-Za-z]+['\"]\)" $TARGET --include=*.controller.ts
)"

report "16. Módulo que usa IA mas controller sem @Throttle (custo)" "$(
  for dir in $MODULE_DIRS; do
    if grep -rqE "AiService|LlmProvider" "$dir/services" 2>/dev/null; then
      for c in $(find "$dir" -maxdepth 1 -name '*.controller.ts'); do
        grep -qE "Throttle|AiRateLimit" "$c" || echo "$c"
      done
    fi
  done
)"

report "17. SDK de LLM fora de modules/ai" "$(
  grep -rnE "@google/genai|@anthropic-ai/sdk" $SRC --include=*.ts | grep -v "^$SRC/modules/ai/"
)"

report "18. Dependência sem versão exata (^ ou ~)" "$(
  grep -nE '"[@a-zA-Z0-9/._-]+": "[\^~]' backend/package.json package.json frontend/package.json 2>/dev/null
)"

report "19. Variável do env.schema ausente no .env.example" "$(
  for key in $(grep -oE '^[[:space:]]+[A-Z][A-Z0-9_]+:' $SRC/config/env.schema.ts | tr -d ' :'); do
    grep -q "^$key=" backend/.env.example || echo "$key"
  done
)"

report "20. findMany sem take (paginação/limite)" "$(
  for f in $REPO_FILES; do
    awk -v F="$f" '
      { l[NR] = $0 }
      END {
        for (i = 1; i <= NR; i++)
          if (l[i] ~ /findMany\(/) {
            ok = 0
            for (j = i; j <= i + 10 && j <= NR; j++) if (l[j] ~ /take/) ok = 1
            if (!ok) print F ":" i ": " l[i]
          }
      }' "$f"
  done
)"

report "21. Método de repository com 2+ escritas sem \$transaction" "$(
  for f in $REPO_FILES; do
    awk -v F="$f" '
      function flush() { if (name != "" && writes >= 2 && !tx) print F ":" start ": " name " (" writes " escritas)" }
      /^  (async )?[A-Za-z_]+\(.*\)[^;]*\{[[:space:]]*$/ {
        flush(); name = $0; sub(/^  (async )?/, "", name); sub(/\(.*/, "", name)
        start = FNR; writes = 0; tx = 0
      }
      /\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(/ { writes++ }
      /\$transaction/ { tx = 1 }
      END { flush() }' "$f"
  done
)"

report "22. schema.prisma alterado sem migration nova" "$(
  st=$(git status --porcelain backend/prisma)
  if echo "$st" | grep -q "schema.prisma" && ! echo "$st" | grep -q "migrations/"; then
    echo "backend/prisma/schema.prisma"
  fi
)"

report "23. else / else if (use early return)" "$(
  grep -rnE "\belse\b" $TARGET --include=*.ts | grep -v -E "\.spec\.ts|//.*else|\*.*else"
)"

report "24. Logger do Nest usado fora de core/logger (use AppLogger)" "$(
  grep -rnE "new Logger\(|Logger[,} ].*from '@nestjs/common'" $SRC --include=*.ts |
    grep -v -E "^$SRC/(core/logger|generated)/|\.spec\.ts"
)"

report "25. TODO(scaffold) não resolvido (módulo gerado pelo create-new-module-backend)" "$(
  grep -rn "TODO(scaffold)" $TARGET backend/test --include=*.ts
)"

report "26. .env versionado ou segredo literal fora do .env.example" "$(
  git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'
  git grep -nIE "(SECRET|API_KEY|PASSWORD|TOKEN)[A-Z_]*=[^[:space:]]{6,}" -- . \
    ':!*.env.example' ':!*.md' ':!*.spec.ts' ':!backend/test' ':!.claude' 2>/dev/null
)"

report "27. DTO fora de dto/input ou dto/output" "$(
  find $TARGET -path '*/dto/*' -name '*.ts' ! -path '*/dto/input/*' ! -path '*/dto/output/*' 2>/dev/null
)"

report "28. .trim() em service (normalização de entrada é do DTO: use @Trim)" "$(
  grep -rnE '\.trim\(\)' $TARGET --include=*.service.ts | grep -v -E '\.spec\.ts|:[0-9]+:\s*(//|/\*|\*)'
)"

report "29. DTO de saída expondo campo interno (userId, rawText, passwordHash)" "$(
  grep -rnwE 'userId|rawText|passwordHash' $TARGET --include=*.dto.ts |
    grep '/dto/output/' | grep -v -E ':[0-9]+:\s*(//|/\*|\*)'
)"

echo "== $count achado(s) nas checagens objetivas =="
echo "Informativo (revisar à mão): rotas @Public()"
grep -rn "@Public()" $TARGET --include=*.controller.ts | sed 's/^/  /'
exit 0
