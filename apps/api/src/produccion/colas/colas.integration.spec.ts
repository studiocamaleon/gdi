import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ColasProduccionService } from './colas.service';
import { ConsultaColaDto } from './consulta-cola.dto';
import { leerConfiguracionesCola } from './configuracion-cola';

const db = new PrismaService(),
  service = new ColasProduccionService(db);
const tenantId = randomUUID(),
  otro = randomUUID(),
  maquinaId = randomUUID(),
  segunda = randomUUID();
const ordenId = randomUUID(),
  itemId = randomUUID(),
  pasoId = randomUUID(),
  compartidoId = randomUUID();
const categoriaId = randomUUID(),
  subcategoriaId = randomUUID();
beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otro].map((id) => ({
      id,
      nombre: 'QA colas',
      slug: `qa-colas-${id}`,
    })),
  });
  const planta = await db.planta.create({
    data: { tenantId, nombre: 'Planta', codigo: 'P1' },
  });
  const estacion = await db.estacion.create({
    data: { tenantId, nombre: 'Impresión', activo: true },
  });
  await db.maquina.createMany({
    data: [maquinaId, segunda].map((id, i) => ({
      id,
      tenantId,
      plantaId: planta.id,
      estacionId: estacion.id,
      codigo: `UV${i}`,
      nombre: 'Impresora UV',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      geometriaTrabajo: 'ROLLO',
      unidadProduccionPrincipal: 'M2',
    })),
  });
  await db.ordenTrabajo.create({
    data: {
      id: ordenId,
      tenantId,
      numero: 'OT-COLAS',
      estado: 'produccion',
      fechaEntrega: new Date('2026-09-20'),
    },
  });
  const nesting = {
    visualConfig: { panelizado: { enabled: true, panelCount: 2 } },
    modoColor: 'CMYK',
    sustrato: { materialVarianteId: 'vinilo', nombre: 'Vinilo blanco' },
    substrates: [{ kind: 'roll', widthMm: 1050, lengthMm: 4000 }],
    placements: Array.from({ length: 1500 }, (_, xMm) => ({
      pieceId: 'ejemplo',
      xMm,
      yMm: 1,
      widthMm: 1170,
      heightMm: 1600,
      panelIndex: (xMm % 2) + 1,
      panelCount: 2,
      contornos: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    })),
  };
  await db.ordenTrabajoItem.create({
    data: {
      id: itemId,
      tenantId,
      ordenId,
      codigo: 'I',
      nombre: 'Cartelería',
      familia: 'grafica',
      cantidad: 1,
      cantidadUnidad: 'u',
      subtotal: 123456,
      impuestos: 0,
      total: 123456,
      jobContextSnapshotJson: { modoColor: 'BN' },
      trazabilidadSnapshotJson: {
        pasos: [
          {
            rutaPasoId: 'ruta-print',
            configPasoId: 'config',
            familiaCodigo: 'impresion_por_area',
            nestingResult: nesting,
          },
          {
            rutaPasoId: 'ruta-comun',
            configPasoId: 'otra-config',
            familiaCodigo: 'impresion_por_area',
            nestingResult: nesting,
          },
        ],
      },
    },
  });
  await db.ordenTrabajoItemPaso.create({
    data: {
      id: pasoId,
      tenantId,
      ordenId,
      itemId,
      maquinaId,
      indice: 0,
      nodoClave: 'print',
      rutaPasoId: 'ruta-print',
      nombre: 'Impresión CMYK',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      duracionEstimadaMin: 15,
      modoRegistro: 'solo_completar',
    },
  });
  await db.ordenTrabajoItemPaso.create({
    data: {
      id: compartidoId,
      tenantId,
      ordenId,
      itemId,
      maquinaId,
      indice: 1,
      nodoClave: 'comun',
      rutaPasoId: 'ruta-comun',
      nombre: 'Impresión compartida',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      nestingLoteRol: 'OPERATIVO',
      nestingLoteId: 'lote',
      nestingLoteSnapshotJson: {
        materialVarianteId: 'vinilo-1370',
        materialNombre: 'Vinilo blanco 1,37',
        nestingResult: {
          modoColor: 'CMYK+blanco',
          visualConfig: { panelizado: { enabled: true, panelCount: 2 } },
          substrates: [{ kind: 'roll', widthMm: 1370, lengthMm: 3500 }],
          placements: nesting.placements.map((p) => ({ ...p, widthMm: 1190 })),
        },
      },
    },
  });
  await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId,
      itemId,
      maquinaId,
      indice: 2,
      nodoClave: 'alias',
      nombre: 'Alias',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
      nestingLoteRol: 'PARTICIPANTE',
      nestingLoteId: 'lote',
    },
  });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otro] } } });
  await db.productoSubcategoriaComercial.deleteMany({
    where: { id: subcategoriaId },
  });
  await db.productoCategoriaComercial.deleteMany({
    where: { id: categoriaId },
  });
  await db.$disconnect();
});

