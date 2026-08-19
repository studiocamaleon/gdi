/**
 * Órdenes de trabajo — lógica pura del ciclo de vida.
 * Ver docs/ordenes-trabajo-persistencia-diseno.md
 *
 * Unitario sin DB: transiciones de estado y progreso derivado.
 */
import { BadRequestException } from '@nestjs/common';
import {
  corteJornadaDe,
  montosCotizacionItem,
  montoCargosPorTratamiento,
  recalcularCargosPorSubtotal,
  OrdenesTrabajoService,
  ordenSeFinaliza,
  pasoEjecutable,
  pasoReabrible,
  sumaTramosMin,
  TRANSICIONES_PASO,
  validarCancelacion,
  vencimientoComercialDesde,
} from '../ordenes-trabajo.service';
import {
  esCancelable,
  progresoEfectivo,
  tiempoMedidoValido,
  type OrdenTrabajoEstado,
} from '../ordenes-trabajo.types';
import { modoRegistroDeFamilia } from '../../productos-servicios/pasos/familias';

function svc(): OrdenesTrabajoService {
  return Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
}

describe('vencimiento comercial de la orden', () => {
  const finalizadaDeNoche = new Date('2026-08-19T01:30:00.000Z');

  it('una venta común vence el día local en que se finaliza', () => {
    expect(
      vencimientoComercialDesde(
        finalizadaDeNoche,
        null,
        'America/Argentina/Buenos_Aires',
      )
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-08-18');
  });

  it('una cuenta corriente suma el plazo sobre esa fecha local', () => {
    expect(
      vencimientoComercialDesde(
        finalizadaDeNoche,
        30,
        'America/Argentina/Buenos_Aires',
      )
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-09-17');
  });
});

describe('OrdenesTrabajoService — idempotencia de creación', () => {
  it('devuelve la OT existente antes de volver a ejecutar la creación', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'ot-existente' });
    const findOne = jest.fn().mockResolvedValue({ id: 'ot-existente' });
    const service = svc() as unknown as {
      prisma: unknown;
      findOne: typeof findOne;
      create: OrdenesTrabajoService['create'];
    };
    service.prisma = { ordenTrabajo: { findFirst } };
    service.findOne = findOne;
    const auth = { tenantId: 'tenant-1', userId: 'user-1' } as never;

    await expect(
      service.create(auth, {
        idempotencyKey: '2fb1b338-a40d-40a0-8d90-8313b585b6c4',
        items: [],
      }),
    ).resolves.toEqual({ id: 'ot-existente' });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        idempotencyKey: '2fb1b338-a40d-40a0-8d90-8313b585b6c4',
      },
      select: { id: true },
    });
    expect(findOne).toHaveBeenCalledWith(auth, 'ot-existente');
  });
});

