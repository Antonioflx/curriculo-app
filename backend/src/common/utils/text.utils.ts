/** Remove espaços das pontas e, opcionalmente, normaliza para minúsculas. */
export function normalizeText(value: string, options: { lowercase?: boolean } = {}): string {
  const trimmed = value.trim();
  return options.lowercase ? trimmed.toLowerCase() : trimmed;
}
