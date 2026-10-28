import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { findResumeFileProblem } from '../utils/resume-file.utils';

/**
 * O campo é um currículo enviado por upload (`UploadedFile`): PDF ou HTML de até 5 MB, com o conteúdo batendo
 * com o tipo declarado. Obrigatório: um valor ausente também é recusado.
 */
export function IsResumeUpload(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isResumeUpload',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => findResumeFileProblem(value) === null,
        defaultMessage: (args?: ValidationArguments) => findResumeFileProblem(args?.value) ?? 'Arquivo inválido',
      },
    });
  };
}
