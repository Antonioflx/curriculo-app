#!/usr/bin/env bash
# Gera o esqueleto de um módulo do backend no padrão do projeto (CLAUDE.md).
# Uso: bash .claude/skills/create-new-module-backend/scaffold.sh <plural-kebab> <singular-kebab> [model-prisma]
# Ex.:  bash .claude/skills/create-new-module-backend/scaffold.sh job-postings job-posting jobPosting
set -euo pipefail

PLURAL=${1:-}
SINGULAR=${2:-}
if [ -z "$PLURAL" ] || [ -z "$SINGULAR" ]; then
  echo "Uso: scaffold.sh <plural-kebab> <singular-kebab> [model-prisma]" >&2
  exit 1
fi
for name in "$PLURAL" "$SINGULAR"; do
  [[ "$name" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] || { echo "Nome inválido (use kebab-case): $name" >&2; exit 1; }
done

cd "$(git rev-parse --show-toplevel)"
ROOT=${SCAFFOLD_ROOT:-backend}
MODULE_DIR="$ROOT/src/modules/$PLURAL"
E2E_FILE="$ROOT/test/$PLURAL.e2e-spec.ts"
if [ -e "$MODULE_DIR" ] || [ -e "$E2E_FILE" ]; then
  echo "Já existe: $MODULE_DIR ou $E2E_FILE. Nada foi alterado." >&2
  exit 1
fi

pascal() { echo "$1" | awk -F- '{for (i = 1; i <= NF; i++) printf "%s%s", toupper(substr($i, 1, 1)), substr($i, 2)}'; }
camel() { local p; p=$(pascal "$1"); echo "$(echo "${p:0:1}" | tr 'A-Z' 'a-z')${p:1}"; }
upper_snake() { echo "$1" | tr 'a-z-' 'A-Z_'; }

PASCAL=$(pascal "$SINGULAR")
PASCAL_PLURAL=$(pascal "$PLURAL")
CAMEL=$(camel "$SINGULAR")
CAMEL_PLURAL=$(camel "$PLURAL")
MODEL=${3:-$CAMEL}
CONST=$(upper_snake "$SINGULAR")

mkdir -p "$MODULE_DIR"/{services,repositories,dto/input,dto/output,constants,types} "$ROOT/test"

# ---------- constants ----------
cat > "$MODULE_DIR/constants/$SINGULAR.constants.ts" <<'EOF'
import { NotFoundException } from '@nestjs/common';

export const %%CONST%%_NOT_FOUND_MESSAGE = '%%PASCAL%% não encontrado'; // TODO(scaffold): ajuste o texto
export const %%CONST%%_LIST_LIMIT = 100;

/** Erros do Prisma → exceptions, para os métodos do %%PASCAL_PLURAL%%Repository. */
export const %%CONST%%_ERRORS = {
  P2025: () => new NotFoundException(%%CONST%%_NOT_FOUND_MESSAGE),
};
EOF

# ---------- types ----------
cat > "$MODULE_DIR/types/$SINGULAR.types.ts" <<'EOF'
// TODO(scaffold): troque pelos campos reais (veja o model %%MODEL%% em prisma/schema.prisma).

export interface %%PASCAL%%Entity {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Create%%PASCAL%%Data {
  name: string;
}

export interface Update%%PASCAL%%Data {
  name?: string;
}
EOF

# ---------- dto ----------
cat > "$MODULE_DIR/dto/input/create-$SINGULAR.dto.ts" <<'EOF'
import { IsNotEmpty } from 'class-validator';
import { Text, Trim } from '@/common/decorators/validation.decorators';

export class Create%%PASCAL%%Dto {
  // TODO(scaffold): campos reais. O DTO é a borda de ENTRADA: tipo, normalização (@Trim), limite de tamanho
  // (@Text, @TextList, @ArrayMaxSize) e regras entre campos vivem aqui; o service recebe o dado já validado.
  @Trim()
  @IsNotEmpty()
  @Text(100)
  name: string;
}
EOF

cat > "$MODULE_DIR/dto/input/update-$SINGULAR.dto.ts" <<'EOF'
import { StrictPartialType } from '@/common/dto/strict-partial-type';
import { Create%%PASCAL%%Dto } from './create-%%SINGULAR%%.dto';

export class Update%%PASCAL%%Dto extends StrictPartialType(Create%%PASCAL%%Dto) {}
EOF

cat > "$MODULE_DIR/dto/output/$SINGULAR-response.dto.ts" <<'EOF'
import type { %%PASCAL%%Entity } from '@/modules/%%PLURAL%%/types/%%SINGULAR%%.types';

export class %%PASCAL%%ResponseDto {
  id: string;
  name: string;
  createdAt: Date;

  static from(entity: %%PASCAL%%Entity): %%PASCAL%%ResponseDto {
    return { id: entity.id, name: entity.name, createdAt: entity.createdAt };
  }
}
EOF

# ---------- repository ----------
cat > "$MODULE_DIR/repositories/$PLURAL.repository.ts" <<'EOF'
import { Injectable } from '@nestjs/common';
import { HandlePrismaErrors } from '@/prisma/decorators/handle-prisma-errors.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { %%CONST%%_ERRORS, %%CONST%%_LIST_LIMIT } from '../constants/%%SINGULAR%%.constants';
import type { Create%%PASCAL%%Data, Update%%PASCAL%%Data } from '../types/%%SINGULAR%%.types';

/** Único lugar que fala com o Prisma. Toda query filtra por `userId`. */
@Injectable()
export class %%PASCAL_PLURAL%%Repository {
  constructor(private readonly prisma: PrismaService) {}

  @HandlePrismaErrors()
  create(userId: string, data: Create%%PASCAL%%Data) {
    return this.prisma.%%MODEL%%.create({ data: { userId, ...data } });
  }

  findAll(userId: string) {
    return this.prisma.%%MODEL%%.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: %%CONST%%_LIST_LIMIT,
    });
  }

  findById(userId: string, id: string) {
    return this.prisma.%%MODEL%%.findFirst({ where: { id, userId } });
  }

  @HandlePrismaErrors(%%CONST%%_ERRORS)
  update(userId: string, id: string, data: Update%%PASCAL%%Data) {
    return this.prisma.%%MODEL%%.update({ where: { id, userId }, data });
  }

  @HandlePrismaErrors(%%CONST%%_ERRORS)
  delete(userId: string, id: string) {
    return this.prisma.%%MODEL%%.delete({ where: { id, userId } });
  }
}
EOF