describe('edición de carga rápida — conservación de archivos', () => {
  it('reasigna los adjuntos antes de borrar los items reemplazados', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = svc() as unknown as {
      reemplazarItemsConservandoArchivos: (
        tx: unknown,
        tenantId: string,
        ordenId: string,
        eliminados: string[],
        transferencias: Array<{ destinoId: string; origenIds: string[] }>,
      ) => Promise<void>;
    };

    await service.reemplazarItemsConservandoArchivos(
      { archivo: { updateMany }, ordenTrabajoItem: { deleteMany } },
      'tenant-1',
      'orden-1',
      ['item-viejo-1', 'item-viejo-2'],
      [
        {
          destinoId: 'item-nuevo',
          origenIds: ['item-viejo-1', 'item-viejo-2'],
        },
      ],
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        scope: 'ORDEN_ITEM',
        ordenItemId: { in: ['item-viejo-1', 'item-viejo-2'] },
      },
      data: { ordenItemId: 'item-nuevo' },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        ordenId: 'orden-1',
        id: { in: ['item-viejo-1', 'item-viejo-2'] },
      },
    });
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0],
    );
  });
});

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

  it.each(casosInvalidos)(
    '%s → %s se rechaza (flujo sólo avanza)',
    (desde, hacia) => {
      expect(() => svc().validarTransicion(desde, hacia)).toThrow(
        BadRequestException,
      );
    },
  );

  it('mismo estado se rechaza', () => {
    expect(() => svc().validarTransicion('produccion', 'produccion')).toThrow(
      BadRequestException,
    );
  });

  it('estado desconocido se rechaza', () => {
    expect(() =>
      svc().validarTransicion('archivada' as OrdenTrabajoEstado, 'entregada'),
    ).toThrow(BadRequestException);
  });

  /**
   * `cancelada` no es una etapa más adelante: es una salida lateral. Si entrara
   * en la comparación por índice quedaría alcanzable desde cualquier lado
   * —incluida una orden entregada— por el orden del array y no por decisión.
   */
  describe('cancelada queda fuera del flujo', () => {
    it('no se sale de cancelada', () => {
      expect(() => svc().validarTransicion('cancelada', 'produccion')).toThrow(
        BadRequestException,
      );
      expect(() => svc().validarTransicion('cancelada', 'entregada')).toThrow(
        BadRequestException,
      );
    });

    it('no se entra a cancelada por el cambio de estado común', () => {
      expect(() => svc().validarTransicion('produccion', 'cancelada')).toThrow(
        /acción de cancelar/i,
      );
    });
  });
});

describe('desde dónde se puede cancelar', () => {
  it.each(['borrador', 'pendiente', 'produccion'] as const)(
    'una orden %s se puede cancelar',
    (estado) => {
      expect(esCancelable(estado)).toBe(true);
    },
  );

  /**
   * Decisión 2026-07-26: sólo se cancela lo que todavía no se hizo. Una
   * finalizada ya consumió material y horas, así que sacarla del eje comercial
   * se llevaría puestos la venta Y el costo juntos —salen de la misma fila— y
   * el taller dejaría de ver que produjo algo que no cobró. Eso es una pérdida,
   * y una pérdida no se esconde: se mira.
   */
  it('una finalizada NO se cancela: el trabajo ya está hecho', () => {
    expect(esCancelable('finalizada')).toBe(false);
  });

  /** El trabajo ya salió por la puerta: eso se devuelve, no se cancela. */
  it('una entregada NO se cancela', () => {
    expect(esCancelable('entregada')).toBe(false);
  });

  it('una cancelada tampoco (se cancela una sola vez)', () => {
    expect(esCancelable('cancelada')).toBe(false);
  });
});

describe('validarCancelacion', () => {
  it('deja cancelar lo que todavía no se facturó', () => {
    expect(() => validarCancelacion('produccion', 0)).not.toThrow();
    expect(() => validarCancelacion('borrador', 0)).not.toThrow();
  });

  /**
   * El caso caro: si ARCA ya tiene una factura de esta orden, cancelarla
   * dejaría el eje comercial diciendo una cosa y el fiscal otra. (Se puede
   * facturar desde producción, así que el caso sigue vivo aunque las
   * finalizadas ya no se cancelen.)
   */
  it('frena si la orden tiene facturación emitida', () => {
    expect(() => validarCancelacion('produccion', 78_330)).toThrow(
      /nota de crédito/i,
    );
  });

  /** Y el mensaje dice cómo salir: reabrir la deja en producción. */
  it('una finalizada manda a reabrir el paso', () => {
    expect(() => validarCancelacion('finalizada', 0)).toThrow(/reabrí/i);
  });

  it('una entregada no se cancela ni sin facturar', () => {
    expect(() => validarCancelacion('entregada', 0)).toThrow(
      BadRequestException,
    );
  });

  it('no se cancela dos veces', () => {
    expect(() => validarCancelacion('cancelada', 0)).toThrow(/ya estaba/i);
  });
});

describe('progreso de una orden cancelada', () => {
  /** Decir "40%" invitaría a leerlo como algo que todavía puede terminar. */
  it('no informa avance aunque el tablero haya dejado uno', () => {
    expect(progresoEfectivo('cancelada', 40)).toBeNull();
  });
});

