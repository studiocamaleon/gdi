import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAQUINA_DISPONIBLE_WHERE } from '../maquinaria/maquinaria-disponibilidad';
import { CC_PRODUCTO_CODIGO, CC_SISTEMA_CODIGO } from './provisionar-plantilla';

export type NivelSaludCentroCopiado = 'OK' | 'ADVERTENCIA' | 'ERROR';

export interface ChequeoSaludCentroCopiado {
  codigo: string;
  etiqueta: string;
  nivel: NivelSaludCentroCopiado;
  detalle: string;
  reparable: boolean;
}

export interface SaludCentroCopiado {
  estado: 'OPERATIVO' | 'ADVERTENCIA' | 'ERROR';
  generadoEl: string;
  inicializado: boolean;
  activo: boolean;
  puedeReparar: boolean;
  resumen: {
    impresoras: number;
    papeles: number;
    variantesPapel: number;
    variantesCosteadas: number;
    anilladoras: number;
    tiposAnillo: number;
    tapas: number;
  };
  chequeos: ChequeoSaludCentroCopiado[];
}

const nivel = (
  condicion: boolean,
  cuandoFalla: Exclude<NivelSaludCentroCopiado, 'OK'>,
): NivelSaludCentroCopiado => (condicion ? 'OK' : cuandoFalla);

