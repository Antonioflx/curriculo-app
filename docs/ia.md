# IA (Gemini, com Groq como alternativa)

## Integração

- Módulo `ai/`: a interface `LlmProvider` é genérica (`generateJson({ system, user, image?, jsonSchema })`), com a implementação `GeminiProvider` (SDK `@google/genai`); o `AiService` tem as tarefas, os prompts e os schemas, iguais para qualquer provider. Nenhum outro módulo importa o SDK. Cada tarefa declara provider, temperatura e topK com `@LlmTask({...})`; o `LlmProviderRegistry` escolhe o provider (padrão: `LLM_PROVIDER`). Para adicionar o Claude: criar o `ClaudeProvider` e registrá-lo no registry.
- Toda chamada usa **saída estruturada** (`responseMimeType: application/json` + `responseSchema`) e o retorno é validado de novo no backend antes de ser salvo. Resposta inválida → erro tratado, nunca dado parcial no banco.
- A imagem da vaga vai como `inlineData` (base64) na mesma chamada da extração. Só JPEG, PNG e WEBP, até 5 MB.
- Prompts ficam em arquivos versionados em `modules/ai/prompts/` (um por tarefa), nunca montados com concatenação espalhada pelo código.
- Registrar em cada chamada: tarefa, modelo, tokens de entrada e saída, duração. Não registrar o conteúdo do currículo nem da vaga nos logs.
- Rate limit por usuário nas rotas que chamam o Gemini (custo).

## Modelos, provedores e fallback

Escolha atual, medida com `pnpm --filter backend ai:bench` (out/2026; **uma amostra por modelo**, então é indicativa, não estatística):

| Modelo | Papel | Resultado nas 6 tarefas | Pipeline |
|---|---|---|---|
| `gemini-3.5-flash-lite` | principal (`GEMINI_MODEL`) | 6/6 válidas; segue as regras (Kafka vai para "pontos de atenção", não inventa fato, texto puro) | ~8-10 s |
| `gemini-3.1-flash-lite` | reserva do Gemini (`GEMINI_FALLBACK_MODEL`) | 6/6 válidas; e-mail menos confiável antes dos ajustes de prompt | ~30 s |
| `qwen/qwen3.8-27b` (Groq) | provider alternativo (`GROQ_MODEL`) | 5/6, sem inventar fato; deixa o Kafka fora de "pontos de atenção"; modelo *preview* (pode sumir) | ~50-90 s |
| `openai/gpt-oss-120b` (Groq) | descartado como padrão | ignora a regra do Kafka, inventou experiência numa resposta e gera JSON inválido de forma intermitente | ~75 s |
| `gemini-3.8-flash` | descartado hoje | 503/504 e 75-88 s por chamada | n/a |

Preços oficiais (por 1M tokens, entrada/saída; a saída inclui o raciocínio): `gemini-3.5-flash-lite` US$0,30/2,50; `gemini-3.1-flash-lite` US$0,25/1,50; `gemini-3.8-flash` US$0,75/3,75 (dobra em 01/01/2027); Groq `gpt-oss-120b` US$0,15/0,60 e `qwen3.8-27b` US$0,80/4,00. Uma candidatura completa (6 chamadas, ~5,5 mil tokens de entrada e ~1,6 mil de saída no lite) custa por volta de **US$0,006**.

