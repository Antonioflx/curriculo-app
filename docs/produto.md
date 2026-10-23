# Produto

## Problema

Para cada vaga é preciso escolher qual currículo enviar, ajustar o que falta e escrever o e-mail ou as respostas do formulário. O app automatiza esse fluxo.

## Requisitos

1. **Auth:** cadastro, login, logout e refresh com cookies HttpOnly setados pelo backend.
2. **Usuário 1 → N currículos.** Cada currículo serve a um tipo de vaga.
3. **Tags definidas pelo usuário** (ex.: backend, frontend, fullstack, llm). Um currículo com tag é um **currículo base**.
4. **Vaga por texto ou imagem:** o Gemini extrai cargo, empresa, stacks, requisitos, diferenciais, senioridade e se há e-mail de contato.
5. **Avaliação:** o Gemini compara a vaga com os currículos base e indica o melhor para enviar, com a tabela de requisitos (tem / parcial / não tem) e uma lista de **sugestões**.
6. **Sugestões de dois tipos:**
   - **Ênfase** (palavra-chave nas habilidades, título, resumo, ordem dos bullets): o usuário só aceita ou recusa.
   - **Pergunta de fato** ("A vaga pede observabilidade. Você monitorava os bots do sistema de atendimento de alguma forma?"): a IA **nunca** adiciona o fato sem a resposta do usuário. A resposta vira o texto do bullet.
   Um fato confirmado pode ser marcado como **"levar para a base"**: ele passa a valer para todas as vagas, não só para esta.
7. **Preview antes do PDF:** com as sugestões resolvidas, o app monta o **currículo ajustado** e mostra o preview. O usuário pode editar direto no preview ou pedir no chat ("tira o bullet de SVG", "encurta o resumo"), e o preview é refeito.
8. **PDF:** só depois do preview aprovado o app converte o HTML em PDF. Mostra o número de páginas e avisa se passar de 2.
9. **Ajuste temporário:** o currículo ajustado é uma **cópia** ligada à vaga (`ADJUSTED`, status `DRAFT`). A base nunca é alterada pelo ajuste. O usuário pode descartar a cópia ou salvá-la (`SAVED`).
10. **Instruções de escrita:** o usuário configura como as mensagens devem soar (mais objetivas ou mais detalhadas, como começar, assinatura, tom). Funcionam como "instructions" para o Gemini.
11. **Mensagem de candidatura:** se a vaga tem e-mail, gera assunto + corpo seguindo as instruções. Se não tem, não gera corpo.
12. **Perguntas livres sobre a vaga:** o usuário cola uma pergunta de formulário (ex.: "Qualifications Summary em pt-br", "Conte sobre você") e recebe a resposta com base na vaga e no currículo escolhido.

## Páginas

| Rota | Conteúdo |
|---|---|
| `/register` | Nome, e-mail, senha |
| `/login` | E-mail, senha |
| `/curriculos` | Lista de currículos com filtro por tag; criar, editar, duplicar, excluir |
| `/curriculos/[id]` | Editor do currículo (formulário por seção) com preview ao lado e botão "Gerar PDF" |
| `/chat` | Chat-bot da candidatura: envia a vaga, vê a avaliação, responde às perguntas de fato, aceita sugestões, vê o preview do ajustado, gera o PDF e as mensagens |
| `/configuracoes` | Instruções de escrita e dados de assinatura |

## Fluxo do chat

