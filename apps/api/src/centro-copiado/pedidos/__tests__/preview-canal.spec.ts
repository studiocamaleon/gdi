import { CentroCopiadoPedidosService } from '../centro-copiado-pedidos.service';
import { contenidoEjemplo } from '../../tarifarios/__tests__/fixtures';
import type { CotizarCentroCopiadoDto } from '../../dto/cotizar-centro-copiado.dto';

const tenantId = '00000000-0000-4000-8000-000000000010';
const productoId = '00000000-0000-4000-8000-000000000011';
const papel = '00000000-0000-4000-8000-000000000001';
const documento = {
  id: 'documento',
  paginas: 2,
  copias: 1,
  tamano: 'A4',
  tamanoAnchoMm: 210,
  tamanoAltoMm: 297,
  papelMateriaPrimaId: papel,
  gramaje: 80,
  color: 'BN' as const,
  faz: 2 as const,
};
function escenario() {
  const contenido = contenidoEjemplo();
  contenido.hojas!.filas[0].precios[1].precioUnitario = '80';
  const politica = {
    resolverActiva: jest.fn((_tenant: string, canal: string) =>
      canal === 'whatsapp'
        ? { estado: 'MOTOR' }
        : {
            estado: 'TARIFARIO',
            referencia: {
              tenantId,
              canalVenta: canal,
              modalidad: 'TARIFARIO',
              politicaRevision: 1,
              tarifarioId: 'tarifa',
              versionId: 'version',
              monedaCodigo: 'ARS',
            },
            version: { contenido, nombre: 'Lista ficticia', numero: 3 },
          },
    ),
  };
  const prisma = {
    datosEmpresa: { findUnique: jest.fn(() => null) },
    producto: {
      findFirst: jest.fn(() => ({ categoriaFiscal: 'general' })),
    },
    configuracionFiscal: {
      findUnique: jest.fn(() => ({
        condicionFiscal: 'responsable_inscripto',
      })),
    },
    productoImpuestoCatalogo: {
      findMany: jest.fn(() => [{ porcentaje: 21, categoriaFiscal: 'general' }]),
    },
    $transaction: jest.fn(),
  };
  const construir = (dto: CotizarCentroCopiadoDto) => {
    const vistos = new Set<string>();
    return {
      grupoCargaId: 'carga',
      items: dto.documentos.flatMap((d) => {
        const id = d.grupoId ?? d.id;
        if (vistos.has(id)) return [];
        vistos.add(id);
        const grupo = dto.grupos?.find((g) => g.id === d.grupoId);
        const miembros = grupo
          ? dto.documentos.filter((m) => m.grupoId === grupo.id)
          : [d];
        const cantidad = miembros.reduce(
          (s, m) =>
            s + Math.ceil(m.paginas / m.faz) * (grupo?.juegos ?? m.copias),
          0,
        );
        const subtotal = cantidad * 300;
        return [
          {
            documentoId: id,
            grupoTomoId: grupo?.id ?? null,
            productoId,
            cantidad,
            jobContext: {
              cantidad,
              caras: 2,
              _centroCopiado: grupo
                ? {
                    esTomo: true,
                    juegos: grupo.juegos,
                    segmentos: miembros,
                    terminaciones: [],
                  }
                : { ...d, esTomo: false, terminaciones: [] },
            },
            subtotal,
            total: subtotal * 1.21,
            impuestoMonto: subtotal * 0.21,
            cotizacion: {
              costos: { total: cantidad * 20 },
              desglosePrecio: {
                precioNetoTotal: subtotal,
                precioBrutoTotal: subtotal * 1.21,
                impuestos: [
                  {
                    catalogoId: 'iva',
                    nombre: 'IVA',
                    porcentaje: 21,
                    traslado: 'POR_FUERA',
                    baseCalculo: 'NETO',
                  },
                ],
                comisiones: [],
                precioConfig: { metodoCalculo: 'MARGEN' },
                precioEspecialCliente: null,
              },
            },
            error: null,
          },
        ];
      }),
    };
  };
  const copiado = {
    construirItems: jest.fn((_tenant: string, dto: CotizarCentroCopiadoDto) =>
      construir(dto),
    ),
    simularCostoHojas: jest.fn(() => [
      { cotizacion: { costos: { total: 20 } } },
    ]),
    cotizar: jest.fn((_tenant: string, dto: CotizarCentroCopiadoDto) => ({
      documentos: dto.documentos.map((d) => ({
        id: d.id,
        grupoId: d.grupoId ?? null,
        hojas: Math.ceil(d.paginas / d.faz) * d.copias,
        carillas: d.paginas * d.copias,
        pliegos: 1,
        subtotal: 300,
        iva: 63,
        total: 363,
        anillado: null,
        error: null,
      })),
      grupos: (dto.grupos ?? []).map((g) => ({
        id: g.id,
        juegos: g.juegos,
        hojasPorLibro: 2,
        subtotal: 600,
        iva: 126,
        total: 726,
        anillado: null,
        error: null,
      })),
      totales: {
        documentos: dto.documentos.length,
        tomos: dto.grupos?.length ?? 0,
        carillas: 2,
        hojasFisicas: 1,
        subtotal: 300,
        iva: 63,
        total: 363,
      },
    })),
  };
  const service = new CentroCopiadoPedidosService(
    prisma as never,
    politica as never,
    copiado as never,
    {} as never,
    {} as never,
    { usaTipoCambio: false } as never,
    {} as never,
  );
  return { service, prisma, politica, copiado, contenido };
}

