import { BadRequestException } from '@nestjs/common';
import { assertBelowLimit } from './limit.utils';

describe('assertBelowLimit', () => {
  it('passa abaixo do teto', () => {
    expect(() => assertBelowLimit(29, 30, 'tags')).not.toThrow();
  });

  it.each([30, 31])('recusa com %i de 30, citando o limite e o recurso', (current) => {
    expect(() => assertBelowLimit(current, 30, 'tags')).toThrow(BadRequestException);
    expect(() => assertBelowLimit(current, 30, 'tags')).toThrow('Limite de 30 tags atingido');
  });
});
