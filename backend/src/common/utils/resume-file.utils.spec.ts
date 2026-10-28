import { INPUT_LIMITS } from '../constants/input-limits';
import { detectResumeFileKind, findResumeFileProblem } from './resume-file.utils';

const pdf = (size = 32) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(size, 0x20)]);
const html = (text = 'Antonio') => Buffer.from(`<html><body><p>${text}</p></body></html>`);

describe('resume-file.utils', () => {
  describe('detectResumeFileKind', () => {
    it('reconhece PDF pela assinatura e HTML por texto com tag', () => {
      expect(detectResumeFileKind(pdf())).toBe('pdf');
      expect(detectResumeFileKind(html())).toBe('html');
    });

    it('recusa binário (NUL), texto sem tag e buffer vazio', () => {
      expect(detectResumeFileKind(Buffer.from([0x3c, 0x00, 0x01]))).toBeNull();
      expect(detectResumeFileKind(Buffer.from('só texto'))).toBeNull();
      expect(detectResumeFileKind(Buffer.alloc(0))).toBeNull();
    });
  });

  describe('findResumeFileProblem', () => {
    it.each([
      ['application/pdf', pdf()],
      ['text/html', html()],
    ])('aceita %s com conteúdo compatível', (mimeType, data) => {
      expect(findResumeFileProblem({ mimeType, data })).toBeNull();
    });

    it.each([
      ['null', null],
      ['sem data', { mimeType: 'application/pdf' }],
      ['data que não é Buffer', { mimeType: 'application/pdf', data: '%PDF-' }],
      ['tipo não permitido', { mimeType: 'text/plain', data: html() }],
      ['arquivo vazio', { mimeType: 'application/pdf', data: Buffer.alloc(0) }],
      ['PDF declarado, HTML enviado', { mimeType: 'application/pdf', data: html() }],
      ['HTML declarado, PDF enviado', { mimeType: 'text/html', data: pdf() }],
      ['HTML sem texto', { mimeType: 'text/html', data: Buffer.from('<div><script>x</script></div>') }],
    ])('recusa: %s', (_name, value) => {
      expect(findResumeFileProblem(value)).not.toBeNull();
    });

    it('recusa arquivo acima de 5 MB e HTML com texto acima do limite', () => {
      const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(INPUT_LIMITS.resumeFileBytes)]);
      expect(findResumeFileProblem({ mimeType: 'application/pdf', data: big })).toMatch(/5 MB/);
      expect(
        findResumeFileProblem({ mimeType: 'text/html', data: html('x'.repeat(INPUT_LIMITS.resumeText + 1)) }),
      ).toMatch(/grande demais/);
    });
  });
});