# ---------- service ----------
cat > "$MODULE_DIR/services/$PLURAL.service.ts" <<'EOF'
import { Injectable, NotFoundException } from '@nestjs/common';
import { %%CONST%%_NOT_FOUND_MESSAGE } from '../constants/%%SINGULAR%%.constants';
import { Create%%PASCAL%%Dto } from '../dto/input/create-%%SINGULAR%%.dto';
import { Update%%PASCAL%%Dto } from '../dto/input/update-%%SINGULAR%%.dto';
import { %%PASCAL_PLURAL%%Repository } from '../repositories/%%PLURAL%%.repository';

/** Regra de negócio. Recebe dados já validados (DTO) e nunca usa Prisma diretamente. */
@Injectable()
export class %%PASCAL_PLURAL%%Service {
  constructor(private readonly %%CAMEL_PLURAL%%: %%PASCAL_PLURAL%%Repository) {}

  create(userId: string, dto: Create%%PASCAL%%Dto) {
    return this.%%CAMEL_PLURAL%%.create(userId, dto);
  }

  list(userId: string) {
    return this.%%CAMEL_PLURAL%%.findAll(userId);
  }

  async get(userId: string, id: string) {
    const %%CAMEL%% = await this.%%CAMEL_PLURAL%%.findById(userId, id);
    if (!%%CAMEL%%) throw new NotFoundException(%%CONST%%_NOT_FOUND_MESSAGE);
    return %%CAMEL%%;
  }

  update(userId: string, id: string, dto: Update%%PASCAL%%Dto) {
    return this.%%CAMEL_PLURAL%%.update(userId, id, dto);
  }

  async remove(userId: string, id: string) {
    await this.%%CAMEL_PLURAL%%.delete(userId, id);
  }
}
EOF

cat > "$MODULE_DIR/services/$PLURAL.service.spec.ts" <<'EOF'
import { NotFoundException } from '@nestjs/common';
import { Create%%PASCAL%%Dto } from '../dto/input/create-%%SINGULAR%%.dto';
import { %%PASCAL_PLURAL%%Repository } from '../repositories/%%PLURAL%%.repository';
import { %%PASCAL_PLURAL%%Service } from './%%PLURAL%%.service';

