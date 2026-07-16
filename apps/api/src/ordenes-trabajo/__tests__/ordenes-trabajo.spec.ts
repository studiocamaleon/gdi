/**
 * Órdenes de trabajo — lógica pura del ciclo de vida.
 * Ver docs/ordenes-trabajo-persistencia-diseno.md
 *
 * Unitario sin DB: transiciones de estado y progreso derivado.
 */
import { BadRequestException } from '@nestjs/common';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import {
  progresoEfectivo,
  type OrdenTrabajoEstado,
} from '../ordenes-trabajo.types';

function svc(): OrdenesTrabajoService {
  return Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
}

describe('OrdenesTrabajoService — validarTransicion', () => {
  const casosValidos: Array<[OrdenTrabajoEstado, OrdenTrabajoEstado]> = [
    ['borrador', 'pendiente'],
    ['borrador', 'produccion'],
    ['pendiente', 'produccion'],
    ['produccion', 'finalizada'],
    ['finalizada', 'entregada'],
    ['pendiente', 'entregada'],
  ];

  it.each(casosValidos)('%s → %s es válida', (desde, hacia) => {
    expect(() => svc().validarTransicion(desde, hacia)).not.toThrow();
  });

  const casosInvalidos: Array<[OrdenTrabajoEstado, OrdenTrabajoEstado]> = [
    ['pendiente', 'borrador'],
    ['produccion', 'pendiente'],
    ['entregada', 'finalizada'],
    ['entregada', 'borrador'],
  ];

  it.each(casosInvalidos)('%s → %s se rechaza (flujo sólo avanza)', (desde, hacia) => {
    expect(() => svc().validarTransicion(desde, hacia)).toThrow(
      BadRequestException,
    );
  });

  it('mismo estado se rechaza', () => {
    expect(() => svc().validarTransicion('produccion', 'produccion')).toThrow(
      BadRequestException,
    );
  });

  it('estado desconocido se rechaza', () => {
    expect(() =>
      svc().validarTransicion(
        'cancelada' as OrdenTrabajoEstado,
        'entregada',
      ),
    ).toThrow(BadRequestException);
  });
});

describe('OrdenesTrabajoService — validarEmision', () => {
  it('emitir (pendiente) sin cliente se rechaza', () => {
    expect(() => svc().validarEmision('pendiente', null)).toThrow(
      BadRequestException,
    );
  });

  it('salir de borrador a cualquier estado sin cliente se rechaza', () => {
    expect(() => svc().validarEmision('produccion', null)).toThrow(
      BadRequestException,
    );
  });

  it('emitir con cliente pasa', () => {
    expect(() =>
      svc().validarEmision('pendiente', 'a2c1e6d0-0000-0000-0000-000000000001'),
    ).not.toThrow();
  });

  it('borrador sin cliente es válido (se completa antes de emitir)', () => {
    expect(() => svc().validarEmision('borrador', null)).not.toThrow();
  });
});

describe('OrdenesTrabajoService — validarFechaEntregaEmision', () => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;

  it('emitir sin fecha de entrega se rechaza', () => {
    expect(() => svc().validarFechaEntregaEmision('pendiente', null)).toThrow(
      BadRequestException,
    );
  });

  it('emitir con fecha pasada se rechaza', () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    expect(() =>
      svc().validarFechaEntregaEmision('pendiente', iso(ayer)),
    ).toThrow(BadRequestException);
  });

  it('emitir con fecha de hoy o futura pasa', () => {
    const hoy = new Date();
    const enUnaSemana = new Date();
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    expect(() =>
      svc().validarFechaEntregaEmision('pendiente', iso(hoy)),
    ).not.toThrow();
    expect(() =>
      svc().validarFechaEntregaEmision('pendiente', iso(enUnaSemana)),
    ).not.toThrow();
  });

  it('borrador sin fecha es válido', () => {
    expect(() =>
      svc().validarFechaEntregaEmision('borrador', null),
    ).not.toThrow();
  });
});

