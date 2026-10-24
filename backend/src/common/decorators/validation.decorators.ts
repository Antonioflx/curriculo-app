import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';

import { normalizeText } from '../utils/text.utils';
import { isString } from '../utils/type.utils';

type Constructor = new (...args: never[]) => object;

/** String com limite de tamanho. */
export const Text = (max: number) => applyDecorators(IsString(), MaxLength(max));

/** Lista de strings com limite de itens e de tamanho por item. */
export const TextList = (maxItems: number, maxLength: number) =>
  applyDecorators(IsArray(), ArrayMaxSize(maxItems), IsString({ each: true }), MaxLength(maxLength, { each: true }));

/** Objeto aninhado, obrigatório, validado pela classe informada. */
export const Nested = (type: Constructor) =>
  applyDecorators(
    IsObject(),
    ValidateNested(),
    Type(() => type),
  );

/** Lista de objetos aninhados com limite de itens. */
export const NestedList = (type: Constructor, maxItems: number) =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(maxItems),
    ValidateNested({ each: true }),
    Type(() => type),
  );

/**
 * Remove espaços das pontas e, opcionalmente, normaliza para minúsculas.
 * Com `emptyAsUndefined`, texto que fica vazio vira `undefined` (campo "não enviado"): formulários multipart
 * mandam `text=""` quando o usuário só anexou um arquivo.
 */
export const Trim = (options: { lowercase?: boolean; emptyAsUndefined?: boolean } = {}) =>
  Transform(({ value }: { value: unknown }) => {
    if (!isString(value)) return value;
    const normalized = normalizeText(value, options);
    return options.emptyAsUndefined && normalized === '' ? undefined : normalized;
  });
