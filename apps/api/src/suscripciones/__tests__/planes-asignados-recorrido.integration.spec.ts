import { MfaService, huellaPassword } from '../../auth/mfa.service';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { DocumentosPdfWorker } from '../../documentos-pdf/documentos-pdf.worker';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import type { CurrentAuth } from '../../auth/auth.types';
import { PlanesAsignacionController } from '../../plataforma/planes/planes-asignacion.controller';
import { PlanesAsignacionService } from '../../plataforma/planes/planes-asignacion.service';
import { PlataformaGuard } from '../../plataforma/plataforma.guard';
import { PlataformaAdminGuard } from '../../plataforma/plataforma-admin.guard';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Server } from 'node:http';
import request from 'supertest';
import { PermisosGuard } from '../../auth/permisos.guard';
import { CapacidadGuard } from '../capacidad.guard';
import { ComprasController } from '../../compras/compras.controller';
import { CapacidadesController } from '../capacidades.controller';
import { EtaController } from '../../eta/eta.controller';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import { ejecutarOrdenF4 } from '../../../test/soporte-recorridos-f4';
import { runWithTenant } from '../../common/tenant-context';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { ProduccionService } from '../../produccion/produccion.service';
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
import { EnlacesPublicosService } from '../../enlaces-publicos/enlaces-publicos.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { CuponesService } from '../../cupones/cupones.service';
import { DocumentosPdfService } from '../../documentos-pdf/documentos-pdf.service';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { ComprasService } from '../../compras/compras.service';
import { CentroCopiadoService } from '../../centro-copiado/centro-copiado.service';
import { CentroCopiadoCadService } from '../../centro-copiado/centro-copiado-cad.service';
import { CatalogoCadService } from '../../centro-copiado/catalogo-cad.service';
import { prepararCadPlanes } from '../../../test/fixture-cad-planes';
import type { DocumentoCentroCopiadoDto } from '../../centro-copiado/dto/cotizar-centro-copiado.dto';
import { DocumentosOrdenService } from '../../impresion/documentos-orden.service';

function servicios(db: PrismaService) {
  const capacidades = new CapacidadesEmpresaService(db);
  const enlaces = new EnlacesPublicosService(db, capacidades);
  const fidelizacion = new FidelizacionService(db, capacidades);
  const produccion = new ProduccionService(db, capacidades);
  const eta = new EtaService(db, produccion, capacidades);
  const inventario = new InventarioService(db);
  const reservas = new ReservasMaterialService(db, inventario, capacidades);
  const facturacion = new FacturacionOrdenesService(db);
  const empresa = new DatosEmpresaService(db);
  const documentos = new DesarrolloDocumentalService(
    db,
    enlaces,
    {} as never,
    undefined,
    capacidades,
  );
  // Se aíslan sólo transportes externos. El contrato y los servicios de negocio son reales.
  const avisos = { sincronizar: () => Promise.resolve() };
  const ordenes = new OrdenesTrabajoService(
    db,
    eta,
    {} as never,
    avisos as never,
    enlaces,
    empresa,
    {} as never,
    facturacion,
    { asegurarParaItem: () => Promise.resolve() } as never,
    fidelizacion,
    documentos,
    undefined,
    reservas,
    capacidades,
  );
  const motor = new MotorUniversalService(
    db,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(db, capacidades),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    capacidades,
  );
  const recibos = new RecibosService(
    db,
    {} as never,
    enlaces,
    {} as never,
    empresa,
  );
  jest
    .spyOn(recibos, 'materializarPdfEnSegundoPlano')
    .mockImplementation(() => undefined);
  const cobros = new CobrosService(
    db,
    facturacion,
    recibos,
    { avisar: () => Promise.resolve() } as never,
    fidelizacion,
    capacidades,
  );
  const archivos = new ArchivosService(db, {} as never, {} as never);
  const presupuestos = new PresupuestosService(
    db,
    ordenes,
    archivos,
    {} as never,
    avisos as never,
    enlaces,
    empresa,
    new CuponesService(db, capacidades),
    fidelizacion,
    new DocumentosPdfService(db, capacidades),
    capacidades,
  );
  return {
    capacidades,
    enlaces,
    fidelizacion,
    produccion,
    eta,
    inventario,
    reservas,
    ordenes,
    motor,
    cobros,
    presupuestos,
    entrega: new EntregaService(db, cobros, fidelizacion),
    compras: new ComprasService(db, inventario, reservas, capacidades),
    copiado: new CentroCopiadoService(
      db,
      motor,
      undefined,
      undefined,
      new CentroCopiadoCadService(
        db,
        new CatalogoCadService(db),
        motor,
        capacidades,
      ),
      capacidades,
    ),
  };
}

const db = new PrismaService();
const previoPdf = process.env.PRESUPUESTO_PDF_ASYNC;
beforeAll(() => {
  process.env.PRESUPUESTO_PDF_ASYNC = 'true';
});
afterAll(async () => {
  if (previoPdf === undefined) delete process.env.PRESUPUESTO_PDF_ASYNC;
  else process.env.PRESUPUESTO_PDF_ASYNC = previoPdf;
  await db.$disconnect();
});

