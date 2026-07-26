import { MONEDA_DEFAULT, monedaDe, type Moneda } from './monedas';

/**
 * La config regional del tenant para services que ya tienen Prisma a mano y
 * no quieren arrastrar `DatosEmpresaService` (y su módulo) sólo por esto.
 * Misma semántica que `DatosEmpresaService.regional`: defaults argentinos
 * cuando la fila no existe, nunca null.
 */

export const ZONA_DEFAULT = 'America/Argentina/Buenos_Aires';

export type ConfigRegional = {
  moneda: Moneda;
  zonaHoraria: string;
  redondeoPrecio: 'moneda' | 'entero';
  /** ISO alfa-2 (`DatosEmpresa.paisCodigo`); AR si no está cargado. Gatea lo
   *  fiscal argentino (ARCA) — multi-moneda-zona-horaria D14. */
  paisCodigo: string;
};

type PrismaConDatosEmpresa = {
  datosEmpresa: {
    findUnique(args: {
      where: { tenantId: string };
      select: {
        monedaCodigo: true;
        zonaHoraria: true;
        redondeoPrecio: true;
        paisCodigo: true;
      };
    }): Promise<{
      monedaCodigo: string;
      zonaHoraria: string;
      redondeoPrecio: string;
      paisCodigo: string | null;
    } | null>;
  };
};

export async function regionalDelTenant(
  prisma: PrismaConDatosEmpresa,
  tenantId: string,
): Promise<ConfigRegional> {
  const d = await prisma.datosEmpresa.findUnique({
    where: { tenantId },
    select: {
      monedaCodigo: true,
      zonaHoraria: true,
      redondeoPrecio: true,
      paisCodigo: true,
    },
  });
  return {
    moneda: monedaDe(d?.monedaCodigo ?? MONEDA_DEFAULT),
    zonaHoraria: d?.zonaHoraria ?? ZONA_DEFAULT,
    redondeoPrecio: d?.redondeoPrecio === 'entero' ? 'entero' : 'moneda',
    paisCodigo: d?.paisCodigo ?? 'AR',
  };
}
