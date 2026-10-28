const DROPPED_BLOCKS = /<(script|style|head|svg|noscript|template)\b[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const BOLD_TAGS = /<\/?(b|strong)\b[^>]*>/gi;
const LINK = /<a\b[^>]*?\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const LINE_BREAKS = /<\/(p|div|li|h[1-6]|section|article|header|footer|tr|ul|ol)>|<br\s*\/?>/gi;
const ANY_TAG = /<[^>]+>/g;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) return decodeCodePoint(entity, match);
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function decodeCodePoint(entity: string, fallback: string): string {
  const isHex = entity[1]?.toLowerCase() === 'x';
  const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

/**
 * Texto legível de um HTML, para mandar à IA: sem script, estilo nem tags. Negrito vira `**texto**`, link vira
 * `texto (url)` e cada bloco ocupa uma linha. Não executa nem interpreta nada do HTML (A05).
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(DROPPED_BLOCKS, '')
    .replace(COMMENTS, '')
    .replace(BOLD_TAGS, '**')
    .replace(LINK, (_match, href: string, label: string) => `${label} (${href})`)
    .replace(LINE_BREAKS, '\n')
    .replace(ANY_TAG, '');

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
