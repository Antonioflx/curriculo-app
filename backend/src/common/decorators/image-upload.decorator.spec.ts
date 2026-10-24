import { plainToInstance } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsImageUpload } from './image-upload.decorator';

class Form {
  @IsOptional()
  @IsImageUpload()
  image?: unknown;
}

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const messagesOf = async (image: unknown) =>
  (await validate(plainToInstance(Form, { image }))).flatMap((error) => Object.values(error.constraints ?? {}));

describe('@IsImageUpload', () => {
  it('aceita imagem válida e campo ausente (com @IsOptional)', async () => {
    expect(await messagesOf({ mimeType: 'image/jpeg', data: jpeg })).toEqual([]);
    expect(await messagesOf(undefined)).toEqual([]);
  });

  it('a mensagem de erro diz o motivo real', async () => {
    expect(await messagesOf({ mimeType: 'image/gif', data: jpeg })).toEqual(['A imagem deve ser JPEG, PNG ou WEBP']);
    expect(await messagesOf({ mimeType: 'image/png', data: jpeg })).toEqual([
      'O conteúdo do arquivo não corresponde ao tipo informado',
    ]);
    expect(await messagesOf('texto')).toEqual(['Imagem inválida']);
  });
});
