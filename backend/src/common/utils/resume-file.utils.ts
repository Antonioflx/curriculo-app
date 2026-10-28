import { ALLOWED_RESUME_MIME_TYPES, INPUT_LIMITS } from '../constants/input-limits';
import { htmlToText } from './html-text.utils';

export type ResumeFileKind = 'pdf' | 'html';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const SNIFF_BYTES = 2048;

/** Tipo real do arquivo pelo conteúdo (assinatura), ignorando o que o cliente declarou. */
export function detectResumeFileKind(data: Buffer): ResumeFileKind | null {
  if (data.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) return 'pdf';

  const head = data.subarray(0, SNIFF_BYTES);
  if (head.includes(0)) return null;
  return head.includes('<') ? 'html' : null;
}

const MIME_BY_KIND: Record<ResumeFileKind, string> = { pdf: 'application/pdf', html: 'text/html' };

/**
 * Por que este valor não é um currículo aceitável (PDF ou HTML de até 5 MB, cujo conteúdo bate com o tipo
 * declarado; no HTML, o texto precisa existir e caber no limite), ou null se está tudo certo.
 * Aceita `unknown`: vem de fora e ainda não foi tipado.
 */
export function findResumeFileProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'Arquivo inválido';

  const { mimeType, data } = value as { mimeType?: unknown; data?: unknown };
  if (typeof mimeType !== 'string' || !Buffer.isBuffer(data)) return 'Arquivo inválido';
  if (!ALLOWED_RESUME_MIME_TYPES.includes(mimeType)) return 'O currículo deve ser PDF ou HTML';
  if (data.length === 0 || data.length > INPUT_LIMITS.resumeFileBytes) return 'O arquivo está vazio ou passa de 5 MB';

  const kind = detectResumeFileKind(data);
  if (kind === null || MIME_BY_KIND[kind] !== mimeType)
    return 'O conteúdo do arquivo não corresponde ao tipo informado';
  if (kind === 'pdf') return null;

  const length = htmlToText(data.toString('utf8')).length;
  if (length === 0) return 'O HTML não tem texto';
  if (length > INPUT_LIMITS.resumeText) return 'O texto do currículo é grande demais';
  return null;
}