```
1. Usuário envia a vaga (texto e/ou imagem)
2. POST /jobs                       → Gemini extrai a vaga → JobPosting
3. POST /analyses                   → Gemini avalia contra os currículos base
                                      → currículo recomendado, requisitos, Suggestion[]
4. Chat mostra as sugestões:
   - ênfase           → PATCH /suggestions/:id { status: ACCEPTED | REJECTED }
   - pergunta de fato → PATCH /suggestions/:id { answer, promoteToBase? }
5. POST /analyses/:id/adjusted-resume
                                    → Gemini monta o content só com o que foi aceito/respondido
                                    → Resume (ADJUSTED, DRAFT)
6. GET  /resumes/:id/preview        → HTML renderizado (exibido num iframe)
   Edição: PATCH /resumes/:id (direto no preview) ou POST /resumes/:id/revise { instruction } (pelo chat)
7. POST /resumes/:id/pdf            → mesmo HTML → PDF; resposta traz o arquivo e o nº de páginas
8. Se a vaga tem e-mail:  POST /messages { type: EMAIL }  → assunto + corpo
   Perguntas livres:      POST /messages { type: ANSWER, question } → texto
```

**Preview e PDF usam o mesmo HTML.** O backend tem um único renderizador (`content` → HTML com o CSS do currículo). O preview mostra esse HTML num `<iframe sandbox>`, e o PDF é o Chromium imprimindo exatamente ele. Assim o que o usuário aprova é o que sai no PDF.

**"Editar o PDF" = editar o conteúdo e gerar de novo.** O PDF nunca é editado diretamente; ele é sempre um resultado do `content`, que é a fonte.

Cada vaga vira uma conversa no `/chat`. O histórico da conversa é a lista de `GeneratedMessage` e da análise daquela vaga.

## Modelo de dados

```
User 1─N Session
User 1─N Resume N─N Tag (Tag pertence ao User)
User 1─1 WritingSettings
User 1─N JobPosting 1─N Analysis 1─N Suggestion
JobPosting 1─N GeneratedMessage
Resume (ADJUSTED) N─1 Resume (BASE)  via parentId
Resume (ADJUSTED) N─1 JobPosting     via jobId
```

| Entidade | Campos principais |
|---|---|
| `User` | id, name, email (único), passwordHash, createdAt |
| `Session` | id, userId, refreshTokenHash, familyId, expiresAt, revokedAt, userAgent, ip, createdAt |
| `Resume` | id, userId, title, kind (`BASE` \| `ADJUSTED`), status (`DRAFT` \| `SAVED`, só para ADJUSTED), parentId?, jobId?, content (JSON), createdAt, updatedAt |
| `Tag` | id, userId, name (único por usuário) |
| `ResumeTag` | resumeId, tagId |
| `JobPosting` | id, userId, rawText?, title, company?, contactEmail?, extracted (JSON), createdAt |
| `Analysis` | id, jobId, recommendedResumeId, result (JSON: requisitos, lacunas, ajustes), model, inputTokens, outputTokens, createdAt |
| `Suggestion` | id, analysisId, kind (`EMPHASIS` \| `FACT_QUESTION`), target (seção/caminho no content), proposal, question?, answer?, status (`PENDING` \| `ACCEPTED` \| `REJECTED` \| `ANSWERED`), promoteToBase (bool) |
| `GeneratedMessage` | id, jobId, resumeId, type (`EMAIL` \| `ANSWER`), question?, subject?, body, createdAt |
| `WritingSettings` | userId, instructions (texto), tone (`OBJETIVO` \| `DETALHADO`), opening?, signature? |

`Resume.content` segue um schema único (validado com Zod no front e class-validator no back):

```ts
{
  header: { name, headline, location, phone, email, links: [{ label, url }] },
  summary: string,
  experiences: [{ company, role, start, end | null, context, bullets[] }],
  skills: [{ category, items[] }],
  education: [{ course, institution, start, end }],
  languages: [{ name, level }]
}
```

## Fora do escopo do MVP

- Guardar os PDFs gerados. O PDF é gerado sob demanda a partir do `content` e baixado; não há armazenamento de arquivos.
- Guardar a imagem da vaga. Ela vai direto para o Gemini e só o resultado extraído é salvo.
- Importar currículo de um PDF (fase 2, também via Gemini).
- Enviar o e-mail pelo app. O app gera o texto; o envio é manual.
