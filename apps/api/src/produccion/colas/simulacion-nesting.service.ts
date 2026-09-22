import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { restaurarDatosSnapshot } from '../../prisma/snapshots.extension';
import { configurarFilaCola, leerFuentesCola } from './configuracion-cola';
import { nombreLoteProduccion } from '../../planificacion-entregas/materializar-lotes-entrega';
import { calcularRollo } from './simulacion-rollo-computo';
import {
  anchoMaximoRolloMaquina,
  resolveNestingConfig,
} from '../../motor-universal/nesting-config';
import type { JobContext } from '../../motor-universal/tipos';
import type {
  EntradaSimulacionRollo,
  PiezaSimulacion,
} from './simulacion-rollo';

import { identidadMaterialRollo } from './identidad-material-cola';
export { identidadMaterialRollo } from './identidad-material-cola';

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const numero = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : NaN;
const noNegativo = (v: unknown) => Math.max(0, numero(v) || 0);
export function extraerPiezasRollo(
  geometria: unknown,
  trabajo: number,
  referencia: string,
) {
  const guardado = { ...objeto(geometria) };
  if (!guardado.__grafo_geometrias_v2) delete guardado.__grafo_geometrias_v2;
  const leido = restaurarDatosSnapshot('OrdenTrabajoItem', {
    trazabilidadSnapshotJson: guardado,
  });
  const n = objeto(leido.trazabilidadSnapshotJson.nestingResult),
    visual = objeto(n.visualConfig);
  if (
    !['shelf-rollo', 'maxrects-rollo', 'secuencial-rollo'].includes(
      String(n.algorithm),
    )
  )
    throw new BadRequestException(
      `${referencia}: esta simulación necesita piezas rectangulares o paneles calculados sobre rollo.`,
    );
  if (typeof visual.allowRotation !== 'boolean')
    throw new BadRequestException(
      `${referencia}: falta la configuración de rotación guardada en la cotización.`,
    );
  const ubicaciones = lista(n.placements);
  if (!ubicaciones.length || ubicaciones.length > 1000)
    throw new BadRequestException(
      `${referencia}: no hay piezas calculadas o se supera el límite de 1000 piezas por simulación.`,
    );
  const piezas: PiezaSimulacion[] = ubicaciones.map((v, i) => {
    const p = objeto(v),
      rotada = p.rotated === true;
    const anchoMm = numero(rotada ? p.heightMm : p.widthMm),
      altoMm = numero(rotada ? p.widthMm : p.heightMm);
    if (
      !(
        anchoMm > 0 &&
        altoMm > 0 &&
        anchoMm <= 1_000_000 &&
        altoMm <= 1_000_000
      )
    )
      throw new BadRequestException(
        `${referencia}: una pieza no tiene medidas válidas.`,
      );
    const paneles = numero(p.panelCount) > 1 ? numero(p.panelCount) : null;
    const panel = paneles ? numero(p.panelIndex) : null;
    if (paneles && (!Number.isInteger(panel) || panel! < 1 || panel! > paneles))
      throw new BadRequestException(
        `${referencia}: falta la identificación de un panel.`,
      );
    return {
      id: `${trabajo}-${i}`,
      trabajo,
      etiqueta: `${referencia} · ${panel ? `panel ${panel}/${paneles}` : `pieza ${i + 1}`}`,
      anchoMm,
      altoMm,
      permiteRotar: visual.allowRotation as boolean,
      panel,
      paneles,
      solapeInicioMm: noNegativo(p.overlapStartMm),
      solapeFinMm: noNegativo(p.overlapEndMm),
    };
  });
  return { piezas, visual };
}

@Injectable()
export class SimulacionNestingColaService {
  private readonly calculando = new Map<
    string,
    {
      clave: string;
      resultado: ReturnType<SimulacionNestingColaService['preparar']>;
    }
  >();
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async simular(tenantId: string, maquinaId: string, pasoIds: string[]) {
    await this.capacidades.exigir(tenantId, 'colas_produccion');
    if (
      !pasoIds.length ||
      pasoIds.length > 50 ||
      new Set(pasoIds).size !== pasoIds.length
    )
      throw new BadRequestException(
        'Seleccioná entre 1 y 50 trabajos distintos.',
      );
    const clave = JSON.stringify([maquinaId, [...pasoIds].sort()]);
    const pendiente = this.calculando.get(tenantId);
    // Una reapertura o solicitud duplicada espera el mismo cálculo. No consume
    // otra plaza ni comparte resultados entre tenants o selecciones diferentes.
    if (pendiente?.clave === clave) {
      const resultado = await pendiente.resultado;
      await this.capacidades.exigir(tenantId, 'colas_produccion');
      return resultado;
    }
    if (pendiente || this.calculando.size >= 2)
      throw new ServiceUnavailableException(
        'Hay otra simulación en curso. Volvé a intentar en unos segundos.',
      );
    const resultado = this.preparar(tenantId, maquinaId, pasoIds).finally(
      () => {
        this.calculando.delete(tenantId);
      },
    );
    this.calculando.set(tenantId, { clave, resultado });
    return resultado;
  }