it('una OT sin impresión contratada conserva el acceso al historial anterior a los últimos 200 eventos', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[0].id);
    await runWithTenant(c.tenantId, async () => {
      const s = servicios(c.db);
      const orden = await c.tx.ordenTrabajo.create({
        data: {
          tenantId: c.tenantId,
          numero: `OT-HIST-${randomUUID()}`,
          estado: 'pendiente',
          publicToken: randomUUID(),
        },
      });
      expect(
        (await s.ordenes.findOne(c.auth, orden.id)).tieneHistorialImpresion,
      ).toBe(false);
      const fecha = new Date('2026-01-01');
      await c.tx.ordenTrabajoEvento.createMany({
        data: Array.from({ length: 201 }, (_, i) => ({
          tenantId: c.tenantId,
          ordenId: orden.id,
          tipo: i ? 'edicion' : 'cola_impresion',
          descripcion: 'Evento de prueba',
          usuarioNombre: 'Ensayo',
          fecha: new Date(fecha.getTime() + i * 1000),
        })),
      });
      const detalle = await s.ordenes.findOne(c.auth, orden.id);
      expect(detalle.eventos).toHaveLength(200);
      expect(detalle.eventos.some((e) => e.tipo === 'cola_impresion')).toBe(
        false,
      );
      expect(detalle.tieneHistorialImpresion).toBe(true);
      expect(
        await s.capacidades.puedeOperar(c.tenantId, 'impresion_directa'),
      ).toBe(false);
    });
  });
});

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: cotizar → presupuesto → aprobar → OT → producción → cobro → entrega',
  async (nombre) => {
    const indice = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
    await conPlanesAsignados(db, async (c) => {
      await c.asignar(c.versiones[indice].id);
      await runWithTenant(c.tenantId, async () => {
        await declararUnidadPrecioFixture(c.tx, c.tenantId);
        await c.tx.politicaReservasMaterial.upsert({
          where: { tenantId: c.tenantId },
          create: { tenantId: c.tenantId, habilitada: true },
          update: { habilitada: true },
        });
        const s = servicios(c.db);
        expect((await s.capacidades.actual(c.tenantId)).contrato).toMatchObject(
          {
            origen: 'version',
            nombre: `Grafo ${nombre}`,
            limites: {
              usuariosMax: [3, 20, 40][indice],
              almacenamiento: { gb: [250, 500, 1500][indice] },
            },
          },
        );
        const cliente = await c.tx.cliente.create({
          data: {
            tenantId: c.tenantId,
            nombre: `Recorrido ${nombre} ${randomUUID()}`,
            telefonoCodigo: '54',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
        const producto = await c.tx.producto.findFirstOrThrow({
          where: { codigo: 'TARJ-PREMIUM-300' },
        });
        const cotizada = await s.motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: producto.id,
          periodo: '2026-06',
          jobContext: { cantidad: 500, caras: 2 },
        });
        expect(cotizada.result.errores).toEqual([]);
        const snapshot = await c.tx.cotizacionItem.findUniqueOrThrow({
          where: { id: cotizada.cotizacionItemId! },
        });
        const emitido = await s.presupuestos.emitir(c.auth, {
          cotizacionId: cotizada.cotizacionId!,
          clienteId: cliente.id,
          canalVenta: 'mostrador',
          fechaEntrega: '2099-12-01',
          items: [
            {
              cotizacionItemId: snapshot.id,
              codigo: 'NO-CONFIAR',
              nombre: 'Entrada manipulada',
              familia: 'Tarjetas',
              cantidad: 999,
              cantidadUnidad: 'unidad',
              subtotal: 1,
              impuestos: 0,
              total: 1,
            },
          ],
        });
        expect(emitido.estado).toBe('enviado');
        const presupuesto = await c.tx.cotizacion.findUniqueOrThrow({
          where: { id: cotizada.cotizacionId! },
        });
        expect(Number(presupuesto.total)).toBe(Number(snapshot.precioTotal));
        expect(presupuesto.publicToken).toBeTruthy();
        expect(
          await c.tx.documentoPdf.count({
            where: { cotizacionId: presupuesto.id, revision: 2 },
          }),
        ).toBe(1);
        const publico = await runWithTenant('', () =>
          s.presupuestos.publico(presupuesto.publicToken!),
        );
        expect(publico).toBeTruthy();
        await s.presupuestos.resolver(c.auth, presupuesto.id, {
          resultado: 'aprobado',
        });
        const conversion = await s.presupuestos.convertir(
          c.auth,
          presupuesto.id,
          {},
        );
        await s.ordenes.cambiarEstado(c.auth, conversion.ordenId, {
          estado: 'pendiente',
        });
        const orden = await c.tx.ordenTrabajo.findUniqueOrThrow({
          where: { id: conversion.ordenId },
        });
        expect(orden.materialesControlados).toBe(indice > 0);
        expect(orden.produccionControlada).toBe(true);
        expect(Number(orden.total)).toBe(Number(snapshot.precioTotal));
        const necesidades = await c.tx.necesidadMaterialOt.count({
          where: { ordenId: orden.id },
        });
        if (indice > 0) expect(necesidades).toBeGreaterThan(0);
        else expect(necesidades).toBe(0);
        const promesas = await c.tx.etaPromesa.count({
          where: { ordenId: orden.id, hito: 'emision' },
        });
        expect(promesas).toBe(indice === 2 ? 1 : 0);
        const pasos = await c.tx.ordenTrabajoItemPaso.findMany({
          where: { ordenId: orden.id },
          orderBy: { indice: 'asc' },
        });
        expect(pasos.length).toBeGreaterThan(1);
        await expect(
          s.ordenes.accionPaso(
            { ...c.auth, permisos: new Set() },
            orden.id,
            pasos[0].itemId,
            pasos[0].id,
            { accion: 'completar', sinTiempoConfirmado: true },
          ),
        ).rejects.toThrow();
        await expect(
          s.ordenes.accionPaso(
            c.auth,
            orden.id,
            pasos.at(-1)!.itemId,
            pasos.at(-1)!.id,
            { accion: 'completar' },
          ),
        ).rejects.toThrow(/dependencias/);
        if (indice === 0) {
          const reducido = {
            ...structuredClone(PROPUESTA_PLANES[0].contenido),
            almacenamientoModo: 'limitado' as const,
            almacenamientoGb: 250,
          };
          reducido.funciones.tablero = false;
          reducido.funciones.estaciones = false;
          reducido.funciones.documentos_pdf = false;
          const version = await runWithTenant('', () => c.publicar(reducido));
          await c.asignar(version.id);
          // La OT emitida conserva ejecución; una nueva usa preparación manual.
          const manual = await s.ordenes.create(c.auth, {
            idempotencyKey: randomUUID(),
            estado: 'pendiente',
            clienteId: cliente.id,
            canalVenta: 'mostrador',
            fechaEntrega: '2099-12-01',
            items: [
              {
                cotizacionItemId: snapshot.id,
                codigo: producto.codigo,
                nombre: producto.nombre,
                familia: 'Tarjetas',
                cantidad: 500,
                cantidadUnidad: 'unidad',
                subtotal: 0,
                impuestos: 0,
                total: 0,
              },
            ],
          });
          expect(manual.produccionControlada).toBe(false);
          const mostradorManual = await s.entrega.escanear(
            c.auth,
            manual.numero,
          );
          expect(mostradorManual.requiereConfirmacionManual).toBe(true);
          const items = {
            itemIds: mostradorManual.items.map((item) => item.id),
          };
          await expect(
            s.entrega.entregar(c.auth, manual.id, items),
          ).rejects.toThrow('Confirmá');
          await s.entrega.entregar(c.auth, manual.id, {
            ...items,
            confirmarPreparacionManual: true,
          });
          // Un PDF en espera revalida el contrato al ejecutarse, antes de usar el render externo.
          const doc = await c.tx.documentoPdf.findFirstOrThrow({
            where: { cotizacionId: presupuesto.id, revision: 2 },
          });
          const generar = jest.fn();
          const worker = new DocumentosPdfWorker(
            c.db,
            { generar } as never,
            {} as never,
            {
              adquirir: () => Promise.resolve({ duracionMs: 120000 }),
              renovar: () => Promise.resolve(true),
              liberar: () => Promise.resolve(),
            } as never,
            s.capacidades,
          );
          await expect(
            worker.procesar({
              id: 'pdf-pendiente',
              data: {
                documentoId: doc.id,
                tenantId: c.tenantId,
                ronda: doc.ronda,
                intentoAnterior: doc.intentos,
              },
            } as never),
          ).rejects.toMatchObject({ status: 403 });
          expect(generar.mock.calls.length).toBe(0);
          expect(
            await c.tx.documentoPdf.findUnique({ where: { id: doc.id } }),
          ).toMatchObject({
            estado: 'FALLIDO',
            errorCodigo: 'CAPACIDAD_NO_DISPONIBLE',
          });
        }
        await ejecutarOrdenF4(c.tx, s.ordenes, c.auth, orden.id);
        const mostrador = await s.entrega.escanear(c.auth, orden.numero);
        expect(mostrador.items.every((i) => i.listo)).toBe(true);
        const cuenta = await c.tx.cuentaFondos.create({
          data: {
            tenantId: c.tenantId,
            nombre: `Caja ${nombre}`,
            tipo: 'efectivo',
            moneda: 'ARS',
          },
        });
        const metodo = await c.tx.metodoPago.create({
          data: {
            tenantId: c.tenantId,
            nombre: 'Efectivo',
            codigo: randomUUID(),
            tipo: 'efectivo',
          },
        });
        const pago = {
          idempotencyKey: randomUUID(),
          ordenId: orden.id,
          clienteId: cliente.id,
          metodoPagoId: metodo.id,
          cuentaDestinoId: cuenta.id,
          fecha: '2026-09-21',
          montoBruto: mostrador.saldo,
          comisionPctAplicada: 0,
        };
        await s.cobros.create(c.auth, pago);
        await s.cobros.create(c.auth, pago);
        await s.entrega.entregar(c.auth, orden.id, {
          itemIds: mostrador.items.map((i) => i.id),
        });
        const final = await s.entrega.escanear(c.auth, orden.numero);
        expect(final.estado).toBe('entregada');
        expect(final.saldo).toBe(0);
        expect(final.cobrado).toBe(final.total);
        const tracking = await runWithTenant('', () =>
          s.ordenes.trackingPublico(orden.publicToken!),
        );
        expect(tracking?.estado).toBe('entregada');
        // Los pilotos siguen excluidos aunque el plan permita cotizar documentos/CAD.
        await expect(
          s.capacidades.exigir(c.tenantId, 'impresion_directa'),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          s.capacidades.exigir(c.tenantId, 'colas_impresion'),
        ).rejects.toMatchObject({ status: 403 });
      });
    });
  },
  95000,
);

