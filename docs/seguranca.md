# Segurança

## Autenticação

| Item | Decisão |
|---|---|
| Senha | Argon2id (`argon2`), mínimo 8 caracteres, checagem contra senhas vazadas comuns |
| `session_token` | JWT de acesso, 15 min, assinado com segredo do ambiente; payload só com `sub` e `sid` |
| `refresh_token` | Valor aleatório opaco (32 bytes), 7 dias. No banco fica **só o hash** (`Session.refreshTokenHash`) |
| Rotação | Todo `/auth/refresh` emite um novo refresh e revoga o anterior. Reuso de um refresh já revogado → revoga a família inteira (`familyId`) |
| Logout | Revoga a sessão no banco e limpa os dois cookies |
| Rate limit | `/auth/login` e `/auth/register` com limite por IP e por e-mail (`@nestjs/throttler`) |
| Mensagens | Login com erro genérico ("e-mail ou senha inválidos"), sem dizer qual dos dois |

### Cookies (setados só pelo backend)

| Cookie | Atributos |
|---|---|
| `session_token` | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900` |
| `refresh_token` | `HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800` |

- O frontend nunca lê nem escreve esses cookies. Em 401, o `lib/http` chama `/api/auth/refresh` uma vez e repete a requisição; se falhar, manda para `/login`.
- **CSRF:** `SameSite` + um guard no backend que, em métodos que alteram estado (POST, PUT, PATCH, DELETE), exige o header `Origin` igual à origem do `web`. Nenhum GET altera estado.

## OWASP Top 10:2025

| Categoria | Controles no projeto |
|---|---|
| **A01 Broken Access Control** | Todo repository filtra por `userId` vindo do token (nunca do body). Recurso de outro usuário → 404, não 403. Guard global de autenticação; rotas públicas marcadas com `@Public()`. IDs em UUID. |
| **A02 Security Misconfiguration** | `helmet` no Nest e headers de segurança no Next (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`). Sem CORS aberto (mesma origem). Swagger e logs verbosos só em desenvolvimento. Variáveis de ambiente validadas no boot. |
| **A03 Software Supply Chain Failures** | `pnpm-lock.yaml` commitado e `pnpm install --frozen-lockfile` no CI. Dependabot/Renovate ativo. `pnpm audit` no CI. Versões fixas, sem `latest`. Poucas dependências. |
| **A04 Cryptographic Failures** | HTTPS em tudo (Vercel). Argon2id para senha, hash SHA-256 para refresh token. Segredos só em variáveis de ambiente da Vercel. Conexão com o Postgres com SSL. |
| **A05 Injection** | Prisma com queries parametrizadas; `$queryRawUnsafe` proibido. DTOs com `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. React escapa a saída; `dangerouslySetInnerHTML` proibido. Prompt injection tratado em docs/ia.md. |
| **A06 Insecure Design** | Ajuste nunca altera o currículo base (cópia `ADJUSTED`). Limites de tamanho: texto da vaga até 20 mil caracteres, imagem até 5 MB, currículos por usuário com teto. Rate limit e cota diária nas rotas de IA. |
| **A07 Authentication Failures** | Rotação de refresh com detecção de reuso, expiração curta do acesso, rate limit no login, logout revogando no servidor, nenhum token em `localStorage`. |
| **A08 Software or Data Integrity Failures** | Saída do Gemini validada por schema antes de salvar. Upload só com MIME e assinatura de arquivo conferidos. Deploy só a partir da `main` com CI verde. |
| **A09 Security Logging and Alerting Failures** | Log estruturado (JSON) de login, falha de login, reuso de refresh token, 403/404 em recurso alheio e erro de IA, com `userId` e `requestId`. Nunca logar senha, token, conteúdo de currículo ou da vaga. Alerta para picos de falha de login e de reuso de token. |
| **A10 Mishandling of Exceptional Conditions** | Filtro global de exceção: resposta padrão `{ statusCode, message, requestId }`, sem stack trace. Timeout e tratamento explícito para falha ou resposta inválida do Gemini. Transações do Prisma em operações com mais de uma escrita. Falha fecha o acesso (fail closed), nunca libera. |
