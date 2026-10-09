import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RentabilidadService } from '../rentabilidad.service';
import { VentasService } from '../ventas.service';
import { ProductoService } from '../producto.service';
import { ClientesService } from '../clientes.service';
import { EquipoService } from '../equipo.service';
import { EmbudoService } from '../embudo.service';
import { finExclusivo } from '../periodo';

/** PostgreSQL local de tests; datos ficticios dentro de una transacción revertida. */
describe('referencia con IVA, sin cargos extra', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  const fecha = new Date('2098-11-14T12:00:00Z');
  const rango = {
    desde: new Date('2098-11-14'),
    hasta: new Date('2098-11-14'),
    zona: 'UTC',
  };
  const anterior = {
    ...rango,
    desde: new Date('2098-11-13'),
    hasta: new Date('2098-11-13'),
  };

  it('conserva netos y márgenes, usa los totales guardados y respeta los filtros en todas las vistas', async () => {
    const rollback = new Error('revertir muestra IVA');
    const slug = `test-referencia-iva-${randomUUID()}`;
    await expect(
      db.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.create({
            data: { nombre: 'Empresa ficticia IVA', slug },
          });
          const tenantId = tenant.id;
          const otra = await tx.tenant.create({
            data: { nombre: 'Otra empresa ficticia', slug: `${slug}-otra` },
          });
          const cliente = await tx.cliente.create({
            data: {
              tenantId,
              nombre: 'Cliente de prueba IVA',
              telefonoCodigo: '54',
              telefonoNumero: '',
              paisCodigo: 'AR',
            },
          });
          const categoria = await tx.productoCategoriaComercial.create({
            data: { codigo: slug, nombre: 'Categoría de prueba' },
          });
          const subcategoria = await tx.productoSubcategoriaComercial.create({
            data: {
              categoriaId: categoria.id,
              codigo: slug,
              nombre: 'Subcategoría de prueba',
              atributosSchemaJson: {},
            },
          });
          const producto = await tx.producto.create({
            data: {
              tenantId,
              subcategoriaComercialId: subcategoria.id,
              codigo: 'PRODUCTO-IVA',
              nombre: 'Producto de prueba',
            },
          });
          const cargos = [
            {
              nombre: 'Cargo extra de prueba',
              montoNeto: 1000,
              impuestoMonto: 210,
              total: 1210,
            },
          ];
          const importes = [
            { subtotal: 100.03, impuestos: 21.01, total: 121.04 },
            { subtotal: 200.1, impuestos: 21.01, total: 221.11 },
            { subtotal: 300.2, impuestos: 0, total: 300.2 },
            // El snapshot conserva IVA, pero la OT sin comprobante no lo cobra.
            { subtotal: 50.3, impuestos: 10.56, total: 60.86 },
          ];
          for (const [i, importesItem] of importes.entries()) {
            const sinComprobante = i === 3;
            const cotizacion = await tx.cotizacion.create({
              data: {
                tenantId,
                numero: `PRES-IVA-${i}`,
                estado: 'convertido',
                fechaEnvio: fecha,
                ...importesItem,
                total: importesItem.total + 1210,
                cargosDirectosCotizacionJson: cargos,
              },
            });
            const ci = await tx.cotizacionItem.create({
              data: {
                tenantId,
                cotizacionId: cotizacion.id,
                productoId: producto.id,
                cantidad: 1,
                jobContextJson: {},
                snapshotJson: {},
                costoTotal: 50,
                trazabilidadJson: {
                  pasos: [
                    {
                      activado: true,
                      materiales: [
                        { tipoLineaCosto: 'MATERIAL', costoTotal: 20 },
                      ],
                    },
                  ],
                },
              },
            });
            const ot = await tx.ordenTrabajo.create({
              data: {
                tenantId,
                clienteId: cliente.id,
                cotizacionId: cotizacion.id,
                numero: `OT-IVA-${i}`,
                estado: 'produccion',
                fechaEmision: fecha,
                tratamientoFiscal: sinComprobante
                  ? 'SIN_COMPROBANTE'
                  : 'FISCAL',
                subtotal: importesItem.subtotal,
                impuestos: sinComprobante ? 0 : importesItem.impuestos,
                cargosDirectos: 1210,
                cargosDirectosJson: cargos,
                total:
                  (sinComprobante
                    ? importesItem.subtotal
                    : importesItem.total) + 1210,
              },
            });
            await tx.cotizacion.update({
              where: { id: cotizacion.id },
              data: { convertidaOrdenId: ot.id },
            });
            const item = await tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: ot.id,
                cotizacionItemId: ci.id,
                codigo: 'ITEM',
                nombre: producto.nombre,
                familia: 'Producto',
                categoriaComercial: 'Categoría de prueba',
                cantidad: 1,
                cantidadUnidad: 'unidad',
                ...importesItem,
                descuentoMonto: 7, // Ya aplicado al subtotal; no volver a descontarlo.
                adicionalesJson: i === 0 ? ['Terminación de prueba'] : [],
              },
            });
            await tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: ot.id,
                parentItemId: item.id,
                codigo: 'INTERNO',
                nombre: 'Componente interno',
                familia: 'Componente',
                cantidad: 1,
                cantidadUnidad: 'unidad',
                subtotal: 9000,
                impuestos: 1890,
                total: 10890,
              },
            });
          }
          const ruido: Array<Prisma.OrdenTrabajoUncheckedCreateInput> = [
            {
              tenantId,
              numero: 'BORRADOR',
              estado: 'borrador',
              fechaEmision: fecha,
            },
            {
              tenantId,
              numero: 'CANCELADA',
              estado: 'cancelada',
              fechaEmision: fecha,
            },
            {
              tenantId,
              numero: 'FUERA',
              estado: 'produccion',
              fechaEmision: new Date('2098-11-15T12:00:00Z'),
            },
            {
              tenantId: otra.id,
              numero: 'OTRA-EMPRESA',
              estado: 'produccion',
              fechaEmision: fecha,
            },
          ];
          for (const data of ruido) {
            const ot = await tx.ordenTrabajo.create({ data });
            await tx.ordenTrabajoItem.create({
              data: {
                tenantId: data.tenantId,
                ordenId: ot.id,
                codigo: 'RUIDO',
                nombre: 'Fuera del informe',
                familia: 'Producto',
                cantidad: 1,
                cantidadUnidad: 'unidad',
                subtotal: 9000,
                impuestos: 1890,
                total: 10890,
              },
            });
          }
          const neto = 650.63;
          const bruto = 692.65;
          const renta = await new RentabilidadService(tx as never).periodo(
            tenantId,
            rango,
          );
          expect(renta).toMatchObject({
            ventas: neto,
            ventasConIva: bruto,
            costoTotal: 200,
            margenBruto: 450.63,
            costosVariables: 80,
            contribucion: 570.63,
            itemsSinCosto: 0,
          });
          const comercial = await new VentasService(tx as never).comercial(
            tenantId,
            rango,
            anterior,
            fecha,
          );
          expect(comercial.kpis).toMatchObject({
            ventas: neto,
            ventasConIva: bruto,
            ordenes: 4,
            ticketPromedio: 162.66,
            ticketPromedioConIva: 173.16,
          });
          expect(comercial.serie).toEqual([
            expect.objectContaining({ monto: neto, montoConIva: bruto }),
          ]);
          expect(comercial.serieTicket).toEqual([
            expect.objectContaining({
              ticketPromedioConIva: 173.16,
              ticketMedianaConIva: 171.08,
            }),
          ]);
          for (const ranking of [
            comercial.rankingClientes,
            comercial.rankingVendedores,
          ]) {
            expect(ranking).toEqual([
              expect.objectContaining({
                facturado: neto,
                facturadoConIva: bruto,
              }),
            ]);
          }
          for (const mix of [comercial.mixCategoria, comercial.mixTecnologia]) {
            expect(mix).toEqual([
              expect.objectContaining({
                monto: neto,
                montoConIva: bruto,
                pct: 100,
              }),
            ]);
          }
          expect(comercial.estacionalidad).toEqual([
            expect.objectContaining({ monto: neto, montoConIva: bruto }),
          ]);
          const productos = await new ProductoService(tx as never).producto(
            tenantId,
            rango,
          );
          for (const filas of [productos.porCategoria, productos.porProducto]) {
            expect(filas).toEqual([
              expect.objectContaining({
                ventas: neto,
                ventasConIva: bruto,
                costo: 200,
                margen: 450.63,
              }),
            ]);
          }
          expect(productos.mixEvolutivo).toEqual([
            expect.objectContaining({ monto: neto, montoConIva: bruto }),
          ]);
          expect(productos.porTecnologia).toEqual([
            expect.objectContaining({ monto: neto, montoConIva: bruto }),
          ]);
          expect(productos.adicionales).toMatchObject({
            ticketItemCon: 100.03,
            ticketItemConConIva: 121.04,
            ticketItemSinConIva: 190.54,
          });
          expect(productos.adicionales.porAdicional).toEqual([
            expect.objectContaining({ ventas: 100.03, ventasConIva: 121.04 }),
          ]);
          const clientes = await new ClientesService(
            tx as never,
            { getUmbrales: () => Promise.resolve({ diasClienteDormido: 60 }) } as never,
          ).clientes(tenantId, rango, anterior, fecha);
          expect(clientes.pareto).toEqual([
            expect.objectContaining({
              facturado: neto,
              facturadoConIva: bruto,
              pct: 100,
            }),
          ]);
          expect(clientes.margenClientes).toEqual([
            expect.objectContaining({
              ventas: neto,
              ventasConIva: bruto,
              margen: 450.63,
            }),
          ]);
          expect(clientes.serieNuevosRecurrentes).toEqual([
            expect.objectContaining({
              nuevos: neto,
              nuevosConIva: bruto,
              recurrentesConIva: 0,
            }),
          ]);
          expect(
            clientes.rfm.segmentos.reduce((s, c) => s + c.facturadoConIva, 0),
          ).toBe(bruto);
          const equipo = new EquipoService(tx as never) as unknown as {
            vendedores: (
              tenant: string,
              desde: Date,
              hasta: Date,
              comisiones: boolean,
            ) => Promise<unknown>;
          };
          expect(
            await equipo.vendedores(
              tenantId,
              rango.desde,
              finExclusivo(rango),
              false,
            ),
          ).toEqual([
            expect.objectContaining({
              facturado: neto,
              facturadoConIva: bruto,
              ticketPromedioConIva: 173.16,
              margen: 450.63,
            }),
          ]);
          // En el embudo se conservan las bases de cada etapa (presupuesto / OT).
          await tx.cotizacion.create({
            data: {
              tenantId,
              numero: 'PRES-ABIERTO',
              estado: 'enviado',
              fechaEnvio: fecha,
              subtotal: 80,
              impuestos: 8.4,
              cargosDirectosCotizacionJson: [{ montoNeto: 5000, total: 5000 }],
              total: 5088.4,
            },
          });
          const embudo = await new EmbudoService(tx as never).embudo(
            tenantId,
            rango,
            anterior,
          );
          expect(embudo.kpis).toMatchObject({
            pipelineAbiertoMonto: 80,
            pipelineAbiertoMontoConIva: 88.4,
          });
          expect(
            embudo.funnel.find((e) => e.clave === 'emitidas'),
          ).toMatchObject({ monto: 730.63, montoConIva: 791.61 });
          expect(
            embudo.funnel.find((e) => e.clave === 'produccion'),
          ).toMatchObject({ monto: neto, montoConIva: bruto });
          expect(embudo.fugas).toEqual([
            expect.objectContaining({ monto: 80, montoConIva: 88.4 }),
          ]);
          throw rollback;
        },
        { timeout: 25000 },
      ),
    ).rejects.toBe(rollback);
    expect(await db.tenant.count({ where: { slug } })).toBe(0);
  }, 30000);
});