  private async preparar(
    tenantId: string,
    maquinaId: string,
    pasoIds: string[],
  ) {
    // Consultar no exige que el paso esté listo, en mesa o iniciado. No hay transiciones.
    const pasos = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: {
        tenantId,
        maquinaId,
        id: { in: pasoIds },
        item: { tenantId, contieneLotesEntrega: false },
        orden: { tenantId },
      },
      select: {
        id: true,
        itemId: true,
        nestingLoteRol: true,
        familiaCodigo: true,
        orden: { select: { numero: true } },
        item: {
          select: {
            nombre: true,
            loteEntrega: { select: { secuencia: true } },
          },
        },
      },
    });
    if (pasos.length !== pasoIds.length)
      throw new NotFoundException(
        'Algún trabajo ya no pertenece a esta cola. Actualizá la vista.',
      );
    // Dos operaciones de un mismo ítem no duplican sus piezas en la simulación.
    const unicos = [
      ...new Map(
        pasoIds
          .map((id) => pasos.find((p) => p.id === id)!)
          .map((p) => [p.itemId, p]),
      ).values(),
    ];
    const fuentes = await leerFuentesCola(
      this.prisma,
      tenantId,
      unicos.map((p) => p.id),
      true,
    );
    const [maquinaDb, configuraciones, defaults] = await Promise.all([
      this.prisma.maquina.findFirst({
        where: { id: maquinaId, tenantId, activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          plantilla: true,
          anchoUtil: true,
          largoUtil: true,
          parametrosTecnicosJson: true,
        },
      }),
      this.prisma.productoConfigPaso.findMany({
        where: {
          tenantId,
          id: {
            in: fuentes.flatMap((f) => {
              const id = objeto(f.original).configPasoId;
              return typeof id === 'string' &&
                /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
                ? [id]
                : [];
            }),
          },
        },
        select: { id: true, paramsPasoJson: true },
      }),
      this.prisma.familiaPasoDefaults.findMany({
        where: {
          tenantId,
          familiaCodigo: { in: unicos.map((p) => p.familiaCodigo) },
        },
        select: { familiaCodigo: true, demasiaMm: true, solapePanelMm: true },
      }),
    ]);
    if (!maquinaDb)
      throw new NotFoundException(
        'La máquina ya no está disponible. Actualizá la cola.',
      );
    const maquina = {
      ...maquinaDb,
      anchoUtil:
        maquinaDb.anchoUtil == null ? null : Number(maquinaDb.anchoUtil),
      largoUtil:
        maquinaDb.largoUtil == null ? null : Number(maquinaDb.largoUtil),
      parametrosTecnicosJson: objeto(maquinaDb.parametrosTecnicosJson),
    };
    const anchoMaximoMm = anchoMaximoRolloMaquina(maquina);
    if (anchoMaximoMm == null || anchoMaximoMm <= 0)
      throw new BadRequestException(
        `Configurá el ancho útil de ${maquina.nombre} para simular sus rollos.`,
      );
    const trabajos = unicos.map((p, indice) => {
      const fuente = fuentes.find((f) => f.pasoId === p.id);
      const referencia = `${p.orden.numero} · ${p.item.nombre}${p.item.loteEntrega ? ` · ${nombreLoteProduccion(p.item.loteEntrega.secuencia)}` : ''}`;
      if (!fuente)
        throw new BadRequestException(
          `${referencia}: no se encontraron las piezas de la cotización.`,
        );
      const configuracion = configurarFilaCola(fuente);
      if (configuracion.productoCompuesto)
        throw new BadRequestException(
          `${referencia}: pertenece a un producto compuesto. Se conserva su layout calculado y no se puede volver a nestear desde Colas.`,
        );
      if (configuracion.layoutConservado || p.nestingLoteRol)
        throw new BadRequestException(
          `${referencia}: tiene un layout vinculado. No hay piezas sueltas disponibles para este acomodo en rollo.`,
        );
      if (!configuracion.materialId)
        throw new BadRequestException(
          `${referencia}: falta identificar el material.`,
        );
      const extraido = extraerPiezasRollo(fuente.geometria, indice, referencia);
      const configId = objeto(fuente.original).configPasoId;
      const configPasoId = typeof configId === 'string' ? configId : '';
      const config = configuraciones.find((c) => c.id === configPasoId);
      const familia = defaults.find((d) => d.familiaCodigo === p.familiaCodigo);
      // Las OT antiguas pueden no conservar la receta. Sus demasías siguen
      // disponibles en el resultado; los márgenes físicos vienen de la máquina.
      const params = config
        ? config.paramsPasoJson
        : {
            nestingConfig: {
              pieceBleedMm: extraido.visual.pieceBleedMm,
              separationHMm: objeto(extraido.visual.spacing).horizontalMm,
              separationVMm: objeto(extraido.visual.spacing).verticalMm,
            },
          };
      const reglas = resolveNestingConfig(
        {
          familiaCodigo: p.familiaCodigo,
          configPasoId,
          paramsPasoJson: params,
          maquina,
          defaultsFamilia: familia
            ? {
                demasiaMm:
                  familia.demasiaMm == null ? null : Number(familia.demasiaMm),
                solapePanelMm:
                  familia.solapePanelMm == null
                    ? null
                    : Number(familia.solapePanelMm),
              }
            : undefined,
        },
        {
          cantidad: 1,
          configPasoRuntime: objeto(
            objeto(fuente.contexto).configPasoRuntime,
          ) as JobContext['configPasoRuntime'],
        },
        null,
      );
      return {
        pasoId: p.id,
        itemId: p.itemId,
        referencia,
        materialId: configuracion.materialId,
        piezas: extraido.piezas,
        reglas,
      };
    });
    const variantes = await this.prisma.materiaPrimaVariante.findMany({
      where: { tenantId, id: { in: trabajos.map((t) => t.materialId) } },
      select: {
        id: true,
        materiaPrimaId: true,
        atributosVarianteJson: true,
        materiaPrima: { select: { nombre: true } },
      },
    });
    const base = variantes[0];
    if (
      !base ||
      trabajos.some((t) => !variantes.some((v) => v.id === t.materialId))
    )
      throw new BadRequestException(
        'No se pudo identificar el material de todos los trabajos.',
      );
    const identidad = identidadMaterialRollo(base.atributosVarianteJson);
    if (
      variantes.some(
        (v) =>
          v.materiaPrimaId !== base.materiaPrimaId ||
          identidadMaterialRollo(v.atributosVarianteJson) !== identidad,
      )
    )
      throw new BadRequestException(
        'Para simular juntos, seleccioná trabajos del mismo material. Pueden tener distinto ancho cotizado.',
      );
    const catalogo = await this.prisma.materiaPrimaVariante.findMany({
      where: { tenantId, materiaPrimaId: base.materiaPrimaId, activo: true },
      select: { atributosVarianteJson: true },
    });
    const anchos = [
      ...new Set(
        catalogo
          .filter(
            (v) =>
              identidadMaterialRollo(v.atributosVarianteJson) === identidad,
          )
          .map((v) => numero(objeto(v.atributosVarianteJson).anchoMm))
          .filter((n) => n > 0),
      ),
    ];
    if (!anchos.length)
      throw new BadRequestException(
        'Este material no tiene anchos de rollo activos con medidas configuradas.',
      );
    const piezas = trabajos.flatMap((t) => t.piezas);
    if (piezas.length > 1000 || anchos.length > 30)
      throw new BadRequestException(
        'Simulá hasta 1000 piezas y 30 anchos de rollo por vez. Reducí la selección.',
      );
    const margenes: EntradaSimulacionRollo['margenes'] = {
      izquierda: Math.max(...trabajos.map((t) => t.reglas.margins.leftMm)),
      derecha: Math.max(...trabajos.map((t) => t.reglas.margins.rightMm)),
      inicio: Math.max(...trabajos.map((t) => t.reglas.margins.startMm)),
      fin: Math.max(...trabajos.map((t) => t.reglas.margins.endMm)),
    };
    const separacionMm = Math.max(
      ...trabajos.map((t) => t.reglas.separationHMm),
    );
    const separacionVerticalMm = Math.max(
      ...trabajos.map((t) => t.reglas.separationVMm),
    );
    const politicas = [...new Set(trabajos.map((t) => t.reglas.algorithm))];
    const algoritmo =
      maquina.plantilla.toLowerCase() === 'plotter_cad'
        ? 'secuencial-rollo'
        : politicas.length === 1
          ? politicas[0]
          : 'auto';
    await this.capacidades.exigir(tenantId, 'colas_produccion');
    const resultado = await calcularRollo({
      piezas,
      anchos,
      margenes,
      separacionMm,
      separacionVerticalMm,
      anchoMaximoMm,
      algoritmo,
    });
    // El cálculo corre fuera de una transacción. Una retirada del plan durante
    // la simulación no debe entregar un resultado nuevo de esa función.
    await this.capacidades.exigir(tenantId, 'colas_produccion');
    return {
      materialNombre: base.materiaPrima.nombre,
      maquina: { id: maquina.id, nombre: maquina.nombre, anchoMaximoMm },
      piezas,
      margenes,
      separacionMm,
      separacionVerticalMm,
      trabajos: trabajos.map((t) => ({
        pasoId: t.pasoId,
        itemId: t.itemId,
        referencia: t.referencia,
        piezas: t.piezas.length,
      })),
      ...resultado,
    };
  }
}
export type SimulacionNestingCola = Awaited<
  ReturnType<SimulacionNestingColaService['simular']>
>;
