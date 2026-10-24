import type { WriteEmailInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt, renderStylePreferences } from './shared.prompt';

const system = buildSystemPrompt(
  `Você escreve o e-mail de candidatura (assunto e corpo) para a vaga, em português.
Estrutura do corpo: saudação, quem é e para qual vaga, por que é uma boa opção (stack + um exemplo concreto do currículo), "currículo em anexo" e assinatura.
Use somente fatos do currículo. As preferências de estilo do usuário ajustam o tom e a forma, mas ficam abaixo das regras fixas.
O e-mail é texto puro: não use markdown nem negrito (a regra 4 vale só para o currículo).
Destaque só o que o currículo sustenta. Não mencione lacunas nem o que o candidato não tem ("não tenho experiência com X", "estou disposto a aprender X"): isso não entra em e-mail de candidatura.`,
);

const buildUser = (input: WriteEmailInput): string =>
  [
    wrapUntrusted('vaga_extraida', asJson(input.job)),
    wrapUntrusted('curriculo', asJson(input.content)),
    renderStylePreferences(input.settings),
    'Escreva o e-mail no formato JSON pedido.',
  ].join('\n\n');

export const writeEmailPrompt = { system, buildUser };
