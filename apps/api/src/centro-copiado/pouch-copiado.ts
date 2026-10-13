import { BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CENTRO_COPIADO_FORMATOS } from './centro-copiado.domain';

export const TERMINACION_POUCH = 'Plastificado pouch';
export type ConfigPouchCopiado = {
  centroCostoId: string | null;
  minutosPorHoja: number;
  formatos: { tamano: string; varianteId: string }[];
};
export type VariantePouchCopiado = {
  id: string;
  materiaPrimaId: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  margenMm: number;
};
type Db = PrismaClient | Prisma.TransactionClient;
export const POUCH_DEFAULT: ConfigPouchCopiado = {
  centroCostoId: null,
  minutosPorHoja: 0.5,
  formatos: [],
};

export function leerConfigPouch(params: unknown): ConfigPouchCopiado {
  return (
    (params as { copiadoPouch?: ConfigPouchCopiado } | null)?.copiadoPouch ??
    POUCH_DEFAULT
  );
}
export async function variantesPouch(
  db: Db,
  tenantId: string,
): Promise<VariantePouchCopiado[]> {
  const variantes = await db.materiaPrimaVariante.findMany({
    where: {
      tenantId,
      activo: true,
      materiaPrima: { tenantId, activo: true, subfamilia: 'LAMINADO_POUCH' },
    },
    include: { materiaPrima: true },
    orderBy: { sku: 'asc' },
  });
  return variantes.map((v) => {
    const a = {
      ...(v.materiaPrima.atributosTecnicosJson as object),
      ...(v.atributosVarianteJson as object),
    } as Record<string, unknown>;
    return {
      id: v.id,
      materiaPrimaId: v.materiaPrimaId,
      nombre: `${v.materiaPrima.nombre} · ${v.nombreVariante || v.sku}`,
      anchoMm: Number(a.anchoMm ?? 0),
      altoMm: Number(a.altoMm ?? a.largoMm ?? 0),
      margenMm: Math.max(0, Number(a.margenNoUsableMm ?? 0)),
    };
  });
}
/** El formato debe corresponder a una hoja completa por sobre, sin cortar ni agrupar hojas. */
export function pouchParaFormato(
  variante: VariantePouchCopiado,
  ancho: number,
  alto: number,
) {
  const w = variante.anchoMm - 2 * variante.margenMm;
  const h = variante.altoMm - 2 * variante.margenMm;
  if (![w, h, ancho, alto].every((n) => Number.isFinite(n) && n > 0))
    return false;
  const poses = Math.max(
    Math.floor((w + 0.001) / ancho) * Math.floor((h + 0.001) / alto),
    Math.floor((w + 0.001) / alto) * Math.floor((h + 0.001) / ancho),
  );
  return poses === 1;
}
export async function validarConfigPouch(
  db: Db,
  tenantId: string,
  config: ConfigPouchCopiado,
  activo: boolean,
) {
  if (
    !Number.isFinite(config.minutosPorHoja) ||
    config.minutosPorHoja <= 0 ||
    config.minutosPorHoja > 60
  )
    throw new BadRequestException(
      'El tiempo de plastificado debe ser mayor que cero y hasta 60 minutos por hoja.',
    );
  if (activo && (!config.centroCostoId || !config.formatos.length))
    throw new BadRequestException(
      'Para ofrecer Plastificado pouch, elegí un centro de costo y al menos un formato con su sobre.',
    );
  if (
    config.centroCostoId &&
    !(await db.centroCosto.count({
      where: { id: config.centroCostoId, tenantId, activo: true },
    }))
  )
    throw new BadRequestException(
      'El centro de costo del plastificado no está disponible en esta empresa.',
    );
  if (
    new Set(config.formatos.map((f) => f.tamano)).size !==
    config.formatos.length
  )
    throw new BadRequestException('Elegí un solo pouch por formato.');
  const disponibles = await variantesPouch(db, tenantId);
  for (const f of config.formatos) {
    const formato = CENTRO_COPIADO_FORMATOS.find((t) => t.nombre === f.tamano);
    const variante = disponibles.find((v) => v.id === f.varianteId);
    if (
      !formato ||
      !variante ||
      !pouchParaFormato(variante, formato.anchoMm, formato.altoMm)
    )
      throw new BadRequestException(
        `El pouch de ${f.tamano} debe estar activo, pertenecer a esta empresa y cubrir una hoja completa, incluido el borde sellado.`,
      );
  }
  return disponibles;
}

