/** Requisitos de atención congelados al cotizar. Espejo front/API. */
/** Resolución del calendario: redondea hacia arriba sin inventar un milisegundo
 * por el error binario de convertir minutos que ya representan milisegundos. */
export function milisegundosDeMinutos(minutos: number): number {
  const ms = minutos * 60000;
  const entero = Math.round(ms);
  return Math.abs(ms - entero) <= Number.EPSILON * Math.max(1, Math.abs(ms)) * 4
    ? entero
    : Math.ceil(ms);
}

export type FaseRun = { minutos: number; operario: boolean };
export type FaseHumana = { minutos: number; personas: number; operacionMaquina?: true };
export type ModoOperacionMaquina = 'con_operario' | 'autonoma';
type BaseDemanda = { fases: FaseHumana[]; verificada: boolean; dotacionOperarios?: number };
export type DemandaHumana = {
  version: 1;
  fases: FaseHumana[];
  verificada: boolean;
  /** Base cotizada: permite cambiar el comportamiento sin perder maniobras. */
  baseOperacion?: BaseDemanda;
  operacionMaquina?: ModoOperacionMaquina | null;
  dotacionOperarios?: number;
  revisionOperacion?: 1;
};
const registro = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const numero = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

export function leerModoOperacionMaquina(value: unknown): ModoOperacionMaquina | null {
  return value === 'con_operario' || value === 'autonoma' ? value : null;
}

/** Ajusta ocupación humana, nunca minutos. La base se conserva incluso al
 * volver de operación atendida a autónoma. Sin configuración no se libera gente. */
export function aplicarOperacionMaquina(demanda: DemandaHumana | null, modo: ModoOperacionMaquina | null): DemandaHumana | null {
  if (!demanda) return null;
  const base: BaseDemanda = demanda.baseOperacion ?? {
    fases: demanda.fases, verificada: demanda.verificada,
    ...(demanda.dotacionOperarios != null ? { dotacionOperarios: demanda.dotacionOperarios } : {}),
  };
  const dotacion = base.dotacionOperarios ?? Math.max(1, ...base.fases.map(f => f.personas));
  return {
    version: 1, revisionOperacion: 1, baseOperacion: base, operacionMaquina: modo,
    ...(base.dotacionOperarios != null ? { dotacionOperarios: base.dotacionOperarios } : {}),
    verificada: modo === 'autonoma' ? base.verificada : modo === 'con_operario' && (base.verificada || base.dotacionOperarios != null),
    fases: modo === 'autonoma' ? base.fases : base.fases.map(f => ({ ...f, personas: f.personas || dotacion })),
  };
}

export function leerDemandaHumana(
  value: unknown,
  totalMin: number,
): DemandaHumana | null {
  const r = registro(value);
  if (r.version !== 1 || !Array.isArray(r.fases) || r.fases.length > 20000)
    return null;
  const fases: FaseHumana[] = [];
  for (const f of r.fases) {
    const p = registro(f),
      minutos = numero(p.minutos),
      personas = numero(p.personas);
    if (
      minutos == null ||
      personas == null ||
      !Number.isInteger(personas) ||
      personas > 99
    )
      return null;
    if (minutos > 0) fases.push({ minutos, personas, ...(p.operacionMaquina === true ? { operacionMaquina: true as const } : {}) });
  }
  if (Math.abs(fases.reduce((s, f) => s + f.minutos, 0) - totalMin) > 0.01)
    return null;
  const base = r.baseOperacion == null ? null : leerDemandaHumana({ ...registro(r.baseOperacion), version: 1, baseOperacion: undefined }, totalMin);
  if (r.baseOperacion != null && !base) return null;
  const dotacion = Number.isInteger(r.dotacionOperarios) && Number(r.dotacionOperarios) >= 1 && Number(r.dotacionOperarios) <= 99 ? Number(r.dotacionOperarios) : undefined;
  return { version: 1, fases, verificada: r.verificada === true,
    ...(dotacion != null ? { dotacionOperarios: dotacion } : {}),
    ...(r.revisionOperacion === 1 ? { revisionOperacion: 1 as const } : {}),
    ...('operacionMaquina' in r ? { operacionMaquina: leerModoOperacionMaquina(r.operacionMaquina) } : {}),
    ...(base ? { baseOperacion: { fases: base.fases, verificada: base.verificada, ...(base.dotacionOperarios != null ? { dotacionOperarios: base.dotacionOperarios } : {}) } } : {}),
  };
}