it('separa máquinas del mismo nombre, excluye aliases y pagina sólo trabajos reales', async () => {
  const resumen = await service.maquinas(tenantId);
  expect(resumen.maquinas.find((m) => m.id === maquinaId)?.pendientes).toBe(2);
  expect(resumen.maquinas.find((m) => m.id === segunda)).toBeUndefined();
  const r = await service.listar(tenantId, maquinaId, {
    ...new ConsultaColaDto(),
    limit: 1,
  });
  expect(r.total).toBe(2);
  expect(r.items).toHaveLength(1);
  expect(r.pages).toBe(2);
  expect(r.totales.listos).toBe(2);
  expect(JSON.stringify(r)).not.toMatch(
    /placements|contornos|123456|precioUnitario/,
  );
  expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(10_000);
});

it('lee metadatos de snapshots comprimidos, conservando el formato y color efectivos', async () => {
  const meta = await leerConfiguracionesCola(db, tenantId, [
    pasoId,
    compartidoId,
  ]);
  expect(meta.get(pasoId)).toMatchObject({
    panelesPorPiezaMax: 2,
    modoColor: 'CMYK',
    formatos: [{ anchoMm: 1050 }],
    paneles: [1, 2].map((panel) => ({
      panel,
      paneles: 2,
      anchoMm: 1170,
      altoMm: 1600,
      cantidad: 750,
    })),
  });
  expect(meta.get(compartidoId)).toMatchObject({
    modoColor: 'CMYK + blanco',
    formatos: [{ anchoMm: 1370 }],
    formatosCotizados: [{ anchoMm: 1050 }],
    formatoModificado: true,
    ejecucionCompartida: true,
    paneles: [1, 2].map((panel) => ({
      panel,
      paneles: 2,
      anchoMm: 1190,
      altoMm: 1600,
      cantidad: 750,
    })),
  });
});

it('actualiza esperas por dependencias y gates sin modificar ningún estado al leer', async () => {
  const gate = await db.ordenTrabajoPasoGate.create({
    data: { tenantId, ordenId, pasoId, tipo: 'MATERIAL' },
  });
  await db.ordenTrabajoPasoDependencia.create({
    data: {
      tenantId,
      ordenId,
      predecesorPasoId: pasoId,
      sucesorPasoId: compartidoId,
    },
  });
  const r = await service.listar(tenantId, maquinaId, {
    ...new ConsultaColaDto(),
    estado: 'listos',
  });
  expect(r.items).toEqual([]);
  expect(r.totales.en_espera).toBe(2);
  await db.ordenTrabajoPasoGate.update({
    where: { id: gate.id },
    data: { estado: 'CUMPLIDO' },
  });
  const siguiente = await service.listar(
    tenantId,
    maquinaId,
    new ConsultaColaDto(),
  );
  expect(siguiente.totales.listos).toBe(1);
  expect(
    (await db.ordenTrabajoItemPaso.findUniqueOrThrow({ where: { id: pasoId } }))
      .estado,
  ).toBe('pendiente');
});

