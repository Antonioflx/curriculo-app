import { INPUT_LIMITS } from '../constants/input-limits';
import { detectImageMime, findImageProblem } from './image.utils';

const jpeg = (size = 32) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

describe('image.utils', () => {
  describe('detectImageMime', () => {
    it('reconhece JPEG, PNG e WEBP pela assinatura', () => {
      expect(detectImageMime(jpeg())).toBe('image/jpeg');
      expect(detectImageMime(png())).toBe('image/png');
      expect(detectImageMime(webp())).toBe('image/webp');
    });

    it('devolve null para outros formatos e buffers curtos', () => {
      expect(detectImageMime(Buffer.from('GIF89a......'))).toBeNull();
      expect(detectImageMime(Buffer.from('<svg></svg>'))).toBeNull();
      expect(detectImageMime(Buffer.alloc(2))).toBeNull();
    });
  });

  describe('findImageProblem', () => {
    it.each([
      ['image/jpeg', jpeg()],
      ['image/png', png()],
      ['image/webp', webp()],
    ])('aceita %s com conteúdo compatível', (mimeType, data) => {
      expect(findImageProblem({ mimeType, data })).toBeNull();
    });

    it('recusa o que não tem o formato de uma imagem enviada', () => {
      for (const value of [undefined, null, 'texto', 42, {}, { mimeType: 'image/png' }, { data: png() }]) {
        expect(findImageProblem(value)).toBe('Imagem inválida');
      }
      // JSON não consegue produzir Buffer: um cliente não forja o campo por esse caminho.
      expect(findImageProblem({ mimeType: 'image/png', data: { type: 'Buffer', data: [137, 80] } })).toBe(
        'Imagem inválida',
      );
    });

    it('recusa tipo fora da lista (mesmo que o conteúdo seja uma imagem)', () => {
      expect(findImageProblem({ mimeType: 'image/gif', data: jpeg() })).toContain('JPEG, PNG ou WEBP');
      expect(findImageProblem({ mimeType: 'application/pdf', data: jpeg() })).toContain('JPEG, PNG ou WEBP');
    });

    it('recusa quando o conteúdo não bate com o tipo declarado', () => {
      expect(findImageProblem({ mimeType: 'image/png', data: jpeg() })).toContain('não corresponde');
      expect(findImageProblem({ mimeType: 'image/jpeg', data: Buffer.from('<script>alert(1)</script>') })).toContain(
        'não corresponde',
      );
    });

    it('recusa imagem vazia ou acima de 5 MB; aceita a de exatamente 5 MB', () => {
      expect(findImageProblem({ mimeType: 'image/jpeg', data: Buffer.alloc(0) })).toContain('5 MB');
      expect(findImageProblem({ mimeType: 'image/jpeg', data: jpeg(INPUT_LIMITS.imageBytes) })).toContain('5 MB');

      const atLimit = Buffer.concat([jpeg(0), Buffer.alloc(INPUT_LIMITS.imageBytes - 4)]);
      expect(atLimit.length).toBe(INPUT_LIMITS.imageBytes);
      expect(findImageProblem({ mimeType: 'image/jpeg', data: atLimit })).toBeNull();
    });
  });
});