/** Lee la secuencia cotizada de ejecución y maniobras, sin parámetros nuevos. */
function leerFasesRun(value: unknown, total: number): FaseRun[] | null {
  if (!Array.isArray(value) || value.length > 20000) return null;
  const fases: FaseRun[] = [];
  for (const valueFase of value) {
    const f = registro(valueFase);
    if (numero(f.minutos) == null || typeof f.operario !== 'boolean')
      return null;
    if (Number(f.minutos) > 0)
      fases.push({ minutos: Number(f.minutos), operario: f.operario });
  }
  return Math.abs(fases.reduce((s, f) => s + f.minutos, 0) - total) <= 0.01
    ? fases
    : null;
}

/** Deriva fases de los tiempos cotizados y aplica el funcionamiento indicado
 * por la máquina. Conserva la base para reproyectar trabajo pendiente con la
 * configuración vigente, sin recotizar ni duplicar cargas y recargas. */
export function demandaDesdeTiempo(value: unknown): DemandaHumana | null {
  const t = registro(value);
  const demanda = demandaBaseDesdeTiempo(value);
  if (!demanda || !t.maquinaId || !('operacionMaquina' in t)) return demanda;
  const dotacion = Number.isInteger(t.dotacionOperarios) && Number(t.dotacionOperarios) >= 1 && Number(t.dotacionOperarios) <= 99 ? Number(t.dotacionOperarios) : undefined;
  return aplicarOperacionMaquina({ ...demanda, ...(dotacion != null ? { dotacionOperarios: dotacion } : {}) }, leerModoOperacionMaquina(t.operacionMaquina));
}

function demandaBaseDesdeTiempo(value: unknown): DemandaHumana | null {
  const t = registro(value),
    total = numero(t.totalMin);
  if (total == null) return null;
  const congelada = leerDemandaHumana(t.demandaHumana, total);
  if (congelada) return congelada;
  const personas =
    Number.isInteger(t.dotacionOperarios) && Number(t.dotacionOperarios) >= 1
      ? Math.min(99, Number(t.dotacionOperarios))
      : 1;
  const setup = numero(t.setupMin),
    run = numero(t.runMin),
    cleanup = numero(t.cleanupMin),
    fijo = numero(t.tiempoFijoMin);
  const tieneMaquina = typeof t.maquinaId === 'string' && !!t.maquinaId;
  const extras = Array.isArray(t.tiemposExtra)
    ? t.tiemposExtra.map(registro)
    : [];
  const maxPersonas = Math.max(
    personas,
    ...extras.map((e) =>
      Number.isInteger(e.dotacionOperarios)
        ? Math.max(1, Math.min(99, Number(e.dotacionOperarios)))
        : personas,
    ),
  );
  const extrasValidos = extras.every(
    (e) =>
      numero(e.minutos) != null &&
      Number.isInteger(e.dotacionOperarios) &&
      Number(e.dotacionOperarios) >= 1 &&
      Number(e.dotacionOperarios) <= 99,
  );
  const minutosExtra = extras.reduce((s, e) => s + (numero(e.minutos) ?? 0), 0);
  const fasesExtra = extras.map((e) => ({
    minutos: Number(e.minutos),
    personas: Number(e.dotacionOperarios),
  }));
  const completo = extrasValidos && minutosExtra <= total;
  const conservadora = (): DemandaHumana => ({
    version: 1,
    verificada: false,
    fases: total ? [{ minutos: total, personas: maxPersonas }] : [],
  });
  if (!tieneMaquina)
    return completo
      ? {
          version: 1,
          verificada: true,
          fases: [
            { minutos: total - minutosExtra, personas },
            ...fasesExtra,
          ].filter((f) => f.minutos > 0),
        }
      : conservadora();
  if (!completo || [setup, run, cleanup, fijo].some((v) => v == null))
    return conservadora();
  const redondeo = total - setup! - run! - cleanup! - fijo! - minutosExtra;
  if (redondeo < -0.01 || redondeo > 1.01) return conservadora();
  let fasesRun: FaseRun[] | null;
  if (t.procesamientoCorte) {
    // El snapshot de herramientas conserva la tanda completa. El participante
    // recibe su proporción del run; su reserva final se consolida en la OT.
    const corte = registro(t.procesamientoCorte),
      totalCorte = numero(corte.runMin);
    const originales =
      totalCorte == null ? null : leerFasesRun(corte.fasesRun, totalCorte);
    fasesRun =
      originales && totalCorte! > 0
        ? originales.map((f) => ({
            ...f,
            minutos: (f.minutos * run!) / totalCorte!,
          }))
        : run === 0
          ? []
          : null;
  } else
    fasesRun =
      t.fasesRun != null
        ? leerFasesRun(t.fasesRun, run!)
        : [{ minutos: run!, operario: false }];
  // Los snapshots históricos que mezclaban maniobras dentro de RUN deben
  // recotizarse para recuperar su secuencia. No liberar ese trabajo a ciegas.
  if (!fasesRun) return conservadora();
  return {
    version: 1,
    verificada: true,
    fases: [
      { minutos: setup! + fijo!, personas },
      ...fasesRun.map((f) => ({
        minutos: f.minutos,
        personas: f.operario ? personas : 0,
        ...('operacionMaquina' in t && !f.operario ? { operacionMaquina: true as const } : {}),
      })),
      { minutos: cleanup! + Math.max(0, redondeo), personas },
      ...fasesExtra,
    ].filter((f) => f.minutos > 0),
  };
}

