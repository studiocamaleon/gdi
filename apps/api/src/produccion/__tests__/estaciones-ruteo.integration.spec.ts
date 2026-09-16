import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProduccionService } from '../produccion.service';
import { resolverEstacionDePaso } from '../../eta/motor/tablero-tipos';
import type { CurrentAuth } from '../../auth/auth.types';

// Jest fija DATABASE_URL a gdi_saas_test antes de importar Prisma.
const db = new PrismaService();
const service = new ProduccionService(db);
const tenantId = randomUUID(), plantaId = randomUUID();
const auth = { tenantId, userId: randomUUID() } as CurrentAuth;
const maquinas = [randomUUID(), randomUUID()];
beforeAll(async () => {
  await db.tenant.create({ data: { id: tenantId, nombre: 'QA estaciones', slug: `qa-${tenantId}` } });
  await db.planta.create({ data: { id: plantaId, tenantId, nombre: 'Taller', codigo: 'P1' } });
  await db.maquina.createMany({ data: maquinas.map((id, i) => ({
    id, tenantId, plantaId, codigo: `M${i}`, nombre: `Laser ${i + 1}`,
    plantilla: 'IMPRESORA_LASER', geometriaTrabajo: 'PLIEGO', unidadProduccionPrincipal: 'HOJA',
  })) });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});

it('asigna, mueve y desactiva máquinas sin alterar el destino del trabajo manual', async () => {
  const a = await service.createEstacion(auth, {
    nombre: 'Diseño A', activo: true, familias: ['diseno_grafico'], maquinaIds: [maquinas[0]],
  });
  const b = await service.createEstacion(auth, {
    nombre: 'Diseño B', activo: true, familias: [], maquinaIds: [maquinas[1]],
  });
  const paso = { familiaCodigo: 'impresion_por_hoja', centroCostoId: null, maquinaId: maquinas[0], requiereMaquina: true };
  let estaciones = await service.findEstaciones(tenantId);
  expect(resolverEstacionDePaso(estaciones, paso)?.id).toBe(a.id);
  expect(estaciones.find(e => e.id === a.id)?.maquinas[0].nombre).toBe('Laser 1');
  await service.updateEstacion(auth, b.id, { nombre: b.nombre, activo: true, familias: [], maquinaIds: maquinas });
  estaciones = await service.findEstaciones(tenantId);
  expect(resolverEstacionDePaso(estaciones, paso)?.id).toBe(b.id);
  expect(resolverEstacionDePaso(estaciones, { familiaCodigo: 'diseno_grafico', centroCostoId: null })?.id).toBe(a.id);
  await service.toggleEstacion(auth, b.id);
  expect(resolverEstacionDePaso(await service.findEstaciones(tenantId), paso)).toBeNull();
});

it('lee y edita las estaciones antiguas retirando reglas de máquina, conservando las manuales', async () => {
  const id = randomUUID();
  await db.estacion.create({ data: { id, tenantId, nombre: 'Legacy', reglas: { create: [
    { tenantId, tipo: 'tecnologia', valor: 'laser' },
    { tenantId, tipo: 'familia', valor: 'corte_laser' },
    { tenantId, tipo: 'paso', valor: 'embalaje' },
  ] } } });
  const leida = (await service.findEstaciones(tenantId)).find(e => e.id === id)!;
  expect(leida.pasosSinMaquina).toEqual(['embalaje']);
  expect(leida.familias).toEqual([]);
  expect(leida.reglas).toEqual([{ tipo: 'paso', valor: 'embalaje' }]);
  const catalogo = await service.findFamiliasPasos(auth);
  expect(catalogo.some(p => p.codigo === 'corte_laser')).toBe(false);
  expect(catalogo.find(p => p.codigo === 'embalaje')?.estaciones[0].id).toBe(id);
  await service.updateEstacion(auth, id, { nombre: 'Legacy', activo: true, familias: leida.pasosSinMaquina });
  expect(await db.estacionRegla.findMany({ where: { estacionId: id }, select: { tipo: true, valor: true } }))
    .toEqual([{ tipo: 'familia', valor: 'embalaje' }]);
});

it('dos guardados simultáneos no pueden quedarse con el mismo paso manual', async () => {
  const resultados = await Promise.allSettled(['A', 'B'].map(sufijo => service.createEstacion(auth, {
    nombre: `Concurrente ${sufijo}`, activo: true, familias: ['pre_prensa'],
  })));
  expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(resultados.filter(r => r.status === 'rejected')).toHaveLength(1);
  expect(await db.estacionRegla.count({ where: { tenantId, valor: 'pre_prensa' } })).toBe(1);
});
