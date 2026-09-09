import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  ResultadoCommonLineTrabajo,
} from '../colas';
import {
  materializarPatrones,
  type Patron,
  type SeleccionPatrones,
} from './cartera-patrones';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

type Pose = {
  piezaId: string;
  copia: number;
  grados: number;
  x: number;
  y: number;
};
type Plantilla = { poses: Pose[]; commonLine?: ResultadoCommonLineTrabajo };
type PlanAprendido = {
  demanda: Record<string, number>;
  seleccion: Array<{ firma: string; repeticiones: number }>;
};
type Biblioteca = {
  version: 2;
  patrones: Plantilla[];
  planes: PlanAprendido[];
};
export type FamiliaPatrones = {
  patrones: Patron[];
  /** Combinaciones completas, aún sujetas a validación geométrica final. */
  planes: SeleccionPatrones[];
};
const MAX_PATRONES = 256;
const MAX_PLANES = 32;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_BYTES_PLANES = 64 * 1024;

function leerBiblioteca(json: unknown): Biblioteca {
  // Compatibilidad con la primera biblioteca, que sólo guardaba patrones.
  if (Array.isArray(json))
    return { version: 2, patrones: json.slice(0, MAX_PATRONES), planes: [] };
  const value = json as Partial<Biblioteca> | null;
  return {
    version: 2,
    patrones: Array.isArray(value?.patrones)
      ? value.patrones.slice(0, MAX_PATRONES)
      : [],
    planes:
      value?.version === 2 && Array.isArray(value.planes)
        ? value.planes.slice(0, MAX_PLANES)
        : [],
  };
}

function firmaPlantilla(plantilla: Plantilla): string {
  return createHash('sha256')
    .update(serializarEstable(plantilla, true))
    .digest('hex');
}

function serializarEstable(
  value: unknown,
  precisionExportacion = false,
): string {
  // PostgreSQL jsonb puede reordenar claves de objetos. La identidad de una
  // pose o un plan debe sobrevivir ese viaje sin depender del orden de claves.
  return JSON.stringify(value, (_key, v: unknown) =>
    // Sólo la firma se redondea. El viaje por JSON/Prisma también puede variar
    // un ulp en residuos trigonométricos; las poses almacenadas no se alteran.
    precisionExportacion && typeof v === 'number'
      ? Math.round(v * 1e6) / 1e6
      : v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(
            Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
          )
        : v,
  );
}

/** Cantidad, semilla, presupuesto y motor no cambian la fabricabilidad de una
 * placa. Geometría, orientaciones, área útil, separación y Common Line sí. */
export function firmaFamiliaPatrones(input: NestingIrregularOpenNestData) {
  const piezas = input.piezas
    .map(({ cantidad: _cantidad, id, ...geometria }) => ({
      id,
      geometria,
      firma: JSON.stringify(geometria),
    }))
    .sort((a, b) => a.firma.localeCompare(b.firma) || a.id.localeCompare(b.id));
  const { maxPlacas: _maxPlacas, ...placa } = input.placa;
  return {
    clave: createHash('sha256')
      .update(
        JSON.stringify({
          version: 1,
          placa,
          separacionMm: input.separacionMm,
          commonLine: input.commonLine,
          piezas: piezas.map((p) => p.geometria),
        }),
      )
      .digest('hex'),
    ids: new Map(piezas.map((p, i) => [p.id, `tipo-${i}`])),
  };
}

/** Sólo poses y recorridos: los contornos originales se reconstruyen al usar
 * el patrón. Los números de copia son locales al archivo de fabricación. */