- **Modelos mudam e somem rápido:** os `gemini-2.5-*` foram aposentados para contas novas (404) mesmo aparecendo na listagem. Antes de adotar ou trocar de modelo, rode o benchmark (`ai:bench`, que usa os mesmos prompts e schemas do app) em vez de decidir por reputação.
- **Cadeia de providers:** `LLM_PROVIDER` (principal) e `LLM_FALLBACK_PROVIDER` (opcional, ex.: `groq`). Só se passa ao próximo quando o anterior fica *indisponível*: cota, 429/5xx, timeout, falha de rede, chave ou modelo inválidos. Erro de pedido (400) não troca de provider. O Groq não recebe imagem: pedido com imagem fica só no Gemini. Todos indisponíveis → 503 "IA indisponível no momento"; a troca fica no log (`ai_provider_fallback`).
- **Prazo:** `AI_TIMEOUT_MS` limita cada tentativa e `AI_TOTAL_TIMEOUT_MS` (padrão 60 s) é o orçamento da chamada inteira, **compartilhado por todos os providers** (tentativas, esperas e trocas). Precisa caber no `maxDuration` da função na Vercel.
- **Repetição:** 429/503 são repetidos no mesmo modelo/provider (1 s, 2 s, ou o que o servidor pedir em `retry-after`/"retry in Xs"), mas só se a espera for de até 10 s ou se esse for o **último** da cadeia e a espera couber no prazo. Cota diária ("retry in 7h47m") nunca cabe: troca. 504/timeout vai direto ao próximo modelo/provider. No Groq, JSON inválido gerado pelo modelo (400 `json_validate_failed`) é repetido até 2 vezes.
- **Cotas das contas gratuitas:** Gemini Free ~20 requisições por dia **por modelo**; Groq `on_demand` 1.000 requisições/dia, 8.000 tokens/min e, no `qwen3.8-27b`, **1.000 tokens de saída por minuto** (só dá para 2 a 3 chamadas por minuto). Nenhuma das duas sustenta uso real: habilite billing no Gemini (Tier 1, efeito imediato) e, se usar o Groq como alternativa, no plano Developer.
- **Schema de saída:** o Zod é a fonte única: gera o JSON Schema enviado ao modelo e valida a resposta. O Gemini aceita só um subconjunto: o conversor descarta `maxLength`, `pattern` etc. e **`maxItems`** (em schemas aninhados estoura a complexidade: 400), levando o limite de itens para a descrição ("até N itens"). O modo estrito do Groq exige `additionalProperties: false` e todas as propriedades em `required` e recusa `format` (ex.: `uri`), que é removido do pedido. Em ambos o Zod aplica os limites depois. Os limites do `content` vêm de `RESUME_CONTENT_LIMITS`, compartilhados com o DTO.
- **Defesas:** a ENTRADA é validada no DTO de quem chama o `AiService` (`jobs`, `resumes`, `messages`...: texto aparado e dentro do limite, imagem JPEG/PNG/WEBP de até 5 MB conferida por assinatura, regra "texto ou imagem"); o `AiService` só valida a SAÍDA do modelo. Texto não confiável entra delimitado e não consegue fechar a própria tag (`wrapUntrusted`); `recommendedResumeId` só aceita ids dos currículos enviados; o ajustado é recusado se mudar empresa, cargo ou datas; imagem é conferida por assinatura (JPEG/PNG/WEBP, até 5 MB). Modelos mais fracos violam as regras de escrita mesmo quando explícitas (Kafka como sugestão, experiência inventada): o texto gerado é sempre revisado pelo usuário antes de ir a qualquer lugar.
- **Limite por usuário:** as rotas que chamam a IA usam `@AiRateLimit()` (10 chamadas por minuto por usuário e por IP). A cota diária por usuário depende de armazenamento persistente e ainda não existe.
- **Verificação real:** o Jest não consegue chamar o Gemini (o SDK usa uma API do undici que não existe no sandbox `vm` dele). Use `pnpm --filter backend ai:smoke` (as 6 tarefas pela cadeia real; gasta tokens) e `pnpm --filter backend ai:bench [--show] [provider:modelo ...]` (compara modelos com checagens de qualidade). Para testar a queda para o Groq: `GEMINI_API_KEY= node scripts/ai-smoke.cjs` (após `pnpm build`).

## Tarefas

