import { ALLOWED_IMAGE_MIME_TYPES, INPUT_LIMITS } from '../constants/input-limits';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipo real do arquivo pelos primeiros bytes (assinatura), ignorando o que o cliente declarou. */
export function detectImageMime(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * Por que este valor não é uma imagem aceitável (JPEG, PNG ou WEBP de até 5 MB, cujo conteúdo bate com o tipo
 * declarado, A08), ou null se está tudo certo. Aceita `unknown`: vem de fora e ainda não foi tipado.
 */
export function findImageProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'Imagem inválida';

  const { mimeType, data } = value as { mimeType?: unknown; data?: unknown };
  if (typeof mimeType !== 'string' || !Buffer.isBuffer(data)) return 'Imagem inválida';
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) return 'A imagem deve ser JPEG, PNG ou WEBP';
  if (data.length === 0 || data.length > INPUT_LIMITS.imageBytes) return 'A imagem está vazia ou passa de 5 MB';
  if (detectImageMime(data) !== mimeType) return 'O conteúdo do arquivo não corresponde ao tipo informado';
  return null;
}