it('las tareas automáticas de Avanzado no escriben con la empresa bloqueada', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[2].id);
    await runWithTenant(c.tenantId, async () => {
      const s = servicios(c.db);
      await c.tx.tenant.update({
        where: { id: c.tenantId },
        data: { activo: false },
      });
      const contexto = jest.spyOn(s.eta, 'contextoSimulacion');
      await s.eta.snapshotDiario(c.tenantId);
      await s.eta.sincronizarAsignaciones(c.tenantId);
      expect(contexto.mock.calls.length).toBe(0);
      expect(
        await c.tx.etaSnapshotEstacion.count({
          where: { tenantId: c.tenantId },
        }),
      ).toBe(0);
    });
  });
}, 95000);

it('el catálogo publicado se consulta desde el contexto de empresa sin inyectarle tenantId', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[0].id);
    await runWithTenant(c.tenantId, async () => {
      expect(
        await c.db.planVersion.findMany({ where: { id: c.versiones[0].id } }),
      ).toHaveLength(1);
    });
  });
}, 95000);

it('el perfil con MFA cuenta sólo los dispositivos del usuario dentro de una empresa', async () => {
  await conPlanesAsignados(db, async (c) => {
    const otro = await c.tx.user.create({
      data: {
        email: `mfa-${randomUUID()}@test.local`,
        nombreCompleto: 'Otra identidad',
      },
    });
    const config = await c.tx.userMfa.findUniqueOrThrow({
      where: { userId: c.auth.userId },
    });
    for (const userId of [c.auth.userId, otro.id])
      await c.tx.mfaDispositivo.create({
        data: {
          userId,
          tokenHash: randomUUID(),
          alcance: 'tenant',
          passwordStamp: huellaPassword(null),
          mfaVersion: config.version,
          venceEl: new Date(Date.now() + 86400000),
        },
      });
    await runWithTenant(c.tenantId, async () => {
      const estado = await new MfaService(
        c.db,
        { disponible: true } as never,
        {} as never,
      ).estado(c.auth);
      expect(estado).toMatchObject({ activo: true, dispositivosRecordados: 1 });
    });
  });
}, 95000);

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s cotiza documentos con rangos sin impresión directa',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      const i = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
      await c.asignar(c.versiones[i].id);
      await runWithTenant(c.tenantId, async () => {
        await declararUnidadPrecioFixture(c.tx, c.tenantId);
        const s = servicios(c.db);
        const papel = await c.tx.materiaPrima.findFirstOrThrow({
          where: { subfamilia: 'SUSTRATO_HOJA' },
          orderBy: { nombre: 'asc' },
        });
        const construidos = await s.copiado.construirItems(
          c.tenantId,
          {
            documentos: [
              {
                id: 'doc',
                nombre: 'Prueba.pdf',
                archivoNombre: 'Prueba.pdf',
                paginasOriginales: 12,
                paginas: 4,
                copias: 2,
                tamano: 'A4',
                tamanoAnchoMm: 210,
                tamanoAltoMm: 297,
                papelMateriaPrimaId: papel.id,
                color: 'BN',
                faz: 2,
                rangoPaginas: '1-3,5',
              },
            ],
          },
          '2026-03',
        );
        const item = construidos.items[0];
        expect(item.error).toBeNull();
        const cotizada = await s.motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: item.productoId,
          jobContext: item.jobContext as never,
          periodo: '2026-03',
        });
        expect(cotizada.result.exitoso).toBe(true);
        expect(cotizada.cotizacionItemId).toBeTruthy();
        const guardado = await c.tx.cotizacionItem.findUniqueOrThrow({
          where: { id: cotizada.cotizacionItemId! },
        });
        expect(
          (
            guardado.jobContextJson as {
              _centroCopiado: { hojas: number; rangoPaginas: string };
            }
          )._centroCopiado,
        ).toMatchObject({ hojas: 4, rangoPaginas: '1-3,5' });
        expect(
          await s.capacidades.puedeOperar(c.tenantId, 'impresion_directa'),
        ).toBe(false);
      });
    });
  },
  95000,
);

