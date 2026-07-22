/**
 * Construcción PURA de las fotos diarias del ETA (F2) desde el resultado del
 * motor. Sin DB — el EtaService corre el motor, delega el armado acá y hace el
 * upsert. Ver docs/eta-metricas-historicas-diseno.md §4.2/§4.3
 */

import {
  DIAS_SEMANA,
  type CalendarioEstacion,
  type DiaSemana,
} from '../produccion/calendario';
import { calendarioDefault } from './motor/estaciones-tipos';
import { PROVEEDOR_KEY } from './motor/flujo-produccion';
import { percentil } from './metricas';
import { SIN_ESTACION_KEY } from './motor/tablero-tipos';

const JS_DIA: DiaSemana[] = [
  'dom',
  'lun',
  'mar',
  'mie',
  'jue',
  'vie',
  'sab',
];
const DIA_MS = 86_400_000;

function claveFecha(fecha: Date) {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

function minutosDeDia(cal: CalendarioEstacion, fecha: Date): number {
  const franjas = cal.dias[JS_DIA[fecha.getDay()]] ?? [];
  return franjas.reduce((acc, f) => {
    const [dh, dm] = f.desde.split(':').map(Number);
    const [hh, hm] = f.hasta.split(':').map(Number);
    return acc + (hh * 60 + hm) - (dh * 60 + dm);
  }, 0);
}

const calendarioVacio = (cal: CalendarioEstacion | null) =>
  !cal || DIAS_SEMANA.every((d) => (cal.dias[d] ?? []).length === 0);

/** Capacidad (min-persona) del taller en los próximos 5 días desde `ahora`. */
function capacidad5dMin(
  cal: CalendarioEstacion,
  puestos: number,
  ahora: Date,
  noLaborables: Set<string>,
): number {
  let total = 0;
  for (let i = 0; i < 5; i += 1) {
    const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
    if (noLaborables.has(claveFecha(dia))) continue;
    total += minutosDeDia(cal, dia) * Math.max(1, puestos);
  }
  return total;
}

/**
 * Jornadas para vaciar `colaMin` caminando el calendario (proyectarColaDias
 * del front, versión compacta). null si no hay calendario que consuma.
 */
function proyectarHorizonteDias(
  cal: CalendarioEstacion,
  colaMin: number,
  puestos: number,
  ahora: Date,
  noLaborables: Set<string>,
): number | null {
  if (colaMin <= 0) return 0;
  const p = Math.max(1, puestos);
  let restante = colaMin;
  let dias = 0;
  for (let i = 0; i < 365; i += 1) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
    if (noLaborables.has(claveFecha(fecha))) continue;
    const capacidadDia = minutosDeDia(cal, fecha) * p;
    if (capacidadDia <= 0) continue;
    const consumo = Math.min(restante, capacidadDia);
    dias += consumo / capacidadDia;
    restante -= consumo;
    if (restante <= 0) return Math.round(dias * 10) / 10;
  }
  return null;
}

export type EstacionInfo = {
  id: string;
  nombre: string;
  calendario: CalendarioEstacion | null;
  capacidadConcurrente: number;
};

/** Subconjunto de PasoProgramado que la foto por estación necesita. */
export type PasoTraza = {
  estacionKey: string;
  duracionMin: number | null;
  esperaMin: number;
  candidatos: number | null;
  inicio: Date;
  tercerizado: boolean;
};

export type SnapshotEstacion = {
  estacionKey: string;
  estacionNombre: string;
  colaMin: number;
  horizonteDias: number | null;
  esperaP50Min: number;
  esperaP90Min: number;
  contencionMax: number;
  utilizacion5dPct: number;
  pasosEnPlan: number;
};

const NOMBRE_SINTETICO: Record<string, string> = {
  [SIN_ESTACION_KEY]: 'Sin estación',
  [PROVEEDOR_KEY]: 'Proveedor',
};

