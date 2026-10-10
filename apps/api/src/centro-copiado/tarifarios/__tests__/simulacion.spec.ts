import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CentroCopiadoSimulacionService } from '../centro-copiado-simulacion.service';
import { CentroCopiadoService } from '../../centro-copiado.service';
import { CentroCopiadoCadService } from '../../centro-copiado-cad.service';
import { contenidoEjemplo } from './fixtures';
import { compararSimulacion } from '../../comercial/comparacion-simulacion';
import type { EscenarioSimulado } from '../simulacion-tarifario.types';
import { estructuraSimulacion } from '../simulacion-tarifario.types';
const contiene = (texto: string): unknown => expect.stringContaining(texto);
const objeto = (valor: Record<string, unknown>): unknown =>
  expect.objectContaining(valor);

function entorno() {
  const contenido = contenidoEjemplo();
  const costo = {
    productoId: 'producto-ficticio',
    rutaAlternativaId: 'ruta-ficticia',
    periodoTarifario: '2026-10',
    costos: { total: 60 },
    precio: { precioTotal: 99999 },
  };
  const prisma = {
    datosEmpresa: { findUnique: jest.fn(() => Promise.resolve(null)) },
    producto: {
      findFirst: jest.fn(() => Promise.resolve({ categoriaFiscal: 'general' })),
    },
    configuracionFiscal: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          condicionFiscal: 'responsable_inscripto',
        }),
      ),
    },
    productoImpuestoCatalogo: {
      findMany: jest.fn(() =>
        Promise.resolve([{ categoriaFiscal: 'general', porcentaje: 21 }]),
      ),
    },
  };
  const tarifarios = {
    obtener: jest.fn(() => Promise.resolve({ revision: 2, contenido })),
    version: jest.fn(() => Promise.resolve({ contenido })),
  };
  const copiado = {
    simularCostoHojas: jest.fn(() =>
      Promise.resolve([{ exitoso: true, cotizacion: costo, errores: [] }]),
    ),
  };
  const perfil = {
    id: 'perfil-ficticio',
    revision: 'revision',
    papelMateriaPrimaId:
      contenido.hojas!.filas[0].combinacion.papelMateriaPrimaId,
    gramaje: 80,
    color: 'BN',
    rollo: { anchoRolloMm: 914, margenMm: 5 },
    maquinaNombre: 'Plotter de prueba',
    productoNombre: 'Plano de prueba',
  };
  const cad = {
    opciones: jest.fn(() => Promise.resolve({ perfiles: [perfil] })),
    construir: jest.fn(() =>
      Promise.resolve({ cotizacion: costo, error: null }),
    ),
  };
  const service = new CentroCopiadoSimulacionService(
    prisma as never,
    tarifarios as never,
    copiado as never,
    cad as never,
  );
  const ejecutar = (
    celda = { seccion: 'hojas', fila: 0, tramo: 0 } as object,
  ) =>
    service.simular('empresa-ficticia', 'tarifario-ficticio', {
      revision: 2,
      celdas: [celda],
    });
  const agregarCad = () => {
    contenido.cad!.filas.push({
      combinacion: {
        papelMateriaPrimaId: perfil.papelMateriaPrimaId,
        gramaje: 80,
        color: 'BN',
        anchoRolloMm: 914,
        cobertura: null,
      },
      precios: [
        { desdeCantidad: '0', precioUnitario: '121' },
        { desdeCantidad: '10', precioUnitario: null },
      ],
    });
  };
  return {
    contenido,
    prisma,
    tarifarios,
    copiado,
    cad,
    perfil,
    service,
    ejecutar,
    agregarCad,
  };
}

it('costea las tres coberturas aun sin precio; usa el costo del motor y no su precio de venta', async () => {
  const e = entorno();
  const r = await e.ejecutar({ seccion: 'hojas', fila: 0, tramo: 1 });
  expect(e.copiado.simularCostoHojas).toHaveBeenCalledTimes(3);
  expect(r.resultados[0].escenarios.map((s) => s.cobertura)).toEqual([
    'borrador',
    'normal',
    'alta',
  ]);
  const s = r.resultados[0].escenarios[0] as EscenarioSimulado;
  expect(s).toMatchObject({
    costoTotal: '60',
    costoUnitario: '0.60000000',
    cantidadReferencia: '100',
    cantidadFacturable: '100',
    unidad: 'HOJA',
    ivaPorcentaje: '21',
  });
  expect(compararSimulacion(e.contenido, 'hojas', s).utilidad).toBeNull();
});