/** Una consolidación conserva fases y dotaciones si los minutos concilian. */
export function combinarDemandas(
  demandas: Array<DemandaHumana | null>,
  total: number,
): DemandaHumana {
  const fases = demandas.flatMap((d) => d?.fases ?? []);
  const concilia =
    demandas.every(Boolean) &&
    Math.abs(fases.reduce((s, f) => s + f.minutos, 0) - total) <= 0.01;
  return {
    version: 1,
    verificada: concilia && demandas.every((d) => d!.verificada),
    ...(concilia && demandas.some(d => d?.baseOperacion) ? {
      baseOperacion: {
        fases: demandas.flatMap(d => d!.baseOperacion?.fases ?? d!.fases),
        verificada: demandas.every(d => (d!.baseOperacion ?? d!).verificada),
        ...(demandas.every(d => (d!.baseOperacion ?? d!).dotacionOperarios != null) ? {
          dotacionOperarios: Math.max(...demandas.map(d => (d!.baseOperacion ?? d!).dotacionOperarios!)),
        } : {}),
      },
    } : {}),
    fases: concilia
      ? fases
      : total > 0
        ? [
            {
              minutos: total,
              personas: Math.max(1, ...fases.map((f) => f.personas)),
            },
          ]
        : [],
  };
}

export function recortarDemanda(
  demanda: DemandaHumana | null,
  total: number,
  restante: number,
): DemandaHumana {
  if (!demanda || restante > total)
    return {
      version: 1,
      verificada: false,
      fases:
        restante > 0
          ? [
              {
                minutos: restante,
                personas: Math.max(
                  1,
                  ...(demanda?.fases.map((f) => f.personas) ?? []),
                ),
              },
            ]
          : [],
    };
  let consumido = Math.max(0, total - restante);
  const fases = demanda.fases.flatMap((f) => {
    const omitir = Math.min(consumido, f.minutos);
    consumido -= omitir;
    return f.minutos > omitir
      ? [{ ...f, minutos: f.minutos - omitir }]
      : [];
  });
  return { ...demanda, fases };
}