/** Agrega la traza del plan a una foto por estación. */
export function construirSnapshotsEstacion(
  traza: PasoTraza[],
  estaciones: EstacionInfo[],
  ahora: Date,
  noLaborables: Set<string>,
): SnapshotEstacion[] {
  const info = new Map(estaciones.map((e) => [e.id, e]));
  const finVentana5d = ahora.getTime() + 5 * DIA_MS;
  const grupos = new Map<string, PasoTraza[]>();
  for (const paso of traza) {
    const lista = grupos.get(paso.estacionKey) ?? [];
    lista.push(paso);
    grupos.set(paso.estacionKey, lista);
  }

  const salida: SnapshotEstacion[] = [];
  for (const [estacionKey, pasos] of grupos) {
    // La cola son los minutos de trabajo del taller: los tercerizados corren
    // en el proveedor y no ocupan puesto, no son "cola" de la estación.
    const propios = pasos.filter((p) => !p.tercerizado && p.duracionMin != null);
    const colaMin = Math.round(
      propios.reduce((acc, p) => acc + (p.duracionMin ?? 0), 0),
    );
    const esperas = pasos.map((p) => p.esperaMin).sort((a, b) => a - b);
    const contencionMax = pasos.reduce(
      (max, p) => Math.max(max, p.candidatos ?? 0),
      0,
    );
    const programado5d = Math.round(
      propios
        .filter((p) => p.inicio.getTime() < finVentana5d)
        .reduce((acc, p) => acc + (p.duracionMin ?? 0), 0),
    );

    const est = info.get(estacionKey);
    const cal =
      est && !calendarioVacio(est.calendario)
        ? (est.calendario as CalendarioEstacion)
        : est
          ? calendarioDefault()
          : null;
    const puestos = est?.capacidadConcurrente ?? 1;
    const cap5d = cal ? capacidad5dMin(cal, puestos, ahora, noLaborables) : 0;

    salida.push({
      estacionKey,
      estacionNombre:
        est?.nombre ?? NOMBRE_SINTETICO[estacionKey] ?? estacionKey,
      colaMin,
      horizonteDias: cal
        ? proyectarHorizonteDias(cal, colaMin, puestos, ahora, noLaborables)
        : null,
      esperaP50Min: esperas.length ? Math.round(percentil(esperas, 0.5)) : 0,
      esperaP90Min: esperas.length ? Math.round(percentil(esperas, 0.9)) : 0,
      contencionMax,
      utilizacion5dPct:
        cap5d > 0 ? Math.round((programado5d / cap5d) * 1000) / 10 : 0,
      pasosEnPlan: pasos.length,
    });
  }
  return salida.sort((a, b) => a.estacionNombre.localeCompare(b.estacionNombre));
}

export type SnapshotItem = {
  itemId: string;
  finEstimado: Date | null;
  sinEstimar: boolean;
  parcial: boolean;
  margenMin: number | null;
};

type EtaItem = {
  finEstimado: Date | null;
  sinEstimar: boolean;
  parcial: boolean;
};

/**
 * Foto por item: finEstimado + margen contra la entrega (fin del día de
 * entrega es la deadline; + = proyecta tarde).
 */
export function construirSnapshotsItem(
  porItem: Map<string, EtaItem>,
  fechaEntregaPorItem: Map<string, string | null>,
): SnapshotItem[] {
  const salida: SnapshotItem[] = [];
  for (const [itemId, eta] of porItem) {
    const entregaIso = fechaEntregaPorItem.get(itemId) ?? null;
    let margenMin: number | null = null;
    if (eta.finEstimado && entregaIso) {
      const [y, m, d] = entregaIso.slice(0, 10).split('-').map(Number);
      if (y && m && d) {
        const deadline = new Date(y, m - 1, d, 23, 59, 59, 999);
        margenMin = Math.round(
          (eta.finEstimado.getTime() - deadline.getTime()) / 60000,
        );
      }
    }
    salida.push({
      itemId,
      finEstimado: eta.finEstimado,
      sinEstimar: eta.sinEstimar,
      parcial: eta.parcial,
      margenMin,
    });
  }
  return salida;
}