it('no permite consultar una máquina ni metadatos de otro tenant', async () => {
  await expect(
    service.listar(otro, maquinaId, new ConsultaColaDto()),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect((await leerConfiguracionesCola(db, otro, [pasoId])).size).toBe(0);
  expect((await service.maquinas(otro)).maquinas).toEqual([]);
});

it('recupera componentes históricos por su camino exacto, sin confundir hermanos ni reemplazar un snapshot propio', async () => {
  await db.productoCategoriaComercial.create({
    data: { id: categoriaId, codigo: categoriaId, nombre: 'QA colas' },
  });
  await db.productoSubcategoriaComercial.create({
    data: {
      id: subcategoriaId,
      categoriaId,
      codigo: subcategoriaId,
      nombre: 'QA',
      atributosSchemaJson: {},
    },
  });
  const producto = await db.producto.create({
    data: {
      tenantId,
      subcategoriaComercialId: subcategoriaId,
      codigo: 'QA-COLA',
      nombre: 'Cartel compuesto',
    },
  });
  const cotizacion = await db.cotizacion.create({ data: { tenantId } });
  const traza = (nombre: string, ancho: number) => ({
    pasos: [
      {
        rutaPasoId: 'ruta-reutilizada',
        familiaCodigo: 'impresion_por_area',
        nestingResult: {
          modoColor: 'CMYK',
          sustrato: { materialVarianteId: nombre, nombre },
          substrates: [{ kind: 'roll', widthMm: ancho }],
        },
      },
    ],
  });
  const cotizado = await db.cotizacionItem.create({
    data: {
      tenantId,
      cotizacionId: cotizacion.id,
      productoId: producto.id,
      cantidad: 1,
      snapshotJson: {},
      jobContextJson: {},
      trazabilidadJson: {
        componentesFabricados: [
          { codigo: 'OTRA', ...traza('Vinilo', 1050) },
          { codigo: 'LONA', ...traza('Lona Backlight', 1370) },
          {
            codigo: 'KIT',
            componentes: [{ codigo: 'LONA', ...traza('Lona anidada', 1600) }],
          },
        ],
      },
    },
  });
  const base = {
    tenantId,
    ordenId,
    familia: 'grafica',
    cantidad: 1,
    cantidadUnidad: 'u',
    subtotal: 0,
    impuestos: 0,
    total: 0,
  };
  const padre = await db.ordenTrabajoItem.create({
    data: {
      ...base,
      codigo: 'PADRE',
      nombre: 'Cartel',
      cotizacionItemId: cotizado.id,
    },
  });
  const crearHijo = (parentItemId: string, componenteCodigo: string) =>
    db.ordenTrabajoItem.create({
      data: {
        ...base,
        parentItemId,
        componenteCodigo,
        codigo: randomUUID(),
        nombre: componenteCodigo,
      },
    });
  const hijo = await crearHijo(padre.id, 'LONA'),
    kit = await crearHijo(padre.id, 'KIT');
  const anidado = await crearHijo(kit.id, 'LONA'),
    desconocido = await crearHijo(padre.id, 'AUSENTE');
  const pasos = await Promise.all(
    [hijo, anidado, desconocido].map((i) =>
      db.ordenTrabajoItemPaso.create({
        data: {
          tenantId,
          ordenId,
          itemId: i.id,
          maquinaId,
          indice: 0,
          nombre: 'Impresión',
          familiaCodigo: 'impresion_por_area',
          categoriaFamilia: 'produccion_impresion',
          rutaPasoId: 'ruta-reutilizada',
        },
      }),
    ),
  );
  const ids = pasos.map((p) => p.id);
  const meta = await leerConfiguracionesCola(db, tenantId, ids);
  expect(meta.get(ids[0])).toMatchObject({
    materialNombre: 'Lona Backlight',
    modoColor: 'CMYK',
    formatos: [{ anchoMm: 1370 }],
  });
  expect(meta.get(ids[0])).toMatchObject({
    productoCompuesto: true,
    layoutConservado: true,
  });
  expect(meta.get(ids[1])).toMatchObject({
    productoCompuesto: true,
    layoutConservado: true,
  });
  expect(meta.get(ids[1])).toMatchObject({
    materialNombre: 'Lona anidada',
    formatos: [{ anchoMm: 1600 }],
  });
  expect(meta.get(ids[2])).toMatchObject({
    materialNombre: null,
    formatos: [],
  });
  await db.ordenTrabajoItem.update({
    where: { id: hijo.id },
    data: { trazabilidadSnapshotJson: traza('Plan propio', 1220) },
  });
  expect(
    (await leerConfiguracionesCola(db, tenantId, ids)).get(ids[0]),
  ).toMatchObject({
    materialNombre: 'Plan propio',
    formatos: [{ anchoMm: 1220 }],
  });
  expect((await leerConfiguracionesCola(db, otro, ids)).size).toBe(0);
});

it('muestra sólo la medida del componente a producir sin convertir una cantidad administrativa en m²', async () => {
  const base = {
    tenantId,
    ordenId,
    familia: 'grafica',
    cantidad: 1,
    subtotal: 0,
    impuestos: 0,
    total: 0,
  };
  const padre = await db.ordenTrabajoItem.create({
    data: {
      ...base,
      codigo: 'MEDIDA-PADRE',
      nombre: 'Cartel Backlight',
      cantidadUnidad: 'u',
      jobContextSnapshotJson: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
      },
    },
  });
  const hijo = await db.ordenTrabajoItem.create({
    data: {
      ...base,
      codigo: 'MEDIDA-HIJO',
      nombre: 'Lona Backlight',
      cantidadUnidad: 'm2',
      parentItemId: padre.id,
      componenteCodigo: 'LONA',
      jobContextSnapshotJson: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1700, altoMm: 1200 }],
      },
    },
  });
  const paso = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId,
      itemId: hijo.id,
      maquinaId,
      indice: 0,
      nombre: 'Impresión',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
    },
  });
  const datos = (await leerConfiguracionesCola(db, tenantId, [paso.id])).get(
    paso.id,
  )!;
  expect(datos).toMatchObject({
    productoCompuesto: true,
    layoutConservado: true,
    piezas: [{ cantidad: 1, anchoMm: 1700, altoMm: 1200 }],
  });
  expect(
    (
      await db.ordenTrabajoItem.findUniqueOrThrow({ where: { id: hijo.id } })
    ).cantidad.toNumber(),
  ).toBe(1);
});

it('ordena las máquinas por trabajo pendiente y retira una cola cuando se termina', async () => {
  const i = await db.ordenTrabajoItem.create({
    data: {
      tenantId,
      ordenId,
      codigo: 'COLA-2',
      nombre: 'Trabajo máquina 2',
      familia: 'grafica',
      cantidad: 1,
      cantidadUnidad: 'u',
      subtotal: 0,
      impuestos: 0,
      total: 0,
    },
  });
  await db.ordenTrabajoItemPaso.createMany({
    data: Array.from({ length: 12 }, (_, indice) => ({
      tenantId,
      ordenId,
      itemId: i.id,
      maquinaId: segunda,
      indice,
      nombre: 'Impresión',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
    })),
  });
  const r = await service.maquinas(tenantId);
  expect(r.maquinas[0]).toMatchObject({ id: segunda, pendientes: 12 });
  expect(r.maquinas.every((m) => m.pendientes > 0)).toBe(true);
  await db.ordenTrabajoItemPaso.updateMany({
    where: { tenantId, itemId: i.id },
    data: { estado: 'hecho' },
  });
  expect(
    (await service.maquinas(tenantId)).maquinas.some((m) => m.id === segunda),
  ).toBe(false);
});