it('usa la cobertura y los rangos propios de la combinación', async () => {
  const e = entorno();
  e.contenido.hojas!.reglas.cobertura = 'DIFERENCIADA';
  e.contenido.cad!.reglas.cobertura = 'DIFERENCIADA';
  const fila = e.contenido.hojas!.filas[0];
  fila.combinacion.cobertura = 'alta';
  fila.rangosPropios = [1, 30];
  fila.precios = [];
  const r = await e.ejecutar({ seccion: 'hojas', fila: 0, tramo: 1 });
  expect(r.resultados[0].escenarios).toHaveLength(1);
  expect(r.resultados[0].escenarios[0]).toMatchObject({
    cantidadReferencia: '30',
  });
});

it('rechaza cantidades fuera del tramo y revisiones desactualizadas antes de costear', async () => {
  const e = entorno();
  const r = await e.ejecutar({
    seccion: 'hojas',
    fila: 0,
    tramo: 0,
    cantidadReferencia: '100',
  });
  expect(r.resultados[0].escenarios[0]).toMatchObject({
    estado: 'ERROR',
    motivo: contiene('dentro del tramo'),
  });
  await expect(
    e.service.simular('empresa', 'tarifa', {
      revision: 1,
      celdas: [{ seccion: 'hojas', fila: 0, tramo: 0 }],
    }),
  ).rejects.toThrow('borrador cambió');
  expect(e.copiado.simularCostoHojas).not.toHaveBeenCalled();
});

it('no consulta costos de un tarifario ajeno ni acepta payloads sin límite', async () => {
  const e = entorno();
  e.tarifarios.obtener.mockRejectedValueOnce(
    new NotFoundException('Tarifario inexistente.'),
  );
  await expect(e.ejecutar()).rejects.toThrow('inexistente');
  await expect(
    e.service.simular('empresa', 'tarifa', {
      revision: 2,
      celdas: Array(6).fill({ seccion: 'hojas', fila: 0, tramo: 0 }),
    }),
  ).rejects.toThrow('cinco');
  expect(e.copiado.simularCostoHojas).not.toHaveBeenCalled();
});

it('limita los lotes concurrentes por empresa y libera el turno al terminar', async () => {
  const e = entorno();
  const anterior = e.copiado.simularCostoHojas.getMockImplementation()!;
  let liberar!: () => void;
  let indicarEntrada!: () => void;
  const entrada = new Promise<void>((resolve) => {
    indicarEntrada = resolve;
  });
  e.copiado.simularCostoHojas.mockImplementationOnce(
    () =>
      new Promise<Awaited<ReturnType<typeof anterior>>>((resolve) => {
        liberar = () => {
          void anterior().then(resolve);
        };
        indicarEntrada();
      }),
  );
  const primero = e.ejecutar();
  await entrada;
  await expect(e.ejecutar()).rejects.toMatchObject({ status: 429 });
  liberar();
  await primero;
  await expect(e.ejecutar()).resolves.toHaveProperty('resultados');
});

it('conserva los errores por cobertura sin devolver costo cero', async () => {
  const e = entorno();
  e.copiado.simularCostoHojas.mockRejectedValueOnce(
    new BadRequestException('Falta tóner de prueba.'),
  );
  const r = await e.ejecutar();
  expect(r.resultados[0].escenarios[0]).toEqual({
    estado: 'ERROR',
    motivo: 'Falta tóner de prueba.',
    cobertura: 'borrador',
    calculadoEl: expect.any(String) as unknown,
  });
  expect(r.resultados[0].escenarios[1].estado).toBe('CALCULADO');
});

it('no inventa IVA cero cuando falta la configuración y respeta exención explícita', async () => {
  const e = entorno();
  e.prisma.productoImpuestoCatalogo.findMany.mockResolvedValue([]);
  expect((await e.ejecutar()).resultados[0].escenarios[0]).toMatchObject({
    estado: 'ERROR',
    motivo: contiene('alícuota'),
  });
  e.prisma.configuracionFiscal.findUnique.mockResolvedValue({
    condicionFiscal: 'exento',
  });
  expect((await e.ejecutar()).resultados[0].escenarios[0]).toMatchObject({
    ivaPorcentaje: '0',
  });
});

