import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';

import { normalizeText } from '../utils/text.utils';

type Constructor = new (...args: never[]) => object;

/** String com limite de tamanho. */
export const Text = (max: number) => applyDecorators(IsString(), MaxLength(max));

/** Lista de strings com limite de itens e de tamanho por item. */
export const TextList = (maxItems: number, maxLength: number) =>
  applyDecorators(IsArray(), ArrayMaxSize(maxItems), IsString({ each: true }), MaxLength(maxLength, { each: true }));

/** Objeto aninhado, obrigatório, validado pela classe informada. */
export const Nested = (type: Constructor) => applyDecorators(IsObject(), ValidateNested(), Type(() => type));

/** Lista de objetos aninhados com limite de itens. */
export const NestedList = (type: Constructor, maxItems: number) =>
  applyDecorators(IsArray(), ArrayMaxSize(maxItems), ValidateNested({ each: true }), Type(() => type));

/** Remove espaços das pontas e, opcionalmente, normaliza para minúsculas. */
export const Trim = (options: { lowercase?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeText(value, options) : value));