describe('OrdenesTrabajoService — validarMontosItems', () => {
  const item = (subtotal: number, impuestos: number, total: number) => ({
    nombre: 'Tarjetas',
    subtotal,
    impuestos,
    total,
  });

  it('total = subtotal + impuestos pasa (con tolerancia de redondeo)', () => {
    expect(() =>
      svc().validarMontosItems([item(31735, 6665, 38400)]),
    ).not.toThrow();
    expect(() =>
      svc().validarMontosItems([item(100.5, 21.1, 121.61)]),
    ).not.toThrow();
  });

  it('montos que no cierran se rechazan', () => {
    expect(() => svc().validarMontosItems([item(31735, 6665, 45000)])).toThrow(
      BadRequestException,
    );
  });
});

describe('OrdenesTrabajoService — camposEditables (gating por estado)', () => {
  it('borrador y pendiente permiten todos los datos comerciales', () => {
    for (const estado of ['borrador', 'pendiente'] as const) {
      const campos = svc().camposEditables(estado);
      expect(campos.has('clienteId')).toBe(true);
      expect(campos.has('vendedorEmpleadoId')).toBe(true);
      expect(campos.has('canalVenta')).toBe(true);
      expect(campos.has('fechaEntrega')).toBe(true);
      expect(campos.has('observaciones')).toBe(true);
    }
  });

  it('produccion permite sólo fecha y observaciones', () => {
    const campos = svc().camposEditables('produccion');
    expect(campos.has('fechaEntrega')).toBe(true);
    expect(campos.has('observaciones')).toBe(true);
    expect(campos.has('clienteId')).toBe(false);
    expect(campos.has('canalVenta')).toBe(false);
  });

  it('finalizada y entregada no permiten nada', () => {
    expect(svc().camposEditables('finalizada').size).toBe(0);
    expect(svc().camposEditables('entregada').size).toBe(0);
  });
});

describe('OrdenesTrabajoService — puedeEditarItems', () => {
  it('borrador y pendiente permiten tocar items', () => {
    expect(svc().puedeEditarItems('borrador')).toBe(true);
    expect(svc().puedeEditarItems('pendiente')).toBe(true);
  });

  it('desde produccion en adelante el contenido queda congelado', () => {
    expect(svc().puedeEditarItems('produccion')).toBe(false);
    expect(svc().puedeEditarItems('finalizada')).toBe(false);
    expect(svc().puedeEditarItems('entregada')).toBe(false);
  });
});

describe('progresoEfectivo', () => {
  it('borrador → null (sin barra)', () => {
    expect(progresoEfectivo('borrador', null)).toBeNull();
    expect(progresoEfectivo('borrador', 50)).toBeNull();
  });

  it('pendiente → 0 salvo dato informado', () => {
    expect(progresoEfectivo('pendiente', null)).toBe(0);
    expect(progresoEfectivo('pendiente', 10)).toBe(10);
  });

  it('produccion → lo que informe producción (null si no hay dato)', () => {
    expect(progresoEfectivo('produccion', null)).toBeNull();
    expect(progresoEfectivo('produccion', 42)).toBe(42);
  });

  it('finalizada/entregada → 100 siempre', () => {
    expect(progresoEfectivo('finalizada', null)).toBe(100);
    expect(progresoEfectivo('entregada', 60)).toBe(100);
  });
});

describe('numeración OT-AAAA-NNNN', () => {
  it('padStart a 4 dígitos', () => {
    expect(`OT-2026-${String(7).padStart(4, '0')}`).toBe('OT-2026-0007');
    expect(`OT-2026-${String(184).padStart(4, '0')}`).toBe('OT-2026-0184');
    expect(`OT-2026-${String(12345).padStart(4, '0')}`).toBe('OT-2026-12345');
  });
});