@Injectable()
export class CentroCopiadoSaludService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(tenantId: string): Promise<SaludCentroCopiado> {
    const [config, producto, impresoras, papeles, anilladoras, anillos, tapas] =
      await Promise.all([
        this.prisma.centroCopiadoConfig.findUnique({ where: { tenantId } }),
        this.prisma.producto.findUnique({
          where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
          include: {
            rutasAlternativas: {
              where: { activo: true },
              include: {
                configPasos: {
                  where: { activo: true },
                  include: {
                    rutaPaso: { select: { familiaCodigo: true } },
                    maquinasCandidatas: {
                      where: { activo: true },
                      select: { maquinaId: true },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.maquina.findMany({
          where: {
            tenantId,
            plantilla: 'IMPRESORA_LASER',
            ...MAQUINA_DISPONIBLE_WHERE,
          },
          select: {
            id: true,
            componentesDesgaste: { select: { soloColor: true } },
          },
        }),
        this.prisma.materiaPrima.findMany({
          where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
          select: {
            id: true,
            variantes: {
              where: { activo: true },
              select: {
                id: true,
                precioReferencia: true,
                stocks: { select: { costoPromedio: true } },
              },
            },
          },
        }),
        this.prisma.maquina.findMany({
          where: {
            tenantId,
            plantilla: 'ANILLADORA',
            ...MAQUINA_DISPONIBLE_WHERE,
          },
          select: { id: true },
        }),
        this.prisma.materiaPrimaVariante.findMany({
          where: {
            tenantId,
            activo: true,
            materiaPrima: { subfamilia: 'ANILLADO_ENCUADERNACION' },
          },
          select: { atributosVarianteJson: true },
        }),
        this.prisma.materiaPrima.findMany({
          where: { tenantId, subfamilia: 'TAPA_ENCUADERNACION' },
          select: {
            id: true,
            variantes: { where: { activo: true }, select: { id: true } },
          },
        }),
      ]);

    const ruta = producto?.rutasAlternativas[0] ?? null;
    const pasoImpresion = ruta?.configPasos.find(
      (paso) => paso.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    );
    const pasoAnillado = ruta?.configPasos.find(
      (paso) => paso.rutaPaso.familiaCodigo === 'encuadernado_anillado',
    );
    const variantesPapel = papeles.reduce(
      (total, papel) => total + papel.variantes.length,
      0,
    );
    const variantesCosteadas = papeles.reduce(
      (total, papel) =>
        total +
        papel.variantes.filter(
          (variante) =>
            Number(variante.precioReferencia ?? 0) > 0 ||
            variante.stocks.some((stock) => Number(stock.costoPromedio) > 0),
        ).length,
      0,
    );
    const tapasDisponibles = tapas.filter((tapa) => tapa.variantes.length > 0);
    const tiposAnillo = new Set(
      anillos
        .map((anillo) => {
          const atributos = (anillo.atributosVarianteJson ?? {}) as Record<
            string,
            unknown
          >;
          return typeof atributos.tipoAnillo === 'string'
            ? atributos.tipoAnillo
            : null;
        })
        .filter((tipo): tipo is string => !!tipo),
    );
    const impresoraIds = new Set(impresoras.map((maquina) => maquina.id));
    const seleccionValida = [config?.maquinaColorId, config?.maquinaBnId]
      .filter((id): id is string => !!id)
      .every((id) => impresoraIds.has(id));
    const candidatasValidas =
      !!pasoImpresion &&
      pasoImpresion.maquinasCandidatas.some((candidata) =>
        impresoraIds.has(candidata.maquinaId),
      );
    const anilladoConfigurado = (
      (config?.terminacionesJson as string[] | null) ?? ['Anillado']
    ).includes('Anillado');
    const anilladoraSeleccionadaValida =
      !config?.maquinaAnilladoraId ||
      anilladoras.some((maquina) => maquina.id === config.maquinaAnilladoraId);

    const chequeos: ChequeoSaludCentroCopiado[] = [
      {
        codigo: 'configuracion',
        etiqueta: 'Configuración',
        nivel: nivel(!!config, 'ERROR'),
        detalle: config
          ? config.activo
            ? 'Configuración activa y persistida.'
            : 'El módulo está pausado por configuración.'
          : 'El módulo todavía no tiene configuración persistida.',
        reparable: !config,
      },
      {
        codigo: 'plantilla',
        etiqueta: 'Plantilla del sistema',
        nivel: nivel(
          !!producto &&
            producto.activo &&
            producto.sistemaCodigo === CC_SISTEMA_CODIGO,
          'ERROR',
        ),
        detalle: !producto
          ? 'Falta el producto técnico del Centro de Copiado.'
          : producto.sistemaCodigo !== CC_SISTEMA_CODIGO
            ? 'La plantilla existe, pero no está marcada como recurso del sistema.'
            : producto.activo
              ? 'Producto técnico protegido y activo.'
              : 'El producto técnico está inactivo.',
        reparable: !producto || producto?.sistemaCodigo !== CC_SISTEMA_CODIGO,
      },
      {
        codigo: 'ruta_impresion',
        etiqueta: 'Ruta de impresión',
        nivel: nivel(!!ruta && !!pasoImpresion, 'ERROR'),
        detalle:
          ruta && pasoImpresion
            ? 'Ruta y paso de impresión disponibles.'
            : 'Falta la ruta activa o el paso de impresión por hoja.',
        reparable: !ruta || !pasoImpresion,
      },
      {
        codigo: 'impresoras',
        etiqueta: 'Impresoras láser',
        nivel: nivel(impresoras.length > 0 && seleccionValida, 'ERROR'),
        detalle:
          impresoras.length === 0
            ? 'No hay impresoras láser disponibles.'
            : seleccionValida
              ? `${impresoras.length} impresora(s) disponible(s).`
              : 'Una impresora elegida ya no está disponible.',
        reparable: !seleccionValida,
      },
      {
        codigo: 'candidatas',
        etiqueta: 'Ruteo de máquinas',
        nivel: nivel(candidatasValidas, 'ERROR'),
        detalle: candidatasValidas
          ? 'El paso de impresión tiene al menos una candidata válida.'
          : 'El paso de impresión no tiene máquinas candidatas utilizables.',
        reparable: !!pasoImpresion && impresoras.length > 0,
      },
      {
        codigo: 'papeles',
        etiqueta: 'Papeles',
        nivel: nivel(variantesPapel > 0, 'ERROR'),
        detalle:
          variantesPapel > 0
            ? `${papeles.length} papel(es) con ${variantesPapel} variante(s) activa(s).`
            : 'No hay variantes activas de papel para producir.',
        reparable: false,
      },
      {
        codigo: 'costos_papel',
        etiqueta: 'Costos de papel',
        nivel: nivel(
          variantesPapel > 0 && variantesCosteadas === variantesPapel,
          'ADVERTENCIA',
        ),
        detalle:
          variantesPapel > 0 && variantesCosteadas === variantesPapel
            ? 'Todas las variantes activas tienen un costo disponible.'
            : `${variantesCosteadas} de ${variantesPapel} variante(s) tienen costo; una cotización puede resultar en $0.`,
        reparable: false,
      },
    ];

    if (anilladoConfigurado) {
      const anilladoListo =
        !!pasoAnillado &&
        anilladoras.length > 0 &&
        anilladoraSeleccionadaValida &&
        tiposAnillo.size > 0;
      chequeos.push({
        codigo: 'anillado',
        etiqueta: 'Anillado',
        nivel: nivel(anilladoListo, 'ADVERTENCIA'),
        detalle: anilladoListo
          ? `${tiposAnillo.size} tipo(s) de anillo disponibles.`
          : 'Anillado no está completamente configurado; no se ofrecerá al cargar.',
        reparable:
          anilladoras.length > 0 && tiposAnillo.size > 0 && !pasoAnillado,
      });
      chequeos.push({
        codigo: 'tapas',
        etiqueta: 'Tapas de encuadernación',
        nivel: nivel(tapasDisponibles.length >= 2, 'ADVERTENCIA'),
        detalle:
          tapasDisponibles.length >= 2
            ? `${tapasDisponibles.length} materiales de tapa disponibles.`
            : 'Falta tapa frontal o contratapa; algunos anillados pueden quedar incompletos.',
        reparable: false,
      });
    }

    const tieneError = chequeos.some((chequeo) => chequeo.nivel === 'ERROR');
    const tieneAdvertencia = chequeos.some(
      (chequeo) => chequeo.nivel === 'ADVERTENCIA',
    );
    return {
      estado: tieneError
        ? 'ERROR'
        : tieneAdvertencia
          ? 'ADVERTENCIA'
          : 'OPERATIVO',
      generadoEl: new Date().toISOString(),
      inicializado: !!producto && !!config,
      activo: config?.activo ?? false,
      puedeReparar: chequeos.some((chequeo) => chequeo.reparable),
      resumen: {
        impresoras: impresoras.length,
        papeles: papeles.length,
        variantesPapel,
        variantesCosteadas,
        anilladoras: anilladoras.length,
        tiposAnillo: tiposAnillo.size,
        tapas: tapasDisponibles.length,
      },
      chequeos,
    };
  }
}
