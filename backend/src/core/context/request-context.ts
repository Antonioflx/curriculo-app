import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/**
 * Contexto da requisição em andamento (requestId e userId). O `AppLogger` lê daqui, então quem loga
 * não precisa repassar esses ids. Fora de uma requisição (testes, scripts) não há contexto.
 */
export const requestContext = {
  run: <T>(store: RequestContextStore, callback: () => T): T => storage.run(store, callback),

  get: (): RequestContextStore | undefined => storage.getStore(),

  /** Chamado quando a autenticação identifica o usuário. */
  setUserId(userId: string): void {
    const store = storage.getStore();
    if (store) store.userId = userId;
  },
};
