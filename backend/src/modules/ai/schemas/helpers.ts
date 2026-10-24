import { z } from 'zod';

/** String com limite; o limite também vai na descrição para o modelo respeitá-lo. */
export const str = (max: number) => z.string().max(max).describe(`até ${max} caracteres`);

/** Lista de strings com limites de itens e de tamanho (o limite de itens vira dica na descrição ao gerar o schema). */
export const strList = (maxItems: number, maxLength: number) => z.array(str(maxLength)).max(maxItems);
