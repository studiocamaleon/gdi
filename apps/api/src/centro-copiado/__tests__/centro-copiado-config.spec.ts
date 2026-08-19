/**
 * Configuración del módulo (Fase 2): la config es CURACIÓN opcional y el modal
 * (opciones) la respeta. Verifica el filtrado de papeles/tamaños/terminaciones,
 * el estado (activo), y que elegir máquina REGENERA las candidatas del paso (el
 * motor sólo rutea a candidatas). Resetea la config al final: es un singleton por
 * tenant y la DB de test es compartida.
 *
 * Corre contra gdi_saas_test (DB aislada).
 */
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { CentroCopiadoService } from '../centro-copiado.service';

const prisma = new PrismaClient();

let tenantId: string;
let service: CentroCopiadoService;

const reset = () =>
  service.actualizarConfig(tenantId, {
    activo: true,
    papeles: null,
    tamanos: null,
    terminaciones: null,
    tiposAnillo: null,
    politicaPrecio: 'MARGEN_FIJO' as const,
    margenPct: 40,
    margenMinimoPct: 25,
    minimoHojasFacturables: 0,
    maquinaColorId: null,
    maquinaBnId: null,
  });

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'gdi-demo' },
  });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;
  const motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );
  service = new CentroCopiadoService(prisma as never, motor);
  await service.getConfig(tenantId); // provisiona plantilla + crea config vacía
});

afterAll(async () => {
  if (tenantId) await reset();
  await prisma.$disconnect();
});

it('sin config, opciones ofrece todo (defaults)', async () => {
  if (!tenantId) return;
  await reset();
  const o = await service.opciones(tenantId);
  expect(o.activo).toBe(true);
  expect(o.tamanosOfrecidos).toBeNull(); // null = todos los producibles
  // Una terminación sólo se ofrece si el taller tiene su paso productivo listo.
  expect(o.terminaciones).toEqual([]);
  expect(o.papeles.length).toBeGreaterThan(0);
});

it('leer configuración aplica defaults sin crear filas', async () => {
  if (!tenantId) return;
  await prisma.centroCopiadoConfig.deleteMany({ where: { tenantId } });

  const config = await service.getConfig(tenantId);
  expect(config.activo).toBe(true);
  await expect(
    prisma.centroCopiadoConfig.findUnique({ where: { tenantId } }),
  ).resolves.toBeNull();

  await service.inicializar(tenantId);
  await expect(
    prisma.centroCopiadoConfig.findUnique({ where: { tenantId } }),
  ).resolves.not.toBeNull();
});

it('la config restringe lo que opciones ofrece', async () => {
  if (!tenantId) return;
  const antes = await service.opciones(tenantId);
  const unPapel = antes.papeles[0].materiaPrimaId;

  await service.actualizarConfig(tenantId, {
    activo: false,
    papeles: [{ materiaPrimaId: unPapel }],
    tamanos: ['A4'],
    terminaciones: [],
  });

  const o = await service.opciones(tenantId);
  expect(o.activo).toBe(false);
  expect(o.tamanosOfrecidos).toEqual(['A4']);
  expect(o.terminaciones).toEqual([]);
  expect(o.papeles.map((p) => p.materiaPrimaId)).toEqual([unPapel]);

  const estado = await service.estado(tenantId);
  expect(estado.activo).toBe(false);

  await reset();
  const vuelta = await service.opciones(tenantId);
  expect(vuelta.activo).toBe(true);
  expect(vuelta.tamanosOfrecidos).toBeNull();
});

it('revierte la config si falla otra escritura del mismo commit', async () => {
  if (!tenantId) return;
  await reset();
  const antes = await prisma.centroCopiadoConfig.findUniqueOrThrow({
    where: { tenantId },
    select: { activo: true },
  });
  const serviceInterno = service as unknown as {
    aplicarPrecioYTiempos: () => Promise<void>;
  };
  const falla = jest
    .spyOn(serviceInterno, 'aplicarPrecioYTiempos')
    .mockRejectedValueOnce(new Error('fallo inducido'));

  await expect(
    service.actualizarConfig(tenantId, { activo: !antes.activo }),
  ).rejects.toThrow('fallo inducido');

  const despues = await prisma.centroCopiadoConfig.findUniqueOrThrow({
    where: { tenantId },
    select: { activo: true },
  });
  expect(despues.activo).toBe(antes.activo);
  falla.mockRestore();
});

