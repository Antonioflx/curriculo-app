import { BadRequestException, Param, ParseUUIDPipe } from '@nestjs/common';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Identificador inválido'),
});

/** `@Param` que só aceita UUID; id malformado vira 400, nunca chega ao banco. */
export const UuidParam = (name = 'id') => Param(name, uuidPipe);
