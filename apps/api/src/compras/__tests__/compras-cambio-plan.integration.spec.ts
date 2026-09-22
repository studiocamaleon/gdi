import { runWithTenant } from '../../common/tenant-context';
import { NotificacionesService } from '../../integraciones/notificaciones/notificaciones.service';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { InventarioService } from '../../inventario/inventario.service';
import { ReservasMaterialService } from '../../inventario/reservas-material.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { bloquearCupoUsuarios } from '../../suscripciones/cupos-usuarios';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';
import { PlanesAsignacionService } from '../../plataforma/planes/planes-asignacion.service';
import { ComprasService } from '../compras.service';
import { TesoreriaService } from '../../administracion/tesoreria.service';
import { CampanasService } from '../../campanas/campanas.service';
import { DocumentosOrdenService } from '../../impresion/documentos-orden.service';
import { PerfilesImpresionService } from '../../impresion/perfiles-impresion.service';
import type { ImpresionService } from '../../impresion/impresion.service';
import type { ArchivosService } from '../../archivos/archivos.service';
import { ordenImpresionFixture } from '../../../test/fixture-impresion-planes';
import { AfipIntegracionService } from '../../administracion/afip-integracion.service';
import { ConfiguracionFiscalService } from '../../administracion/configuracion-fiscal.service';
import type { AfipSdkProvider } from '../../administracion/invoicing/afip-sdk.provider';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
let baseSegura = false;
beforeAll(async () => {
  const [fila] = await prisma.$queryRaw<
    Array<{ nombre: string }>
  >`SELECT current_database() AS nombre`;
  if (!fila.nombre.endsWith('_test'))
    throw new Error(
      'Esta prueba sólo puede ejecutarse en una base exclusiva terminada en _test.',
    );
  baseSegura = true;
});
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function senal() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

/** Instrumenta el comienzo y el commit, sin sustituir consultas ni locks.
 * Cada llamada usa una transacción y una conexión PostgreSQL independientes. */
function transaccionControlada(omitir = 0) {
  const abierta = senal(),
    escrita = senal(),
    liberar = senal();
  let pid = 0;
  let inicios = 0;
  const cliente = new Proxy(db, {
    get(target, prop) {
      if (prop === '$transaction')
        return (
          run: (tx: Prisma.TransactionClient) => Promise<unknown>,
          opciones?: {
            isolationLevel?: Prisma.TransactionIsolationLevel;
          },
        ) =>
          prisma.$transaction(
            async (tx) => {
              inicios++;
              if (inicios <= omitir) return run(tx);
              [{ pid }] = await tx.$queryRaw<
                Array<{ pid: number }>
              >`SELECT pg_backend_pid() AS pid`;
              abierta.resolver();
              const result = await run(tx);
              escrita.resolver();
              await liberar.promesa;
              return result;
            },
            { ...opciones, timeout: 15000 },
          );
      return Reflect.get(target, prop) as unknown;
    },
  });
  return {
    cliente,
    abierta,
    escrita,
    liberar,
    pid: () => pid,
    inicios: () => inicios,
  };
}