async function cargaCad(
  c: Parameters<Parameters<typeof conPlanesAsignados>[1]>[0],
  s: ReturnType<typeof servicios>,
  color: 'BN' | 'COLOR' = 'BN',
) {
  await declararUnidadPrecioFixture(c.tx, c.tenantId);
  const fixture = await prepararCadPlanes(c.tx, c.tenantId);
  const { perfiles } = await s.copiado.opcionesCad(c.tenantId);
  const opcion = perfiles.find((p) => p.color === color)!;
  expect(opcion).toBeDefined();
  expect(
    await c.tx.impresionDestino.count({
      where: { tenantId: c.tenantId, maquinaId: fixture.maquinaId },
    }),
  ).toBe(0);
  const documento: DocumentoCentroCopiadoDto = {
    id: 'plano',
    nombre: 'Planos.pdf',
    archivoNombre: 'Planos.pdf',
    modo: 'CAD',
    tamano: 'CAD',
    tamanoAnchoMm: 594,
    tamanoAltoMm: 841,
    paginasOriginales: 3,
    paginas: 2,
    rangoPaginas: '1,3',
    copias: 1,
    copiasPorPagina: [
      { pagina: 1, copias: 2 },
      { pagina: 2, copias: 7 },
    ],
    medidasPaginas: [
      { anchoMm: 594, altoMm: 841 },
      { anchoMm: 1200, altoMm: 1400 },
      { anchoMm: 1189, altoMm: 841 },
    ],
    papelMateriaPrimaId: fixture.papel.id,
    gramaje: 80,
    color,
    faz: 1,
    cad: { cotizacion: { id: opcion.id, revision: opcion.revision } },
  };
  return { documento, fixture };
}

