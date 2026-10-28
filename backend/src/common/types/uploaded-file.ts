/** Arquivo recebido por upload (PDF, HTML...), com o conteúdo em memória (nada é gravado em disco). */
export interface UploadedFile {
  mimeType: string;
  data: Buffer;
}
