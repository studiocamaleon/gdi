import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ComprobantesService } from '../comprobantes.service';
import { FacturaService } from '../factura.service';
import { FacturaPdfService } from '../factura-pdf.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('facturación de raíces comerciales de F4 (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('conserva descuento, producto gratuito, total y parcial al preparar factura individual o general', async () => {
    const rollback = new Error('rollback factura F4');
    await expect(
      db.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.create({
            data: {
              slug: 'prueba-f4-factura-componentes',
              nombre: 'Prueba F4',
            },
          });
          const tenantId = tenant.id;
          const fiscal = await tx.configuracionFiscal.create({
            data: {
              tenantId,
              razonSocial: 'Prueba F4',
              cuit: '30712345671',
              condicionFiscal: 'RI',
            },
          });
          const pv = await tx.puntoVenta.create({
            data: {
              tenantId,
              configuracionFiscalId: fiscal.id,
              numero: 1,
              nombre: 'Prueba',
            },
          });
          const auth = { tenantId, permisos: new Set() } as CurrentAuth;
          const orden = await tx.ordenTrabajo.create({
            data: {
              tenantId,
              numero: 'OT-PRUEBA-F4-FACTURA',
              estado: 'finalizada',
              subtotal: 80,
              impuestos: 16.8,
              total: 96.8,
              descuentoTotal: 20,
            },
          });
          const raiz = await tx.ordenTrabajoItem.create({
            data: {
              tenantId,
              ordenId: orden.id,
              codigo: 'KIT',
              nombre: 'Kit con descuento',
              familia: 'Kit',
              cantidad: 1,
              cantidadUnidad: 'unidad',
              subtotal: 80,
              impuestos: 16.8,
              total: 96.8,
              descuentoMonto: 20,
            },
          });
          await tx.ordenTrabajoItem.create({
            data: {
              tenantId,
              ordenId: orden.id,
              codigo: 'GRATIS',
              nombre: 'Producto gratuito',
              familia: 'Otro',
              cantidad: 1,
              cantidadUnidad: 'unidad',
              subtotal: 0,
              impuestos: 0,
              total: 0,
            },
          });
          for (let i = 0; i < 6; i++)
            await tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: orden.id,
                parentItemId: raiz.id,
                codigo: `interno-${i}`,
                nombre: 'Interno no facturable',
                familia: 'Componente',
                cantidad: 3,
                cantidadUnidad: 'unidad',
                subtotal: 0,
                impuestos: 0,
                total: 0,
              },
            });
          const service = Object.create(
            ComprobantesService.prototype,
          ) as ComprobantesService;
          const emitir = jest.fn();
          Object.assign(service, {
            prisma: tx,
            afipIntegracion: { facturacionHabilitada: async () => true },
            emitir,
          });
          const factura = await service.facturarOrden(auth, orden.id, {
            emitir: false,
            puntoVentaId: pv.id,
          });
          expect(factura.total).toBe(96.8);
          expect(factura.estado).toBe('borrador');
          expect(factura.items).toEqual([
            expect.objectContaining({
              descripcion: 'Kit con descuento',
              bonificacionPct: 20,
            }),
            expect.objectContaining({
              descripcion: 'Producto gratuito',
              precioUnitarioSinIva: 0,
            }),
          ]);
          const parcial = await service.facturarOrden(auth, orden.id, {
            emitir: false,
            puntoVentaId: pv.id,
            monto: 40,
          });
          expect(parcial.total).toBe(40);
          expect(parcial.items).toHaveLength(1);
          const general = await service.crear(auth, {
            tipo: 'factura',
            puntoVentaId: pv.id,
            ordenId: orden.id,
            items: [],
          });
          expect(general.total).toBe(96.8);
          expect(general.items).toHaveLength(2);
          const facturas = new FacturaService(
            tx as never,
            { paraDocumentos: async () => ({ nombre: 'Prueba F4' }) } as never,
          );
          const documento = await facturas.documento(tenantId, factura.id);
          expect(documento.items).toHaveLength(2);
          expect(documento.total).toBe(96.8);
          expect(JSON.stringify(documento)).not.toContain(
            'Interno no facturable',
          );
          const pdf = await new FacturaPdfService().generar(documento, null);
          expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
          // La factura emitida es una fixture local: el proveedor fiscal no
          // participa. Verificamos el borrador de NC que corrige sus importes.
          await tx.comprobante.update({
            where: { id: factura.id },
            data: { estado: 'emitido', numero: 1 },
          });
          const nc = await service.notaCreditoDeOrden(auth, orden.id, {
            comprobanteOrigenId: factura.id,
            motivo: 'Aceptación de componente compuesto',
            emitir: false,
          });
          expect(nc.estado).toBe('borrador');
          expect(nc.total).toBe(96.8);
          expect(nc.items).toHaveLength(1);
          const documentoNc = await facturas.documento(tenantId, nc.id);
          expect(documentoNc.total).toBe(96.8);
          expect(JSON.stringify(documentoNc)).not.toContain(
            'Interno no facturable',
          );
          const pdfNc = await new FacturaPdfService().generar(
            documentoNc,
            null,
          );
          expect(pdfNc.subarray(0, 4).toString()).toBe('%PDF');
          if (process.env.F4_ARTEFACTOS_DIR) {
            mkdirSync(process.env.F4_ARTEFACTOS_DIR, { recursive: true });
            writeFileSync(
              join(
                process.env.F4_ARTEFACTOS_DIR,
                'factura-compuesto-borrador.pdf',
              ),
              pdf,
            );
            writeFileSync(
              join(
                process.env.F4_ARTEFACTOS_DIR,
                'nota-credito-compuesto-borrador.pdf',
              ),
              pdfNc,
            );
          }
          await tx.comprobante.update({
            where: { id: nc.id },
            data: { estado: 'emitido', numero: 1 },
          });
          await expect(
            service.notaCreditoDeOrden(auth, orden.id, {
              comprobanteOrigenId: factura.id,
              motivo: 'Duplicado que debe rechazarse',
              emitir: false,
            }),
          ).rejects.toThrow(/acreditada por completo/);

          expect(emitir).not.toHaveBeenCalled();
          expect(
            Number(
              (
                await tx.ordenTrabajo.findUniqueOrThrow({
                  where: { id: orden.id },
                })
              ).facturadoTotal,
            ),
          ).toBe(0);
          throw rollback;
        },
        { timeout: 25_000 },
      ),
    ).rejects.toBe(rollback);
    expect(
      await db.tenant.count({
        where: { slug: 'prueba-f4-factura-componentes' },
      }),
    ).toBe(0);
  });
});