it('el preview y la carga usan la matriz del canal y no el precio del motor', async () => {
  const { service, prisma, politica } = escenario();
  const dto = { canalVenta: 'mostrador', documentos: [documento] };
  const preview = await service.cotizarCarga(tenantId, dto);
  expect(preview.totales).toMatchObject({
    subtotal: 83.06,
    iva: 17.44,
    total: 100.5,
  });
  expect(preview).toMatchObject({
    tarifario: { nombre: 'Lista ficticia', numero: 3 },
  });
  const carga = await service.construirCarga(tenantId, dto);
  expect(carga.items[0]).toMatchObject({
    subtotal: 83.06,
    impuestoMonto: 17.44,
    total: 100.5,
  });
  expect(politica.resolverActiva).toHaveBeenCalledWith(tenantId, 'mostrador');
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('cambiar a un canal de motor devuelve su precio sin reutilizar la matriz', async () => {
  const { service } = escenario();
  await service.cotizarCarga(tenantId, {
    canalVenta: 'mostrador',
    documentos: [documento],
  });
  const preview = await service.cotizarCarga(tenantId, {
    canalVenta: 'whatsapp',
    documentos: [documento],
  });
  expect(preview.totales.total).toBe(363);
  expect(preview).not.toHaveProperty('tarifario');
});

it('acumula las otras cargas para elegir el tramo y devuelve sólo el importe de la carga abierta', async () => {
  const { service } = escenario();
  const preview = await service.cotizarCarga(tenantId, {
    canalVenta: 'mostrador',
    documentos: [{ ...documento, copias: 10 }],
    cargasPedido: [{ documentos: [{ ...documento, copias: 90 }] }],
  });
  expect(preview.totales.total).toBe(800);
});

it('una celda sin precio queda pendiente y nunca muestra ni agrega el importe del motor', async () => {
  const { service } = escenario();
  const dto = {
    canalVenta: 'mostrador',
    documentos: [{ ...documento, color: 'COLOR' as const }],
  };
  const preview = await service.cotizarCarga(tenantId, dto);
  expect(preview.documentos[0].error).toContain('no tiene precio');
  expect(preview.totales.total).toBe(0);
  expect(
    (await service.construirCarga(tenantId, dto)).items[0].error,
  ).toContain('no tiene precio');
});

it('los segmentos de un tomo conservan el total exacto del tarifario', async () => {
  const { service } = escenario();
  const preview = await service.cotizarCarga(tenantId, {
    canalVenta: 'mostrador',
    documentos: [
      { ...documento, grupoId: 'tomo' },
      { ...documento, id: 'segundo', grupoId: 'tomo' },
    ],
    grupos: [{ id: 'tomo', juegos: 1 }],
  });
  expect(preview.grupos[0].total).toBe(201);
  expect(preview.documentos.reduce((sum, d) => sum + d.total, 0)).toBe(201);
  expect(preview.totales.total).toBe(201);
});
