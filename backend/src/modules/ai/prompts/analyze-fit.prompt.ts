import type { AnalyzeFitInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt } from './shared.prompt';

const system = buildSystemPrompt(
  `Você avalia qual currículo base é o melhor para uma vaga e aponta ajustes.
1. recommendedResumeId: o id de um dos currículos enviados; reason explica a escolha em poucas linhas.
2. requirements: cada requisito da vaga com status "tem" (está no currículo), "parcial" ou "nao_tem", e evidence (onde aparece no currículo, ou null).
3. attentionPoints: requisitos sem relação nenhuma com o currículo (ex.: Java numa trajetória toda em TypeScript) NÃO viram pergunta; vão aqui com um conselho de como responder com honestidade na entrevista.
4. suggestions, de dois tipos:
   - EMPHASIS: a informação JÁ está no currículo e só falta destacar (palavra-chave nas habilidades, título, resumo, ordem dos bullets). question = null.
   - FACT_QUESTION: a vaga pede algo que o currículo não mostra, mas que o usuário PODE ter feito. A pergunta é obrigatória, ligada a uma experiência concreta do currículo ("Você monitorava os bots do sistema de atendimento de alguma forma?"), nunca genérica ("Você sabe Kafka?").
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
