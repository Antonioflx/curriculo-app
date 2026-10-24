import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { findImageProblem } from '../utils/image.utils';

/**
 * O campo é uma imagem enviada por upload (`UploadedImage`): JPEG, PNG ou WEBP de até 5 MB, com o conteúdo
 * batendo com o tipo declarado. Combine com `@IsOptional()` quando a imagem não for obrigatória.
 */
export function IsImageUpload(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isImageUpload',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => findImageProblem(value) === null,
        defaultMessage: (args?: ValidationArguments) => findImageProblem(args?.value) ?? 'Imagem inválida',
      },
    });
  };
}
