import { BadRequestException } from '@nestjs/common';

/** Recusa (400) quando a contagem atual já atingiu o teto. `label` entra na mensagem: "tags", "currículos base"... */
export function assertBelowLimit(current: number, max: number, label: string): void {
  if (current >= max) throw new BadRequestException(`Limite de ${max} ${label} atingido`);
}
