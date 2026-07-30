/**
 * Familias tenant (pasos componibles, Etapa C): validador puro, CRUD,
 * resolver síncrono, snapshot de registro y borrado sólo-si-virgen.
 *
 * Integración real contra gdi_saas_test (jest-setup-db fija DATABASE_URL
 * antes de cualquier import). El tenant es propio del spec y se borra al
 * final — cascade limpia familias y estaciones.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FamiliasPasosService } from '../familias-pasos.service';
import { FamiliasTenantService } from '../familias-tenant.service';
import {
  validarDefinicionFamiliaTenant,
  type FamiliaTenantInput,
} from '../pasos/familia-tenant-validacion';
import { modoRegistroDeFamilia, resolverFamilia } from '../pasos/familias';
import type { PrismaService } from '../../prisma/prisma.service';

const prisma = new PrismaClient();
const service = new FamiliasTenantService(prisma as unknown as PrismaService);

const SERIGRAFIA: FamiliaTenantInput = {
  nombre: 'Serigrafía manual',
  descripcion: 'Estampado con shablón, a mano.',
  categoria: 'operaciones_manuales',
  relacionMaquina: ['M-0'],
  modosTiempo: ['T-2'],
  mecanismosCantidad: ['DIRECT_FROM_JOBCONTEXT'],
  slots: [
    {
      codigo: 'tinta_serigrafia',
      nombre: 'Tinta',
      tipo: 'INSUMO_PASO',
      requerido: true,
    },
  ],
};

describe('validarDefinicionFamiliaTenant (el validador puro)', () => {
  it('acepta la forma "Serigrafía manual" (M-0 · T-2 · DIRECT · con insumo)', () => {
    expect(validarDefinicionFamiliaTenant(SERIGRAFIA)).toEqual([]);
  });

  it('rechaza CALCULADO_POR_PASO: la geometría es frontera del sistema', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      mecanismosCantidad: ['CALCULADO_POR_PASO'],
    });
    expect(
      errores.some((e) => e.includes('exclusivo de las familias del sistema')),
    ).toBe(true);
  });

  it('rechaza T-3 sin máquina', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      modosTiempo: ['T-3'],
    });
    expect(errores.some((e) => e.includes('T-3'))).toBe(true);
  });

  it('rechaza máquina sin plantillas compatibles', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      relacionMaquina: ['M-1'],
      modosTiempo: ['T-3'],
    });
    expect(errores.some((e) => e.includes('plantilla'))).toBe(true);
  });

  it('rechaza CONSUMIBLE_MAQUINA en un paso sin máquina', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      slots: [
        {
          codigo: 'tinta',
          nombre: 'Tinta',
          tipo: 'CONSUMIBLE_MAQUINA',
          requerido: true,
        },
      ],
    });
    expect(errores.some((e) => e.includes('CONSUMIBLE_MAQUINA'))).toBe(true);
  });

  it('rechaza categoría y preset desconocidos', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      categoria: 'inventada',
      presetOrigen: 'no_existe',
    });
    expect(errores.some((e) => e.includes('Categoría desconocida'))).toBe(true);
    expect(
      errores.some((e) => e.includes('Preset de origen desconocido')),
    ).toBe(true);
  });

  it('rechaza un default de activación fuera de los soportados', () => {
    const errores = validarDefinicionFamiliaTenant({
      ...SERIGRAFIA,
      modosActivacion: ['OBLIGATORIO'],
      modoActivacionDefault: 'OPCIONAL',
    });
    expect(errores.some((e) => e.includes('default'))).toBe(true);
  });
});

describe('FamiliasTenantService (integración, gdi_saas_test)', () => {
  let tenantId: string;
  let estacionId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: 'Test familias tenant',
        slug: `test-familias-${randomUUID().slice(0, 8)}`,
      },
    });
    tenantId = tenant.id;
    const estacion = await prisma.estacion.create({
      data: { tenantId, nombre: 'Mesa de serigrafía', etapa: 'terminaciones' },
    });
    estacionId = estacion.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('crear → la familia resuelve SÍNCRONO por UUID y rutea a su estación', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      estacionId,
    });

    // El resolver la ve sin tocar la base (registro write-through).
    const def = resolverFamilia(fila.id);
    expect(def).toBeDefined();
    expect(def!.nombre).toBe('Serigrafía manual');
    expect(def!.esDeTenant).toBe(true);
    expect(def!.slotsRequeridos).toHaveLength(1);

    // Tablero: cronómetro por default de categoría (operaciones_manuales).
    expect(modoRegistroDeFamilia(fila.id)).toBe('cronometro');

    // Ruteo: la fuente de verdad es EstacionFamilia, con el UUID como código.
    const ruteo = await prisma.estacionFamilia.findFirst({
      where: { tenantId, familiaCodigo: fila.id },
    });
    expect(ruteo?.estacionId).toBe(estacionId);
  });

  it('B.3.2: los outputs se DERIVAN de la forma — lo que declare el input se descarta', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Estampado con outputs basura',
      outputsCanonicos: ['piezas_estampadas', 'lo_que_sea'],
    });
    expect(fila.outputsCanonicos).toEqual([
      'unidades_procesadas',
      'minutos_reales',
    ]);

    // Un PATCH cualquiera re-deriva (normaliza filas legacy).
    const parchada = await service.actualizar(tenantId, fila.id, {
      descripcion: 'normalizada',
    });
    expect(parchada.outputsCanonicos).toEqual([
      'unidades_procesadas',
      'minutos_reales',
    ]);
  });

  it('el override de modoRegistro le gana al default de la categoría', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Serigrafía en tandas',
      modoRegistro: 'solo_completar',
    });
    expect(modoRegistroDeFamilia(fila.id)).toBe('solo_completar');
  });

  it('nombre duplicado en el mismo tenant → 409', async () => {
    await expect(service.crear(tenantId, { ...SERIGRAFIA })).rejects.toThrow(
      ConflictException,
    );
  });

  it('forma inválida → 400 con la lista de errores, y NO persiste', async () => {
    await expect(
      service.crear(tenantId, {
        ...SERIGRAFIA,
        nombre: 'Inválida',
        mecanismosCantidad: ['CALCULADO_POR_PASO'],
      }),
    ).rejects.toThrow(BadRequestException);
    const cuantas = await prisma.familiaTenant.count({
      where: { tenantId, nombre: 'Inválida' },
    });
    expect(cuantas).toBe(0);
  });

  it('PATCH parcial valida el MERGE: no puede dejar una forma rota', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Para editar',
    });
    // Sacarle la máquina no rompe nada… pero pedir T-3 sin máquina sí.
    await expect(
      service.actualizar(tenantId, fila.id, { modosTiempo: ['T-3'] }),
    ).rejects.toThrow(BadRequestException);
    // Y una edición coherente pasa y actualiza el registro.
    await service.actualizar(tenantId, fila.id, { nombre: 'Editada OK' });
    expect(resolverFamilia(fila.id)!.nombre).toBe('Editada OK');
  });

  it('inhabilitar NO la saca del resolver (OTs históricas siguen leyendo)', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Para inhabilitar',
    });
    await service.actualizar(tenantId, fila.id, { activo: false });
    const def = resolverFamilia(fila.id);
    expect(def).toBeDefined();
    expect(def!.activo).toBe(false);
  });

  it('borrar una familia virgen la elimina de verdad (y del resolver)', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Virgen',
    });
    await service.eliminar(tenantId, fila.id);
    expect(resolverFamilia(fila.id)).toBeUndefined();
    expect(await prisma.familiaTenant.count({ where: { id: fila.id } })).toBe(
      0,
    );
  });

  it('borrar una familia USADA → 409 que ofrece inhabilitar', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Usada en ruta',
    });
    const ruta = await prisma.ruta.create({
      data: {
        tenantId,
        codigo: `R-TEST-${randomUUID().slice(0, 6)}`,
        nombre: 'Ruta de prueba',
      },
    });
    await prisma.rutaPaso.create({
      data: {
        tenantId,
        rutaId: ruta.id,
        version: 1,
        orden: 1,
        familiaCodigo: fila.id,
        icono: 'Hand',
      },
    });

    await expect(service.eliminar(tenantId, fila.id)).rejects.toThrow(
      ConflictException,
    );
    // Sigue existiendo y sigue resolviendo.
    expect(resolverFamilia(fila.id)).toBeDefined();
  });

  it('activación FIJADA: el producto no puede elegir otro modo (NO_EJECUTAR sí)', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Fijada en obligatorio',
      modosActivacion: ['OBLIGATORIO'],
      modoActivacionDefault: 'OBLIGATORIO',
    });
    const pasosService = new FamiliasPasosService(
      prisma as unknown as PrismaService,
    );
    const dto = { modoActivacion: 'OPCIONAL' } as never;
    expect(() =>
      pasosService.validarConfigPasoContraFamilia(fila.id, dto),
    ).toThrow(BadRequestException);
    // Apagarla en una ruta puntual sigue permitido.
    expect(() =>
      pasosService.validarConfigPasoContraFamilia(fila.id, {
        modoActivacion: 'NO_EJECUTAR',
      } as never),
    ).not.toThrow();
    // Y el modo fijado, obviamente, también.
    expect(() =>
      pasosService.validarConfigPasoContraFamilia(fila.id, {
        modoActivacion: 'OBLIGATORIO',
      } as never),
    ).not.toThrow();
  });

  it('tenant ajeno no puede tocarla', async () => {
    const fila = await service.crear(tenantId, {
      ...SERIGRAFIA,
      nombre: 'Del tenant A',
    });
    const otro = await prisma.tenant.create({
      data: {
        nombre: 'Otro tenant',
        slug: `test-otro-${randomUUID().slice(0, 8)}`,
      },
    });
    try {
      await expect(
        service.actualizar(otro.id, fila.id, { nombre: 'Robada' }),
      ).rejects.toThrow(NotFoundException);
      await expect(service.eliminar(otro.id, fila.id)).rejects.toThrow(
        NotFoundException,
      );
    } finally {
      await prisma.tenant.delete({ where: { id: otro.id } });
    }
  });
});
