import {
  materialUnitConversion,
  normalizeMaterialUnit,
  type MaterialUnitContext,
} from '../inventario/material-units';

type Registro = Record<string, unknown>;
const registro = (value: unknown): Registro | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Registro)
    : null;
const registros = (value: unknown): Registro[] =>
  Array.isArray(value)
    ? value.flatMap((v) => (registro(v) ? [v as Registro] : []))
    : [];
const texto = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
const numero = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
const redondear = (value: number) => Math.round(value * 1e8) / 1e8;

export type ItemMaterialesSnapshot = {
  id: string;
  nombre: string;
  parentItemId: string | null;
  componenteCodigo?: string | null;
  /** Los componentes INLINE no tienen fila propia de OT. */
  origenItemId?: string;
  contieneLotesEntrega: boolean;
  trazabilidadSnapshotJson: unknown;
  jobContextSnapshotJson?: unknown;
  cotizacionItem: {
    trazabilidadJson: unknown;
    jobContextJson?: unknown;
  } | null;
  pasos: Array<{
    id: string;
    nombre: string;
    rutaPasoId: string | null;
    nestingLoteId: string | null;
    nestingLoteRol: string | null;
    nestingLoteSnapshotJson: unknown;
  }>;
};

export type OrigenNecesidadMaterial = {
  itemId: string;
  producto: string;
  documento?: string;
  pasoId: string | null;
  paso: string;
  tipo: 'material' | 'consumible';
  loteCompartido: boolean;
  cantidadCalculada: number | null;
  unidadCalculada: string | null;
  cantidadStock: number | null;
  unidadStock: string | null;
  observacion: string | null;
};
export type NecesidadMaterialOrden = {
  varianteId: string;
  nombre: string;
  estado: 'calculada' | 'revisar';
  cantidad: number | null;
  unidad: string | null;
  origenes: OrigenNecesidadMaterial[];
};
export type MaterialesOrden = {
  ordenId: string;
  revision: string;
  necesidades: NecesidadMaterialOrden[];
  pendientes: Array<{
    itemId: string;
    producto: string;
    paso: string | null;
    motivo: string;
  }>;
  resumen: {
    variantes: number;
    calculadas: number;
    porRevisar: number;
    desgastesExcluidos: number;
  };
};

/** Cantidad física completa del acomodo, nunca el área/fracción que se cobró.
 * Sólo se usa cuando la cotización costeó directamente el soporte anidado
 * (no en impresión por hoja que convierte pasadas a hojas compradas). */
function soporteFisico(
  nesting: Registro | null,
  porcentaje: number,
): { cantidad: number; unidad: string } | null {
  const substrates = registros(nesting?.substrates);
  if (!substrates.length || porcentaje < 0 || !Number.isFinite(porcentaje))
    return null;
  if (substrates.every((s) => s.kind === 'sheet' && numero(s.count) !== null)) {
    const comprado = numero(
      registro(nesting?.pliegoImpresionSeleccionado)?.pliegosComprados,
    );
    const cantidad =
      comprado ?? substrates.reduce((sum, s) => sum + (s.count as number), 0);
    return {
      cantidad: Math.ceil(redondear(cantidad * (1 + porcentaje / 100))),
      unidad: 'hoja',
    };
  }
  if (
    substrates.every((s) => s.kind === 'roll' && numero(s.lengthMm) !== null)
  ) {
    return {
      cantidad: redondear(
        (substrates.reduce((sum, s) => sum + (s.lengthMm as number), 0) /
          1000) *
          (1 + porcentaje / 100),
      ),
      unidad: 'metro_lineal',
    };
  }
  return null;
}

/** C0: proyección de sólo lectura. No consulta precios, recetas ni coeficientes
 * actuales; tampoco interpreta una falta de snapshot como consumo cero. */
