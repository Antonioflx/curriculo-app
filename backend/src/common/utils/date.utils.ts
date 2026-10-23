const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

type DatePart = 'day' | 'month' | 'year' | 'hour' | 'minute';

function partsOf(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone, ...options }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<DatePart, string>;
}

/** `dd/MM/yyyy` no fuso informado (padrão: horário de Brasília). */
export function formatDate(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const { day, month, year } = partsOf(date, timeZone, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${day}/${month}/${year}`;
}

/** `dd/MM/yyyy HH:mm` (24h) no fuso informado (padrão: horário de Brasília). */
export function formatDateTime(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const { day, month, year, hour, minute } = partsOf(date, timeZone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export const addSeconds = (date: Date, seconds: number): Date => new Date(date.getTime() + seconds * 1000);

/** `true` se a data já passou ou é exatamente agora. */
export const isPast = (date: Date, now: Date = new Date()): boolean => date.getTime() <= now.getTime();