it('compara edición de precios, preparación y mínimo sin volver a costear ni incluir IVA en la utilidad', async () => {
  const e = entorno();
  const s = (await e.ejecutar()).resultados[0]
    .escenarios[0] as EscenarioSimulado;
  const firma = estructuraSimulacion(e.contenido);
  e.contenido.hojas!.filas[0].precios[0].precioUnitario = '121';
  e.contenido.composicion.preparacion = {
    modalidad: 'FIJA_PEDIDO',
    importe: '121',
  };
  e.contenido.composicion.minimo = {
    modalidad: 'IMPORTE_PEDIDO',
    importe: '363',
  };
  const r = compararSimulacion(e.contenido, 'hojas', s);
  expect(r.composicion.total).toEqual({
    neto: '300.00',
    iva: '63.00',
    total: '363.00',
  });
  expect(r.utilidad).toBe('240.00');
  expect(r.margenPorcentaje).toBe('80.00');
  expect(estructuraSimulacion(e.contenido)).toBe(firma);
  expect(e.copiado.simularCostoHojas).toHaveBeenCalledTimes(3);
});

it('precio cero explícito muestra pérdida; nunca divide el margen por venta cero', async () => {
  const e = entorno();
  const s = (await e.ejecutar()).resultados[0]
    .escenarios[0] as EscenarioSimulado;
  e.contenido.hojas!.filas[0].precios[0].precioUnitario = '0';
  expect(compararSimulacion(e.contenido, 'hojas', s)).toMatchObject({
    utilidad: '-60.00',
    margenPorcentaje: null,
    costoSuperaVenta: true,
  });
});

it('referencia CAD usa largo consumido: incluye márgenes y redondeo sólo en la venta', async () => {
  const e = entorno();
  e.agregarCad();
  e.contenido.cad!.reglas.redondeo = {
    modalidad: 'HACIA_ARRIBA',
    incrementoMl: '0.5',
  };
  const r = await e.ejecutar({
    seccion: 'cad',
    fila: 0,
    tramo: 0,
    geometriaCad: { anchoMm: 594, altoMm: 841, copias: 2 },
  });
  const s = r.resultados[0].escenarios[0] as EscenarioSimulado;
  // El giro de 90° usa 594 + 10 mm por copia, no 841 mm ni el ancho del rollo.
  expect(s).toMatchObject({
    cantidadReferencia: '1.208',
    cantidadFacturable: '1.5',
    unidad: 'ML',
  });
  expect(
    compararSimulacion(e.contenido, 'cad', s).composicion.total?.neto,
  ).toBe('150.00');
  expect(e.cad.construir).toHaveBeenCalledWith(
    'empresa-ficticia',
    objeto({ cobertura: 'borrador' }),
    'simulacion',
    null,
    undefined,
    true,
  );
});

it('CAD parte de una referencia positiva y exige elegir si hay varias recetas', async () => {
  const e = entorno();
  e.agregarCad();
  expect(
    (await e.ejecutar({ seccion: 'cad', fila: 0, tramo: 0 })).resultados[0]
      .escenarios[0],
  ).toMatchObject({
    cantidadReferencia: '1',
    referencia: contiene('904 × 990'),
  });
  e.cad.opciones.mockResolvedValue({
    perfiles: [e.perfil, { ...e.perfil, id: 'segunda' }],
  });
  expect(
    (await e.ejecutar({ seccion: 'cad', fila: 0, tramo: 0 })).resultados[0]
      .escenarios[0],
  ).toMatchObject({
    estado: 'ERROR',
    motivo: contiene('varias configuraciones'),
  });
  expect(
    (
      await e.ejecutar({
        seccion: 'cad',
        fila: 0,
        tramo: 0,
        perfilCadId: 'segunda',
      })
    ).resultados[0].escenarios[0].estado,
  ).toBe('CALCULADO');
});

it('carillas dobles con última simple usa cantidad par; no atribuye otra celda al tramo elegido', async () => {
  const e = entorno();
  e.contenido.hojas!.reglas.unidad = 'CARILLA';
  e.contenido.hojas!.reglas.ultimaHojaImpar = 'COBRAR_SIMPLE';
  expect((await e.ejecutar()).resultados[0].escenarios[0]).toMatchObject({
    cantidadReferencia: '2',
    avisos: [contiene('par')],
  });
  expect(
    (
      await e.ejecutar({
        seccion: 'hojas',
        fila: 0,
        tramo: 0,
        cantidadReferencia: '3',
      })
    ).resultados[0].escenarios[0],
  ).toMatchObject({ estado: 'ERROR' });
  e.contenido.hojas!.rangosGenerales = [1, 2];
  e.contenido.hojas!.filas[0].precios = [];
  expect((await e.ejecutar()).resultados[0].escenarios[0]).toMatchObject({
    estado: 'ERROR',
    motivo: contiene('no contiene una cantidad par'),
  });
});

