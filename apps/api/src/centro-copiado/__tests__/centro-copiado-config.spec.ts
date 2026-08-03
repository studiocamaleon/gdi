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
  expect(o.terminaciones).toEqual(['Anillado']);
  expect(o.papeles.length).toBeGreaterThan(0);
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
});
