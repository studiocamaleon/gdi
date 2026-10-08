import { Prisma } from '@prisma/client';

export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

/** Columnas constantes, texto parametrizado. % y _ son caracteres literales. */
export function contieneSinAcentos(
  columna: Prisma.Sql,
  texto: string,
): Prisma.Sql {
  const marcas = '[\u0300-\u036f]';
  return Prisma.sql`strpos(lower(regexp_replace(normalize(coalesce(${columna}, ''), NFD), ${marcas}, '', 'g')), ${normalizarBusqueda(texto)}) > 0`;
}