| Tarefa | Entrada | Saída |
|---|---|---|
| `extractJob` | texto e/ou imagem da vaga | cargo, empresa, contactEmail, stacks[], requisitos[], diferenciais[], senioridade, modelo de contratação |
| `analyzeFit` | vaga extraída + currículos base (com tags) | currículo recomendado + motivo, tabela de requisitos (`tem` / `parcial` / `nao_tem` + onde aparece), pontos de atenção e `suggestions[]` (`EMPHASIS` ou `FACT_QUESTION`) |
| `buildAdjusted` | currículo base + sugestões aceitas + respostas do usuário | `content` do currículo ajustado |
| `reviseResume` | `content` atual + instrução do usuário no chat | `content` revisado |
| `writeEmail` | vaga + currículo + WritingSettings | assunto + corpo |
| `answerQuestion` | pergunta + vaga + currículo + WritingSettings | texto da resposta |

## Sugestões: ênfase × pergunta de fato

O `analyzeFit` separa o que pode ser feito com o que já existe do que depende de um fato que o currículo não mostra:

| Tipo | Quando | Exemplo |
|---|---|---|
| `EMPHASIS` | A informação já está no currículo, só falta destacar | "Acrescentar 'prompt design' e 'interfaces conversacionais' na linha de IA, porque a vaga usa esses termos." |
| `FACT_QUESTION` | A vaga pede algo que o currículo não mostra, mas que o usuário **pode** ter feito | "A vaga pede observabilidade de sistemas LLM. Você monitorava os bots do sistema de atendimento de alguma forma (logs, métricas, alertas)?" |

- A pergunta é sempre ligada a uma experiência concreta do currículo, nunca genérica ("Você sabe Kafka?").
- Requisito sem nenhuma relação com o currículo (ex.: Java numa trajetória toda em TypeScript) **não vira pergunta**: vai para "pontos de atenção" como `nao_tem`, com uma sugestão de como responder na entrevista.
- `buildAdjusted` só usa sugestões `ACCEPTED` e respostas `ANSWERED`. A resposta do usuário é reescrita no formato de bullet, sem acrescentar nada que ele não disse.

## Proteção contra prompt injection

O texto e a imagem da vaga são **dados não confiáveis**: um anúncio pode conter "ignore as instruções anteriores".

- Instruções do sistema vão em `systemInstruction`. A vaga vai no conteúdo do usuário, delimitada (`<vaga>...</vaga>`), e o prompt diz explicitamente que o conteúdo delimitado é dado, nunca instrução.
- A saída é sempre JSON validado por schema: o modelo não consegue "responder outra coisa" que chegue ao banco ou à tela.
- O modelo não tem ferramentas nem acesso a nada além do que o backend passa na chamada.
- As `WritingSettings` do usuário entram como preferência de estilo, abaixo das regras fixas do sistema. Elas não podem desligar a regra de não inventar fatos.

## Regras fixas de escrita (vão no `systemInstruction` de todas as tarefas)

Vêm do processo manual que originou o app:

1. **Nunca inventar** fatos, números, tecnologias, cargos ou datas. Só usar o que está no currículo. Se faltar dado, dizer o que falta em vez de preencher.
2. **Lacuna não vira mentira:** se a vaga pede algo que o usuário não tem, a avaliação marca `nao_tem` e sugere como responder com honestidade. Nunca adiciona a tecnologia ao currículo.
3. **Bullets** com verbo + o que fez + resultado, no máximo 2 linhas, sem adjetivos vazios ("robusto", "escalável", "apaixonado").
4. **No currículo, negrito só em números e resultados. E-mail e respostas de formulário são texto puro: sem negrito nem markdown.**
5. **Ajuste muda ênfase, não fatos:** título, resumo, ordem dos bullets e palavras-chave das habilidades podem mudar; experiências e datas não.
6. **E-mail curto:** saudação, quem é e para qual vaga, por que é uma boa opção (stack + um exemplo concreto), "currículo em anexo", assinatura.
7. **Respostas de formulário** no idioma pedido, no tamanho do campo, com prova concreta em cada afirmação.
8. Não inflar senioridade.
