import { addSeconds, formatDate, formatDateTime, isPast } from './date.utils';

describe('date.utils', () => {
  const instant = new Date('2026-10-23T02:05:00Z');

  describe('formatDate / formatDateTime', () => {
    it('usam o horário de Brasília por padrão (a data pode voltar um dia em relação ao UTC)', () => {
      expect(formatDate(instant)).toBe('22/10/2026');
      expect(formatDateTime(instant)).toBe('22/10/2026 23:05');
    });

    it('aceitam outro fuso', () => {
      expect(formatDate(instant, 'UTC')).toBe('23/10/2026');
      expect(formatDateTime(instant, 'UTC')).toBe('23/10/2026 02:05');
    });

    it('mostra meia-noite como 00:00, não 24:00', () => {
      expect(formatDateTime(new Date('2026-10-23T00:00:00Z'), 'UTC')).toBe('23/10/2026 00:00');
    });
  });

  it('addSeconds soma sem alterar a data original', () => {
    const result = addSeconds(instant, 90);
    expect(result.toISOString()).toBe('2026-10-23T02:06:30.000Z');
    expect(instant.toISOString()).toBe('2026-10-23T02:05:00.000Z');
  });

  it('isPast considera passado o instante exato e o que já ocorreu', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(isPast(new Date('2026-10-23T11:59:59Z'), now)).toBe(true);
    expect(isPast(now, now)).toBe(true);
    expect(isPast(new Date('2026-10-23T12:00:01Z'), now)).toBe(false);
  });
});
