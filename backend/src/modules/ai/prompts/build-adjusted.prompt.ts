import type { BuildAdjustedInput } from '../types/ai.types';
import { wrapUntrusted } from '../utils/wrap-untrusted';
import { asJson, buildSystemPrompt } from './shared.prompt';

const system = buildSystemPrompt(
  `Você monta o currículo AJUSTADO para uma vaga a partir do currículo base.
Devolva o content COMPLETO do currículo.
- Aplique somente as sugestões aceitas e as respostas do usuário. Nada além disso.
- Cada resposta do usuário vira um bullet (verbo + o que fez + resultado), reescrito a partir do que ele disse, sem acrescentar nenhum fato, número ou tecnologia que ele não tenha dito. Não copie a fala dele: escreva no estilo dos outros bullets da experiência, de forma geral (sem exemplos como "empresa X e Y") e citando o sistema ou projeto que a pergunta menciona (ex.: o sistema de agendamento).
- Habilidades: não acrescente nenhuma que não esteja no currículo base nem na resposta do usuário (mesmo que a vaga peça) e não remova as existentes; só reordene e destaque.
- Ao ajustar título ou resumo, preserve os números e destaques que já existem, a menos que a sugestão peça para trocá-los.
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
