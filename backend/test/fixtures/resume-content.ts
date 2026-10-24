import data from './resume.fixture.json';

/**
 * Currículo válido segundo o schema do `content` (docs/produto.md).
 * Fonte única: o JSON também é lido pelo `scripts/ai-smoke.cjs`.
 */
export const resumeContent = data;

/** Cópia do objeto sem a chave informada (para montar entradas inválidas nos testes). */
export const omit = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};
