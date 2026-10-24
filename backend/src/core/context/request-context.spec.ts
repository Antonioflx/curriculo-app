import { requestContext } from './request-context';

describe('requestContext', () => {
  it('fora de uma requisição não há contexto, e setUserId é inofensivo', () => {
    expect(requestContext.get()).toBeUndefined();
    expect(() => requestContext.setUserId('u1')).not.toThrow();
  });

  it('o contexto vale para todo o fluxo assíncrono da requisição', async () => {
    await requestContext.run({ requestId: 'r1' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(requestContext.get()?.requestId).toBe('r1');
    });
  });

  it('setUserId completa o contexto atual', () => {
    requestContext.run({ requestId: 'r1' }, () => {
      requestContext.setUserId('u1');
      expect(requestContext.get()).toEqual({ requestId: 'r1', userId: 'u1' });
    });
  });

  it('requisições simultâneas não se misturam', async () => {
    const seen = await Promise.all(
      ['a', 'b', 'c'].map((id) =>
        requestContext.run({ requestId: id }, async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
          requestContext.setUserId(`u-${id}`);
          return requestContext.get();
        }),
      ),
    );
    expect(seen).toEqual([
      { requestId: 'a', userId: 'u-a' },
      { requestId: 'b', userId: 'u-b' },
      { requestId: 'c', userId: 'u-c' },
    ]);
  });
});
