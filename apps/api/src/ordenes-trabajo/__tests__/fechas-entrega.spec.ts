import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from '../dto/crear-orden-trabajo.dto';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';

describe('contrato de fechas calendario de OT', () => {
  afterEach(() => jest.useRealTimers());
  it.each(['2026-02-29', '2026-09-31', '2026-09-09T23:00:00-03:00'])(
    'rechaza %s al crear y editar, sin desplazar un día al guardar',
    async (fechaEntrega) => {
      for (const Tipo of [
        CrearOrdenTrabajoDto,
        EditarOrdenTrabajoDto,
        CrearOrdenTrabajoItemDto,
      ]) {
        const errores = await validate(
          Object.assign(new Tipo(), { fechaEntrega }),
        );
        expect(errores.some((e) => e.property === 'fechaEntrega')).toBe(true);
      }
    },
  );
  it('acepta fecha pura, preserva hoy del taller y valida también borradores', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T01:30:00Z'));
    const svc = Object.create(
      OrdenesTrabajoService.prototype,
    ) as OrdenesTrabajoService;
    expect(() =>
      svc.validarFechaEntregaEmision(
        'pendiente',
        '2026-09-09',
        'America/Argentina/Buenos_Aires',
      ),
    ).not.toThrow();
    expect(() =>
      svc.validarFechaEntregaEmision('pendiente', '2026-09-09', 'UTC'),
    ).toThrow();
    expect(() =>
      svc.validarFechaEntregaEmision('borrador', '2026-09-31'),
    ).toThrow();
    expect(() =>
      svc.validarFechaEntregaEmision('borrador', null),
    ).not.toThrow();
    for (const Tipo of [
      CrearOrdenTrabajoDto,
      EditarOrdenTrabajoDto,
      CrearOrdenTrabajoItemDto,
    ]) {
      const errores = await validate(
        Object.assign(new Tipo(), { fechaEntrega: '2026-09-09' }),
      );
      expect(errores.some((e) => e.property === 'fechaEntrega')).toBe(false);
    }
  });
});