it('adaptador de referencia: última impar y preparación productiva una vez aun con centro pausado y setup comercial incluido', async () => {
  const contenido = contenidoEjemplo();
  const c = contenido.hojas!.filas[0].combinacion;
  const motor = {
    cotizar: jest.fn(() =>
      Promise.resolve({
        exitoso: true,
        cotizacion: { costos: { total: 1 } },
        errores: [],
      }),
    ),
  };
  const capacidades = { exigirIncluida: jest.fn() };
  const servicio = new CentroCopiadoService(
    {
      centroCopiadoConfig: {
        findUnique: () =>
          Promise.resolve({
            activo: false,
            papelesJson: null,
            tamanosJson: null,
            terminacionesJson: [],
          }),
      },
    } as never,
    motor as never,
    undefined,
    undefined,
    undefined,
    capacidades as never,
  );
  const contexto = {
    productoId: 'producto',
    rutaAlternativaId: 'ruta',
    configPasoId: 'paso',
    maquinaBnId: 'maquina',
    maquinaColorId: null,
    cobraSetup: false,
    papeles: [
      {
        materiaPrimaId: c.papelMateriaPrimaId,
        nombre: 'Obra ficticia',
        gramajes: [80],
        variantes: [
          {
            id: 'variante',
            gramajeGr: 80,
            anchoMm: 210,
            altoMm: 297,
            formatoComercial: 'A4',
          },
        ],
      },
    ],
    anillos: [],
    tiposAnilloPermitidos: [],
  };
  jest
    .spyOn(
      servicio as unknown as { contexto: () => Promise<unknown> },
      'contexto',
    )
    .mockResolvedValue(contexto);
  await servicio.simularCostoHojas('empresa', {
    ...c,
    cobertura: 'alta',
    id: 'referencia',
    paginas: 3,
    copias: 2,
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
  });
  expect(motor.cotizar).toHaveBeenNthCalledWith(
    1,
    objeto({
      jobContext: objeto({
        cantidad: 2,
        caras: 2,
        omitirSetupCleanup: false,
        cobertura: 'alta',
      }),
    }),
  );
  expect(motor.cotizar).toHaveBeenNthCalledWith(
    2,
    objeto({
      jobContext: objeto({
        cantidad: 2,
        caras: 1,
        omitirSetupCleanup: true,
      }),
    }),
  );
  await expect(
    servicio.simularCostoHojas('empresa', {
      ...c,
      gramaje: null,
      id: 'sin-gramaje',
      paginas: 1,
      copias: 1,
      tamanoAnchoMm: 210,
      tamanoAltoMm: 297,
    }),
  ).rejects.toThrow('gramaje');
});

it('el adaptador CAD lleva la cobertura al motor y conserva la geometría del plano', async () => {
  const e = entorno();
  const perfil = {
    ...e.perfil,
    productoId: 'producto',
    rutaAlternativaId: 'ruta',
    configPasoId: 'paso',
    maquinaId: 'maquina',
    materialVarianteId: 'variante',
  };
  const motor = {
    cotizar: jest.fn(() =>
      Promise.resolve({
        exitoso: true,
        errores: [],
        cotizacion: { costos: { total: 30 } },
      }),
    ),
  };
  const cad = new CentroCopiadoCadService(
    {} as never,
    { configuraciones: () => Promise.resolve([perfil]) } as never,
    motor as never,
    { exigirTodas: jest.fn() } as never,
  );
  const doc = {
    id: 'referencia',
    modo: 'CAD' as const,
    cad: { cotizacion: { id: perfil.id, revision: perfil.revision } },
    paginas: 1,
    paginasOriginales: 1,
    archivoNombre: 'referencia.pdf',
    copias: 2,
    cobertura: 'borrador',
    faz: 1 as const,
    color: 'BN' as const,
    papelMateriaPrimaId: perfil.papelMateriaPrimaId,
    gramaje: 80,
    tamano: 'CAD',
    tamanoAnchoMm: 594,
    tamanoAltoMm: 841,
    medidasPaginas: [{ pagina: 1, anchoMm: 594, altoMm: 841 }],
  };
  const r = await cad.construir(
    'empresa',
    doc,
    'simulacion',
    null,
    undefined,
    true,
  );
  expect(r.error).toBeNull();
  expect(r.cotizacion?.costos.total).toBe(30);
  expect(motor.cotizar).toHaveBeenCalledWith(
    objeto({
      tenantId: 'empresa',
      productoId: 'producto',
      rutaAlternativaId: 'ruta',
      jobContext: objeto({
        cobertura: 'borrador',
        omitirSetupCleanup: false,
        cantidad: 2,
        piezas: [{ cantidad: 2, anchoMm: 594, altoMm: 841 }],
      }),
    }),
  );
});