function extraerPlantillas(
  result: NestingIrregularOpenNestResult,
): Array<{ plantilla: Plantilla; repeticiones: number }> {
  const placas = new Map<number, typeof result.placements>();
  for (const p of result.placements) {
    const ps = placas.get(p.placa) ?? [];
    ps.push(p);
    placas.set(p.placa, ps);
  }
  const unicos = new Map<
    string,
    { plantilla: Plantilla; repeticiones: number }
  >();
  for (const [placa, ps] of placas) {
    const originales = new Map<string, number>();
    const copias = new Map<string, number>();
    const poses = [...ps]
      .sort(
        (a, b) =>
          a.piezaId.localeCompare(b.piezaId) ||
          a.rotacionGrados - b.rotacionGrados ||
          a.traslacion.x - b.traslacion.x ||
          a.traslacion.y - b.traslacion.y,
      )
      .map((p) => {
        const copia = copias.get(p.piezaId) ?? 0;
        copias.set(p.piezaId, copia + 1);
        originales.set(`${p.piezaId}:${p.copia}`, copia);
        return {
          piezaId: p.piezaId,
          copia,
          grados: p.rotacionGrados,
          ...p.traslacion,
        };
      });
    const tramos = (result.commonLine?.tramos ?? [])
      .filter((t) => t.placa === placa)
      .map((t) => ({
        ...t,
        placa: 0,
        id: '',
        segmentosOrigen: t.segmentosOrigen.map((s) => {
          const copia = originales.get(`${s.piezaId}:${s.copia}`);
          if (copia === undefined)
            throw new Error('Referencia de patrón desconocida.');
          return { ...s, copia };
        }) as typeof t.segmentosOrigen,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      .map((t, i) => ({ ...t, id: `cl-${i}` }));
    const plantilla: Plantilla = {
      poses,
      ...(result.commonLine && tramos.length
        ? {
            commonLine: {
              ...result.commonLine,
              aplicado: true,
              tramos,
              longitudCompartidaMm: tramos.reduce(
                (s, t) => s + t.longitudMm,
                0,
              ),
              ahorroRecorridoMm: tramos.reduce((s, t) => s + t.longitudMm, 0),
            },
          }
        : {}),
    };
    const firma = firmaPlantilla(plantilla);
    const anterior = unicos.get(firma);
    unicos.set(firma, {
      plantilla,
      repeticiones: (anterior?.repeticiones ?? 0) + 1,
    });
  }
  return [...unicos.values()];
}

function convertir(
  input: NestingIrregularOpenNestData,
  plantilla: Plantilla,
): Patron {
  const counts = input.piezas.map(
    (p) => plantilla.poses.filter((x) => x.piezaId === p.id).length,
  );
  return {
    counts,
    origen: 'biblioteca',
    placements: plantilla.poses.map((p) => ({
      pieceId: p.piezaId,
      substrateIndex: 0,
      xMm: p.x,
      yMm: p.y,
      widthMm: 0,
      heightMm: 0,
      rotated: false,
      meta: {
        rotacionGrados: p.grados,
        traslacion: { x: p.x, y: p.y },
        copia: p.copia,
      },
    })),
    ...(plantilla.commonLine ? { commonLine: plantilla.commonLine } : {}),
  };
}

function validarPatron(
  input: NestingIrregularOpenNestData,
  patron: Patron,
): void {
  const parcial = {
    ...input,
    placa: { ...input.placa, maxPlacas: 1 },
    piezas: input.piezas
      .map((p, i) => ({ ...p, cantidad: patron.counts[i] }))
      .filter((p) => p.cantidad > 0),
  };
  if (!parcial.piezas.length) throw new Error('Patrón vacío.');
  validarResultadoNestingOpenNest(
    parcial,
    materializarPatrones(parcial, [patron], {
      seleccion: [{ patron: 0, repeticiones: 1 }],
      optimoPlacasDentroCartera: false,
      optimoPatronesDentroCartera: false,
    }),
  );
}

function remapear(plantilla: Plantilla, ids: Map<string, string>): Plantilla {
  const id = (value: string) => {
    const mapped = ids.get(value);
    if (!mapped) throw new Error('Tipo de pieza desconocido en biblioteca.');
    return mapped;
  };
  return {
    poses: plantilla.poses.map((p) => ({ ...p, piezaId: id(p.piezaId) })),
    ...(plantilla.commonLine
      ? {
          commonLine: {
            ...plantilla.commonLine,
            tramos: plantilla.commonLine.tramos.map((t) => ({
              ...t,
              segmentosOrigen: t.segmentosOrigen.map((s) => ({
                ...s,
                piezaId: id(s.piezaId),
              })) as typeof t.segmentosOrigen,
            })),
          },
        }
      : {}),
  };
}

/** Extrae patrones de una solución ya validada para enriquecer otra búsqueda. */
export function patronesDeResultado(
  input: NestingIrregularOpenNestData,
  result: NestingIrregularOpenNestResult,
): Patron[] {
  return extraerPlantillas(result).map(({ plantilla }) =>
    convertir(input, plantilla),
  );
}

@Injectable()
export class BibliotecaPatronesService {
  private readonly logger = new Logger(BibliotecaPatronesService.name);
  constructor(private readonly db: PrismaService) {}

  async obtener(input: NestingIrregularOpenNestData): Promise<Patron[]> {
    return (await this.obtenerFamilia(input)).patrones;
  }

  async obtenerFamilia(
    input: NestingIrregularOpenNestData,
  ): Promise<FamiliaPatrones> {
    const { clave, ids } = firmaFamiliaPatrones(input);
    const row = await this.db.carteraNestingGuardada.findUnique({
      where: { tenantId_clave: { tenantId: input.tenantId, clave } },
    });
    if (!row) return { patrones: [], planes: [] };
    const biblioteca = leerBiblioteca(row.patronesJson);
    const inversos = new Map([...ids].map(([a, b]) => [b, a]));
    const patrones: Patron[] = [];
    const indices = new Map<string, number>();
    for (const json of biblioteca.patrones) {
      try {
        const patron = convertir(input, remapear(json, inversos));
        validarPatron(input, patron);
        // La biblioteca conserva también patrones mayores para futuras tiradas;
        // el selector actual sólo puede elegir cantidades que no excedan demanda.
        if (patron.counts.every((n, i) => n <= input.piezas[i].cantidad)) {
          indices.set(firmaPlantilla(json), patrones.length);
          patrones.push(patron);
        }
      } catch {
        this.logger.warn({
          event: 'patron_guardado_invalido',
          clave,
          tenantId: input.tenantId,
        });
      }
    }
    const planes: SeleccionPatrones[] = [];
    for (const plan of biblioteca.planes) {
      const seleccion = escalarPlan(input, ids, plan, indices, patrones);
      if (seleccion) planes.push(seleccion);
    }
    planes.sort(
      (a, b) =>
        a.seleccion.reduce((s, x) => s + x.repeticiones, 0) -
          b.seleccion.reduce((s, x) => s + x.repeticiones, 0) ||
        a.seleccion.length - b.seleccion.length,
    );
    return { patrones, planes };
  }

  async aprender(
    input: NestingIrregularOpenNestData,
    result: NestingIrregularOpenNestResult,
  ): Promise<void> {
    const { clave, ids } = firmaFamiliaPatrones(input);
    const nuevas = extraerPlantillas(result);
    for (const { plantilla } of nuevas)
      validarPatron(input, convertir(input, plantilla));
    const canonicas = nuevas.map(({ plantilla }) => remapear(plantilla, ids));
    const plan: PlanAprendido = {
      demanda: Object.fromEntries(
        input.piezas
          .map((p) => [ids.get(p.id)!, p.cantidad])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
      ),
      seleccion: canonicas
        .map((p, i) => ({
          firma: firmaPlantilla(p),
          repeticiones: nuevas[i].repeticiones,
        }))
        .sort((a, b) => a.firma.localeCompare(b.firma)),
    };
    // 100 y 200 unidades con el mismo plan son una única receta escalable.
    const divisor = plan.seleccion.reduce((m, p) => mcd(m, p.repeticiones), 0);
    if (divisor > 1) {
      for (const id of Object.keys(plan.demanda)) plan.demanda[id] /= divisor;
      for (const p of plan.seleccion) p.repeticiones /= divisor;
    }
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`patrones:${input.tenantId}:${clave}`}, 0))`;
      const where = { tenantId_clave: { tenantId: input.tenantId, clave } };
      const anterior = await tx.carteraNestingGuardada.findUnique({ where });
      // Primero la última solución ganadora; después diversidad anterior. Tanto
      // cantidad como bytes están acotados: nunca se guardan miles de copias.
      const previa = leerBiblioteca(anterior?.patronesJson);
      const vistos = new Set<string>();
      const elegidas: Plantilla[] = [];
      let bytes = 2;
      for (const p of [...canonicas, ...previa.patrones]) {
        const json = serializarEstable(p);
        const firma = firmaPlantilla(p);
        const size = Buffer.byteLength(json) + 1;
        if (vistos.has(firma) || bytes + size > MAX_BYTES - MAX_BYTES_PLANES)
          continue;
        vistos.add(firma);
        elegidas.push(p);
        bytes += size;
        if (elegidas.length >= MAX_PATRONES) break;
      }
      const firmas = new Set(elegidas.map(firmaPlantilla));
      const planes: PlanAprendido[] = [];
      const vistosPlanes = new Set<string>();
      let bytesPlanes = 0;
      for (const p of [plan, ...previa.planes]) {
        if (
          !Array.isArray(p?.seleccion) ||
          !p.seleccion.every((s) => firmas.has(s.firma))
        )
          continue;
        const json = serializarEstable(p);
        const size = Buffer.byteLength(json) + 1;
        if (
          vistosPlanes.has(json) ||
          bytesPlanes + size > MAX_BYTES_PLANES - 100
        )
          continue;
        vistosPlanes.add(json);
        bytesPlanes += size;
        planes.push(p);
        if (planes.length >= MAX_PLANES) break;
      }
      const biblioteca: Biblioteca = { version: 2, patrones: elegidas, planes };
      if (
        serializarEstable(biblioteca) ===
        serializarEstable(anterior?.patronesJson)
      )
        return;
      const patronesJson = biblioteca as unknown as Prisma.InputJsonValue;
      await tx.carteraNestingGuardada.upsert({
        where,
        create: { tenantId: input.tenantId, clave, patronesJson },
        update: { patronesJson },
      });
    });
  }
}

function mcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Aritmética entera: nunca redondea placas ni produce piezas de más. */
function escalarPlan(
  input: NestingIrregularOpenNestData,
  ids: Map<string, string>,
  plan: PlanAprendido,
  indices: Map<string, number>,
  patrones: Patron[],
): SeleccionPatrones | null {
  try {
    if (
      !plan?.demanda ||
      Object.keys(plan.demanda).length !== ids.size ||
      !Array.isArray(plan.seleccion) ||
      !plan.seleccion.length ||
      plan.seleccion.length > MAX_PATRONES
    )
      return null;
    const numerador = input.piezas[0].cantidad;
    const denominador = plan.demanda[ids.get(input.piezas[0].id)!];
    if (!Number.isSafeInteger(denominador) || denominador <= 0) return null;
    if (
      !input.piezas.every((p) => {
        const cantidad = plan.demanda[ids.get(p.id)!];
        return (
          Number.isSafeInteger(cantidad) &&
          cantidad > 0 &&
          Number.isSafeInteger(p.cantidad * denominador) &&
          Number.isSafeInteger(cantidad * numerador) &&
          p.cantidad * denominador === cantidad * numerador
        );
      })
    )
      return null;
    const seleccion: SeleccionPatrones['seleccion'] = [];
    const usados = new Set<number>();
    for (const s of plan.seleccion) {
      const patron = indices.get(s.firma);
      const multiplicado = s.repeticiones * numerador;
      if (
        patron === undefined ||
        usados.has(patron) ||
        !Number.isSafeInteger(s.repeticiones) ||
        s.repeticiones <= 0 ||
        !Number.isSafeInteger(multiplicado) ||
        multiplicado % denominador !== 0
      )
        return null;
      usados.add(patron);
      seleccion.push({ patron, repeticiones: multiplicado / denominador });
    }
    if (
      seleccion.reduce((s, x) => s + x.repeticiones, 0) >
        input.placa.maxPlacas ||
      !input.piezas.every(
        (p, i) =>
          seleccion.reduce(
            (s, x) => s + patrones[x.patron].counts[i] * x.repeticiones,
            0,
          ) === p.cantidad,
      )
    )
      return null;
    // Reutilizar una combinación no demuestra optimalidad para la nueva demanda.
    return {
      seleccion,
      optimoPlacasDentroCartera: false,
      optimoPatronesDentroCartera: false,
    };
  } catch {
    return null;
  }
}
