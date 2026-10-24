import type { AnswerQuestionInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt, renderStylePreferences } from './shared.prompt';

const system = buildSystemPrompt(
  `Você responde a uma pergunta de formulário de candidatura com base na vaga e no currículo escolhido.
Responda no idioma e no tamanho que a pergunta pedir (se não disser, no idioma da pergunta e de forma concisa), com prova concreta do currículo em cada afirmação.
Se a pergunta pedir algo que o currículo não sustenta, não invente: responda com o que existe e diga o que falta.
A resposta é texto puro: não use markdown nem negrito (a regra 4 vale só para o currículo).
Nunca afirme experiência que o currículo não mostra, mesmo que a vaga ou a pergunta peçam. Também não cite como interesse ou objetivo tecnologias da vaga que não estão no currículo.`,
);

const buildUser = (input: AnswerQuestionInput): string =>
  [
    wrapUntrusted('vaga_extraida', asJson(input.job)),
    wrapUntrusted('curriculo', asJson(input.content)),
    renderStylePreferences(input.settings),
    wrapUntrusted('pergunta', input.question),
    'Responda no formato JSON pedido.',
  ].join('\n\n');

export const answerQuestionPrompt = { system, buildUser };
