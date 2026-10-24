import type { BuildAdjustedInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt } from './shared.prompt';

const system = buildSystemPrompt(
  `Você monta o currículo AJUSTADO para uma vaga a partir do currículo base.
Devolva o content COMPLETO do currículo.
- Aplique somente as sugestões aceitas e as respostas do usuário. Nada além disso.
- Cada resposta do usuário vira um bullet (verbo + o que fez + resultado), reescrito a partir do que ele disse, sem acrescentar nenhum fato, número ou tecnologia que ele não tenha dito.
- Não altere experiências: mesma quantidade, mesma ordem, mesma empresa, cargo e datas. Pode reordenar bullets e trocar palavras-chave de habilidades, título e resumo.
- Tudo que não foi tocado por uma sugestão ou resposta permanece idêntico ao base.`,
);

const buildUser = (input: BuildAdjustedInput): string =>
  [
    wrapUntrusted('vaga_extraida', asJson(input.job)),
    wrapUntrusted('curriculo_base', asJson(input.baseContent)),
    wrapUntrusted('sugestoes_aceitas', asJson(input.accepted)),
    wrapUntrusted('respostas_do_usuario', asJson(input.answered)),
    'Monte o currículo ajustado no formato JSON pedido.',
  ].join('\n\n');

export const buildAdjustedPrompt = { system, buildUser };