/** Configuración y paso técnico se guardan en la misma transacción que el módulo. */
export async function guardarConfigPouch(
  db: Prisma.TransactionClient,
  tenantId: string,
  config: ConfigPouchCopiado,
  activo: boolean,
) {
  const variantes = await validarConfigPouch(db, tenantId, config, activo);
  const ruta = await db.productoRutaAlternativa.findFirst({
    where: {
      tenantId,
      activo: true,
      producto: { tenantId, codigo: 'SYS-IMPRESION-DOC' },
    },
    include: { configPasos: { include: { rutaPaso: true } } },
  });
  if (!ruta)
    throw new BadRequestException(
      'Inicializá Centro de copiado antes de configurar el pouch.',
    );
  const anterior = ruta.configPasos.find(
    (p) => p.rutaPaso.familiaCodigo === 'plastificado_pouch',
  );
  if (!anterior && !config.formatos.length && !config.centroCostoId && !activo)
    return;
  let rutaPasoId = anterior?.rutaPasoId;
  if (!rutaPasoId) {
    // Va después de imprimir y antes de encuadernar. Se desplaza desde el final para conservar el índice único.
    const posteriores = await db.rutaPaso.findMany({
      where: {
        tenantId,
        rutaId: ruta.rutaId,
        version: ruta.rutaVersion,
        orden: { gte: 1 },
      },
      orderBy: { orden: 'desc' },
    });
    for (const p of posteriores)
      await db.rutaPaso.update({
        where: { id: p.id },
        data: { orden: p.orden + 1 },
      });
    const paso = await db.rutaPaso.create({
      data: {
        tenantId,
        rutaId: ruta.rutaId,
        version: ruta.rutaVersion,
        orden: 1,
        familiaCodigo: 'plastificado_pouch',
        icono: 'Layers',
        activo: true,
      },
    });
    rutaPasoId = paso.id;
    const ver = await db.rutaVersion.findFirst({
      where: { tenantId, rutaId: ruta.rutaId, version: ruta.rutaVersion },
    });
    if (ver) {
      const snap = ver.snapshotJson as Prisma.JsonObject;
      const pasos: Prisma.JsonObject[] = (
        (snap.pasos ?? []) as Prisma.JsonObject[]
      ).map((p) => ({
        ...p,
        orden: Number(p.orden) >= 1 ? Number(p.orden) + 1 : p.orden,
      }));
      pasos.push({ id: paso.id, orden: 1, familia: 'plastificado_pouch' });
      await db.rutaVersion.update({
        where: { id: ver.id },
        data: { snapshotJson: { ...snap, pasos } as Prisma.InputJsonObject },
      });
    }
  }
  const data = {
    modoActivacion: 'OPCIONAL',
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    centroCostoId: config.centroCostoId,
    setupOverrideMin: 0,
    cleanupOverrideMin: 0,
    paramsPasoJson: {
      productivityValue: 60 / config.minutosPorHoja,
      productivityUnit: 'unidades_h',
      fuentePiezas: 'output:copiadoHojasPouch',
      copiadoPouch: config,
    } as Prisma.InputJsonObject,
  };
  const cp = anterior
    ? await db.productoConfigPaso.update({ where: { id: anterior.id }, data })
    : await db.productoConfigPaso.create({
        data: {
          ...data,
          tenantId,
          productoRutaAlternativaId: ruta.id,
          rutaPasoId,
        },
      });
  let slot = await db.productoConfigPasoSlotMaterial.findFirst({
    where: { tenantId, productoConfigPasoId: cp.id, slotCodigo: 'pouch' },
  });
  if (!slot)
    slot = await db.productoConfigPasoSlotMaterial.create({
      data: {
        tenantId,
        productoConfigPasoId: cp.id,
        slotCodigo: 'pouch',
        slotRol: 'CONSUMIBLE',
        modoSeleccion: 'COMERCIAL_ELIGE',
        formula: 'por_unidad_productiva',
        aplicaMultiCaras: false,
      },
    });
  const existentes = await db.productoConfigPasoSlotMaterialCandidato.findMany({
    where: { tenantId, slotMaterialId: slot.id },
  });
  const mps = new Set(existentes.map((c) => c.materiaPrimaId));
  for (const f of config.formatos) {
    const v = variantes.find((v) => v.id === f.varianteId)!;
    if (mps.has(v.materiaPrimaId)) continue;
    await db.productoConfigPasoSlotMaterialCandidato.create({
      data: {
        tenantId,
        slotMaterialId: slot.id,
        materiaPrimaId: v.materiaPrimaId,
        defaultVarianteId: v.id,
        todasLasVariantes: true,
        orden: mps.size,
      },
    });
    mps.add(v.materiaPrimaId);
  }
}

export function activarPouch(
  args: {
    configPasoId?: string | null;
    config?: ConfigPouchCopiado;
    variantes?: VariantePouchCopiado[];
  },
  tamano: string,
  anchoMm: number,
  altoMm: number,
  hojas: number,
) {
  const f = args.config?.formatos.find((f) => f.tamano === tamano);
  const v = args.variantes?.find((v) => v.id === f?.varianteId);
  if (
    !args.configPasoId ||
    !args.config?.centroCostoId ||
    !v ||
    !pouchParaFormato(v, anchoMm, altoMm)
  )
    return {
      error: `No hay un pouch configurado y disponible para ${tamano}. Revisá Ruta y terminaciones.`,
      additions: null,
    };
  return {
    error: null,
    additions: {
      opcionalesActivados: { [args.configPasoId]: true },
      slotMateriales: { [`${args.configPasoId}_pouch`]: v.id },
      copiadoHojasPouch: [{ cantidad: hojas, anchoMm, altoMm }],
    },
  };
}