async function comprobarEspera(pid: number, bloqueador: number) {
  const limite = Date.now() + 4000;
  while (Date.now() < limite) {
    const [fila] = await prisma.$queryRaw<Array<{ pids: number[] }>>`
      SELECT pg_blocking_pids(${pid}::int) AS pids`;
    if (fila.pids.includes(bloqueador)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('La operación no esperó al lock de la otra transacción.');
}

function compras(cliente = db) {
  const inventario = new InventarioService(cliente);
  const capacidades = new CapacidadesEmpresaService(cliente);
  return new ComprasService(
    cliente,
    inventario,
    new ReservasMaterialService(cliente, inventario, capacidades),
    capacidades,
  );
}

describe('Compras y cambios de contrato concurrentes', () => {
  let tenantId: string, planId: string, userId: string, ofertaId: string;
  let auth: CurrentAuth, staff: CurrentAuth;
  let versiones: string[], borradores: string[];
  let datos: Parameters<ComprasService['crear']>[1];

  beforeEach(async () => {
    tenantId = planId = userId = ofertaId = '';
    versiones = [];
    borradores = [];
    tenantId = (
      await prisma.tenant.create({
        data: {
          nombre: 'Prueba aislada de concurrencia',
          slug: `compras-plan-${randomUUID()}`,
        },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          email: `compras-plan-${randomUUID()}@test.local`,
          nombreCompleto: 'Ensayo',
          rolPlataforma: 'ADMIN',
        },
      })
    ).id;
    await prisma.userMfa.create({
      data: {
        userId,
        activatedAt: new Date(1),
        recuperacionConfirmadaEl: new Date(2),
      },
    });
    const sesion = await prisma.authSession.create({
      data: {
        userId,
        mfaVerificadoEl: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    auth = {
      userId,
      email: 'compras-plan@test.local',
      tenantId,
      role: 'ADMINISTRADOR',
      membershipId: '',
      sessionId: sesion.id,
    };
    staff = {
      ...auth,
      tenantId: '',
      esPlataforma: true,
      plataformaMfaPendiente: false,
    };
    planId = (
      await prisma.plan.create({
        data: {
          codigo: randomUUID(),
          nombre: 'Plan de prueba',
          precioMensual: 290,
          featuresJson: {},
        },
      })
    ).id;
    for (const i of [0, 1, 2]) {
      const contenido = json({
        ...structuredClone(PROPUESTA_PLANES[i].contenido),
        almacenamientoModo: 'limitado',
        almacenamientoGb: [250, 500, 1500][i],
      });
      const borrador = await prisma.planBorrador.create({
        data: { codigo: randomUUID(), orden: i, contenido },
      });
      borradores.push(borrador.id);
      const version = await prisma.planVersion.create({
        data: {
          borradorId: borrador.id,
          codigo: borrador.codigo,
          numero: 1,
          revisionBorrador: 1,
          catalogoVersion: 1,
          contenido,
          catalogoSnapshot: [],
          publicadoPorId: userId,
          publicadoPorNombre: 'Ensayo',
          motivo: 'Fixture de concurrencia',
        },
      });
      versiones.push(version.id);
    }
    await prisma.suscripcion.create({
      data: {
        tenantId,
        planId,
        planVersionId: versiones[1],
        estado: 'activa',
        proveedor: 'manual',
      },
    });
    ofertaId = (
      await prisma.planOferta.create({
        data: {
          planId,
          versionId: versiones[0],
          entorno: 'sandbox',
          registroPublico: false,
          recomendado: false,
          creadaPorId: userId,
          motivo: 'Fixture de pago pendiente',
        },
      })
    ).id;
    const proveedor = await prisma.proveedor.create({
      data: {
        tenantId,
        nombre: 'Papelera de prueba',
        emailPrincipal: '',
        telefonoCodigo: '',
        telefonoNumero: '',
        paisCodigo: 'AR',
      },
    });
    const materia = await prisma.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'PAPEL',
        nombre: 'Papel A4',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_RIGIDO',
        tipoTecnico: 'test',
        templateId: 'test',
        unidadStock: 'HOJA',
        unidadCompra: 'RESMA',
        atributosTecnicosJson: {},
      },
    });
    const variante = await prisma.materiaPrimaVariante.create({
      data: {
        tenantId,
        materiaPrimaId: materia.id,
        sku: 'A4',
        atributosVarianteJson: {},
        unidadStock: 'HOJA',
        unidadCompra: 'RESMA',
      },
    });
    const almacen = await prisma.almacenMateriaPrima.create({
      data: { tenantId, nombre: 'Depósito', codigo: 'D' },
    });
    const ubicacion = await prisma.almacenMateriaPrimaUbicacion.create({
      data: {
        tenantId,
        almacenId: almacen.id,
        nombre: 'Principal',
        codigo: 'P',
      },
    });
    datos = {
      clave: randomUUID(),
      proveedorId: proveedor.id,
      ubicacionId: ubicacion.id,
      fechaPedido: '2026-09-22',
      moneda: 'ARS',
      tipoCambio: 1,
      lineas: [
        {
          varianteId: variante.id,
          unidadCompra: 'RESMA',
          factorStock: 500,
          cantidad: 1,
          precio: 1000,
          asignaciones: [],
        },
      ],
    };
  });
  afterEach(async () => {
    if (!baseSegura || !tenantId) return;
    await prisma.planContratacion.deleteMany({ where: { tenantId } });
    await prisma.operacionCompra.deleteMany({ where: { tenantId } });
    await prisma.lineaOrdenCompra.deleteMany({ where: { tenantId } });
    await prisma.ordenCompra.deleteMany({ where: { tenantId } });
    await prisma.consumoMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.reservaMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.necesidadMaterialOt.deleteMany({ where: { tenantId } });
    await prisma.operacionReservasMaterial.deleteMany({ where: { tenantId } });
    await prisma.plataformaEvento.deleteMany({
      where: { staffUserId: userId },
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
    // Sólo limpieza del catálogo sintético ya confirmado: el rollback exterior
    // no sirve para pruebas entre conexiones. La excepción a los triggers es
    // local a esta transacción de test; no se modifica su definición global.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
      await tx.planOferta.deleteMany({ where: { planId } });
      await tx.planVersion.deleteMany({ where: { id: { in: versiones } } });
      await tx.planBorrador.deleteMany({ where: { id: { in: borradores } } });
    });
    await prisma.plan.delete({ where: { id: planId } });
    await prisma.user.delete({ where: { id: userId } });
  });
  afterAll(() => prisma.$disconnect());

  function pendiente(estado: string, idOferta = ofertaId) {
    return prisma.planContratacion.create({
      data: {
        tenantId,
        userId,
        ofertaId: idOferta,
        ciclo: 'mensual',
        adicionales: 0,
        tipo: 'checkout',
        estado,
        huella: 'fixture',
        revisionContrato: 0,
        revisionJson: {},
        cobroJson: {},
        expiraEl: new Date(1),
      },
    });
  }

  it.each(['enviando', 'checkout', 'verificar'])(
    'impide abrir compras mientras %s retira su gestión, incluso con revisión vencida',
    async (estado) => {
      const p = await pendiente(estado);
      await expect(compras().crear(auth, datos)).rejects.toMatchObject({
        response: {
          code: 'CAMBIO_PLAN_PENDIENTE',
          capacidades: ['compras', 'recepciones'],
        },
      });
      expect(await prisma.ordenCompra.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.operacionCompra.count({ where: { tenantId } })).toBe(
        0,
      );
      await prisma.planContratacion.update({
        where: { id: p.id },
        data: { estado: 'rechazada' },
      });
      await expect(compras().crear(auth, datos)).resolves.toHaveProperty(
        'ordenId',
      );
    },
  );

  it('una ampliación pendiente que conserva Compras no detiene el trabajo', async () => {
    const oferta = await prisma.planOferta.create({
      data: {
        planId,
        versionId: versiones[2],
        entorno: 'sandbox',
        registroPublico: false,
        recomendado: false,
        creadaPorId: userId,
        motivo: 'Ampliación de prueba',
      },
    });
    try {
      await pendiente('checkout', oferta.id);
      await expect(compras().crear(auth, datos)).resolves.toHaveProperty(
        'ordenId',
      );
    } finally {
      await prisma.planContratacion.deleteMany({
        where: { ofertaId: oferta.id },
      });
    }
  });

  it('conserva consulta, cancelación e idempotencia de compras anteriores durante un cambio pendiente', async () => {
    const servicio = compras();
    const resultado = (await servicio.crear(auth, datos)) as {
      ordenId: string;
    };
    await pendiente('verificar');
    await expect(servicio.crear(auth, datos)).resolves.toEqual(resultado);
    const orden = await servicio.detalle(auth, resultado.ordenId);
    await expect(
      servicio.actuar(auth, orden.id, {
        clave: randomUUID(),
        version: orden.version,
        accion: 'emitir',
      }),
    ).rejects.toMatchObject({ response: { code: 'CAMBIO_PLAN_PENDIENTE' } });
    await servicio.actuar(auth, orden.id, {
      clave: randomUUID(),
      version: orden.version,
      accion: 'cancelar',
      motivo: 'Cerrar compromiso de ensayo',
    });
    expect((await servicio.detalle(auth, orden.id)).estado).toBe('CANCELADA');
  });

  async function solicitud(versionId = versiones[0]) {
    const servicio = new PlanesAsignacionService(db);
    const d = await servicio.diagnostico({ tenantId, versionId });
    expect(d.bloqueos).toEqual([]);
    return {
      tenantId,
      versionId,
      huella: d.huella,
      revision: d.actual.revision,
      motivo: 'Cambio durante prueba concurrente',
      operacionId: randomUUID(),
      revisionesAceptadas: d.revisiones,
    };
  }

  it('la activación fiscal espera un cambio de plan sin confirmar y relee la función después del commit', async () => {
    const propuesta = structuredClone(PROPUESTA_PLANES[0].contenido);
    propuesta.funciones.fiscal_argentina = false;
    propuesta.almacenamientoModo = 'limitado';
    propuesta.almacenamientoGb = 250;
    const borrador = await prisma.planBorrador.create({
      data: { codigo: randomUUID(), orden: 3, contenido: json(propuesta) },
    });
    borradores.push(borrador.id);
    const version = await prisma.planVersion.create({
      data: {
        borradorId: borrador.id,
        codigo: borrador.codigo,
        numero: 1,
        revisionBorrador: 1,
        catalogoVersion: 1,
        contenido: json(propuesta),
        catalogoSnapshot: [],
        publicadoPorId: userId,
        publicadoPorNombre: 'Ensayo',
        motivo: 'Fixture de concurrencia fiscal',
      },
    });
    versiones.push(version.id);
    const config = new ConfiguracionFiscalService(db);
    await config.guardar(auth, {
      razonSocial: 'Ensayo',
      cuit: '30000000015',
      condicionFiscal: 'RI',
    });
    await config.crearPuntoVenta(auth, { numero: 1, nombre: 'Ensayo' });
    const dto = await solicitud(version.id);
    const cambioTx = transaccionControlada();
    // Deja terminar la admisión inicial y observa la transacción que aplicaría el OK.
    const activacionTx = transaccionControlada(1);
    const consultando = senal(),
      respuesta = senal();
    const verificarDelegacion = jest.fn(async () => {
      consultando.resolver();
      await respuesta.promesa;
      return { ok: true, numero: 1 };
    });
    const servicio = new AfipIntegracionService(
      activacionTx.cliente,
      new ConfiguracionFiscalService(activacionTx.cliente),
      {
        disponible: true,
        environment: 'dev',
        verificarDelegacion,
      } as unknown as AfipSdkProvider,
      new CapacidadesEmpresaService(activacionTx.cliente),
    );
    const activacion = servicio.activar(auth);
    void activacion.catch(() => {});
    let cambio: Promise<unknown> | undefined;
    try {
      await consultando.promesa;
      cambio = new PlanesAsignacionService(cambioTx.cliente).asignar(
        staff,
        dto,
      );
      void cambio.catch(() => {});
      await cambioTx.escrita.promesa;
      respuesta.resolver();
      await activacionTx.abierta.promesa;
      await comprobarEspera(activacionTx.pid(), cambioTx.pid());
      cambioTx.liberar.resolver();
      await cambio;
      await expect(activacion).rejects.toMatchObject({
        response: { code: 'CAPACIDAD_NO_DISPONIBLE' },
      });
      expect(
        await prisma.integracionTenant.count({
          where: { tenantId, proveedor: 'AFIP' },
        }),
      ).toBe(0);
      expect(verificarDelegacion).toHaveBeenCalledTimes(1);
    } finally {
      respuesta.resolver();
      cambioTx.liberar.resolver();
      activacionTx.liberar.resolver();
      await Promise.allSettled([activacion, ...(cambio ? [cambio] : [])]);
    }
  });

  function reservas(cliente = db) {
    return new ReservasMaterialService(
      cliente,
      new InventarioService(cliente),
      new CapacidadesEmpresaService(cliente),
    );
  }

  async function prepararImpresion() {
    await prisma.plan.update({
      where: { id: planId },
      data: { featuresJson: { todo: true, impresionDirecta: true } },
    });
    await prisma.suscripcion.update({
      where: { tenantId },
      data: { planVersionId: null },
    });
    const orden = await ordenImpresionFixture(prisma, tenantId);
    await prisma.ordenTrabajoItem.update({
      where: { id: orden.itemId },
      data: {
        jobContextSnapshotJson: {
          _centroCopiado: {
            nombre: 'Ensayo.pdf',
            archivoNombre: 'Ensayo.pdf',
            paginas: 1,
            paginasOriginales: 1,
            copias: 1,
            faz: 1,
            tamano: 'A4',
            color: 'BN',
            gramaje: 80,
            hojas: 1,
          },
        },
      },
    });
    return orden;
  }

  function documentos(cliente: PrismaService) {
    // Encolar no debe leer archivos, firmar ni alcanzar una impresora física.
    const inesperado = () => {
      throw new Error('Transporte inesperado al encolar');
    };
    const archivos = new Proxy({}, { get: inesperado }) as ArchivosService;
    const impresion = new Proxy({}, { get: inesperado }) as ImpresionService;
    return new DocumentosOrdenService(
      cliente,
      archivos,
      impresion,
      new PerfilesImpresionService(cliente, impresion),
    );
  }

  it('si se encola primero, la asignación concurrente exige revisar el nuevo pendiente de impresión', async () => {
    const orden = await prepararImpresion(),
      dto = await solicitud();
    const primera = transaccionControlada(),
      segunda = transaccionControlada();
    const encolado = documentos(primera.cliente).solicitar(auth, orden.ordenId);
    void encolado.catch(() => {});
    let cambio: Promise<unknown> | undefined;
    try {
      await primera.escrita.promesa;
      cambio = new PlanesAsignacionService(segunda.cliente).asignar(staff, dto);
      void cambio.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), primera.pid());
      primera.liberar.resolver();
      await encolado;
      await expect(cambio).rejects.toThrow(
        'Las condiciones de la empresa cambiaron',
      );
      const revisada = await new PlanesAsignacionService(db).diagnostico({
        tenantId,
        versionId: versiones[0],
      });
      expect(revisada.bloqueos).toEqual([]);
      expect(revisada.revisiones).toContain('impresion_sin_envio');
      expect(revisada.diagnostico.hallazgos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: 'impresion_sin_envio',
            cantidad: 1,
          }),
        ]),
      );
      expect(
        (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
          .planVersionId,
      ).toBeNull();
    } finally {
      primera.liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([encolado, ...(cambio ? [cambio] : [])]);
    }
  });

  it('si se asigna primero, encolar respeta la retirada de impresión y no crea solicitudes', async () => {
    const orden = await prepararImpresion(),
      dto = await solicitud();
    const primera = transaccionControlada(),
      segunda = transaccionControlada();
    const cambio = new PlanesAsignacionService(primera.cliente).asignar(
      staff,
      dto,
    );
    void cambio.catch(() => {});
    let encolado: Promise<unknown> | undefined;
    try {
      await primera.escrita.promesa;
      encolado = documentos(segunda.cliente).solicitar(auth, orden.ordenId);
      void encolado.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), primera.pid());
      primera.liberar.resolver();
      await cambio;
      segunda.liberar.resolver();
      await expect(encolado).rejects.toMatchObject({
        response: { code: 'CAPACIDAD_NO_DISPONIBLE' },
      });
      expect(
        await prisma.ordenTrabajoEvento.count({
          where: { tenantId, tipo: 'cola_impresion' },
        }),
      ).toBe(0);
      expect(
        (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
          .planVersionId,
      ).toBe(versiones[0]);
    } finally {
      primera.liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([cambio, ...(encolado ? [encolado] : [])]);
    }
  });

  async function prepararReserva() {
    await reservas().guardarPolitica(tenantId, {
      version: 0,
      habilitada: true,
      incluirConsumibles: false,
      modo: 'AL_EMITIR',
    });
    await prisma.stockMateriaPrimaVariante.create({
      data: {
        tenantId,
        varianteId: datos.lineas[0].varianteId,
        ubicacionId: datos.ubicacionId,
        cantidadDisponible: 10,
        costoPromedio: 2,
      },
    });
    return prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-${randomUUID()}`,
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'DOC',
            nombre: 'Documento',
            familia: 'Documentos',
            cantidad: 1,
            cantidadUnidad: 'u',
            subtotal: 100,
            impuestos: 0,
            total: 100,
            trazabilidadSnapshotJson: {
              pasos: [
                {
                  activado: true,
                  rutaPasoId: 'imprimir',
                  materiales: [
                    {
                      materialVarianteId: datos.lineas[0].varianteId,
                      materialDisplayName: 'Papel',
                      tipoLineaCosto: 'MATERIAL',
                      cantidad: 8,
                      unidad: 'hoja',
                      contextoUnidadesSnapshot: {
                        unidadStock: 'HOJA',
                        unidadCompra: 'RESMA',
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    });
  }

  async function reservarOrden(
    cliente: PrismaService,
    id: string,
    automatica: boolean,
  ) {
    const servicio = reservas(cliente);
    if (automatica)
      return cliente.$transaction((tx) =>
        servicio.sincronizarOrdenTx(tx, tenantId, id, { alEmitir: true }),
      );
    const { revision } = await reservas().consultar(tenantId, id);
    return servicio.ejecutar(auth, id, {
      clave: randomUUID(),
      revision,
      accion: 'reservar',
    });
  }

  it.each([true, false])(
    'si la reserva (automática=%s) se guarda primero, el cambio debe revisar el compromiso',
    async (automatica) => {
      const o = await prepararReserva(),
        dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const reserva = reservarOrden(primera.cliente, o.id, automatica);
      void reserva.catch(() => {});
      let cambio: Promise<unknown> | undefined;
      try {
        await primera.escrita.promesa;
        cambio = new PlanesAsignacionService(segunda.cliente).asignar(
          staff,
          dto,
        );
        void cambio.catch(() => {});
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await reserva;
        await expect(cambio).rejects.toThrow(
          'Las condiciones de la empresa cambiaron',
        );
        expect(
          Number(
            (
              await prisma.reservaMaterialOt.findFirstOrThrow({
                where: { tenantId },
              })
            ).cantidad,
          ),
        ).toBe(8);
        expect(
          (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
            .planVersionId,
        ).toBe(versiones[1]);
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([reserva, ...(cambio ? [cambio] : [])]);
      }
    },
  );

  it.each([true, false])(
    'si el plan cambia primero, la reserva (automática=%s) respeta la función retirada',
    async (automatica) => {
      const o = await prepararReserva(),
        dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const cambio = new PlanesAsignacionService(primera.cliente).asignar(
        staff,
        dto,
      );
      let reserva: Promise<unknown> | undefined;
      try {
        await primera.escrita.promesa;
        reserva = reservarOrden(segunda.cliente, o.id, automatica);
        void reserva.catch(() => {});
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await cambio;
        segunda.liberar.resolver();
        if (automatica) await expect(reserva).resolves.toBeUndefined();
        else
          await expect(reserva).rejects.toMatchObject({
            response: {
              code: 'CAPACIDAD_NO_DISPONIBLE',
              capacidad: 'reservas',
            },
          });
        expect(
          await prisma.necesidadMaterialOt.count({ where: { tenantId } }),
        ).toBe(0);
        expect(
          (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: o.id } }))
            .materialesControlados,
        ).toBe(false);
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([cambio, ...(reserva ? [reserva] : [])]);
      }
    },
  );

  it('el lock del contrato permite inserciones de otros módulos que sólo referencian la empresa', async () => {
    const control = transaccionControlada();
    const compra = compras(control.cliente).crear(auth, datos);
    try {
      await control.escrita.promesa;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '1000ms'`;
        await tx.proveedor.create({
          data: {
            tenantId,
            nombre: 'Proveedor independiente',
            emailPrincipal: '',
            telefonoCodigo: '',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
      });
    } finally {
      control.liberar.resolver();
      await compra;
    }
  });

  it('si la compra se guarda primero, la asignación concurrente debe revisar el nuevo compromiso', async () => {
    const dto = await solicitud();
    const primera = transaccionControlada(),
      segunda = transaccionControlada();
    const compra = compras(primera.cliente).crear(auth, datos);
    let cambio: Promise<unknown> | undefined;
    try {
      await primera.escrita.promesa;
      cambio = new PlanesAsignacionService(segunda.cliente).asignar(staff, dto);
      void cambio.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), primera.pid());
      primera.liberar.resolver();
      await expect(compra).resolves.toHaveProperty('ordenId');
      await expect(cambio).rejects.toThrow(
        'Las condiciones de la empresa cambiaron',
      );
      expect(
        (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
          .planVersionId,
      ).toBe(versiones[1]);
    } finally {
      primera.liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([compra, ...(cambio ? [cambio] : [])]);
    }
  });

  it('si la asignación se guarda primero, una compra que ya pasó el control inicial revalida y se rechaza', async () => {
    const dto = await solicitud();
    const primera = transaccionControlada(),
      segunda = transaccionControlada();
    const cambio = new PlanesAsignacionService(primera.cliente).asignar(
      staff,
      dto,
    );
    let compra: Promise<unknown> | undefined;
    try {
      await primera.escrita.promesa;
      compra = compras(segunda.cliente).crear(auth, datos);
      void compra.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), primera.pid());
      primera.liberar.resolver();
      await cambio;
      await expect(compra).rejects.toMatchObject({
        response: { code: 'CAPACIDAD_NO_DISPONIBLE', capacidad: 'compras' },
      });
      expect(await prisma.ordenCompra.count({ where: { tenantId } })).toBe(0);
    } finally {
      primera.liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([cambio, ...(compra ? [compra] : [])]);
    }
  });

  it('una transferencia SERIALIZABLE reintenta con el contrato nuevo después de esperar una asignación', async () => {
    const origen = await prisma.cuentaFondos.create({
      data: { tenantId, tipo: 'banco', nombre: 'Origen', saldo: 100 },
    });
    const destino = await prisma.cuentaFondos.create({
      data: { tenantId, tipo: 'banco', nombre: 'Destino', saldo: 0 },
    });
    const dto = await solicitud();
    const primera = transaccionControlada(),
      segunda = transaccionControlada();
    const cambio = new PlanesAsignacionService(primera.cliente).asignar(
      staff,
      dto,
    );
    let transferencia: Promise<unknown> | undefined;
    try {
      await primera.escrita.promesa;
      transferencia = new TesoreriaService(
        segunda.cliente,
        {} as never,
      ).transferir(auth, {
        desdeCuentaId: origen.id,
        haciaCuentaId: destino.id,
        monto: 10,
        idempotencyKey: randomUUID(),
      });
      void transferencia.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), primera.pid());
      primera.liberar.resolver();
      await cambio;
      await expect(transferencia).rejects.toMatchObject({
        response: { code: 'CAPACIDAD_NO_DISPONIBLE', capacidad: 'tesoreria' },
      });
      expect(segunda.inicios()).toBe(2);
      expect(await prisma.movimientoFondos.count({ where: { tenantId } })).toBe(
        0,
      );
      expect(
        Number(
          (
            await prisma.cuentaFondos.findUniqueOrThrow({
              where: { id: origen.id },
            })
          ).saldo,
        ),
      ).toBe(100);
    } finally {
      primera.liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([
        cambio,
        ...(transferencia ? [transferencia] : []),
      ]);
    }
  });

  async function prepararProyecto(modo: 'crear' | 'reabrir') {
    const cliente = await prisma.cliente.create({
      data: {
        tenantId,
        nombre: 'Cliente de prueba',
        telefonoCodigo: '+54',
        telefonoNumero: '1111111111',
        paisCodigo: 'AR',
      },
    });
    const existente =
      modo === 'reabrir'
        ? await prisma.proyectoCampana.create({
            data: {
              tenantId,
              clienteId: cliente.id,
              codigo: 'CAM-CERRADA',
              nombre: 'Campaña cerrada',
              estado: 'completado',
            },
          })
        : null;
    return (conexion: PrismaService) => {
      const servicio = new CampanasService(conexion);
      return existente
        ? servicio.cambiarEstado(auth, existente.id, {
            estado: 'activo',
            updatedAt: existente.updatedAt.toISOString(),
          })
        : servicio.crear(auth, {
            nombre: 'Campaña nueva',
            clienteId: cliente.id,
          });
    };
  }

  it.each(['crear', 'reabrir'] as const)(
    'al %s primero una campaña, el cambio de plan concurrente revisa el compromiso',
    async (modo) => {
      const operar = await prepararProyecto(modo);
      const dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const trabajo = operar(primera.cliente);
      let cambio: Promise<unknown> | undefined;
      try {
        await primera.escrita.promesa;
        cambio = new PlanesAsignacionService(segunda.cliente).asignar(
          staff,
          dto,
        );
        void cambio.catch(() => {});
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await trabajo;
        await expect(cambio).rejects.toThrow(
          'Las condiciones de la empresa cambiaron',
        );
        expect(
          (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
            .planVersionId,
        ).toBe(versiones[1]);
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([trabajo, ...(cambio ? [cambio] : [])]);
      }
    },
  );

  it.each(['crear', 'reabrir'] as const)(
    'si el cambio de plan confirma primero, impide %s la campaña en espera',
    async (modo) => {
      const operar = await prepararProyecto(modo);
      const dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const cambio = new PlanesAsignacionService(primera.cliente).asignar(
        staff,
        dto,
      );
      let trabajo: Promise<unknown> | undefined;
      try {
        await primera.escrita.promesa;
        trabajo = operar(segunda.cliente);
        void trabajo.catch(() => {});
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await cambio;
        await expect(trabajo).rejects.toMatchObject({
          response: { code: 'CAPACIDAD_NO_DISPONIBLE', capacidad: 'proyectos' },
        });
        expect(
          await prisma.proyectoCampana.count({
            where: { tenantId, estado: { in: ['borrador', 'activo'] } },
          }),
        ).toBe(0);
        expect(
          await prisma.proyectoCampanaEvento.count({ where: { tenantId } }),
        ).toBe(0);
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([cambio, ...(trabajo ? [trabajo] : [])]);
      }
    },
  );

  it('revisa un checkout que comenzó mientras la compra esperaba el contrato', async () => {
    const escrita = senal(),
      liberar = senal();
    let pid = 0;
    const inicio = prisma.$transaction(
      async (tx) => {
        await bloquearCupoUsuarios(tx, tenantId);
        [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        await tx.planContratacion.create({
          data: {
            tenantId,
            userId,
            ofertaId,
            ciclo: 'mensual',
            adicionales: 0,
            tipo: 'checkout',
            estado: 'checkout',
            huella: 'fixture',
            revisionContrato: 0,
            revisionJson: {},
            cobroJson: {},
            expiraEl: new Date(1),
          },
        });
        escrita.resolver();
        await liberar.promesa;
      },
      { timeout: 15000 },
    );
    const segunda = transaccionControlada();
    let compra: Promise<unknown> | undefined;
    try {
      await escrita.promesa;
      compra = compras(segunda.cliente).crear(auth, datos);
      void compra.catch(() => {});
      await segunda.abierta.promesa;
      await comprobarEspera(segunda.pid(), pid);
      liberar.resolver();
      await inicio;
      await expect(compra).rejects.toMatchObject({
        response: { code: 'CAMBIO_PLAN_PENDIENTE' },
      });
      expect(await prisma.ordenCompra.count({ where: { tenantId } })).toBe(0);
    } finally {
      liberar.resolver();
      segunda.liberar.resolver();
      await Promise.allSettled([inicio, ...(compra ? [compra] : [])]);
    }
  });
  async function prepararAviso(canal: string) {
    await prisma.configuracionNotificaciones.create({
      data: { tenantId, canalOrdenes: canal, pausado: false },
    });
    const cliente = await prisma.cliente.create({
      data: {
        tenantId,
        nombre: 'Cliente sintético',
        telefonoCodigo: '+54',
        telefonoNumero: '2966123456',
        paisCodigo: 'AR',
        aceptaWhatsapp: true,
      },
    });
    const despachar = jest.fn().mockResolvedValue({ estado: 'nada' });
    const encolar = (clienteDb: PrismaService) =>
      runWithTenant(tenantId, () =>
        new NotificacionesService(clienteDb, { despachar } as never).encolar({
          evento: 'orden_recibida',
          entidadId: randomUUID(),
          clienteId: cliente.id,
          parametros: [
            'Cliente',
            'OT-1',
            '22/09/2026',
            'https://fixture.invalid/ot',
          ],
        }),
      );
    return { encolar, despachar };
  }

  it.each(['WATI', 'WHATSAPP_WEB'])(
    'el aviso %s confirmado primero impide retirar su canal con un diagnóstico anterior',
    async (canal) => {
      const x = await prepararAviso(canal),
        dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const trabajo = x.encolar(primera.cliente);
      let cambio: Promise<unknown> | undefined;
      try {
        await primera.escrita.promesa;
        cambio = new PlanesAsignacionService(segunda.cliente).asignar(
          staff,
          dto,
        );
        void cambio.catch(() => {});
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await expect(trabajo).resolves.toMatchObject({ encolada: true });
        await expect(cambio).rejects.toThrow(
          'Las condiciones de la empresa cambiaron',
        );
        expect(
          (await prisma.suscripcion.findUniqueOrThrow({ where: { tenantId } }))
            .planVersionId,
        ).toBe(versiones[1]);
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([trabajo, ...(cambio ? [cambio] : [])]);
      }
    },
  );

  it.each(['WATI', 'WHATSAPP_WEB'])(
    'si el cambio de plan confirma primero, el aviso %s en espera no se encola ni despacha',
    async (canal) => {
      const x = await prepararAviso(canal),
        dto = await solicitud();
      const primera = transaccionControlada(),
        segunda = transaccionControlada();
      const cambio = new PlanesAsignacionService(primera.cliente).asignar(
        staff,
        dto,
      );
      let trabajo: ReturnType<typeof x.encolar> | undefined;
      try {
        await primera.escrita.promesa;
        trabajo = x.encolar(segunda.cliente);
        await segunda.abierta.promesa;
        await comprobarEspera(segunda.pid(), primera.pid());
        primera.liberar.resolver();
        await cambio;
        segunda.liberar.resolver();
        await expect(trabajo).resolves.toMatchObject({ encolada: false });
        expect(
          await prisma.notificacionWhatsapp.count({ where: { tenantId } }),
        ).toBe(0);
        expect(x.despachar).not.toHaveBeenCalled();
      } finally {
        primera.liberar.resolver();
        segunda.liberar.resolver();
        await Promise.allSettled([cambio, ...(trabajo ? [trabajo] : [])]);
      }
    },
  );
});
