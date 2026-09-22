import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoPropuesto } from '../evaluador-capacidades';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import {
  serviciosRecorridoF4,
  ejecutarOrdenF4,
} from '../../../test/soporte-recorridos-f4';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { EtaService } from '../../eta/eta.service';
import { DesarrolloDocumentalService } from '../../desarrollo-documental/desarrollo-documental.service';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';
import { FacturacionOrdenesService } from '../../administracion/facturacion-ordenes.service';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { CobrosService } from '../../administracion/cobros.service';
import { RecibosService } from '../../administracion/recibos.service';
import { EntregaService } from '../../ordenes-trabajo/entrega.service';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import type { CurrentAuth } from '../../auth/auth.types';

// DB dedicada. Se usa el catálogo de prueba y se revierte toda la operación.
// Sólo se sustituye el contrato resuelto; no hay endpoint de activación ni
// cambios en las suscripciones reales. No se envían comunicaciones ni archivos.
describe('Esencial: cotización → emisión → producción manual → cobro → entrega', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('completa el circuito sin módulos avanzados, incluso con automatizaciones configuradas', async () => {
    const rollback = new Error('rollback recorrido Esencial');
    try {
      await db.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const tenantId = tenant.id;
          await declararUnidadPrecioFixture(tx, tenantId);
          const actor = await tx.user.findFirstOrThrow();
          const auth = {
            tenantId,
            userId: actor.id,
            email: actor.email,
            permisos: new Set([
              'produccion.supervisar',
              'comercial.ver',
              'finanzas.ver_margenes',
            ]),
          } as CurrentAuth;
          const { prisma, produccion, enlaces } = serviciosRecorridoF4(tx);
          const capacidades = new CapacidadesEmpresaService(prisma as never);
          const actual = capacidades.actual.bind(capacidades);
          const contenido = structuredClone(PROPUESTA_PLANES[0].contenido);
          // Cobrar y entregar también debe funcionar sin la integración fiscal.
          contenido.funciones.fiscal_argentina = false;
          for (const clave of [
            'analisis_vectorial',
            'geometrias',
            'aprovechamiento_cotizacion',
            'exportacion_fabricacion',
            'recorridos_fabricacion',
            'mcp',
            'aprobacion_presupuestos',
            'documentos_pdf',
            'seguimiento_qr',
            'etiquetas_pdf',
            'existencias',
            'equipos_produccion',
            'cuentas_cobrar',
          ] as const)
            contenido.funciones[clave] = false;
          const contrato = contratoPropuesto(
            contenido,
            VERSION_CATALOGO_PLANES,
          );
          jest
            .spyOn(capacidades, 'actual')
            .mockImplementation(async (id, dbTx) => ({
              ...(await actual(id, dbTx)),
              contrato,
            }));
          const cliente = await tx.cliente.create({
            data: {
              tenantId,
              nombre: `Esencial ${randomUUID()}`,
              telefonoCodigo: '54',
              telefonoNumero: '',
              paisCodigo: 'AR',
            },
          });
          await tx.configuracionFidelizacion.upsert({
            where: { tenantId },
            create: {
              tenantId,
              acumulacionActiva: true,
              porcentajeMargen: 50,
              montoBase: 100,
              puntosBase: 100,
            },
            update: {
              acumulacionActiva: true,
              porcentajeMargen: 50,
              montoBase: 100,
              puntosBase: 100,
            },
          });
          const fidelizacion = new FidelizacionService(
            prisma as never,
            capacidades,
          );
          const eta = new EtaService(prisma as never, produccion, capacidades);
          const contextoEta = jest.spyOn(eta, 'contextoSimulacion');
          const documentos = new DesarrolloDocumentalService(
            prisma as never,
            enlaces,
            {} as never,
            undefined,
            capacidades,
          );
          const reservas = new ReservasMaterialService(
            prisma as never,
            new InventarioService(prisma as never),
            capacidades,
          );
          const facturacion = new FacturacionOrdenesService(prisma as never);
          const empresa = new DatosEmpresaService(prisma as never);
          const preparar = jest.fn();
          const ordenes = new OrdenesTrabajoService(
            prisma as never,
            eta,
            {} as never,
            { sincronizar: () => Promise.resolve() } as never,
            enlaces,
            empresa,
            {} as never,
            facturacion,
            { asegurarParaItem: preparar } as never,
            fidelizacion,
            documentos,
            undefined,
            reservas,
            capacidades,
          );
          const motor = new MotorUniversalService(
            prisma as never,
            new AplicarPrecioService(),
            new PreciosEspecialesClientesService(prisma as never, capacidades),
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            capacidades,
          );
          const producto = await tx.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
          });
          const guardada = await motor.cotizarYGuardar({
            tenantId,
            productoId: producto.id,
            periodo: '2026-06',
            jobContext: { cantidad: 500, caras: 2 },
          });
          expect(guardada.result.errores).toEqual([]);
          expect(guardada.cotizacionItemId).toBeTruthy();
          const payload = {
            idempotencyKey: randomUUID(),
            estado: 'pendiente' as const,
            canalVenta: 'mostrador',
            clienteId: cliente.id,
            fechaEntrega: '2099-12-01',
            items: [
              {
                cotizacionItemId: guardada.cotizacionItemId!,
                codigo: producto.codigo,
                nombre: producto.nombre,
                familia: 'Documentos',
                cantidad: 500,
                cantidadUnidad: 'unidad',
                subtotal: 0,
                impuestos: 0,
                total: 0,
              },
            ],
          };
          await expect(
            ordenes.create(auth, {
              ...payload,
              proyectoCampanaId: randomUUID(),
            }),
          ).rejects.toMatchObject({ status: 403 });
          await expect(
            ordenes.create(auth, { ...payload, fidelizacionCanjePuntos: 1 }),
          ).rejects.toMatchObject({ status: 403 });
          const orden = await ordenes.create(auth, payload);
          const persistida = await tx.ordenTrabajo.findUniqueOrThrow({
            where: { id: orden.id },
          });
          expect(Number(persistida.total)).toBeGreaterThan(0);
          expect(persistida.fechaEntrega?.toISOString().slice(0, 10)).toBe(
            '2099-12-01',
          );
          expect(persistida.publicToken).toBeNull();
          expect(persistida.materialesControlados).toBe(false);
          expect(persistida.fidelizacionPuntosEstimados).toBe(0);
          expect(
            await tx.necesidadMaterialOt.count({
              where: { ordenId: orden.id },
            }),
          ).toBe(0);
          // El borrador no conserva derechos de una emisión futura.
          const borrador = await ordenes.create(auth, {
            ...payload,
            estado: 'borrador',
            idempotencyKey: randomUUID(),
          });
          await ordenes.pasosDeOrden(auth, borrador.id);
          expect(
            await tx.ordenTrabajoItemPaso.count({
              where: { ordenId: borrador.id },
            }),
          ).toBe(0);
          contrato.funciones.tablero = false;
          contrato.funciones.estaciones = false;
          contrato.funciones.cobros = false;
          const manual = await ordenes.create(auth, {
            ...payload,
            idempotencyKey: randomUUID(),
          });
          const emitidaDesdeBorrador = await ordenes.cambiarEstado(
            auth,
            borrador.id,
            { estado: 'pendiente' },
          );
          for (const nueva of [manual, emitidaDesdeBorrador]) {
            expect(nueva.produccionControlada).toBe(false);
            expect(nueva.cobrosHabilitadosEmision).toBe(false);
            await ordenes.pasosDeOrden(auth, nueva.id); // Tampoco materializar al leer.
            expect(
              await tx.ordenTrabajoItemPaso.count({
                where: { ordenId: nueva.id },
              }),
            ).toBe(0);
          }
          // Simula la retirada del circuito comercial con la OT ya emitida.
          contrato.funciones.ordenes = false;
          contrato.funciones.presupuestos = false;
          contrato.funciones.cotizacion = false;
          for (const clave of [
            'clientes',
            'empleados',
            'materiales',
            'productos',
            'productos_compuestos',
            'procesos',
            'centros_costo',
            'maquinaria',
            'reglas_precio',
          ] as const) {
            contrato.funciones[clave] = false;
          }
          const { ejecutados } = await ejecutarOrdenF4(
            tx,
            ordenes,
            auth,
            orden.id,
          );
          expect(ejecutados).toBeGreaterThan(0);
          await eta.sincronizarAsignaciones(tenantId);
          await eta.snapshotDiario(tenantId);
          expect(contextoEta).not.toHaveBeenCalled();
          expect(preparar).not.toHaveBeenCalled();
          expect(
            await tx.etaPromesa.count({ where: { ordenId: orden.id } }),
          ).toBe(0);
          const recibos = new RecibosService(
            prisma as never,
            {} as never,
            enlaces,
            {} as never,
            empresa,
          );
          jest
            .spyOn(recibos, 'materializarPdfEnSegundoPlano')
            .mockImplementation(() => undefined);
          const cobros = new CobrosService(
            prisma as never,
            facturacion,
            recibos,
            { avisar: () => Promise.resolve() } as never,
            fidelizacion,
            capacidades,
          );
          const entrega = new EntregaService(
            prisma as never,
            cobros,
            fidelizacion,
          );
          const mostrador = await entrega.escanear(auth, orden.numero);
          expect(mostrador.items.every((i) => i.listo)).toBe(true);
          expect(mostrador.saldo).toBe(Number(persistida.total));
          const cuenta = await tx.cuentaFondos.create({
            data: {
              tenantId,
              nombre: 'Caja prueba Esencial',
              tipo: 'efectivo',
              moneda: 'ARS',
            },
          });
          const metodo = await tx.metodoPago.create({
            data: {
              tenantId,
              nombre: 'Efectivo prueba',
              codigo: randomUUID(),
              tipo: 'efectivo',
            },
          });
          await expect(
            cobros.create(auth, {
              ordenId: orden.id,
              fecha: '2026-09-21',
              metodoPagoId: metodo.id,
              cuentaDestinoId: cuenta.id,
              montoBruto: mostrador.saldo + 1,
              comisionPctAplicada: 0,
            }),
          ).rejects.toThrow('saldo pendiente');
          await cobros.create(auth, {
            idempotencyKey: randomUUID(),
            ordenId: orden.id,
            clienteId: cliente.id,
            fecha: '2026-09-21',
            metodoPagoId: metodo.id,
            cuentaDestinoId: cuenta.id,
            montoBruto: mostrador.saldo,
            comisionPctAplicada: 0,
          });
          await entrega.entregar(auth, orden.id, {
            itemIds: mostrador.items.map((i) => i.id),
          });
          const final = await entrega.escanear(auth, orden.numero);
          expect(final.estado).toBe('entregada');
          expect(final.saldo).toBe(0);
          expect(final.cobrado).toBe(final.total);
          const manualEscaneada = await entrega.escanear(auth, manual.numero);
          expect(manualEscaneada.puedeCobrar).toBe(false);
          expect(manualEscaneada.requiereConfirmacionManual).toBe(true);
          await expect(
            cobros.create(auth, {
              ordenId: manual.id,
              metodoPagoId: metodo.id,
              cuentaDestinoId: cuenta.id,
              fecha: '2026-09-21',
              montoBruto: 10,
              comisionPctAplicada: 0,
            }),
          ).rejects.toMatchObject({ status: 403 });
          const entregaManual = {
            itemIds: manualEscaneada.items.map((item) => item.id),
          };
          await expect(
            entrega.entregar(auth, manual.id, entregaManual),
          ).rejects.toThrow('Confirmá');
          await entrega.entregar(auth, manual.id, {
            ...entregaManual,
            confirmarPreparacionManual: true,
          });
          const manualEntregada = await entrega.escanear(auth, manual.numero);
          expect(manualEntregada.estado).toBe('entregada');
          expect(manualEntregada.cobrado).toBe(0);
          expect(manualEntregada.saldo).toBe(manualEntregada.total);

          expect(
            await tx.fidelizacionMovimiento.count({
              where: { tenantId, clienteId: cliente.id },
            }),
          ).toBe(0);
          expect(
            await tx.fidelizacionCuenta.count({
              where: { tenantId, clienteId: cliente.id },
            }),
          ).toBe(0);
          expect(
            await tx.reservaMaterialOt.count({
              where: { necesidad: { ordenId: orden.id } },
            }),
          ).toBe(0);
          throw rollback;
        },
        { timeout: 60000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 65000);
});
