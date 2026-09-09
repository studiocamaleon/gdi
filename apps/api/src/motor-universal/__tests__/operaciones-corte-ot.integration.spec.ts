import { MaquinariaService } from '../../maquinaria/maquinaria.service';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  inspeccionarVector,
  interpretarVector,
} from '../../productos-servicios/geometrias/interpretar-vector';
import {
  emitirCotizacionF4,
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import { escenarioHerramientas } from './fixtures/operaciones-corte';

const dxf = [
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  '0',
  'LWPOLYLINE',
  '8',
  'EXTERIOR',
  '90',
  '4',
  '70',
  '1',
  '10',
  '0',
  '20',
  '0',
  '10',
  '100',
  '20',
  '0',
  '10',
  '100',
  '20',
  '100',
  '10',
  '0',
  '20',
  '100',
  '0',
  'LINE',
  '8',
  'CORTE PARCIAL',
  '10',
  '0',
  '20',
  '20',
  '11',
  '100',
  '21',
  '20',
  '0',
  'LINE',
  '8',
  'HENDIDO',
  '10',
  '50',
  '20',
  '0',
  '11',
  '50',
  '21',
  '100',
  '0',
  'LINE',
  '8',
  'GRAFICA',
  '10',
  '5',
  '20',
  '5',
  '11',
  '95',
  '21',
  '95',
  '0',
  'ENDSEC',
  '0',
  'EOF',
].join('\n');
const comparable = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v, (_k, x) =>
      typeof x === 'number' ? Math.round(x * 1e8) / 1e8 : x,
    ),
  );
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
describe('DXF → herramientas → cotización guardada → OT (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  it.each([false, true])('calcula procesos y conserva piezas/recetas hasta la OT (colección simple: %s)', async (coleccion) => {
    const rollback = new Error('rollback mesa de corte');
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const plantillaProducto = await tx.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
          });
          const tarifa = await tx.centroCostoTarifaPeriodo.findFirstOrThrow({
            where: { tenantId, estado: 'PUBLICADA', periodo: '2026-06' },
          });
          const planta = await tx.planta.findFirstOrThrow({
            where: { tenantId },
          });
          const mp = await tx.materiaPrima.findFirstOrThrow({
            where: { tenantId, subfamilia: 'SUSTRATO_RIGIDO', activo: true },
          });
          const variante = await tx.materiaPrimaVariante.create({
            data: {
              tenantId,
              materiaPrimaId: mp.id,
              sku: 'QA-MESA-PLACA',
              nombreVariante: 'Placa 3 mm de prueba',
              precioReferencia: 1000,
              unidadStock: 'UNIDAD',
              unidadCompra: 'UNIDAD',
              atributosVarianteJson: {
                anchoMm: 1000,
                altoMm: 1000,
                largoMm: 1000,
                espesorMm: 3,
              },
            },
          });
          const fixture = escenarioHerramientas();
          const { prisma } = serviciosRecorridoF4(tx);
          const user = await tx.user.findFirstOrThrow();
          const maquinaria = new MaquinariaService(prisma as never);
          const payloadMaquina = {
            nombre: 'Mesa de aceptación',
            plantilla: 'mesa_de_corte',
            plantaId: planta.id,
            centroCostoPrincipalId: tarifa.centroCostoId,
            estado: 'activa',
            estadoConfiguracion: 'lista',
            activo: true,
            geometriaTrabajo: 'plano',
            unidadProduccionPrincipal: 'm2',
            anchoUtil: 1000,
            largoUtil: 1000,
            espesorMaximo: 10,
            parametrosTecnicos: { procesamientoCorte: fixture.configuracion },
            perfilesOperativos: fixture.perfiles.map((p) => ({
              nombre: p.nombre,
              tipoPerfil: 'corte',
              activo: true,
              productivityValue: p.productivityValue,
              productivityUnit: 'm_min',
              detalle: { ...p.detalleJson, material: [mp.id] },
            })),
            consumibles: [],
            componentesDesgaste: [],
          };
          const actor = {
            tenantId,
            userId: user.id,
            email: user.email,
          } as never;
          const maquina = await maquinaria.create(
            actor,
            payloadMaquina as never,
          );
          expect(maquina.estadoConfiguracion).toBe('lista');
          expect(maquina.parametrosTecnicos?.procesamientoCorte).toEqual(
            json(fixture.configuracion),
          );
          // Se guarda otra vez la misma ficha con los IDs de perfiles persistidos.
          await maquinaria.update(actor, maquina.id, {
            ...payloadMaquina,
            perfilesOperativos: maquina.perfilesOperativos,
          } as never);
          const producto = await tx.producto.create({
            data: {
              tenantId,
              codigo: 'QA-MESA-DXF',
              nombre: 'Exhibidor de aceptación',
              subcategoriaComercialId:
                plantillaProducto.subcategoriaComercialId,
              dimensionesRequeridas: [],
              modoMedidas: 'FIJA',
              precioConfigJson: {
                metodoCalculo: 'por_margen',
                detalle: { marginPct: 25 },
              },
            },
          });
          const archivo = await tx.archivo.create({
            data: {
              tenantId,
              productoId: producto.id,
              scope: 'PRODUCTO',
              key: `qa/${randomUUID()}.dxf`,
              nombreOriginal: 'exhibidor.dxf',
              mimeType: 'application/dxf',
              estado: 'LISTO',
            },
          });
          const inspeccion = inspeccionarVector(dxf, 'exhibidor.dxf');
          const seleccion = {
            exteriorId: inspeccion.entidades.find((e) => e.capa === 'EXTERIOR')!
              .id,
            unidad: 'mm',
            cerrarExterior: false,
            operaciones: inspeccion.entidades
              .filter((e) => ['CORTE PARCIAL', 'HENDIDO'].includes(e.capa))
              .map((e) => ({
                entidadId: e.id,
                tipo:
                  e.capa === 'HENDIDO'
                    ? ('HENDIDO' as const)
                    : ('CORTE_PARCIAL' as const),
              })),
          };
          const geometriaId = randomUUID(),
            hash = createHash('sha256').update(dxf).digest('hex');
          const fuente = interpretarVector(inspeccion, seleccion, {
            geometriaId,
            archivoId: archivo.id,
            hash,
            nombreArchivo: 'exhibidor.dxf',
          });
          await tx.geometriaProducto.create({
            data: {
              id: geometriaId,
              tenantId,
              productoId: producto.id,
              archivoId: archivo.id,
              hash,
              interpretacionJson: json(seleccion),
              fuenteJson: json(fuente),
            },
          });
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><path d="M0 0H80V40H0Z"/></svg>';
          const hashSvg = createHash('sha256').update(svg).digest('hex');
          const archivoSvg = coleccion ? await tx.archivo.create({ data: {
            tenantId, productoId: producto.id, scope: 'PRODUCTO', key: `qa/${randomUUID()}.svg`,
            nombreOriginal: 'soporte.svg', mimeType: 'image/svg+xml', estado: 'LISTO',
          } }) : null;
          let fuenteSvg: typeof fuente | undefined;
          if (archivoSvg) {
            const inspeccionSvg = inspeccionarVector(svg, 'soporte.svg');
            const seleccionSvg = { exteriorId: inspeccionSvg.sugeridaId, unidad: 'mm', cerrarExterior: false, operaciones: [] };
            fuenteSvg = interpretarVector(inspeccionSvg, seleccionSvg, {
              geometriaId: randomUUID(), archivoId: archivoSvg.id, hash: hashSvg, nombreArchivo: 'soporte.svg',
            });
            await tx.geometriaProducto.create({ data: {
              id: fuenteSvg.procedencia.geometriaId, tenantId, productoId: producto.id,
              archivoId: archivoSvg.id, hash: hashSvg, interpretacionJson: json(seleccionSvg), fuenteJson: json(fuenteSvg),
            } });
          }
          await tx.producto.update({
            where: { id: producto.id },
            data: {
              atributosComercialesJson: json({
                geometriasComerciales: {
                  version: 1,
                  modo: 'VECTORIAL',
                  fuentes: [
                    {
                      id: 'principal',
                      nombre: 'Exhibidor',
                      requerida: true,
                      predeterminada: fuente,
                    },
                  ],
                },
              }),
            },
          });
          const ruta = await tx.ruta.create({
            data: { tenantId, codigo: 'QA-MESA', nombre: 'Cortar exhibidor' },
          });
          const paso = await tx.rutaPaso.create({
            data: {
              tenantId,
              rutaId: ruta.id,
              orden: 0,
              familiaCodigo: 'troquelado_digital',
              nombreVisible: 'Corte y hendido',
            },
          });
          await tx.rutaVersion.create({
            data: {
              tenantId,
              rutaId: ruta.id,
              version: 1,
              snapshotJson: json({ pasos: [paso] }),
            },
          });
          const alternativa = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: producto.id,
              rutaId: ruta.id,
              rutaVersion: 1,
              nombre: ruta.nombre,
              esPreferida: true,
            },
          });
          const config = await tx.productoConfigPaso.create({
            data: {
              tenantId,
              productoRutaAlternativaId: alternativa.id,
              rutaPasoId: paso.id,
              modoActivacion: 'OBLIGATORIO',
              modoTiempo: 'T-3',
              mecanismoCantidad: 'CALCULADO_POR_PASO',
              maquinaM1Id: maquina.id,
              paramsPasoJson: {
                cotizarOperacionesVectoriales: true,
                usarDisenoVectorial: true,
                permitirIngresoPorMedidas: false,
              },
            },
          });
          await tx.productoConfigPasoSlotMaterial.create({
            data: {
              tenantId,
              productoConfigPasoId: config.id,
              slotCodigo: 'sustrato',
              modoSeleccion: 'HARDCODED',
              materialVarianteId: variante.id,
              formula: 'por_unidad_productiva',
            },
          });
          const motor = new MotorUniversalService(
            prisma as never,
            new AplicarPrecioService(),
            new PreciosEspecialesClientesService(prisma as never),
          );
          const guardada = await motor.cotizarYGuardar({
            tenantId,
            productoId: producto.id,
            periodo: '2026-06',
            jobContext: { cantidad: 10, ...(fuenteSvg ? { disenosVectoriales: [
              { id: 'principal', nombre: 'Exhibidor', cantidadPorUnidad: 1, fuente: comparable(fuente) },
              { id: 'soporte', nombre: 'Soporte', cantidadPorUnidad: 2, fuente: comparable(fuenteSvg) },
            ] } : {}) },
          });
          expect(guardada.result.errores).toEqual([]);
          expect(guardada.result.exitoso).toBe(true);
          const costeado = guardada.result.cotizacion!.pasos[0],
            trace = costeado.tiempo!.procesamientoCorte!;
          expect(trace.operaciones.map((o) => o.operacion)).toEqual([
            'HENDIDO',
            'CORTE_PARCIAL',
            'CORTE_COMPLETO',
          ]);
          expect(
            trace.operaciones.find((o) => o.operacion === 'CORTE_COMPLETO')!
              .metros,
          ).toBeCloseTo(coleccion ? 8.8 : 4);
          expect(
            trace.operaciones.find((o) => o.operacion === 'CORTE_PARCIAL')!
              .metros,
          ).toBeCloseTo(1);
          expect(
            trace.operaciones.find((o) => o.operacion === 'HENDIDO')!.metros,
          ).toBeCloseTo(1);
          expect(
            trace.operaciones
              .flatMap((o) => o.fuentes)
              .every((f) => f.archivoHash === hash || (coleccion && f.archivoHash === hashSvg)),
          ).toBe(true);
          const persistida = await tx.cotizacionItem.findUniqueOrThrow({
            where: { id: guardada.cotizacionItemId! },
          });
          if (coleccion) {
            expect(costeado.nestingResult?.piezasAcomodadas).toBe(30);
            expect(new Set(costeado.nestingResult?.placements.map(p => p.pieceId)).size).toBe(2);
            expect(comparable(persistida.jobContextJson).disenosVectoriales.map((p: { cantidadPorUnidad: number }) => p.cantidadPorUnidad)).toEqual([1, 2]);
          }
          expect(
            comparable(persistida.trazabilidadJson).pasos[0].tiempo
              .procesamientoCorte,
          ).toEqual(comparable(trace));
          await tx.maquinaPerfilOperativo.updateMany({
            where: { maquinaId: maquina.id },
            data: { productivityValue: 999 },
          });
          const { orden, ordenes, auth } = await emitirCotizacionF4(
            tx,
            guardada,
          );
          const nodo = await tx.ordenTrabajoItemPaso.findFirstOrThrow({
            where: { ordenId: orden.id },
          });
          expect(Number(nodo.duracionEstimadaMin)).toBe(
            costeado.tiempo!.totalMin,
          );
          expect(nodo.maquinaId).toBe(maquina.id);
          const { orden: terminada } = await ejecutarOrdenF4(
            tx,
            ordenes,
            auth,
            orden.id,
          );
          expect(terminada.estado).toBe('finalizada');
          expect(
            (
              await tx.cotizacionItem.findUniqueOrThrow({
                where: { id: persistida.id },
              })
            ).trazabilidadJson,
          ).toEqual(persistida.trazabilidadJson);
          throw rollback;
        },
        { timeout: 30000 },
      ),
    ).rejects.toBe(rollback);
  }, 45000);
});
