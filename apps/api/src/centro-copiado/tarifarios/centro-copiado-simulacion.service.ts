import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { regionalDelTenant } from '../../common/regional';
import { CentroCopiadoService } from '../centro-copiado.service';
import { CentroCopiadoCadService } from '../centro-copiado-cad.service';
import {
  CENTRO_COPIADO_COBERTURAS,
  CENTRO_COPIADO_FORMATOS,
} from '../centro-copiado.domain';
import type { DocumentoInput } from '../adaptador';
import type { CotizarOutput } from '../../motor-universal/tipos';
import { CentroCopiadoTarifariosService } from './centro-copiado-tarifarios.service';
import {
  validarContenidoTarifario,
  type ContenidoTarifario,
} from './contenido-tarifario';
import { calcularComercialHojas } from '../comercial/calculo-hojas';
import { calcularComercialCad } from '../comercial/calculo-cad';
import {
  DecimalComercial,
  ErrorCalculoComercial,
} from '../comercial/validaciones';
import { claveCombinacion } from '../comercial/validaciones';
import { claveCombinacionCad } from '../comercial/validaciones-cad';
import type {
  CeldaSimulacion,
  EscenarioSimulado,
  ResultadoCeldaSimulacion,
} from './simulacion-tarifario.types';

const solicitud = z
  .object({
    revision: z.number().int().positive().optional(),
    versionId: z.uuid().optional(),
    celdas: z
      .array(
        z
          .object({
            seccion: z.enum(['hojas', 'cad']),
            fila: z.number().int().min(0).max(4999),
            tramo: z.number().int().min(0).max(99),
            cantidadReferencia: z
              .string()
              .regex(/^\d{1,16}(\.\d{1,12})?$/)
              .optional(),
            perfilCadId: z.string().min(1).max(250).optional(),
            geometriaCad: z
              .object({
                anchoMm: z.number().positive().max(100000),
                altoMm: z.number().positive().max(100000),
                copias: z.number().int().min(1).max(10000),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .refine(
    (s) => (s.revision != null) !== (s.versionId != null),
    'Indicá la revisión del borrador o una versión.',
  );

function dentro(
  cantidad: string,
  desde: string | number,
  hasta?: string | number,
) {
  const n = new DecimalComercial(cantidad);
  if (!n.gt(0) || n.lt(desde) || (hasta != null && n.gte(hasta)))
    throw new BadRequestException(
      'La cantidad de referencia debe ser positiva y estar dentro del tramo elegido.',
    );
}

/** Cada escenario es un pedido independiente. No guarda cotizaciones ni precios. */
@Injectable()
export class CentroCopiadoSimulacionService {
  private readonly enCurso = new Set<string>();
  private readonly logger = new Logger(CentroCopiadoSimulacionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly tarifarios: CentroCopiadoTarifariosService,
    private readonly copiado: CentroCopiadoService,
    private readonly cad: CentroCopiadoCadService,
  ) {}

  async simular(tenantId: string, tarifarioId: string, body: unknown) {
    const parsed = solicitud.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Revisá la referencia de simulación: hasta cinco celdas por solicitud.',
      );
    const dto = parsed.data;
    const fuente = dto.versionId
      ? await this.tarifarios.version(tenantId, tarifarioId, dto.versionId)
      : await this.tarifarios.obtener(tenantId, tarifarioId);
    if ('revision' in fuente && fuente.revision !== dto.revision)
      throw new ConflictException(
        'El borrador cambió. Guardá o recargá antes de simular.',
      );
    const contenido = validarContenidoTarifario(fuente.contenido);
    const regional = await regionalDelTenant(this.prisma, tenantId);
    if (contenido.monedaCodigo !== regional.moneda.codigo)
      throw new BadRequestException(
        'La moneda del tarifario debe coincidir con la moneda de costos de la empresa.',
      );
    if (this.enCurso.has(tenantId))
      throw new HttpException(
        'Ya hay un lote de simulación en curso para esta empresa. Esperá a que termine.',
        429,
      );
    this.enCurso.add(tenantId);
    try {
      const resultados: ResultadoCeldaSimulacion[] = [];
      for (const celda of dto.celdas) {
        const matriz = contenido[celda.seccion];
        const fila = matriz?.filas[celda.fila];
        const rangos = fila?.rangosPropios ?? matriz?.rangosGenerales;
        if (!fila || rangos?.[celda.tramo] == null)
          throw new BadRequestException(
            'La celda ya no existe. Recargá el tarifario.',
          );
        const coberturas = fila.combinacion.cobertura
          ? [fila.combinacion.cobertura]
          : CENTRO_COPIADO_COBERTURAS;
        const escenarios: ResultadoCeldaSimulacion['escenarios'] = [];
        for (const cobertura of coberturas) {
          try {
            const escenario = await this.escenario(
              tenantId,
              tarifarioId,
              contenido,
              celda,
              cobertura,
            );
            escenarios.push({
              ...escenario,
              decimalesPrecio:
                regional.redondeoPrecio === 'entero'
                  ? 0
                  : regional.moneda.decimales,
            });
          } catch (error) {
            if (
              !(error instanceof HttpException) &&
              !(error instanceof ErrorCalculoComercial)
            )
              this.logger.error(
                'Falló un escenario de costos de Centro de copiado.',
                error instanceof Error ? error.stack : undefined,
              );
            escenarios.push({
              cobertura,
              calculadoEl: new Date().toISOString(),
              estado: 'ERROR',
              motivo:
                error instanceof HttpException ||
                error instanceof ErrorCalculoComercial
                  ? error.message
                  : 'No se pudo simular esta referencia. Revisá la configuración del motor y volvé a intentar.',
            });
          }
        }
        resultados.push({ celda, escenarios });
      }
      return { resultados };
    } finally {
      this.enCurso.delete(tenantId);
    }
  }

  private async iva(tenantId: string, productoId: string) {
    const [producto, fiscal, tasas] = await Promise.all([
      this.prisma.producto.findFirst({
        where: { tenantId, id: productoId },
        select: { categoriaFiscal: true },
      }),
      this.prisma.configuracionFiscal.findUnique({
        where: { tenantId },
        select: { condicionFiscal: true },
      }),
      this.prisma.productoImpuestoCatalogo.findMany({
        where: {
          tenantId,
          activo: true,
          alcance: 'PRODUCTO',
          traslado: 'POR_FUERA',
        },
      }),
    ]);
    if (!producto)
      throw new BadRequestException(
        'El producto de referencia ya no está disponible.',
      );
    const categoria = producto.categoriaFiscal ?? 'general';
    if (
      ['monotributo', 'exento'].includes(fiscal?.condicionFiscal ?? '') ||
      categoria === 'exento'
    )
      return '0';
    const compatibles = tasas.filter(
      (t) => (t.categoriaFiscal ?? 'general') === categoria,
    );
    if (compatibles.length !== 1)
      throw new BadRequestException(
        'Falta una alícuota fiscal inequívoca para comparar el precio sin IVA.',
      );
    return String(compatibles[0].porcentaje);
  }

  private async escenario(
    tenantId: string,
    tarifarioId: string,
    contenido: ContenidoTarifario,
    celda: CeldaSimulacion,
    cobertura: (typeof CENTRO_COPIADO_COBERTURAS)[number],
  ): Promise<Omit<EscenarioSimulado, 'decimalesPrecio'>> {
    const referencia = { tenantId, tarifarioId, versionId: 'simulacion' };
    let cotizaciones: NonNullable<CotizarOutput['cotizacion']>[];
    let grupos: EscenarioSimulado['grupos'];
    let cantidad: string;
    let facturable: string;
    let descripcion: string;
    let unidad: EscenarioSimulado['unidad'];
    const avisos: string[] = [];
    if (celda.seccion === 'hojas') {
      const matriz = contenido.hojas!;
      const fila = matriz.filas[celda.fila];
      const c = fila.combinacion;
      const rangos = fila.rangosPropios ?? matriz.rangosGenerales;
      let n = Number(celda.cantidadReferencia ?? rangos[celda.tramo]);
      if (!Number.isSafeInteger(n) || n > 1000000)
        throw new BadRequestException(
          'Usá una referencia entera de hasta 1.000.000 de unidades.',
        );
      if (
        matriz.reglas.unidad === 'CARILLA' &&
        c.faz === 2 &&
        matriz.reglas.ultimaHojaImpar === 'COBRAR_SIMPLE' &&
        n % 2 === 1
      ) {
        if (celda.cantidadReferencia != null)
          throw new BadRequestException(
            'Con última hoja a simple faz, el volumen de doble faz debe ser par. Elegí una cantidad par dentro del tramo.',
          );
        n++;
        if (rangos[celda.tramo + 1] != null && n >= rangos[celda.tramo + 1])
          throw new BadRequestException(
            'Este tramo no contiene una cantidad par. Con la última hoja a simple faz no hay un volumen de doble faz que use esta celda.',
          );
        avisos.push(
          'Referencia ajustada a la primera cantidad par: la última cara suelta se cobra en la combinación simple faz.',
        );
      }
      dentro(String(n), rangos[celda.tramo], rangos[celda.tramo + 1]);
      const formato = CENTRO_COPIADO_FORMATOS.find(
        (f) => f.nombre === c.tamano,
      )!;
      const impar =
        matriz.reglas.unidad === 'CARILLA' && c.faz === 2 && n % 2 === 1;
      if (impar && n > 100000)
        throw new BadRequestException(
          'Para esta referencia impar usá hasta 100.000 carillas o elegí una cantidad par.',
        );
      const doc = {
        ...c,
        id: 'referencia',
        modo: 'HOJAS' as const,
        cobertura,
        paginas: impar ? n : c.faz,
        copias: impar ? 1 : matriz.reglas.unidad === 'HOJA' ? n : n / c.faz,
        tamanoAnchoMm: formato.anchoMm,
        tamanoAltoMm: formato.altoMm,
      };
      const calculo = calcularComercialHojas(
        {
          tenantId,
          pedidoId: 'referencia',
          cargas: [{ id: 'referencia', documentos: [doc] }],
        },
        { ...referencia, ...matriz },
      );
      grupos = calculo.grupos.map((g) => ({
        fila: matriz.filas.findIndex(
          (f) =>
            claveCombinacion(f.combinacion) === claveCombinacion(g.combinacion),
        ),
        desdeCantidad: String(g.tramo.desdeCantidad),
        cantidadFacturable: String(g.cantidadFacturable),
      }));
      const resultados = await this.copiado.simularCostoHojas(tenantId, doc);
      cotizaciones = resultados.map((r) => r.cotizacion!);
      avisos.push(
        ...resultados.flatMap((r) =>
          r.errores
            .filter((e) => e.severidad !== 'ERROR')
            .map((e) => e.mensaje),
        ),
      );
      cantidad = String(calculo.cantidadComercial);
      facturable = cantidad;
      unidad = matriz.reglas.unidad;
      descripcion = `${calculo.hojasFisicas} hojas físicas · ${calculo.carillasImpresas} carillas · ${doc.paginas} páginas × ${doc.copias} copias`;
    } else {
      const matriz = contenido.cad!;
      const fila = matriz.filas[celda.fila];
      const c = fila.combinacion;
      const rangos = fila.rangosPropios ?? matriz.rangosGenerales;
      const opciones = (await this.cad.opciones(tenantId)).perfiles.filter(
        (p) =>
          p.papelMateriaPrimaId === c.papelMateriaPrimaId &&
          p.gramaje === c.gramaje &&
          p.color === c.color &&
          p.rollo.anchoRolloMm === c.anchoRolloMm,
      );
      const perfil = celda.perfilCadId
        ? opciones.find((p) => p.id === celda.perfilCadId)
        : opciones.length === 1
          ? opciones[0]
          : null;
      if (!perfil)
        throw new BadRequestException(
          opciones.length > 1
            ? 'Hay varias configuraciones CAD compatibles. Elegí la máquina y receta de referencia.'
            : 'No hay una configuración CAD compatible con este papel, color y rollo.',
        );
      const desde = new DecimalComercial(rangos[celda.tramo]);
      const hasta = rangos[celda.tramo + 1];
      const objetivo = new DecimalComercial(
        celda.cantidadReferencia ??
          (desde.gt(0)
            ? desde
            : hasta
              ? DecimalComercial.min(1, new DecimalComercial(hasta).div(2))
              : 1),
      );
      if (!objetivo.gt(0) || objetivo.gt(1000000))
        throw new BadRequestException(
          'Usá una referencia de consumo entre 0 y 1.000.000 ML.',
        );
      const copias = objetivo.div(100).ceil().toNumber();
      const geometria = celda.geometriaCad ?? {
        anchoMm: perfil.rollo.anchoRolloMm - 2 * perfil.rollo.margenMm,
        altoMm: objetivo
          .times(1000)
          .div(copias)
          .minus(2 * perfil.rollo.margenMm)
          .toDecimalPlaces(6)
          .toNumber(),
        copias,
      };
      if (geometria.altoMm <= 0)
        throw new BadRequestException(
          'Este tramo no admite el consumo mínimo del rollo y sus márgenes. Revisá la geometría de referencia.',
        );
      const doc = {
        ...c,
        id: 'referencia',
        modo: 'CAD' as const,
        cad: { cotizacion: { id: perfil.id, revision: perfil.revision } },
        cobertura,
        faz: 1 as const,
        paginas: 1,
        paginasOriginales: 1,
        archivoNombre: 'referencia.pdf',
        copias: geometria.copias,
        tamano: 'CAD',
        tamanoAnchoMm: geometria.anchoMm,
        tamanoAltoMm: geometria.altoMm,
        medidasPaginas: [
          { pagina: 1, anchoMm: geometria.anchoMm, altoMm: geometria.altoMm },
        ],
        rolloProduccion: perfil.rollo,
      };
      const calculo = calcularComercialCad(
        {
          tenantId,
          pedidoId: 'referencia',
          cargas: [{ id: 'referencia', documentos: [doc] }],
        },
        { ...referencia, ...matriz },
      );
      if (new DecimalComercial(calculo.consumoMl).gt(1000000))
        throw new BadRequestException(
          'La geometría y las copias superan el límite de 1.000.000 ML de referencia.',
        );
      dentro(calculo.consumoMl, rangos[celda.tramo], hasta);
      grupos = calculo.grupos.map((g) => ({
        fila: matriz.filas.findIndex(
          (f) =>
            claveCombinacionCad(f.combinacion) ===
            claveCombinacionCad(g.combinacion),
        ),
        desdeCantidad: g.tramo.desdeCantidad,
        cantidadFacturable: g.cantidadFacturable,
      }));
      const resultado = await this.cad.construir(
        tenantId,
        doc as DocumentoInput,
        'simulacion',
        null,
        undefined,
        true,
      );
      if (!resultado.cotizacion)
        throw new BadRequestException(
          resultado.error || 'El motor no pudo calcular el plano.',
        );
      cotizaciones = [resultado.cotizacion];
      cantidad = calculo.consumoMl;
      facturable = calculo.cantidadFacturable;
      unidad = 'ML';
      descripcion = `${geometria.anchoMm} × ${geometria.altoMm} mm × ${geometria.copias} copias · rollo ${c.anchoRolloMm} mm · ${perfil.maquinaNombre} · ${perfil.productoNombre}`;
      if (desde.eq(0) && !celda.cantidadReferencia && !celda.geometriaCad)
        avisos.push(
          'El tramo empieza en cero; se usa una referencia positiva de consumo dentro del tramo.',
        );
    }
    if (
      cotizaciones.some(
        (c) => !Number.isFinite(c.costos.total) || c.costos.total < 0,
      )
    )
      throw new BadRequestException('El motor devolvió un costo inválido.');
    const costo = cotizaciones.reduce(
      (n, c) => n.plus(c.costos.total),
      new DecimalComercial(0),
    );
    if (costo.eq(0))
      avisos.push(
        'El motor devolvió costo cero. Revisá las tarifas e insumos antes de fijar el precio.',
      );
    const alicuotas = await Promise.all(
      cotizaciones.map((c) => this.iva(tenantId, c.productoId)),
    );
    if (new Set(alicuotas).size !== 1)
      throw new BadRequestException(
        'La referencia contiene alícuotas distintas. No se puede comparar como una sola celda.',
      );
    return {
      estado: 'CALCULADO',
      cobertura,
      calculadoEl: new Date().toISOString(),
      costoTotal: costo.toFixed(),
      costoUnitario: costo.div(cantidad).toFixed(8),
      cantidadReferencia: cantidad,
      cantidadFacturable: facturable,
      unidad,
      referencia: descripcion,
      grupos,
      ivaPorcentaje: alicuotas[0],
      trazas: cotizaciones.map((c) => ({
        productoId: c.productoId,
        rutaId: c.rutaAlternativaId,
        periodo: c.periodoTarifario,
        tipoCambioId: c.tipoCambio?.id ?? null,
      })),
      avisos: [...new Set(avisos)],
    };
  }
}
