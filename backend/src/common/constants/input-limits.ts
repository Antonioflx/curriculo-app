/**
 * Limites de entrada do usuário (docs/seguranca.md, A06). Valem nos DTOs de quem recebe o dado;
 * os services (e o `AiService`) já recebem o dado validado e não repetem estas checagens.
 */
export const INPUT_LIMITS = {
  jobText: 20_000,
  instruction: 1_000,
  question: 2_000,
  imageBytes: 5 * 1024 * 1024,
  resumeFileBytes: 5 * 1024 * 1024,
  /** Texto de um currículo importado de HTML (depois de tirar as tags). */
  resumeText: 60_000,
} as const;

export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_RESUME_MIME_TYPES: readonly string[] = ['application/pdf', 'text/html'];
