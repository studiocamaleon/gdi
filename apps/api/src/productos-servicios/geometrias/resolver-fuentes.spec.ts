import { resolverFuentesProducto } from './resolver-fuentes';
import { resolverJobContextComponente } from '../componentes-configuracion';
import { inspeccionarVector, interpretarVector } from './interpretar-vector';

describe('referencias compactas de geometría', () => {
  const p = {
    version: 1,
    geometriaId: '22222222-2222-4222-8222-222222222222',
    archivoId: '33333333-3333-4333-8333-333333333333',
    hash: 'a'.repeat(64),
  };
  const ref = {
    tipo: 'REFERENCIA_GEOMETRIA',
    schemaVersion: 1,
    procedencia: p,
  };
  const inspeccion = inspeccionarVector(
    '<svg viewBox="0 0 100 60"><path d="M0 0H100V60H0Z"/><path d="M50 0V60"/></svg>',
    'cuerpo.svg',
  );
  inspeccion.entidades.push({
    id: 'hendido',
    capa: 'HENDIDO',
    tipoEntidad: 'LINE',
    puntos: [
      { x: 50, y: 0 },
      { x: 50, y: 60 },
    ],
    cerrada: false,
    apertura: 60,
    area: 0,
    ancho: 0,
    alto: 60,
  });
  const fuente = JSON.parse(
    JSON.stringify(
      interpretarVector(
        inspeccion,
        {
          exteriorId: inspeccion.sugeridaId,
          unidad: 'mm',
          cerrarExterior: false,
          operaciones: [
            { entidadId: inspeccion.entidades[1].id, tipo: 'HENDIDO' },
          ],
        },
        { ...p, nombreArchivo: 'cuerpo.svg' },
      ),
    ),
  );
  const db = () => ({
    geometriaProducto: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: p.geometriaId,
          archivoId: p.archivoId,
          hash: p.hash,
          fuenteJson: fuente,
        },
      ]),
    },
  });

  it.each(['medidas', 'placas'] as const)('con %s no inyecta el archivo predeterminado ni reutiliza geometrías residuales', async modo => {
    const prisma = db();
    const original = {cantidad: 50, modoCotizacionVectorial: modo, disenoVectorialFuente: ref,
      geometriasVectoriales: {principal: ref}, placasVectorialesManuales: 2,
      metrosCortePorPlacaVectorial: 15, entradasCortePorPlacaVectorial: 4};
    const resultado = await resolverFuentesProducto(prisma as never, 'tenant-1', {
      geometriasComerciales: {version: 1, modo: 'AMBAS', permitirCotizacionManual: true,
        fuentes: [{id: 'principal', nombre: 'Pieza', predeterminada: fuente, permitirReemplazo: false}]},
    }, original as never);
    expect(resultado.disenoVectorialFuente).toBeUndefined();
    expect(resultado.geometriasVectoriales).toBeUndefined();
    expect(resultado.placasVectorialesManuales).toBe(modo === 'placas' ? 2 : undefined);
    expect(prisma.geometriaProducto.findMany).not.toHaveBeenCalled();
    expect(original.disenoVectorialFuente).toBe(ref);
  });

  it('resuelve el archivo una vez y completa medidas de overrides antes del binding hijo', async () => {
    const prisma = db();
    const contexto = await resolverFuentesProducto(
      prisma as never,
      'tenant-1',
      {},
      {
        cantidad: 10,
        geometriasVectoriales: { cuerpo: ref },
        componentesConfiguracion: {
          frente: {
            disenoVectorialFuente: ref,
            ocurrencias: [{ overrides: { disenoVectorialFuente: ref } }],
          },
        },
        disenosVectoriales: [
          { id: 'pieza', fuente: ref, cantidadPorUnidad: 2 },
        ],
      } as never,
    );
    const ctx = contexto as unknown as Record<string, any>;
    expect(ctx.geometriasVectoriales.cuerpo).toEqual(fuente);
    expect(ctx.disenosVectoriales[0].fuente.fabricacion).toEqual(
      fuente.fabricacion,
    );
    expect(
      ctx.componentesConfiguracion.frente.ocurrencias[0].overrides
        .disenoVectorialFuente,
    ).toEqual(fuente);
    expect(prisma.geometriaProducto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: { in: [p.geometriaId] } },
    });
    const hijo = resolverJobContextComponente({
      codigoComponente: 'frente',
      cantidadLegacy: 1,
      contextoPadre: ctx,
      configuracion: {
        version: 1,
        bindings: [
          { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
          { clave: 'disenoVectorialFuente', origen: 'COTIZACION' },
          {
            clave: 'medidaCustomMm.anchoMm',
            origen: 'COTIZACION',
            requerido: true,
          },
        ],
      },
    });
    expect(hijo.medidaCustomMm).toMatchObject({ anchoMm: 100, altoMm: 60 });
    expect(hijo.cantidad).toBe(10);
    expect((hijo.disenoVectorialFuente as any).operaciones[0].tipo).toBe(
      'HENDIDO',
    );
  });

  it('rehidrata las capas de la colección nombrada antes de heredarla al componente', async () => {
    const prisma = db();
    const ctx = await resolverFuentesProducto(prisma as never, 'tenant-1', {}, {
      cantidad: 10,
      coleccionesVectoriales: {
        principal: [
          { id: 'letras', nombre: 'Letras', cantidadPorUnidad: 2, fuente: ref },
        ],
      },
    } as never);
    const hijo = resolverJobContextComponente({
      codigoComponente: 'polyfan',
      cantidadLegacy: 1,
      contextoPadre: ctx as never,
      configuracion: {
        version: 1,
        bindings: [
          { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
          {
            clave: 'disenoVectorialFuente',
            origen: 'PADRE',
            padreClave: 'geometriasVectoriales.principal',
          },
        ],
      },
    });
    expect(hijo.disenosVectoriales).toEqual([
      { id: 'letras', nombre: 'Letras', cantidadPorUnidad: 2, fuente },
    ]);
    expect(hijo.piezas).toEqual([{ cantidad: 20, anchoMm: 100, altoMm: 60 }]);
    expect(prisma.geometriaProducto.findMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    { archivoId: '44444444-4444-4444-8444-444444444444' },
    { hash: 'b'.repeat(64) },
  ])('rechaza una identidad mezclada: %j', async (patch) => {
    await expect(
      resolverFuentesProducto(db() as never, 'tenant', {}, {
        cantidad: 1,
        disenoVectorialFuente: { ...ref, procedencia: { ...p, ...patch } },
      } as never),
    ).rejects.toThrow('no corresponde');
  });
  it('rechaza referencias que no pertenecen a la cuenta incluso dentro de un grupo', async () => {
    const prisma = db();
    prisma.geometriaProducto.findMany.mockResolvedValue([]);
    await expect(
      resolverFuentesProducto(prisma as never, 'otra', {}, {
        cantidad: 1,
        componentesConfiguracion: { grupo: { disenoVectorialFuente: ref } },
      } as never),
    ).rejects.toThrow('esta cuenta');
  });
});