describe('qué se puede editar de una cancelada', () => {
  it('nada: es el registro de algo que no va a pasar', () => {
    expect(svc().camposEditables('cancelada').size).toBe(0);
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

describe('cargos de orden', () => {
  const cargos = [
    { montoNeto: 1000, impuestoMonto: 210, total: 1210 },
    { montoNeto: 500, impuestoMonto: 105, total: 605 },
  ];

  it('usa el bruto fiscal y el neto sin comprobante', () => {
    expect(montoCargosPorTratamiento(cargos, 'FISCAL')).toBe(1815);
    expect(montoCargosPorTratamiento(cargos, 'SIN_COMPROBANTE')).toBe(1500);
  });

  it('actualiza los cargos porcentuales cuando cambia el subtotal', () => {
    const [cargo] = recalcularCargosPorSubtotal(
      [
        {
          modoCalculoSnapshot: 'PORCENTAJE_SOBRE_BASE',
          configSnapshot: { porcentajeAplicado: 10 },
          impuestoPorcentaje: 21,
        },
      ],
      2_000,
    ) as Array<Record<string, unknown>>;
    expect(cargo).toMatchObject({
      baseCalculo: 2_000,
      montoNeto: 200,
      impuestoMonto: 42,
      total: 242,
    });
  });

  it('recalcula porcentaje, impuesto y total sin confiar en el navegador', async () => {
    const service = svc() as unknown as {
      prisma: unknown;
      cargosAutorizados: (
        tenantId: string,
        cargos: Array<Record<string, unknown>>,
        subtotal: number,
        decimales: number,
      ) => Promise<Array<Record<string, unknown>>>;
    };
    service.prisma = {
      cargoDirectoCatalogo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f2ae7857-bef9-4db5-a34b-791fd573c596',
            codigo: 'urgencia',
            nombre: 'Urgencia',
            descripcion: null,
            modoCalculo: 'PORCENTAJE_SOBRE_BASE',
            configJson: { porcentajeDefault: 5 },
          },
        ]),
      },
    };
    const [cargo] = await service.cargosAutorizados(
      'tenant-1',
      [
        {
          cargoDirectoCatalogoId: 'f2ae7857-bef9-4db5-a34b-791fd573c596',
          configInput: { porcentajeAplicado: 10 },
          montoNeto: 999_999,
        },
      ],
      1_000,
      2,
    );
    expect(cargo).toMatchObject({
      codigoSnapshot: 'urgencia',
      montoNeto: 100,
      impuestoMonto: 21,
      total: 121,
    });
  });
});

