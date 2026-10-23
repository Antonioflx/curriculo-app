/** Currículo válido segundo o schema do `content` (docs/produto.md). */
export const resumeContent = {
  header: {
    name: 'Ana Teste',
    headline: 'Desenvolvedora Backend',
    location: 'Fortaleza, CE',
    phone: '+55 85 90000-0000',
    email: 'ana@example.com',
    links: [{ label: 'GitHub', url: 'https://github.com/ana' }],
  },
  summary: 'Desenvolvedora backend com foco em Node.js e TypeScript.',
  experiences: [
    {
      company: 'Acme',
      role: 'Backend Developer',
      start: '2022-01',
      end: null,
      context: 'Plataforma de pagamentos',
      bullets: ['Reduziu a latência da API de 800 ms para 200 ms'],
    },
  ],
  skills: [{ category: 'Linguagens', items: ['TypeScript', 'SQL'] }],
  education: [{ course: 'Sistemas de Informação', institution: 'UFC', start: '2018', end: '2022' }],
  languages: [{ name: 'Inglês', level: 'Avançado' }],
};

/** Cópia do objeto sem a chave informada (para montar entradas inválidas nos testes). */
export const omit = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};
