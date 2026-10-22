import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeAll(() => service.onModuleInit());

  it('gera hash argon2id e verifica a senha', async () => {
    const hash = await service.hash('Segredo!2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'Segredo!2026')).resolves.toBe(true);
    await expect(service.verify(hash, 'outra-senha')).resolves.toBe(false);
  });

  it('sem hash (usuário inexistente) devolve false', async () => {
    await expect(service.verify(null, 'qualquer-senha')).resolves.toBe(false);
  });

  it('detecta senhas comuns ignorando maiúsculas', () => {
    expect(service.isCommon('Password123')).toBe(true);
    expect(service.isCommon('Segredo!2026')).toBe(false);
  });
});
