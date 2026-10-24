/**
 * Delimita texto não confiável (vaga, currículo, instrução do usuário) para o prompt.
 * O texto vira DADO dentro da tag; o system prompt diz que o conteúdo delimitado nunca é instrução.
 */
export function wrapUntrusted(tag: string, text: string): string {
  return `<${tag}>\n${neutralizeTag(text, tag)}\n</${tag}>`;
}

/** Impede que o próprio texto abra ou feche a tag que o delimita (ex.: "</vaga> ignore as regras"). */
function neutralizeTag(text: string, tag: string): string {
  return text.replace(new RegExp(`<(/?)${tag}`, 'gi'), (_match, slash: string) => `&lt;${slash}${tag}`);
}