export function proyectarMaterialesOrden(
  ordenId: string,
  items: ItemMaterialesSnapshot[],
): Omit<MaterialesOrden, 'revision'> {
  const pendientes: MaterialesOrden['pendientes'] = [];
  // El motor guarda los componentes por separado del resumen del padre.
  // Los independientes se leen desde sus filas ejecutables; los INLINE,
  // desde su subcálculo congelado. Nunca repetir ambos caminos.
  items = [...items];
  for (let index = 0; index < items.length; index++) {
    const padre = items[index];
    if (padre.contieneLotesEntrega) continue;
    const traza = registro(
      padre.trazabilidadSnapshotJson ?? padre.cotizacionItem?.trazabilidadJson,
    );
    for (const componente of registros(traza?.componentesFabricados)) {
      const codigo = texto(componente.codigo);
      if (
        codigo &&
        items.some(
          (h) => h.parentItemId === padre.id && h.componenteCodigo === codigo,
        )
      )
        continue;
      const nombre = texto(componente.nombre) || 'Componente';
      if (
        componente.politicaEjecucion === 'INLINE' &&
        codigo &&
        Array.isArray(componente.pasos)
      ) {
        items.push({
          id: `${padre.id}/inline/${codigo}`,
          origenItemId: padre.origenItemId ?? padre.id,
          nombre: `${padre.nombre} · ${nombre}`,
          parentItemId: padre.id,
          componenteCodigo: codigo,
          contieneLotesEntrega: false,
          cotizacionItem: null,
          pasos: [],
          jobContextSnapshotJson: componente.jobContext,
          trazabilidadSnapshotJson: {
            pasos: componente.pasos,
            componentesFabricados: componente.componentes,
          },
        });
      } else {
        pendientes.push({
          itemId: padre.origenItemId ?? padre.id,
          producto: padre.nombre,
          paso: null,
          motivo: `El componente «${nombre}» todavía no tiene un detalle operativo de materiales disponible.`,
        });
      }
    }
  }
  const necesidades = new Map<string, NecesidadMaterialOrden>();
  let desgastesExcluidos = 0;
  const loteKey = (item: ItemMaterialesSnapshot, loteId: string) =>
    `${item.parentItemId ?? item.id}:${loteId}`;
  const lotes = new Map<string, Registro[]>();
  const lotesContados = new Set<string>();
  for (const item of items.filter((i) => !i.contieneLotesEntrega)) {
    for (const paso of item.pasos) {
      const lote = registro(paso.nestingLoteSnapshotJson);
      if (paso.nestingLoteRol === 'OPERATIVO' && paso.nestingLoteId && lote) {
        const key = loteKey(item, paso.nestingLoteId);
        lotes.set(key, [...(lotes.get(key) ?? []), lote]);
      }
    }
  }
  const pendiente = (
    item: ItemMaterialesSnapshot,
    paso: string | null,
    motivo: string,
  ) => {
    pendientes.push({
      itemId: item.origenItemId ?? item.id,
      producto: item.nombre,
      paso,
      motivo,
    });
  };

  for (const item of items) {
    if (item.contieneLotesEntrega) continue;
    const job = registro(
      item.jobContextSnapshotJson ?? item.cotizacionItem?.jobContextJson,
    );
    const centroCopiado = registro(job?._centroCopiado);
    const documento =
      texto(centroCopiado?.archivoNombre) ||
      texto(centroCopiado?.nombre) ||
      undefined;
    const traza = registro(
      item.trazabilidadSnapshotJson ?? item.cotizacionItem?.trazabilidadJson,
    );
    if (!traza || !Array.isArray(traza.pasos)) {
      pendiente(
        item,
        null,
        'Este ítem no tiene un cálculo de materiales guardado. Requiere revisión.',
      );
      continue;
    }
    if (registros(traza.pasos).length !== traza.pasos.length)
      pendiente(item, null, 'El cálculo guardado contiene pasos incompletos.');
    const snapshots = registros(traza.pasos).filter(
      (p) => p.activado !== false,
    );
    // Los borradores pueden tener cálculo y todavía no tener pasos de taller.
    const pasos = item.pasos.length
      ? item.pasos
      : snapshots.map((p, index) => ({
          id: null,
          nombre: texto(p.nombreVisible) || `Paso ${index + 1}`,
          rutaPasoId: texto(p.rutaPasoId) || null,
          nestingLoteId: null,
          nestingLoteRol: null,
          nestingLoteSnapshotJson: null,
        }));
    for (const paso of pasos) {
      const matches = snapshots.filter(
        (p) => texto(p.rutaPasoId) === paso.rutaPasoId,
      );
      if (matches.length !== 1) {
        pendiente(
          item,
          paso.nombre,
          'No se pudo identificar un cálculo único para este paso.',
        );
        continue;
      }
      const snapshot = matches[0];
      // El padre de una etapa compuesta repite los materiales de sus operaciones.
      const internas = registros(snapshot.operacionesInternas);
      const operaciones = internas.length
        ? internas.filter((o) => o.activada !== false)
        : [snapshot];
      for (const operacion of operaciones) {
        const nombrePaso = internas.length
          ? `${paso.nombre} · ${texto(operacion.nombre) || texto(operacion.codigo)}`
          : paso.nombre;
        if (!Array.isArray(operacion.materiales)) {
          pendiente(
            item,
            nombrePaso,
            'Este paso no tiene un detalle de materiales guardado.',
          );
          continue;
        }
        if (
          registros(operacion.materiales).length !== operacion.materiales.length
        )
          pendiente(
            item,
            nombrePaso,
            'El detalle de materiales contiene líneas incompletas.',
          );
        for (const material of registros(operacion.materiales)) {
          if (material.tipoLineaCosto === 'DESGASTE_MAQUINA') {
            desgastesExcluidos++;
            continue;
          }
          if (
            material.tipoLineaCosto !== 'MATERIAL' &&
            material.tipoLineaCosto !== 'CONSUMIBLE_MAQUINA'
          ) {
            pendiente(
              item,
              nombrePaso,
              'Hay una línea de material sin tipo de consumo definido.',
            );
            continue;
          }
          const varianteId = texto(material.materialVarianteId);
          if (!varianteId) {
            pendiente(
              item,
              nombrePaso,
              'Hay un material sin variante identificada.',
            );
            continue;
          }
          const nombre =
            texto(material.materialDisplayName) ||
            texto(material.materiaPrimaNombre) ||
            'Material sin nombre';
          let cantidad = numero(material.cantidad);
          let unidad = texto(material.unidad)
            ? normalizeMaterialUnit(texto(material.unidad))
            : null;
          let observacion: string | null = null;
          let compartido = false;
          const asignacion = registro(material.asignacionNestingCompuesto);
          const porcentaje =
            numero(registro(material.mermaAdicional)?.porcentaje) ?? 0;
          if (asignacion) {
            compartido = true;
            const loteId = texto(asignacion.loteId);
            const key = loteKey(item, loteId);
            const candidatos = lotes.get(key) ?? [];
            if (
              !loteId ||
              paso.nestingLoteId !== loteId ||
              candidatos.length !== 1
            ) {
              cantidad = null;
              observacion =
                'Falta identificar la operación del material compartido.';
            } else {
              const lote = candidatos[0];
              if (texto(lote.materialVarianteId) !== varianteId) {
                cantidad = null;
                observacion =
                  'El material del lote compartido no coincide con el del cálculo.';
              } else if (lote.layoutOrigenLoteId) {
                // Corte u otra operación sobre soportes ya demandados en el lote original.
                if (
                  (
                    lotes.get(loteKey(item, texto(lote.layoutOrigenLoteId))) ??
                    []
                  ).length === 1
                )
                  continue;
                cantidad = null;
                observacion =
                  'Falta el lote de origen de los soportes reutilizados.';
              } else {
                if (paso.nestingLoteRol === 'PARTICIPANTE') continue;
                if (lotesContados.has(key)) {
                  pendiente(
                    item,
                    nombrePaso,
                    'El lote compartido aparece más de una vez en el cálculo.',
                  );
                  continue;
                }
                lotesContados.add(key);
                const merma = registro(
                  registro(lote.costeoSustrato)?.mermaOperativa,
                );
                const fisico = soporteFisico(
                  registro(lote.nestingResult),
                  numero(merma?.porcentaje) ?? porcentaje,
                );
                cantidad = fisico?.cantidad ?? null;
                unidad = fisico?.unidad ?? null;
                if (!fisico)
                  observacion =
                    'Falta el detalle de los soportes del lote compartido.';
              }
            }
          } else if (material.detalleCosteoNesting) {
            const fisico = soporteFisico(
              registro(operacion.nestingResult),
              porcentaje,
            );
            cantidad = fisico?.cantidad ?? null;
            unidad = fisico?.unidad ?? null;
            if (!fisico)
              observacion =
                'El importe cotizado no permite determinar los soportes físicos necesarios.';
          }
          if (cantidad === null || !unidad)
            observacion ??=
              'La cantidad o su unidad no están definidas en el cálculo.';
          if (operacion.tercerizado === true || snapshot.tercerizado === true)
            observacion ??=
              'Paso tercerizado: falta confirmar quién aporta este material.';
          // Un cero explícito y válido es distinto de una cantidad faltante.
          if (cantidad === 0 && unidad && !observacion) continue;
          let cantidadStock: number | null = null;
          let unidadStock: string | null = null;
          const contexto = registro(material.contextoUnidadesSnapshot);
          if (!contexto || !texto(contexto.unidadStock)) {
            observacion ??=
              'Esta cotización no guardó la unidad de stock y sus conversiones. Se muestra la cantidad calculada.';
          } else {
            unidadStock = normalizeMaterialUnit(texto(contexto.unidadStock));
            if (cantidad !== null && unidad && !observacion) {
              try {
                const conversion = materialUnitConversion(
                  contexto as MaterialUnitContext,
                  unidad,
                  unidadStock,
                );
                if (
                  conversion.ok &&
                  Number.isFinite(conversion.factor) &&
                  conversion.factor > 0
                ) {
                  cantidadStock = redondear(cantidad * conversion.factor);
                  if (['hoja', 'placa'].includes(unidadStock))
                    cantidadStock = Math.ceil(cantidadStock);
                } else
                  observacion =
                    'Falta una conversión guardada hacia la unidad de stock.';
              } catch {
                observacion = 'Las conversiones guardadas requieren revisión.';
              }
            }
          }
          const fila = necesidades.get(varianteId) ?? {
            varianteId,
            nombre,
            estado: 'calculada',
            cantidad: null,
            unidad: null,
            origenes: [],
          };
          fila.origenes.push({
            itemId: item.origenItemId ?? item.id,
            producto: item.nombre,
            ...(documento ? { documento } : {}),
            pasoId: paso.id,
            paso: nombrePaso,
            tipo:
              material.tipoLineaCosto === 'CONSUMIBLE_MAQUINA'
                ? 'consumible'
                : 'material',
            loteCompartido: compartido,
            cantidadCalculada: cantidad,
            unidadCalculada: unidad,
            cantidadStock,
            unidadStock,
            observacion,
          });
          necesidades.set(varianteId, fila);
        }
      }
    }
  }
  for (const fila of necesidades.values()) {
    const unidad = fila.origenes[0].unidadStock;
    const completa =
      unidad &&
      fila.origenes.every(
        (o) =>
          !o.observacion &&
          o.cantidadStock !== null &&
          o.unidadStock === unidad,
      );
    fila.estado = completa ? 'calculada' : 'revisar';
    fila.unidad = completa ? unidad : null;
    fila.cantidad = completa
      ? redondear(fila.origenes.reduce((sum, o) => sum + o.cantidadStock!, 0))
      : null;
  }
  const filas = [...necesidades.values()].sort(
    (a, b) =>
      Number(a.origenes.every((o) => o.tipo === 'consumible')) -
        Number(b.origenes.every((o) => o.tipo === 'consumible')) ||
      a.nombre.localeCompare(b.nombre, 'es') ||
      a.varianteId.localeCompare(b.varianteId),
  );
  const resultado = {
    ordenId,
    necesidades: filas,
    pendientes,
    resumen: {
      variantes: filas.length,
      calculadas: filas.filter((f) => f.estado === 'calculada').length,
      porRevisar:
        filas.filter((f) => f.estado === 'revisar').length + pendientes.length,
      desgastesExcluidos,
    },
  };
  return resultado;
}