it.each(['Esencial', 'Pro', 'Avanzado'])(
  '%s: CAD con rangos y copias por página llega a una OT sin impresión conectada',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      const indice = ['Esencial', 'Pro', 'Avanzado'].indexOf(nombre);
      await c.asignar(c.versiones[indice].id);
      await runWithTenant(c.tenantId, async () => {
        const s = servicios(c.db);
        const { documento, fixture } = await cargaCad(
          c,
          s,
          indice === 1 ? 'COLOR' : 'BN',
        );
        const construidos = await s.copiado.construirItems(
          c.tenantId,
          { documentos: [documento] },
          '2026-03',
        );
        const item = construidos.items[0];
        expect(item.error).toBeNull();
        expect(item.total).toBeGreaterThan(0);
        expect(item.cantidad).toBe(3);
        const cotizada = await s.motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: item.productoId,
          jobContext: item.jobContext as never,
          periodo: '2026-03',
        });
        expect(cotizada.result.exitoso).toBe(true);
        const snapshot = await c.tx.cotizacionItem.findUniqueOrThrow({
          where: { id: cotizada.cotizacionItemId! },
        });
        expect(Number(snapshot.precioTotal)).toBeCloseTo(item.total, 2);
        const meta = (
          snapshot.jobContextJson as { _centroCopiado: Record<string, unknown> }
        )._centroCopiado;
        expect(meta).toMatchObject({
          modo: 'CAD',
          escala: 100,
          paginas: 2,
          hojas: 3,
          rangoPaginas: '1,3',
          copiasPorPagina: documento.copiasPorPagina,
        });
        expect(meta.planes).toEqual([
          expect.objectContaining({ pagina: 1, copias: 2 }),
          expect.objectContaining({ pagina: 3, copias: 1 }),
        ]);
        const cliente = await c.tx.cliente.create({
          data: {
            tenantId: c.tenantId,
            nombre: 'CAD sin impresión',
            paisCodigo: 'AR',
            telefonoCodigo: '54',
            telefonoNumero: '',
          },
        });
        const orden = await s.ordenes.create(c.auth, {
          idempotencyKey: randomUUID(),
          estado: 'pendiente',
          clienteId: cliente.id,
          canalVenta: 'mostrador',
          fechaEntrega: '2099-12-01',
          items: [
            {
              cotizacionItemId: snapshot.id,
              codigo: fixture.producto.codigo,
              nombre: 'Planos.pdf',
              familia: 'CAD',
              cantidad: 3,
              cantidadUnidad: 'unidad',
              subtotal: 0,
              impuestos: 0,
              total: 0,
            },
          ],
        });
        expect(Number(orden.total)).toBeCloseTo(item.total, 2);
        const itemOt = await c.tx.ordenTrabajoItem.findFirstOrThrow({
          where: {
            tenantId: c.tenantId,
            ordenId: orden.id,
            cotizacionItemId: snapshot.id,
          },
          include: { cotizacionItem: { select: { jobContextJson: true } } },
        });
        expect(
          itemOt.jobContextSnapshotJson ??
            itemOt.cotizacionItem?.jobContextJson,
        ).toMatchObject({
          _centroCopiado: meta,
        });
        expect(
          await c.tx.ordenTrabajoItemPaso.count({
            where: {
              tenantId: c.tenantId,
              ordenId: orden.id,
              familiaCodigo: 'impresion_por_area',
            },
          }),
        ).toBe(1);
        const transportes = {
          firmarDocumento: jest.fn(),
          descargarBuffer: jest.fn(),
        };
        const impresion = new DocumentosOrdenService(
          c.db,
          transportes as never,
          transportes as never,
          {} as never,
          s.capacidades,
        );
        await expect(impresion.vista(c.auth, orden.id)).rejects.toMatchObject({
          status: 403,
          response: { capacidad: 'impresion_directa' },
        });
        expect(transportes.firmarDocumento).not.toHaveBeenCalled();
        expect(transportes.descargarBuffer).not.toHaveBeenCalled();
      });
    });
  },
  95000,
);

it.each(['nuevo', 'recotizar'] as const)(
  'CAD %s: retirar la función mientras calcula impide persistir y conserva el historial',
  async (operacion) => {
    await conPlanesAsignados(db, async (c) => {
      await c.asignar(c.versiones[0].id);
      await runWithTenant(c.tenantId, async () => {
        const s = servicios(c.db);
        const { documento } = await cargaCad(c, s);
        const preparado = (
          await s.copiado.construirItems(
            c.tenantId,
            { documentos: [documento] },
            '2026-03',
          )
        ).items[0];
        expect(preparado.error).toBeNull();
        const input = {
          tenantId: c.tenantId,
          productoId: preparado.productoId,
          jobContext: preparado.jobContext as never,
          periodo: '2026-03',
        };
        const anterior =
          operacion === 'recotizar'
            ? await s.motor.cotizarYGuardar(input)
            : null;
        const snapshot = anterior
          ? await c.tx.cotizacionItem.findUniqueOrThrow({
              where: { id: anterior.cotizacionItemId! },
            })
          : null;
        const contenido = structuredClone(PROPUESTA_PLANES[0].contenido);
        contenido.almacenamientoModo = 'limitado';
        contenido.almacenamientoGb = 250;
        contenido.funciones.cotizacion_cad = false;
        const version = await runWithTenant('', () => c.publicar(contenido));
        const originales = await c.tx.cotizacionItem.count({
          where: { tenantId: c.tenantId },
        });
        const borradores = await c.tx.cotizacion.count({
          where: { tenantId: c.tenantId },
        });
        const calcular = s.motor.cotizar.bind(s.motor);
        const intercalacion = jest
          .spyOn(s.motor, 'cotizar')
          .mockImplementationOnce(async (...args) => {
            const resultado = await calcular(...args);
            expect(resultado.exitoso).toBe(true);
            // La asignación real ocurre después de calcular y antes del primer write.
            await c.asignar(version.id);
            return resultado;
          });
        await expect(
          operacion === 'nuevo'
            ? s.motor.cotizarYGuardar(input)
            : s.motor.recotizarItem({
                ...input,
                cotizacionItemId: snapshot!.id,
              }),
        ).rejects.toMatchObject({
          status: 403,
          response: { capacidad: 'cotizacion_cad' },
        });
        intercalacion.mockRestore();
        expect(
          await c.tx.cotizacionItem.count({ where: { tenantId: c.tenantId } }),
        ).toBe(originales);
        expect(
          await c.tx.cotizacion.count({ where: { tenantId: c.tenantId } }),
        ).toBe(borradores);
        if (snapshot)
          expect(
            await c.tx.cotizacionItem.findUniqueOrThrow({
              where: { id: snapshot.id },
            }),
          ).toEqual(snapshot);
        const papel = await c.tx.materiaPrima.findFirstOrThrow({
          where: { tenantId: c.tenantId, subfamilia: 'SUSTRATO_HOJA' },
          orderBy: { nombre: 'asc' },
        });
        const a4: DocumentoCentroCopiadoDto = {
          id: 'a4',
          nombre: 'Documento A4',
          paginas: 2,
          copias: 1,
          tamano: 'A4',
          tamanoAnchoMm: 210,
          tamanoAltoMm: 297,
          color: 'BN',
          faz: 2,
          papelMateriaPrimaId: papel.id,
        };
        await expect(
          s.copiado.construirItems(
            c.tenantId,
            { documentos: [a4, documento] },
            '2026-03',
          ),
        ).rejects.toMatchObject({
          status: 403,
          response: { capacidad: 'cotizacion_cad' },
        });
        const normal = (
          await s.copiado.construirItems(
            c.tenantId,
            { documentos: [a4] },
            '2026-03',
          )
        ).items[0];
        expect(normal.error).toBeNull();
        expect(
          (
            await s.motor.cotizarYGuardar({
              ...input,
              productoId: normal.productoId,
              jobContext: normal.jobContext as never,
            })
          ).cotizacionItemId,
        ).toBeTruthy();
      });
    });
  },
  95000,
);

