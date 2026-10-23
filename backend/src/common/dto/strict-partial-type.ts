import type { Type } from '@nestjs/common';
import {
  inheritPropertyInitializers,
  inheritTransformationMetadata,
  inheritValidationMetadata,
} from '@nestjs/mapped-types';
import { ValidateIf } from 'class-validator';

/**
 * Como o `PartialType` do Nest, mas só `undefined` conta como "não enviado".
 * O `PartialType` usa `IsOptional`, que também deixa `null` passar e estoura 500 no Prisma
 * em campo obrigatório; aqui `null` continua sendo validado (e recusado com 400).
 */
export function StrictPartialType<T>(classRef: Type<T>): Type<Partial<T>> {
  abstract class StrictPartialClass {
    constructor() {
      inheritPropertyInitializers(this, classRef);
    }
  }

  const propertyKeys = inheritValidationMetadata(classRef, StrictPartialClass);
  inheritTransformationMetadata(classRef, StrictPartialClass);
  for (const key of propertyKeys ?? []) {
    ValidateIf((_object, value) => value !== undefined)(StrictPartialClass.prototype, key);
  }

  return StrictPartialClass as Type<Partial<T>>;
}
