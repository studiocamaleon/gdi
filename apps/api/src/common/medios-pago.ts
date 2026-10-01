/** Cálculos compartidos por API y web. Sin dependencias ni acceso a datos. */
export type ReglaRetencion = {
  id: string;
  regimen: string;
  jurisdiccion: string;
  agente: 'procesador' | 'banco' | 'cliente';
  alicuota: number;
  baseCalculo: 'bruto' | 'neto_liquidacion';
  vigenteDesde?: string;
  vigenteHasta?: string;
};

export type RetencionCalculada = {
  regimen: string;
  jurisdiccion?: string | null;
  agente?: string;
  reglaId?: string | null;
  base: number;
  alicuota: number;
  monto: number;
  nroComprobante?: string | null;
};

export const redondearDinero = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function cifrasCobro(
  bruto: number,
  comisionPct: number,
  ivaPct: number,
  retenciones: number,
) {
  const comisionMonto = redondearDinero((bruto * comisionPct) / 100);
  const comisionIvaMonto = redondearDinero((comisionMonto * ivaPct) / 100);
  const netoAcreditado = redondearDinero(
    bruto - comisionMonto - comisionIvaMonto,
  );
  return {
    comisionMonto,
    comisionIvaMonto,
    netoAcreditado,
    disponibleReal: redondearDinero(netoAcreditado - retenciones),
  };
}

export function calcularRetenciones(
  reglas: ReglaRetencion[],
  bruto: number,
  netoLiquidacion: number,
  fecha: string,
): RetencionCalculada[] {
  return reglas
    .filter(
      (r) =>
        (!r.vigenteDesde || r.vigenteDesde <= fecha) &&
        (!r.vigenteHasta || r.vigenteHasta >= fecha),
    )
    .map((r) => {
      // Todas usan la base indicada: no se encadenan entre sí silenciosamente.
      const base = redondearDinero(
        r.baseCalculo === 'bruto' ? bruto : netoLiquidacion,
      );
      return {
        reglaId: r.id,
        regimen: r.regimen,
        jurisdiccion: r.jurisdiccion,
        agente: r.agente,
        base,
        alicuota: r.alicuota,
        monto: redondearDinero((base * r.alicuota) / 100),
      };
    });
}

/** Duplicar una misma retención por agente/jurisdicción no es acumulable. */
export function claveRetencion(
  r: Pick<RetencionCalculada, 'agente' | 'regimen' | 'jurisdiccion'>,
) {
  return [
    r.agente ?? 'cliente',
    r.regimen,
    (r.jurisdiccion ?? '').trim().toLocaleLowerCase('es'),
  ].join('|');
}

// Calendario oficial BCRA 2026, Comunicación C 101352. Actualizar por año.
// https://www.bcra.gob.ar/consulta-feriados-bancarios/
const FERIADOS_AR: Record<number, string[]> = {
  2026: [
    '01-01',
    '02-16',
    '02-17',
    '03-23',
    '03-24',
    '04-02',
    '04-03',
    '05-01',
    '05-25',
    '06-15',
    '07-09',
    '07-10',
    '08-17',
    '10-12',
    '11-23',
    '12-07',
    '12-08',
    '12-25',
  ],
};

export type CalendarioAcreditacion = 'habiles_bancarios' | 'corridos';
export function estimarAcreditacion(
  fecha: string,
  dias: number,
  calendario: CalendarioAcreditacion = 'habiles_bancarios',
  pais = 'AR',
  adicionales: string[] = [],
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    !Number.isInteger(dias) ||
    dias < 0 ||
    dias > 365
  )
    throw new Error('Fecha o plazo de acreditación inválidos.');
  const d = new Date(`${fecha}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== fecha)
    throw new Error('Fecha de acreditación inválida.');
  let restantes = dias;
  let calendarioCompleto = true;
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const clave = d.toISOString().slice(0, 10);
    if (calendario === 'corridos') {
      restantes--;
      continue;
    }
    const oficiales =
      pais === 'AR' ? FERIADOS_AR[d.getUTCFullYear()] : undefined;
    if (!oficiales) calendarioCompleto = false;
    if (
      d.getUTCDay() === 0 ||
      d.getUTCDay() === 6 ||
      adicionales.includes(clave) ||
      oficiales?.includes(clave.slice(5))
    )
      continue;
    restantes--;
  }
  return {
    fecha: d.toISOString().slice(0, 10),
    calendarioCompleto,
    advertencia: calendarioCompleto
      ? null
      : 'El calendario oficial de ese período no está cargado. Se excluyen fines de semana y las fechas adicionales; verificá la fecha con el proveedor.',
  };
}
