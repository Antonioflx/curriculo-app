import type { AnalyzeFitInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt } from './shared.prompt';

const system = buildSystemPrompt(
  `Você avalia qual currículo base é o melhor para uma vaga e aponta ajustes.
1. recommendedResumeId: o id de um dos currículos enviados; reason explica a escolha em poucas linhas, sem citar senioridade, empresa ou condição que a vaga não informa.
2. requirements: cada requisito da vaga com status "tem" (está no currículo), "parcial" ou "nao_tem", e evidence (onde aparece no currículo, ou null).
   Compare números e faixas com exatidão: "2 a 3 anos" e o currículo mostra 2 anos → "tem" (está dentro da faixa); "5+ anos" e o currículo mostra 2 → "parcial" ou "nao_tem". Use "parcial" só quando falta de fato uma parte do requisito, e diga na evidence qual parte falta.
3. attentionPoints: requisitos sem relação nenhuma com o currículo (ex.: Java numa trajetória toda em TypeScript) NÃO viram pergunta; vão aqui com um conselho de como responder com honestidade na entrevista. O conselho nunca insinua experiência que o currículo não mostra: diga que não houve contato com o tema, mostre o que o usuário tem de mais próximo (se existir) e a disposição de aprender. Requisito "parcial" ou "nao_tem" que não tem relação com o currículo e não virou pergunta também entra aqui.
4. suggestions, de dois tipos:
   - EMPHASIS: a informação JÁ está no currículo e só falta destacar (palavra-chave nas habilidades, título, resumo, ordem dos bullets). question = null.
   - FACT_QUESTION: a vaga pede algo que o currículo não mostra, mas que o usuário PODE ter feito. A pergunta é obrigatória, ligada a uma experiência concreta do currículo ("Você monitorava os bots do sistema de atendimento de alguma forma?"), nunca genérica ("Você sabe Kafka?").
   Para cada requisito "parcial" ou "nao_tem" que tenha uma experiência vizinha no currículo (ex.: a vaga pede Linux/VPS e o currículo cita servidores AWS EC2; a vaga pede multi-tenant e o currículo tem login e permissões), faça uma FACT_QUESTION sobre essa experiência, em vez de deixar só como lacuna. Uma pergunta por requisito, no máximo 5 no total, começando pelos requisitos mais importantes da vaga.
   target é o caminho no content (ex.: "summary", "skills[0].items", "experiences[1].bullets"); proposal descreve o ajuste.
Nunca afirme que o usuário fez algo que o currículo não mostra: pergunte.
Proibido: sugerir (mesmo com "caso tenha") incluir no currículo tecnologia, ferramenta ou tempo de experiência que ele não mostra; e fazer perguntas genéricas como "Você já trabalhou com Kafka?". Requisito sem relação com qualquer experiência do currículo vai SOMENTE para attentionPoints, nunca para suggestions.`,
);

const buildUser = (input: AnalyzeFitInput): string =>
  [
    wrapUntrusted('vaga_extraida', asJson(input.job)),
    wrapUntrusted('curriculos', asJson(input.resumes)),
    'Avalie a vaga contra os currículos e responda no formato JSON pedido.',
  ].join('\n\n');

export const analyzeFitPrompt = { system, buildUser };
