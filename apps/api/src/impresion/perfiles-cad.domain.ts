export type EnlacePerfilCad = {
  rutaAlternativaId: string;
  materialVarianteId: string;
};
export function enlacePerfilCad(value: unknown): EnlacePerfilCad | null {
  const c = value as EnlacePerfilCad | null;
  return c &&
    typeof c.rutaAlternativaId === 'string' &&
    typeof c.materialVarianteId === 'string'
    ? c
    : null;
}