describe('%%PASCAL_PLURAL%%Service', () => {
  const repository = { create: jest.fn(), findAll: jest.fn(), findById: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const service = new %%PASCAL_PLURAL%%Service(repository as unknown as %%PASCAL_PLURAL%%Repository);

  beforeEach(() => jest.resetAllMocks());

  it('create grava para o usuário informado', async () => {
    const dto = { name: 'Exemplo' } as Create%%PASCAL%%Dto; // TODO(scaffold): campos reais
    await service.create('u1', dto);
    expect(repository.create).toHaveBeenCalledWith('u1', dto);
  });

  it('list consulta só os registros do usuário', async () => {
    await service.list('u1');
    expect(repository.findAll).toHaveBeenCalledWith('u1');
  });

  describe('get', () => {
    it('devolve o registro do usuário', async () => {
      repository.findById.mockResolvedValue({ id: 'x1' });
      await expect(service.get('u1', 'x1')).resolves.toEqual({ id: 'x1' });
      expect(repository.findById).toHaveBeenCalledWith('u1', 'x1');
    });

    it('404 quando não existe ou é de outro usuário', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.get('u1', 'x1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('update e remove delegam ao repository com o userId', async () => {
    await service.update('u1', 'x1', { name: 'Novo' });
    await service.remove('u1', 'x1');
    expect(repository.update).toHaveBeenCalledWith('u1', 'x1', { name: 'Novo' });
    expect(repository.delete).toHaveBeenCalledWith('u1', 'x1');
  });

  // TODO(scaffold): um teste por regra de negócio do módulo (limites, estados, validações entre módulos).
});
EOF

# ---------- controller ----------
cat > "$MODULE_DIR/$PLURAL.controller.ts" <<'EOF'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UuidParam } from '@/common/decorators/uuid-param.decorator';
import { Create%%PASCAL%%Dto } from './dto/input/create-%%SINGULAR%%.dto';
import { %%PASCAL%%ResponseDto } from './dto/output/%%SINGULAR%%-response.dto';
import { Update%%PASCAL%%Dto } from './dto/input/update-%%SINGULAR%%.dto';
import { %%PASCAL_PLURAL%%Service } from './services/%%PLURAL%%.service';

/** HTTP apenas: recebe o DTO, chama o service e devolve o DTO de saída. Autenticada por padrão. */
@Controller('%%PLURAL%%')
export class %%PASCAL_PLURAL%%Controller {
  constructor(private readonly %%CAMEL_PLURAL%%: %%PASCAL_PLURAL%%Service) {}

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() dto: Create%%PASCAL%%Dto): Promise<%%PASCAL%%ResponseDto> {
    return %%PASCAL%%ResponseDto.from(await this.%%CAMEL_PLURAL%%.create(userId, dto));
  }

  @Get()
  async list(@CurrentUser('userId') userId: string): Promise<%%PASCAL%%ResponseDto[]> {
    return (await this.%%CAMEL_PLURAL%%.list(userId)).map((%%CAMEL%%) => %%PASCAL%%ResponseDto.from(%%CAMEL%%));
  }

  @Get(':id')
  async get(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<%%PASCAL%%ResponseDto> {
    return %%PASCAL%%ResponseDto.from(await this.%%CAMEL_PLURAL%%.get(userId, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @UuidParam() id: string,
    @Body() dto: Update%%PASCAL%%Dto,
  ): Promise<%%PASCAL%%ResponseDto> {
    return %%PASCAL%%ResponseDto.from(await this.%%CAMEL_PLURAL%%.update(userId, id, dto));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @UuidParam() id: string): Promise<void> {
    await this.%%CAMEL_PLURAL%%.remove(userId, id);
  }
}
EOF

# ---------- module ----------
cat > "$MODULE_DIR/$PLURAL.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { %%PASCAL_PLURAL%%Controller } from './%%PLURAL%%.controller';
import { %%PASCAL_PLURAL%%Repository } from './repositories/%%PLURAL%%.repository';
import { %%PASCAL_PLURAL%%Service } from './services/%%PLURAL%%.service';

@Module({
  controllers: [%%PASCAL_PLURAL%%Controller],
  providers: [%%PASCAL_PLURAL%%Repository, %%PASCAL_PLURAL%%Service],
  exports: [%%PASCAL_PLURAL%%Service],
})
export class %%PASCAL_PLURAL%%Module {}
EOF

# ---------- e2e ----------
cat > "$E2E_FILE" <<'EOF'
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { api, cleanupUsers, createTestApp, signUp } from '@test/helpers/e2e';

describe('%%PASCAL_PLURAL%% (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ana: ReturnType<typeof api>;
  let bruno: ReturnType<typeof api>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ana = api(app, (await signUp(app)).cookie);
    bruno = api(app, (await signUp(app)).cookie);
  });

  afterAll(() => cleanupUsers(app, prisma));

  const create = async () =>
    (await ana.post('/api/%%PLURAL%%').send({ name: 'Exemplo' }).expect(201)).body as { id: string }; // TODO(scaffold): payload real

  it('exige login', async () => {
    await api(app).get('/api/%%PLURAL%%').expect(401);
  });

  it('cria, lê, edita e exclui', async () => {
    const item = await create();
    await ana.get(`/api/%%PLURAL%%/${item.id}`).expect(200);
    await ana.patch(`/api/%%PLURAL%%/${item.id}`).send({ name: 'Novo' }).expect(200);
    await ana.delete(`/api/%%PLURAL%%/${item.id}`).expect(204);
    await ana.get(`/api/%%PLURAL%%/${item.id}`).expect(404);
  });

  it('registro de outro usuário dá 404 em leitura, edição e exclusão', async () => {
    const item = await create();
    await bruno.get(`/api/%%PLURAL%%/${item.id}`).expect(404);
    await bruno.patch(`/api/%%PLURAL%%/${item.id}`).send({ name: 'invadido' }).expect(404);
    await bruno.delete(`/api/%%PLURAL%%/${item.id}`).expect(404);
    await ana.get(`/api/%%PLURAL%%/${item.id}`).expect(200);
  });

  it('id malformado dá 400 e id inexistente dá 404', async () => {
    await ana.get('/api/%%PLURAL%%/nao-e-uuid').expect(400);
    await ana.get(`/api/%%PLURAL%%/${randomUUID()}`).expect(404);
  });

  // TODO(scaffold): entradas inválidas (400), limites e regras específicas do módulo.
});
EOF

# ---------- substitui os marcadores ----------
FILES=$(find "$MODULE_DIR" -type f)
FILES="$FILES $E2E_FILE"
for f in $FILES; do
  sed -i \
    -e "s/%%PASCAL_PLURAL%%/$PASCAL_PLURAL/g" \
    -e "s/%%CAMEL_PLURAL%%/$CAMEL_PLURAL/g" \
    -e "s/%%PASCAL%%/$PASCAL/g" \
    -e "s/%%CAMEL%%/$CAMEL/g" \
    -e "s/%%PLURAL%%/$PLURAL/g" \
    -e "s/%%SINGULAR%%/$SINGULAR/g" \
    -e "s/%%MODEL%%/$MODEL/g" \
    -e "s/%%CONST%%/$CONST/g" \
    "$f"
done

if grep -rn "%%" $FILES >/dev/null 2>&1; then
  echo "Marcadores não substituídos:" >&2
  grep -rn "%%" $FILES >&2
  exit 1
fi

# Formata só o que foi gerado (Biome do backend).
if [ -z "${SCAFFOLD_ROOT:-}" ]; then
  (cd "$ROOT" && pnpm exec biome format --write "src/modules/$PLURAL" "test/$PLURAL.e2e-spec.ts" >/dev/null)
fi

echo "Módulo criado em $MODULE_DIR"
echo "Gerados: module, controller, services/ (+spec), repositories/, dto/input (create, update) e dto/output (response), constants/, types/, $E2E_FILE"
echo
echo "Próximos passos:"
echo "  1. Garanta o model '$MODEL' em prisma/schema.prisma (com userId) + migration + prisma:generate."
echo "  2. Registre ${PASCAL_PLURAL}Module em $ROOT/src/app.module.ts."
echo "  3. Troque todos os TODO(scaffold) (campos, DTOs, regras, specs). O review-backend acusa os que sobrarem."