it('la plantilla de Documentos sin metadata también revalida el contrato al guardar', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[0].id);
    await runWithTenant(c.tenantId, async () => {
      const s = servicios(c.db);
      await declararUnidadPrecioFixture(c.tx, c.tenantId);
      const papel = await c.tx.materiaPrima.findFirstOrThrow({
        where: { tenantId: c.tenantId, subfamilia: 'SUSTRATO_HOJA' },
        orderBy: { nombre: 'asc' },
      });
      const item = (
        await s.copiado.construirItems(
          c.tenantId,
          {
            documentos: [
              {
                id: 'a4',
                paginas: 2,
                copias: 1,
                tamano: 'A4',
                tamanoAnchoMm: 210,
                tamanoAltoMm: 297,
                color: 'BN',
                faz: 2,
                papelMateriaPrimaId: papel.id,
              },
            ],
          },
          '2026-03',
        )
      ).items[0];
      expect(item.error).toBeNull();
      const jobContext = { ...item.jobContext };
      delete jobContext._centroCopiado;
      const contenido = structuredClone(PROPUESTA_PLANES[0].contenido);
      contenido.almacenamientoModo = 'limitado';
      contenido.almacenamientoGb = 250;
      contenido.funciones.centro_copiado = false;
      contenido.funciones.cotizacion_cad = false;
      contenido.funciones.terminaciones_copiado = false;
      const version = await runWithTenant('', () => c.publicar(contenido));
      const antes = await c.tx.cotizacionItem.count({
        where: { tenantId: c.tenantId },
      });
      const calcular = s.motor.cotizar.bind(s.motor);
      jest.spyOn(s.motor, 'cotizar').mockImplementationOnce(async (...args) => {
        const resultado = await calcular(...args);
        expect(resultado.exitoso).toBe(true);
        await c.asignar(version.id);
        return resultado;
      });
      await expect(
        s.motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: item.productoId,
          jobContext: jobContext as never,
          periodo: '2026-03',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'centro_copiado' },
      });
      expect(
        await c.tx.cotizacionItem.count({ where: { tenantId: c.tenantId } }),
      ).toBe(antes);
    });
  });
}, 95000);

it('retirar Terminaciones antes de guardar un tomo conserva el anterior y no agrega otro', async () => {
  await conPlanesAsignados(db, async (c) => {
    await c.asignar(c.versiones[1].id);
    await runWithTenant(c.tenantId, async () => {
      const s = servicios(c.db);
      await declararUnidadPrecioFixture(c.tx, c.tenantId);
      const papel = await c.tx.materiaPrima.findFirstOrThrow({
        where: { tenantId: c.tenantId, subfamilia: 'SUSTRATO_HOJA' },
        orderBy: { nombre: 'asc' },
      });
      const dto = {
        documentos: ['a', 'b'].map((id) => ({
          id,
          nombre: `${id}.pdf`,
          paginas: 2,
          copias: 1,
          tamano: 'A4',
          tamanoAnchoMm: 210,
          tamanoAltoMm: 297,
          color: 'BN' as const,
          faz: 2 as const,
          papelMateriaPrimaId: papel.id,
          grupoId: 't',
        })),
        grupos: [
          { id: 't', nombre: 'Tomo de prueba', juegos: 2, terminaciones: [] },
        ],
      };
      const primero = await s.copiado.guardarTomo(c.tenantId, dto, '2026-03');
      expect(primero.error).toBeNull();
      const snapshot = await c.tx.cotizacionItem.findUniqueOrThrow({
        where: { id: primero.cotizacionItemId! },
      });
      const contenido = structuredClone(PROPUESTA_PLANES[1].contenido);
      contenido.almacenamientoModo = 'limitado';
      contenido.almacenamientoGb = 500;
      contenido.funciones.terminaciones_copiado = false;
      const version = await runWithTenant('', () => c.publicar(contenido));
      const antes = await c.tx.cotizacionItem.count({
        where: { tenantId: c.tenantId },
      });
      const calcular = s.motor.cotizar.bind(s.motor);
      let calculados = 0;
      const intercalacion = jest
        .spyOn(s.motor, 'cotizar')
        .mockImplementation(async (...args) => {
          const resultado = await calcular(...args);
          expect(resultado.exitoso).toBe(true);
          if (++calculados === 2) await c.asignar(version.id);
          return resultado;
        });
      await expect(
        s.copiado.guardarTomo(
          c.tenantId,
          { ...dto, cotizacionId: primero.cotizacionId! },
          '2026-03',
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'terminaciones_copiado' },
      });
      intercalacion.mockRestore();
      expect(calculados).toBe(2);
      expect(
        await c.tx.cotizacionItem.count({ where: { tenantId: c.tenantId } }),
      ).toBe(antes);
      expect(
        await c.tx.cotizacionItem.findUniqueOrThrow({
          where: { id: snapshot.id },
        }),
      ).toEqual(snapshot);
    });
  });
}, 95000);

