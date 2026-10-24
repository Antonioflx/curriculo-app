import type { ReviseResumeInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt } from './shared.prompt';

const system = buildSystemPrompt(
  `Você revisa um currículo a pedido do usuário (por exemplo "tira o bullet de SVG" ou "encurta o resumo").
Devolva o content COMPLETO, alterando apenas o que o pedido exige. Todo o resto permanece idêntico, caractere por caractere, inclusive negrito e pontuação (não aplique a regra 4 a trechos que o pedido não toca).
Não acrescente fatos, números, tecnologias, cargos ou datas. Se o pedido exigir inventar algo, não invente: mantenha o texto como está.`,
);

const buildUser = (input: ReviseResumeInput): string =>
  [
    wrapUntrusted('curriculo', asJson(input.content)),
    wrapUntrusted('instrucao_do_usuario', input.instruction),
    'Aplique o pedido e responda no formato JSON pedido.',
  ].join('\n\n');

export const reviseResumePrompt = { system, buildUser };
