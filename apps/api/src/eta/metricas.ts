/**
 * Núcleo puro de las métricas del ETA (F1): descomposición del ciclo real al
 * cierre y resumen de precisión de las promesas. Sin DB — el EtaService hace
 * la I/O y delega el cálculo acá, así los tests son puros y rápidos.
 * Ver docs/eta-metricas-historicas-diseno.md
 */

export type PasoCierre = {
  iniciadoEl: Date | null;
  completadoEl: Date | null;
  /** Minutos de trabajo real medido (null si no se midió). */
  tiempoRealMin: number | null;
  tipoEjecucion: string;
};

export type Ciclo = {
  /** Último `completadoEl` del item; null si no hay timestamps (OT vieja). */
  finReal: Date | null;
  cicloTotalMin: number | null;
  trabajoRealMin: number | null;
  proveedorMin: number | null;
  esperaCicloMin: number | null;
  /** No separable del residual con datos reales: siempre null en F1. */
  trasladoMin: number | null;
  flowEfficiencyPct: number | null;
};

const VACIO: Ciclo = {
  finReal: null,
  cicloTotalMin: null,
  trabajoRealMin: null,
  proveedorMin: null,
  esperaCicloMin: null,
  trasladoMin: null,
  flowEfficiencyPct: null,
};

/**
 * Descompone el ciclo REAL de un item desde los timestamps de sus pasos:
 * ciclo = del primer inicio al último fin; trabajo = suma de tiempoRealMin
 * (pasos internos); proveedor = duración de los tercerizados; espera = el
 * residual (incluye traslados). Sin inicio o sin fin ⇒ ciclo vacío.
 */
export function descomponerCiclo(pasos: PasoCierre[]): Ciclo {
  const inicios = pasos
    .map((p) => p.iniciadoEl)
    .filter((d): d is Date => d !== null);
  const fines = pasos
    .map((p) => p.completadoEl)
    .filter((d): d is Date => d !== null);
  if (inicios.length === 0 || fines.length === 0) return { ...VACIO };

  const inicio = Math.min(...inicios.map((d) => d.getTime()));
  const finReal = new Date(Math.max(...fines.map((d) => d.getTime())));
  const cicloTotalMin = Math.round((finReal.getTime() - inicio) / 60000);
  const trabajoRealMin = Math.round(
    pasos
      .filter((p) => p.tipoEjecucion !== 'tercerizado')
      .reduce((acc, p) => acc + (p.tiempoRealMin ?? 0), 0),
  );
  const proveedorMin = Math.round(
    pasos
      .filter(
        (p) =>
          p.tipoEjecucion === 'tercerizado' && p.iniciadoEl && p.completadoEl,
      )
      .reduce(
        (acc, p) =>
          acc + (p.completadoEl!.getTime() - p.iniciadoEl!.getTime()) / 60000,
        0,
      ),
  );
  const esperaCicloMin = Math.max(
    0,
    cicloTotalMin - trabajoRealMin - proveedorMin,
  );
  const flowEfficiencyPct =
    cicloTotalMin > 0
      ? Math.round((trabajoRealMin / cicloTotalMin) * 1000) / 10
      : 0;
  return {
    finReal,
    cicloTotalMin,
    trabajoRealMin,
    proveedorMin,
    esperaCicloMin,
    trasladoMin: null,
    flowEfficiencyPct,
  };
}

export type FilaPrecision = { errorMin: number | null; sinEstimar: boolean };

export type ResumenPrecision = {
  /** Promesas con finReal (ya cerradas). */
  cerradas: number;
  /** De ésas, las que tenían ETA estimable (errorMin no nulo). */
  muestras: number;
  sinEstimar: number;
  coberturaPct: number;
  maeMin: number | null;
  medianaAbsMin: number | null;
  p90AbsMin: number | null;
  /** Media del error con signo: + = tiende a terminar TARDE. */
  sesgoMin: number | null;
  dentro4hPct: number | null;
  dentro1dPct: number | null;
  tardePct: number | null;
};

/** Percentil por interpolación lineal sobre un array YA ordenado ascendente. */
export function percentil(ordenado: number[], p: number): number {
  if (ordenado.length === 1) return ordenado[0];
  const pos = (ordenado.length - 1) * p;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return ordenado[bajo];
  return ordenado[bajo] + (ordenado[alto] - ordenado[bajo]) * (pos - bajo);
}

const un = (n: number) => Math.round(n * 10) / 10;

/** Agrega las filas de promesas cerradas al resumen de precisión. */
export function resumirPrecision(filas: FilaPrecision[]): ResumenPrecision {
  const cerradas = filas.length;
  const errores = filas
    .map((f) => f.errorMin)
    .filter((e): e is number => e !== null);
  const muestras = errores.length;
  const sinEstimar = filas.filter((f) => f.sinEstimar).length;

  if (muestras === 0) {
    return {
      cerradas,
      muestras: 0,
      sinEstimar,
      coberturaPct: cerradas > 0 ? un((1 - sinEstimar / cerradas) * 100) : 0,
      maeMin: null,
      medianaAbsMin: null,
      p90AbsMin: null,
      sesgoMin: null,
      dentro4hPct: null,
      dentro1dPct: null,
      tardePct: null,
    };
  }

  const abs = errores.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const dentro = (umbral: number) =>
    un((errores.filter((e) => Math.abs(e) <= umbral).length / muestras) * 100);
  return {
    cerradas,
    muestras,
    sinEstimar,
    coberturaPct: un((muestras / cerradas) * 100),
    maeMin: Math.round(abs.reduce((a, b) => a + b, 0) / muestras),
    medianaAbsMin: Math.round(percentil(abs, 0.5)),
    p90AbsMin: Math.round(percentil(abs, 0.9)),
    sesgoMin: Math.round(errores.reduce((a, b) => a + b, 0) / muestras),
    dentro4hPct: dentro(240),
    dentro1dPct: dentro(1440),
    tardePct: un((errores.filter((e) => e > 0).length / muestras) * 100),
  };
}