it('evita pisar una configuración modificada por otra sesión', async () => {
  if (!tenantId) return;
  await reset();
  const inicial = await service.getConfig(tenantId);
  const actualizada = await service.actualizarConfig(tenantId, {
    version: inicial.version,
    margenPct: inicial.margenPct + 1,
  });

  expect(actualizada.version).toBe(inicial.version + 1);
  await expect(
    service.actualizarConfig(tenantId, {
      version: inicial.version,
      margenPct: inicial.margenPct + 2,
    }),
  ).rejects.toThrow('otra sesión');
  await reset();
});

it('configura anillados y margen por volumen sobre el motor universal', async () => {
  if (!tenantId) return;
  await reset();

  const config = await service.actualizarConfig(tenantId, {
    tiposAnillo: ['ESPIRAL_PLASTICO', 'WIRE_O'],
    politicaPrecio: 'MARGEN_POR_VOLUMEN',
    margenMinimoPct: 25,
    tramosMargen: [
      { desdeCantidad: 1, margenPct: 45 },
      { desdeCantidad: 100, margenPct: 35 },
      { desdeCantidad: 500, margenPct: 25 },
    ],
    minimoHojasFacturables: 10,
  });

  expect(config.tiposAnillo).toEqual(['ESPIRAL_PLASTICO', 'WIRE_O']);
  expect(config.politicaPrecio).toBe('MARGEN_POR_VOLUMEN');
  expect(config.tramosMargen).toEqual([
    { desdeCantidad: 1, margenPct: 45 },
    { desdeCantidad: 100, margenPct: 35 },
    { desdeCantidad: 500, margenPct: 25 },
  ]);
  expect(config.minimoHojasFacturables).toBe(10);

  const producto = await prisma.producto.findUniqueOrThrow({
    where: {
      tenantId_codigo: { tenantId, codigo: 'SYS-IMPRESION-DOC' },
    },
    select: {
      precioConfigJson: true,
      minimoComercialPolitica: true,
      minimoComercialCantidad: true,
      minimoComercialBase: true,
    },
  });
  expect(
    (producto.precioConfigJson as { metodoCalculo?: string }).metodoCalculo,
  ).toBe('margen_variable');
  expect(producto.minimoComercialPolitica).toBe('ADVERTIR_FACTURAR_MINIMO');
  expect(Number(producto.minimoComercialCantidad)).toBe(10);
  expect(producto.minimoComercialBase).toBe('pliegos_impresos');

  await reset();
});

it('la pausa y la curación también se aplican en los endpoints operativos', async () => {
  if (!tenantId) return;
  const opciones = await service.opciones(tenantId);
  const papel = opciones.papeles[0]?.materiaPrimaId;
  if (!papel) return;
  const documento = {
    id: 'doc-config',
    paginas: 1,
    copias: 1,
    tamano: 'A4',
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
    papelMateriaPrimaId: papel,
    color: 'BN' as const,
    faz: 1 as const,
  };

  await service.actualizarConfig(tenantId, { activo: false });
  await expect(
    service.cotizar(tenantId, { documentos: [documento] }),
  ).rejects.toThrow('pausado');

  await service.actualizarConfig(tenantId, {
    activo: true,
    papeles: [],
  });
  await expect(
    service.cotizar(tenantId, { documentos: [documento] }),
  ).rejects.toThrow('no está habilitado');
  await reset();
});

it('elegir máquina regenera las candidatas del paso', async () => {
  if (!tenantId) return;
  const laser = await prisma.maquina.findFirst({
    where: { tenantId, plantilla: 'IMPRESORA_LASER', activo: true },
  });
  if (!laser) return; // sin láser en el tenant de test, no aplica

  await service.actualizarConfig(tenantId, { maquinaColorId: laser.id });

  const cfg = await service.getConfig(tenantId);
  expect(cfg.maquinaColorId).toBe(laser.id);

  // El paso de impresión ahora tiene a esa máquina como candidata.
  const cp = await prisma.productoConfigPaso.findFirstOrThrow({
    where: {
      tenantId,
      productoRutaAlternativa: { producto: { codigo: 'SYS-IMPRESION-DOC' } },
    },
    include: { maquinasCandidatas: true },
  });
  expect(cp.maquinasCandidatas.some((c) => c.maquinaId === laser.id)).toBe(
    true,
  );

  await reset();
  const auto = await prisma.productoConfigPaso.findFirstOrThrow({
    where: {
      tenantId,
      productoRutaAlternativa: { producto: { codigo: 'SYS-IMPRESION-DOC' } },
    },
    include: { maquinasCandidatas: true },
  });
  expect(auto.maquinasCandidatas.length).toBeGreaterThan(0);
});
