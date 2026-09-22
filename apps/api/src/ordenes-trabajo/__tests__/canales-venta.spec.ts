import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CrearOrdenTrabajoDto,
  EditarOrdenTrabajoDto,
  EditarOrdenTrabajoLoteDto,
} from '../dto/crear-orden-trabajo.dto';
import { EmitirPresupuestoDto } from '../../presupuestos/dto/presupuestos.dto';
import { exigirCanalVenta } from '../canales-venta';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import type { CurrentAuth } from '../../auth/auth.types';

const uuid = '33333333-3333-4333-8333-333333333333';
const item = {
  cotizacionItemId: uuid,
  codigo: 'VINILO',
  nombre: 'Vinilo',
  familia: 'Impresión',
  cantidad: 1,
  cantidadUnidad: 'u.',
  subtotal: 100,
  impuestos: 21,
  total: 121,
};
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const altas = [
  {
    nombre: 'borrador OT',
    tipo: CrearOrdenTrabajoDto,
    payload: { estado: 'borrador', items: [item] },
  },
  {
    nombre: 'emisión OT',
    tipo: CrearOrdenTrabajoDto,
    payload: { estado: 'pendiente', clienteId: uuid, items: [item] },
  },
  {
    nombre: 'presupuesto',
    tipo: EmitirPresupuestoDto,
    payload: { cotizacionId: uuid, clienteId: uuid, items: [item] },
  },
];

describe.each(altas)(
  'canal obligatorio al guardar $nombre',
  ({ tipo, payload }) => {
    it.each([undefined, null, '', ' ', 'fax', 'telefono', 'vendedor_externo'])(
      'rechaza %j antes de llegar a persistencia',
      async (canalVenta) => {
        await expect(
          pipe.transform(
            { ...payload, canalVenta },
            { type: 'body', metatype: tipo },
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );
    it.each(['whatsapp', 'mostrador', 'email', 'web', 'app_movil'])(
      'admite y conserva %s sin aplicar un default',
      async (canalVenta) => {
        const result: unknown = await pipe.transform(
          { ...payload, canalVenta },
          { type: 'body', metatype: tipo },
        );
        expect(result).toHaveProperty('canalVenta', canalVenta);
      },
    );
  },
);

describe('edición parcial e históricos', () => {
  it.each([EditarOrdenTrabajoDto, EditarOrdenTrabajoLoteDto])(
    'permite omitir el campo en PATCH, pero no borrarlo ni asignar un retirado',
    async (tipo) => {
      const base =
        tipo === EditarOrdenTrabajoLoteDto
          ? { expectedVersion: '2026-09-12T12:00:00Z' }
          : {};
      await expect(
        pipe.transform(base, { type: 'body', metatype: tipo }),
      ).resolves.toHaveProperty('canalVenta', undefined);
      for (const canalVenta of [null, '', 'telefono', 'vendedor_externo']) {
        await expect(
          pipe.transform(
            { ...base, canalVenta },
            { type: 'body', metatype: tipo },
          ),
        ).rejects.toThrow(BadRequestException);
      }
    },
  );
  it('conserva un canal histórico conocido sin reasignarlo a otro', () => {
    expect(() => exigirCanalVenta('telefono', 'telefono')).not.toThrow();
    expect(() =>
      exigirCanalVenta('vendedor_externo', 'vendedor_externo'),
    ).not.toThrow();
    expect(() => exigirCanalVenta('telefono', 'mostrador')).toThrow(
      BadRequestException,
    );
  });
});

describe('la OT sin canal no puede saltarse la elección mediante edición o emisión', () => {
  function fixture(canalVenta: string | null = null) {
    const orden = {
      id: uuid,
      estado: 'borrador',
      canalVenta,
      updatedAt: new Date('2026-09-12T12:00:00Z'),
      items: [],
    };
    const prisma = {
      ordenTrabajo: {
        findFirst: jest.fn().mockResolvedValue(orden),
        updateMany: jest.fn(),
      },
      empleado: { findFirst: jest.fn().mockResolvedValue(null) },
      datosEmpresa: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = Object.assign(
      Object.create(OrdenesTrabajoService.prototype),
      {
        prisma,
        findOne: jest.fn().mockResolvedValue(orden),
        capacidades: { exigir: jest.fn().mockResolvedValue(undefined) },
      },
    ) as OrdenesTrabajoService;
    return { service, prisma };
  }
  const auth = { tenantId: uuid, userId: uuid } as CurrentAuth;
  it('rechaza guardar campos y el commit de productos sin un canal', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.editar(auth, uuid, { observaciones: 'Cambio' }),
    ).rejects.toThrow('Elegí un canal');
    await expect(
      service.editarLote(auth, uuid, {
        expectedVersion: '2026-09-12T12:00:00Z',
      }),
    ).rejects.toThrow('Elegí un canal');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
  });
  it('rechaza emitir un borrador histórico sin canal', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.cambiarEstado(auth, uuid, { estado: 'pendiente' }),
    ).rejects.toThrow('Elegí un canal');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('no reemplaza un canal histórico cuando la edición no lo cambia', async () => {
    const { service } = fixture('telefono');
    await expect(service.editar(auth, uuid, {})).resolves.toMatchObject({
      canalVenta: 'telefono',
    });
  });
});
