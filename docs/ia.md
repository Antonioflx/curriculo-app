# IA (Gemini)

## Integração

- Módulo `ai/` com a interface `LlmProvider` e a implementação `GeminiProvider` (SDK `@google/genai`). Nenhum outro módulo importa o SDK.
- Toda chamada usa **saída estruturada** (`responseMimeType: application/json` + `responseSchema`) e o retorno é validado de novo no backend antes de ser salvo. Resposta inválida → erro tratado, nunca dado parcial no banco.
- A imagem da vaga vai como `inlineData` (base64) na mesma chamada da extração. Só JPEG, PNG e WEBP, até 5 MB.
- Prompts ficam em arquivos versionados em `modules/ai/prompts/` (um por tarefa), nunca montados com concatenação espalhada pelo código.
- Registrar em cada chamada: tarefa, modelo, tokens de entrada e saída, duração. Não registrar o conteúdo do currículo nem da vaga nos logs.
- Rate limit por usuário nas rotas que chamam o Gemini (custo).

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
4. **Negrito só em números e resultados.**
5. **Ajuste muda ênfase, não fatos:** título, resumo, ordem dos bullets e palavras-chave das habilidades podem mudar; experiências e datas não.
6. **E-mail curto:** saudação, quem é e para qual vaga, por que é uma boa opção (stack + um exemplo concreto), "currículo em anexo", assinatura.
7. **Respostas de formulário** no idioma pedido, no tamanho do campo, com prova concreta em cada afirmação.
8. Não inflar senioridade.
