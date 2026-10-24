/** Imagem recebida por upload, já com o conteúdo em memória (nada é gravado em disco). */
export interface UploadedImage {
  mimeType: string;
  data: Buffer;
}