it('HTTP usa la versión asignada y exige permiso personal; un cambio se refleja en la siguiente solicitud', async () => {
  await conPlanesAsignados(db, async (c) => {
    const s = servicios(c.db);
    const modulo = await Test.createTestingModule({
      controllers: [
        ComprasController,
        CapacidadesController,
        EtaController,
        PlanesAsignacionController,
      ],
      providers: [
        Reflector,
        CapacidadGuard,
        PlataformaGuard,
        PlataformaAdminGuard,
        { provide: PrismaService, useValue: c.db },
        { provide: PlanesAsignacionService, useValue: c.asignaciones },
        { provide: CapacidadesEmpresaService, useValue: s.capacidades },
        { provide: ComprasService, useValue: s.compras },
        { provide: EtaService, useValue: s.eta },
      ],
    }).compile();
    const app = modulo.createNestApplication();
    let auth: CurrentAuth = {
      ...c.auth,
      permisos: new Set([
        'inventario.ver',
        'inventario.gestionar',
        'produccion.ver',
        'finanzas.ver_margenes',
      ]),
    };
    // La sesión autenticada del fixture sustituye sólo el transporte de login.
    app.use((req: { auth?: typeof auth }, _res: unknown, next: () => void) => {
      req.auth = auth;
      next();
    });
    app.useGlobalGuards(new PermisosGuard(new Reflector()));
    app.useGlobalInterceptors(new TenantContextInterceptor(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    try {
      await app.init();
      const http = request(app.getHttpServer() as Server);
      const asignarHttp = async (versionId: string) => {
        const empresa = auth;
        auth = c.staff;
        try {
          const d = (
            await http
              .post('/plataforma/planes-asignacion/diagnostico')
              .send({ tenantId: c.tenantId, versionId })
              .expect(201)
          ).body as Awaited<ReturnType<PlanesAsignacionService['diagnostico']>>;
          expect(d.bloqueos).toEqual([]);
          const payload = {
            tenantId: c.tenantId,
            versionId,
            operacionId: randomUUID(),
            revision: d.actual.revision,
            huella: d.huella,
            motivo: 'Recorrido por HTTP',
            revisionesAceptadas: d.revisiones,
          };
          await http
            .post('/plataforma/planes-asignacion')
            .send({ ...payload, funciones: { compras: true } })
            .expect(400);
          const primera = await http
            .post('/plataforma/planes-asignacion')
            .send(payload)
            .expect(201);
          expect(
            (
              await http
                .post('/plataforma/planes-asignacion')
                .send(payload)
                .expect(201)
            ).body,
          ).toEqual(primera.body);
        } finally {
          auth = empresa;
        }
      };

      await asignarHttp(c.versiones[0].id);
      const esencial = await http.get('/capacidades').expect(200);
      expect(esencial.headers['cache-control']).toBe('no-store');
      expect(
        (
          esencial.body as Awaited<
            ReturnType<CapacidadesController['actuales']>
          >
        ).funciones,
      ).toMatchObject({
        compras: false,
        eta_capacidad: false,
        cotizacion: true,
      });
      await http.get('/compras').expect(200);
      await http.get('/compras/catalogo').expect(403);
      await http.get('/compras/necesidades').expect(403);
      await http
        .post('/compras')
        .send({ funciones: { compras: true } })
        .expect(403);
      await http.get('/eta/contexto-prevision').expect(403);
      await asignarHttp(c.versiones[1].id);
      expect(
        (
          (await http.get('/capacidades').expect(200)).body as Awaited<
            ReturnType<CapacidadesController['actuales']>
          >
        ).funciones.compras,
      ).toBe(true);
      await http.get('/compras').expect(200);
      await http.get('/eta/contexto-prevision').expect(403);
      auth = { ...auth, permisos: new Set() };
      await http.get('/compras').expect(403);
      await http.get('/capacidades').expect(200);
      auth = {
        ...auth,
        permisos: new Set([
          'inventario.ver',
          'produccion.ver',
          'finanzas.ver_margenes',
        ]),
      };
      await asignarHttp(c.versiones[2].id);
      await http.get('/eta/contexto-prevision').expect(200);
      await asignarHttp(c.versiones[0].id);
      await http.get('/compras').expect(200);
      await http.get('/compras/catalogo').expect(403);
      await http.get('/eta/contexto-prevision').expect(403);
    } finally {
      await app.close();
    }
  });
}, 95000);

it.each(['Pro', 'Avanzado'])(
  '%s: compra → recepción parcial → recepción final → cambio a Esencial conserva stock e historial',
  async (nombre) => {
    await conPlanesAsignados(db, async (c) => {
      await c.asignar(c.versiones[nombre === 'Pro' ? 1 : 2].id);
      await runWithTenant(c.tenantId, async () => {
        const s = servicios(c.db);
        const proveedor = await c.tx.proveedor.create({
          data: {
            tenantId: c.tenantId,
            nombre: `Proveedor ${randomUUID()}`,
            emailPrincipal: '',
            telefonoCodigo: '54',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
        const almacen = await c.tx.almacenMateriaPrima.create({
          data: {
            tenantId: c.tenantId,
            codigo: randomUUID(),
            nombre: 'Almacén de prueba',
          },
        });
        const ubicacion = await c.tx.almacenMateriaPrimaUbicacion.create({
          data: {
            tenantId: c.tenantId,
            almacenId: almacen.id,
            codigo: 'PRINCIPAL',
            nombre: 'Principal',
          },
        });
        const variante = await c.tx.materiaPrimaVariante.findFirstOrThrow({
          where: { activo: true },
          include: { materiaPrima: true },
        });
        const unidad =
          variante.unidadStock ?? variante.materiaPrima.unidadStock;
        const creada = await s.compras.crear(c.auth, {
          clave: randomUUID(),
          proveedorId: proveedor.id,
          ubicacionId: ubicacion.id,
          fechaPedido: '2026-09-21',
          moneda: 'ARS',
          tipoCambio: 1,
          lineas: [
            {
              varianteId: variante.id,
              unidadCompra: unidad,
              factorStock: 1,
              cantidad: 10,
              precio: 100,
              asignaciones: [],
            },
          ],
        });
        const revisarBajada = async () => {
          const d = await c.diagnosticar(c.versiones[0].id);
          expect(d.bloqueos.some((b) => b.includes('Compras abiertas'))).toBe(
            true,
          );
          await expect(c.asignar(c.versiones[0].id)).rejects.toThrow(
            'Compras abiertas',
          );
        };
        await revisarBajada();
        const compraId = (creada as { ordenId?: unknown })?.ordenId;
        if (typeof compraId !== 'string')
          throw new Error('La compra no devolvió su identificador.');
        let compra = await s.compras.detalle(c.auth, compraId);
        await s.compras.actuar(c.auth, compra.id, {
          clave: randomUUID(),
          version: compra.version,
          accion: 'emitir',
        });
        compra = await s.compras.detalle(c.auth, compra.id);
        const parcial = {
          clave: randomUUID(),
          version: compra.version,
          ubicacionId: ubicacion.id,
          lineas: [
            { lineaId: compra.lineas[0].id, cantidad: 4, cantidadStock: 4 },
          ],
        };
        await s.compras.recibir(c.auth, compra.id, parcial);
        await s.compras.recibir(c.auth, compra.id, parcial);
        compra = await s.compras.detalle(c.auth, compra.id);
        expect(compra.estado).toBe('PARCIAL');
        await revisarBajada();
        await s.compras.recibir(c.auth, compra.id, {
          clave: randomUUID(),
          version: compra.version,
          ubicacionId: ubicacion.id,
          lineas: [
            { lineaId: compra.lineas[0].id, cantidad: 6, cantidadStock: 6 },
          ],
        });
        expect((await s.compras.detalle(c.auth, compra.id)).estado).toBe(
          'RECIBIDA',
        );
        await c.asignar(c.versiones[0].id);
        const stock = await c.tx.stockMateriaPrimaVariante.findUniqueOrThrow({
          where: {
            tenantId_varianteId_ubicacionId: {
              tenantId: c.tenantId,
              varianteId: variante.id,
              ubicacionId: ubicacion.id,
            },
          },
        });
        expect(Number(stock.cantidadDisponible)).toBe(10);
        expect((await s.compras.detalle(c.auth, compra.id)).estado).toBe(
          'RECIBIDA',
        );
        await expect(
          s.compras.crear(c.auth, {} as never),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          s.compras.recibir(c.auth, compra.id, {} as never),
        ).rejects.toMatchObject({ status: 403 });
        // Consulta histórica por HTTP, sin catálogo operativo y respetando permisos/empresa.
        let authHttp = {
          ...c.auth,
          permisos: new Set([
            'inventario.ver',
            'inventario.gestionar',
            'finanzas.ver_margenes',
          ]),
        };
        const modulo = await Test.createTestingModule({
          controllers: [ComprasController],
          providers: [
            Reflector,
            CapacidadGuard,
            { provide: ComprasService, useValue: s.compras },
            { provide: CapacidadesEmpresaService, useValue: s.capacidades },
          ],
        }).compile();
        const app = modulo.createNestApplication();
        app.use(
          (req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
            req.auth = authHttp;
            next();
          },
        );
        app.useGlobalGuards(new PermisosGuard(new Reflector()));
        app.useGlobalInterceptors(
          new TenantContextInterceptor(new Reflector()),
        );
        try {
          await app.init();
          const http = request(app.getHttpServer() as Server);
          const listado = (await http.get('/compras').expect(200)).body as {
            data: Array<{ id: string }>;
          };
          expect(listado.data.some((f) => f.id === compra.id)).toBe(true);
          const detalle = (await http.get(`/compras/${compra.id}`).expect(200))
            .body as { estado: string; recepciones: unknown[] };
          expect(detalle.estado).toBe('RECIBIDA');
          expect(detalle.recepciones).toHaveLength(2);
          for (const ruta of ['/compras/catalogo', '/compras/necesidades'])
            await http.get(ruta).expect(403);
          await http.put('/compras/ofertas').send({}).expect(403);
          for (const ruta of [
            '/compras',
            `/compras/${compra.id}/acciones`,
            `/compras/${compra.id}/recepciones`,
          ])
            await http.post(ruta).send({}).expect(403);
          authHttp = { ...authHttp, permisos: new Set(['inventario.ver']) };
          await http.get('/compras').expect(403);
          await http.get(`/compras/${compra.id}`).expect(403);
          authHttp = {
            ...authHttp,
            permisos: new Set(['finanzas.ver_margenes']),
          };
          await http.get(`/compras/${compra.id}`).expect(403);
          authHttp = {
            ...authHttp,
            tenantId: randomUUID(),
            permisos: new Set(['inventario.ver', 'finanzas.ver_margenes']),
          };
          const ajena = (await http.get('/compras').expect(200)).body as {
            data: unknown[];
          };
          expect(ajena.data).toEqual([]);
          await http.get(`/compras/${compra.id}`).expect(404);
        } finally {
          await app.close();
        }
        await c.asignar(null);
        expect((await s.capacidades.actual(c.tenantId)).contrato.origen).toBe(
          'compatibilidad',
        );
      });
    });
  },
  95000,
);