describe('montos autoritativos del cotizador', () => {
  it('prioriza los importes exactos persistidos', () => {
    expect(
      montosCotizacionItem({
        precioNetoTotal: 10_000,
        impuestosPorFueraTotal: 2_100,
        precioTotal: 12_100,
        impuestosSnapshotJson: [],
      }),
    ).toEqual({ subtotal: 10_000, impuestos: 2_100, total: 12_100 });
  });

  it('reconstruye snapshots históricos desde impuestos por fuera', () => {
    expect(
      montosCotizacionItem({
        precioNetoTotal: null,
        impuestosPorFueraTotal: null,
        precioTotal: 12_100,
        impuestosSnapshotJson: [{ porcentaje: 21, traslado: 'POR_FUERA' }],
      }),
    ).toEqual({ subtotal: 10_000, impuestos: 2_100, total: 12_100 });
  });

  it('reemplaza montos, identidad y descuento declarados por el navegador', () => {
    const service = svc() as unknown as {
      itemAutorizado: (
        item: Record<string, unknown>,
        snapshot: Record<string, unknown>,
        decimales: number,
      ) => Record<string, unknown>;
    };
    const item = service.itemAutorizado(
      {
        cotizacionItemId: 'item-1',
        codigo: 'FALSO',
        nombre: 'Falso',
        cantidad: 999,
        subtotal: 1,
        impuestos: 0,
        total: 1,
        descuentoMonto: 50_000,
      },
      {
        id: 'item-1',
        cotizacionId: 'cot-1',
        cantidad: 100,
        snapshotJson: {
          producto: { codigo: 'TARJ-REAL', nombre: 'Tarjetas reales' },
        },
        precioNetoTotal: 10_000,
        impuestosPorFueraTotal: 2_100,
        precioTotal: 12_100,
        impuestosSnapshotJson: [],
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: 10,
        descuentoMonto: 1_111.11,
      },
      2,
    );
    expect(item).toMatchObject({
      codigo: 'TARJ-REAL',
      nombre: 'Tarjetas reales',
      cantidad: 100,
      subtotal: 10_000,
      impuestos: 2_100,
      total: 12_100,
      descuentoMonto: 1_111.11,
    });
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

describe('OrdenesTrabajoService — pasosDesdeTrazabilidad (Tablero)', () => {
  // Método privado: se accede por índice para testear el mapeo puro sin DB.
  const pasosDesde = (trazabilidad: unknown) =>
    (
      svc() as unknown as {
        pasosDesdeTrazabilidad: (
          tenantId: string,
          ordenId: string,
          itemId: string,
          trazabilidad: unknown,
        ) => Array<Record<string, unknown>>;
      }
    ).pasosDesdeTrazabilidad('t-1', 'o-1', 'i-1', trazabilidad);

  const pasoTraz = (extra: Record<string, unknown> = {}) => ({
    rutaPasoId: 'rp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_hoja',
    nombreVisible: 'Impresión digital frente',
    activado: true,
    tiempo: {
      totalMin: 42.5,
      centroCostoId: 'a2c1e6d0-0000-0000-0000-000000000009',
      centroCostoNombre: 'IMP-001 · HP Indigo',
    },
    ...extra,
  });

  it('sólo materializa pasos activados, con índice consecutivo', () => {
    const pasos = pasosDesde({
      pasos: [
        pasoTraz(),
        pasoTraz({ activado: false, razonNoActivado: 'no obligatorio' }),
        pasoTraz({ familiaCodigo: 'corte_guillotina', nombreVisible: null }),
      ],
    });
    expect(pasos).toHaveLength(2);
    expect(pasos.map((p) => p.indice)).toEqual([0, 1]);
  });

  it('toma nombre visible, centro de costo y duración del snapshot', () => {
    const [paso] = pasosDesde({ pasos: [pasoTraz()] });
    expect(paso).toMatchObject({
      tenantId: 't-1',
      ordenId: 'o-1',
      itemId: 'i-1',
      nombre: 'Impresión digital frente',
      familiaCodigo: 'impresion_por_hoja',
      categoriaFamilia: 'produccion_impresion',
      centroCostoNombre: 'IMP-001 · HP Indigo',
      duracionEstimadaMin: 42.5,
    });
  });

  it('sin nombre visible cae al nombre de la familia del catálogo', () => {
    const [paso] = pasosDesde({
      pasos: [pasoTraz({ nombreVisible: '   ' })],
    });
    expect(paso.nombre).toBeTruthy();
    expect(paso.nombre).not.toBe('impresion_por_hoja');
  });

  it('familia desconocida no rompe: cae a operaciones manuales', () => {
    const [paso] = pasosDesde({
      pasos: [pasoTraz({ familiaCodigo: 'familia_inventada' })],
    });
    expect(paso.categoriaFamilia).toBe('operaciones_manuales');
  });

  it('paso manual sin tiempo/centro queda sin estación ni duración', () => {
    const [paso] = pasosDesde({
      pasos: [pasoTraz({ tiempo: undefined })],
    });
    expect(paso.centroCostoId).toBeNull();
    expect(paso.centroCostoNombre).toBeNull();
    expect(paso.duracionEstimadaMin).toBeNull();
  });

  it('trazabilidad ausente o malformada → sin pasos', () => {
    expect(pasosDesde(null)).toEqual([]);
    expect(pasosDesde({})).toEqual([]);
    expect(pasosDesde({ pasos: 'corrupto' })).toEqual([]);
  });
});

describe('TRANSICIONES_PASO (acciones del Tablero)', () => {
  it('iniciar sólo desde pendiente', () => {
    expect(TRANSICIONES_PASO.iniciar.desde).toEqual(['pendiente']);
  });

  it('pausar sólo desde en curso; continuar sólo desde pausado', () => {
    expect(TRANSICIONES_PASO.pausar.desde).toEqual(['en_curso']);
    expect(TRANSICIONES_PASO.continuar.desde).toEqual(['pausado']);
  });

  it('completar desde pendiente, en curso o pausado (atajo de taller)', () => {
    expect(TRANSICIONES_PASO.completar.desde).toEqual([
      'pendiente',
      'en_curso',
      'pausado',
    ]);
  });

  it('bloquear nunca desde hecho ni bloqueado', () => {
    expect(TRANSICIONES_PASO.bloquear.desde).not.toContain('hecho');
    expect(TRANSICIONES_PASO.bloquear.desde).not.toContain('bloqueado');
  });

  it('desbloquear sólo desde bloqueado y reabrir sólo desde hecho', () => {
    expect(TRANSICIONES_PASO.desbloquear.desde).toEqual(['bloqueado']);
    expect(TRANSICIONES_PASO.reabrir.desde).toEqual(['hecho']);
  });
});

describe('secuencia de la ruta — pasoEjecutable / pasoReabrible', () => {
  const ruta = (...estados: string[]) =>
    estados.map((estado, indice) => ({ indice, estado }));

  it('el primer paso siempre está listo', () => {
    expect(pasoEjecutable(ruta('pendiente', 'pendiente'), 0)).toBe(true);
  });

  it('un paso está listo sólo si TODOS los anteriores están hechos', () => {
    expect(pasoEjecutable(ruta('hecho', 'pendiente', 'pendiente'), 1)).toBe(
      true,
    );
    expect(pasoEjecutable(ruta('hecho', 'pendiente', 'pendiente'), 2)).toBe(
      false,
    );
    expect(pasoEjecutable(ruta('en_curso', 'pendiente'), 1)).toBe(false);
    expect(pasoEjecutable(ruta('bloqueado', 'pendiente'), 1)).toBe(false);
  });

  it('reabrir sólo el último hecho, con nada posterior arrancado', () => {
    expect(pasoReabrible(ruta('hecho', 'pendiente', 'pendiente'), 0)).toBe(
      true,
    );
    expect(pasoReabrible(ruta('hecho', 'hecho', 'pendiente'), 0)).toBe(false);
    expect(pasoReabrible(ruta('hecho', 'hecho', 'pendiente'), 1)).toBe(true);
    expect(pasoReabrible(ruta('hecho', 'en_curso', 'pendiente'), 0)).toBe(
      false,
    );
    expect(pasoReabrible(ruta('hecho', 'bloqueado'), 0)).toBe(false);
  });
});

describe('auto-finalización — ordenSeFinaliza', () => {
  it('completar el último paso pendiente finaliza la OT', () => {
    expect(ordenSeFinaliza('completar', 4, 4)).toBe(true);
  });

  it('completar un paso intermedio no finaliza (quedan pasos)', () => {
    expect(ordenSeFinaliza('completar', 4, 3)).toBe(false);
  });

  it('sólo la acción completar finaliza; el resto nunca', () => {
    expect(ordenSeFinaliza('iniciar', 4, 4)).toBe(false);
    expect(ordenSeFinaliza('bloquear', 4, 4)).toBe(false);
    expect(ordenSeFinaliza('reabrir', 4, 4)).toBe(false);
    expect(ordenSeFinaliza('desbloquear', 4, 4)).toBe(false);
  });

  it('una OT sin pasos materializados no se auto-finaliza', () => {
    expect(ordenSeFinaliza('completar', 0, 0)).toBe(false);
  });
});

describe('numeración OT-AAAA-NNNN', () => {
  it('padStart a 4 dígitos', () => {
    expect(`OT-2026-${String(7).padStart(4, '0')}`).toBe('OT-2026-0007');
    expect(`OT-2026-${String(184).padStart(4, '0')}`).toBe('OT-2026-0184');
    expect(`OT-2026-${String(12345).padStart(4, '0')}`).toBe('OT-2026-12345');
  });
});

// ── Registro de tiempos (docs/registro-tiempos-produccion-diseno.md) ──────

describe('registro de tiempos — sumaTramosMin (D2)', () => {
  const t = (inicioIso: string, finIso: string | null) => ({
    inicioEl: new Date(inicioIso),
    finEl: finIso ? new Date(finIso) : null,
  });

  it('suma sólo tramos cerrados, en minutos', () => {
    expect(
      sumaTramosMin([
        t('2026-07-18T10:00:00Z', '2026-07-18T10:30:00Z'),
        t('2026-07-18T14:00:00Z', '2026-07-18T14:45:00Z'),
      ]),
    ).toBe(75);
  });

  it('el tramo abierto no suma (se cierra antes de asentar)', () => {
    expect(
      sumaTramosMin([
        t('2026-07-18T10:00:00Z', '2026-07-18T10:30:00Z'),
        t('2026-07-18T14:00:00Z', null),
      ]),
    ).toBe(30);
  });

  it('sin tramos → 0', () => {
    expect(sumaTramosMin([])).toBe(0);
  });
});

describe('registro de tiempos — tiempoMedidoValido (D8, anti "1 seg")', () => {
  it('menos de 1 minuto nunca vale', () => {
    expect(tiempoMedidoValido(0.02, null)).toBe(false);
    expect(tiempoMedidoValido(0.5, 3)).toBe(false);
  });

  it('con estimado, exige al menos el 10%', () => {
    expect(tiempoMedidoValido(5, 100)).toBe(false);
    expect(tiempoMedidoValido(10, 100)).toBe(true);
    expect(tiempoMedidoValido(45, 100)).toBe(true);
  });

  it('sin estimado, alcanza con 1 minuto', () => {
    expect(tiempoMedidoValido(1, null)).toBe(true);
    expect(tiempoMedidoValido(1.5, null)).toBe(true);
  });
});

describe('registro de tiempos — corteJornadaDe (D9)', () => {
  it('tramo abierto antes del corte cierra ese mismo día', () => {
    const inicio = new Date('2026-07-17T14:30:00');
    const corte = corteJornadaDe(inicio, '20:00');
    expect(corte.getDate()).toBe(17);
    expect(corte.getHours()).toBe(20);
    expect(corte.getMinutes()).toBe(0);
  });

  it('tramo abierto DESPUÉS del corte (turno noche) cierra al día siguiente', () => {
    const inicio = new Date('2026-07-17T21:15:00');
    const corte = corteJornadaDe(inicio, '20:00');
    expect(corte.getDate()).toBe(18);
    expect(corte.getHours()).toBe(20);
  });

  it('corte malformado cae al default 20:00', () => {
    const inicio = new Date('2026-07-17T10:00:00');
    const corte = corteJornadaDe(inicio, 'corrupto');
    expect(corte.getHours()).toBe(20);
    expect(corte.getMinutes()).toBe(0);
  });
});

describe('registro de tiempos — modoRegistroDeFamilia (D1)', () => {
  it('las familias de impresión se completan de un click', () => {
    for (const codigo of [
      'impresion_por_hoja',
      'impresion_por_area',
      'impresion_por_pieza',
      'aplicacion_transfer',
      'grabado_laser',
    ]) {
      expect(modoRegistroDeFamilia(codigo)).toBe('solo_completar');
    }
  });

  it('el resto usa cronómetro con tramos', () => {
    for (const codigo of [
      'corte_guillotina',
      'trabajo_manual',
      'embalaje',
      'diseno_grafico',
      'pre_prensa',
    ]) {
      expect(modoRegistroDeFamilia(codigo)).toBe('cronometro');
    }
  });

  it('familia desconocida no rompe: cronómetro', () => {
    expect(modoRegistroDeFamilia('familia_inventada')).toBe('cronometro');
  });
});

describe('registro de tiempos — materialización asigna modoRegistro', () => {
  const pasosDesde = (trazabilidad: unknown) =>
    (
      svc() as unknown as {
        pasosDesdeTrazabilidad: (
          tenantId: string,
          ordenId: string,
          itemId: string,
          trazabilidad: unknown,
        ) => Array<Record<string, unknown>>;
      }
    ).pasosDesdeTrazabilidad('t-1', 'o-1', 'i-1', trazabilidad);

  it('impresión → solo_completar; manual → cronometro', () => {
    const pasos = pasosDesde({
      pasos: [
        { familiaCodigo: 'impresion_por_area', activado: true },
        { familiaCodigo: 'corte_manual', activado: true },
      ],
    });
    expect(pasos.map((p) => p.modoRegistro)).toEqual([
      'solo_completar',
      'cronometro',
    ]);
  });
});

describe('OrdenesTrabajoService — gate de descuento al emitir (F3 descuentos)', () => {
  const authDe = (role: string) =>
    ({ userId: 'u-1', tenantId: 't-1', role }) as never;

  /** Service con un prisma fake que devuelve el umbral configurado. */
  const svcConUmbral = (umbral: number | null) => {
    const s = svc() as unknown as {
      prisma: unknown;
      exigirDescuentoEmitible: (
        auth: never,
        items: Array<{ subtotal: number; descuentoMonto?: number | null }>,
      ) => Promise<void>;
    };
    s.prisma = {
      configuracionPresupuestos: {
        findUnique: async () => ({ aprobacionDescuentoMaxPct: umbral }),
      },
    };
    return s;
  };

  // 10.000 de descuento sobre 100.000 de lista = 10%.
  const item = (subtotal: number, descuentoMonto: number | null) => ({
    subtotal,
    descuentoMonto,
  });

  it('OPERADOR con descuento sobre el umbral → rechaza con el porcentaje', async () => {
    await expect(
      svcConUmbral(10).exigirDescuentoEmitible(authDe('OPERADOR'), [
        item(85_000, 15_000), // 15%
      ]),
    ).rejects.toThrow(/15%.*10%/);
  });

  it('el igual al umbral pasa (el gate es estrictamente mayor)', async () => {
    await expect(
      svcConUmbral(10).exigirDescuentoEmitible(authDe('OPERADOR'), [
        item(90_000, 10_000), // exactamente 10%
      ]),
    ).resolves.toBeUndefined();
  });

  it('gatea por la línea más descontada, no por el promedio', async () => {
    await expect(
      svcConUmbral(10).exigirDescuentoEmitible(authDe('OPERADOR'), [
        item(100_000, 0),
        item(80_000, 20_000), // 20% en una sola línea
      ]),
    ).rejects.toThrow(/20%/);
  });

  it('SUPERVISOR y ADMINISTRADOR emiten sin gate', async () => {
    for (const role of ['SUPERVISOR', 'ADMINISTRADOR']) {
      await expect(
        svcConUmbral(10).exigirDescuentoEmitible(authDe(role), [
          item(50_000, 50_000), // 50%
        ]),
      ).resolves.toBeUndefined();
    }
  });

  it('umbral null (regla desactivada) no gatea nada', async () => {
    await expect(
      svcConUmbral(null).exigirDescuentoEmitible(authDe('OPERADOR'), [
        item(10_000, 90_000), // 90%
      ]),
    ).resolves.toBeUndefined();
  });

  it('sin descuento ni siquiera consulta la config', async () => {
    const s = svcConUmbral(10);
    (
      s.prisma as { configuracionPresupuestos: { findUnique: () => never } }
    ).configuracionPresupuestos.findUnique = () => {
      throw new Error('no debería consultar');
    };
    await expect(
      s.exigirDescuentoEmitible(authDe('OPERADOR'), [item(100_000, 0)]),
    ).resolves.toBeUndefined();
  });
});
