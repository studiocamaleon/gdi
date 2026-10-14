import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  fixtureCantidadManual,
  motorCantidadManual,
} from '../../../test/cantidad-manual-fixture';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PasoEjecutado } from '../tipos';

// Catálogo y tarifas de una empresa desechable. El cálculo, guardado,
// creación de la OT y materialización de producción usan los servicios reales.
describe('Cantidad por paso guardada en cotización y OT (PostgreSQL local)', () => {
  const db = new PrismaClient();
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Sólo base local de pruebas.');
  });
  afterAll(() => db.$disconnect());
  it('conserva 12 m², 5 m², costos y los 60/38 minutos al emitir y reabrir', async () => {
    const rollback = new Error('Deshacer prueba ficticia');
    await expect(
      db.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              slug: `qa-cantidad-${randomUUID()}`,
              nombre: 'Taller ficticio',
            },
          });
          const tenantId = tenant.id;
          const usuario = await tx.user.create({
            data: { email: `qa-${randomUUID()}@example.test` },
          });
          const planta = await tx.planta.create({
            data: { tenantId, codigo: 'TALLER', nombre: 'Taller ficticio' },
          });
          const centro = await tx.centroCosto.create({
            data: {
              tenantId,
              plantaId: planta.id,
              codigo: 'MANUAL',
              nombre: 'Centro ficticio',
              tipoCentro: 'PRODUCTIVO',
            },
          });
          await tx.centroCostoTarifaPeriodo.create({
            data: {
              tenantId,
              centroCostoId: centro.id,
              periodo: '2026-10',
              costoMensualTotal: 600000,
              capacidadPractica: 100,
              tarifaCalculada: 6000,
              estado: 'PUBLICADA',
              resumenJson: {},
            },
          });
          const categoria = await tx.productoCategoriaComercial.create({
            data: { codigo: `qa-${randomUUID()}`, nombre: 'Prueba' },
          });
          const sub = await tx.productoSubcategoriaComercial.create({
            data: {
              categoriaId: categoria.id,
              codigo: `qa-${randomUUID()}`,
              nombre: 'Ploteos ficticios',
              atributosSchemaJson: [],
            },
          });
          const productoDb = await tx.producto.create({
            data: {
              tenantId,
              subcategoriaComercialId: sub.id,
              codigo: 'VIN-TEST',
              nombre: 'Ploteo ficticio',
              unidadComercial: 'm2',
              modoMedidas: 'LIBRE',
              precioConfigJson: {
                metodoCalculo: 'por_margen',
                detalle: { marginPct: 50 },
              },
            },
          });
          const ruta = await tx.ruta.create({
            data: { tenantId, codigo: 'RUTA', nombre: 'Ruta ficticia' },
          });
          const alternativa = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: productoDb.id,
              rutaId: ruta.id,
              rutaVersion: 1,
              nombre: 'Principal',
              esPreferida: true,
            },
          });
          const f = fixtureCantidadManual();
          f.producto.productoId = productoDb.id;
          f.producto.rutaAlternativaId = alternativa.id;
          f.producto.rutaId = ruta.id;
          for (const paso of f.producto.pasos) {
            const rp = await tx.rutaPaso.create({
              data: {
                tenantId,
                rutaId: ruta.id,
                orden: paso.rutaPasoOrden,
                familiaCodigo: paso.familiaCodigo,
              },
            });
            const cp = await tx.productoConfigPaso.create({
              data: {
                tenantId,
                productoRutaAlternativaId: alternativa.id,
                rutaPasoId: rp.id,
                nombreVisible: paso.nombreVisible,
                modoActivacion: paso.modoActivacion,
                modoTiempo: paso.modoTiempo,
                mecanismoCantidad: paso.mecanismoCantidad,
                paramsPasoJson: paso.paramsPasoJson as Prisma.InputJsonValue,
              },
            });
            paso.rutaPasoId = rp.id;
            paso.configPasoId = cp.id;
            paso.centroCostoId = centro.id;
            paso.centroCosto = {
              id: centro.id,
              codigo: centro.codigo,
              nombre: centro.nombre,
            };
          }
          // Los IDs de la impresora y consumibles en el snapshot también son UUID.
          f.ploteo.maquina!.id = randomUUID();
          f.ploteo.slots[0].materialVariante!.id = randomUUID();
          f.ploteo.maquina!.consumibles![0].materialVariante!.id = randomUUID();
          const servicios = serviciosRecorridoF4(tx);
          const motor = motorCantidadManual(servicios.prisma);
          jest
            .spyOn(motor as never, 'cargarProductoYRuta' as never)
            .mockResolvedValue(f.producto as never);
          const key = `cantidadManual_${f.desploteo.configPasoId}`;
          const guardada = await motor.cotizarYGuardar({
            tenantId,
            productoId: productoDb.id,
            periodo: '2026-10',
            jobContext: {
              cantidad: 1,
              piezas: f.contexto.piezas,
              piezaAreaTotalM2: 12,
              opcionalesActivados: { [f.desploteo.configPasoId]: true },
              [key]: 5,
            },
          });
          expect(guardada.result.errores).toEqual([]);
          expect(guardada.cotizacionItemId).toBeDefined();
          const cotizado = await tx.cotizacionItem.findUniqueOrThrow({
            where: { id: guardada.cotizacionItemId! },
          });
          expect(cotizado.jobContextJson).toMatchObject({
            [key]: 5,
            piezaAreaTotalM2: 12,
          });
          expect(Number(cotizado.costoTotal)).toBe(35000);
          const cliente = await tx.cliente.create({
            data: {
              tenantId,
              nombre: 'Cliente ficticio',
              telefonoCodigo: '54',
              telefonoNumero: '2902000000',
              paisCodigo: 'AR',
            },
          });
          const auth = {
            tenantId,
            userId: usuario.id,
            email: usuario.email,
            permisos: new Set([
              'produccion.supervisar',
              'comercial.ver',
              'finanzas.ver_margenes',
            ]),
          } as CurrentAuth;
          const orden = await servicios.ordenes.create(auth, {
            idempotencyKey: randomUUID(),
            estado: 'pendiente',
            clienteId: cliente.id,
            cotizacionId: guardada.cotizacionId!,
            fechaEntrega: '2099-12-01',
            items: [
              {
                cotizacionItemId: cotizado.id,
                codigo: productoDb.codigo,
                nombre: productoDb.nombre,
                familia: 'Ploteo ficticio',
                cantidad: 12,
                cantidadUnidad: 'm2',
                subtotal: 0,
                impuestos: 0,
                total: 0,
              },
            ],
          });
          const pasos = await tx.ordenTrabajoItemPaso.findMany({
            where: { ordenId: orden.id },
            orderBy: { indice: 'asc' },
          });
          expect(
            pasos.map((p) => [p.nombre, Number(p.duracionEstimadaMin)]),
          ).toEqual([
            ['Ploteo', 60],
            ['Desploteo · Normal', 38],
          ]);
          const item = await tx.ordenTrabajoItem.findFirstOrThrow({
            where: { ordenId: orden.id },
            include: { cotizacionItem: true },
          });
          const traza = item.cotizacionItem!.trazabilidadJson as {
            pasos: PasoEjecutado[];
          };
          expect(traza.pasos[1].cantidadManual).toEqual({
            etiqueta: 'Superficie a desplotear',
            unidad: 'm²',
            valor: 5,
          });
          expect(orden.total).toBe(Number(cotizado.precioTotal));
          expect(Number(item.cotizacionItem!.costoTotal)).toBe(35000);
          throw rollback;
        },
        { timeout: 30000 },
      ),
    ).rejects.toBe(rollback);
  });
});
