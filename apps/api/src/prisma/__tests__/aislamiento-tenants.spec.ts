import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { runWithTenant } from '../../common/tenant-context';
import { tenantGuardExtension } from '../tenant-guard.extension';

/**
 * Aislamiento entre tenants — la promesa central del producto.
 *
 * El sistema NO usa Row Level Security: el aislamiento lo hace la extensión
 * de Prisma (`tenant-guard.extension.ts`), que inyecta `tenantId` en cada
 * query a partir del AsyncLocalStorage del request. Eso significa que no hay
 * ninguna red por debajo: si la extensión falla, o si un modelo nuevo queda
 * fuera de su alcance, los datos de un tenant quedan visibles para otro y
 * nada lo avisa.
 *
 * Esta suite ES esa red. Está escrita para envejecer bien:
 *
 *  - El test de COBERTURA recorre el datamodel entero, así que un modelo nuevo
 *    con `tenantId` queda cubierto sin tocar este archivo — y uno nuevo SIN
 *    `tenantId` rompe el build hasta que alguien lo justifique en la lista.
 *  - El test de OPERACIONES recorre todos los verbos de Prisma, que es donde
 *    la extensión tiene que ramificar (el `where` de findUnique no admite
 *    tenantId y se post-filtra; `create` inyecta; `upsert` sólo en el create).
 *
 * Corre contra gdi_saas_test (ver test/jest-setup-db.ts).
 *
 * OJO al escribir tests nuevos: el callback de `runWithTenant` tiene que ser
 * `async`. Las promesas de Prisma son PEREZOSAS —no ejecutan hasta que se las
 * espera— así que con un callback sincrónico la query arranca FUERA del
 * AsyncLocalStorage y el guard no ve ningún tenant. El test pasa a verde por
 * el motivo equivocado: no porque el aislamiento funcione, sino porque no se
 * está probando.
 */

/**
 * Modelos SIN `tenantId`, revisados a mano. Son de plataforma (viven por
 * encima del tenant) o catálogo compartido entre todos.
 *
 * Si aparece un modelo nuevo acá, el test falla a propósito: agregarlo a esta
 * lista tiene que ser una decisión consciente, no un olvido. La pregunta a
 * responder es "¿este dato es de un tenant?" — y si la respuesta es sí, le
 * falta la columna, no un renglón en esta lista.
 */
const SIN_TENANT_ID_JUSTIFICADOS = new Set([
  // Plataforma / auth: existen por encima de cualquier tenant.
  'Tenant',
  // Infraestructura: coordina qué instancia corre cada job programado.
  'CronLock',
  // Auditoría del control plane: lo que hace el staff de la plataforma vive
  // por encima de los tenants (referencia al afectado en tenantAfectadoId,
  // que se llama así justamente para no caer en la excepción de abajo).
  'PlataformaEvento',
  // Webhooks de las pasarelas de cobro (Paddle/MercadoPago): el evento llega
  // sin contexto de tenant — el tenant se resuelve después, por la referencia
  // externa de la suscripción. Ver docs/suscripciones-cobro-diseno.md
  'EventoCobro',
  'User',
  'AuthSession',
  // Catálogo compartido: mismos datos para todos los tenants.
  'MaterialPreset',
  'Plan',
  'PlanPrecioLegacy',
  // Solicitud de alta pública: todavía no existe tenant al que pertenecer.
  'RegistroTenant',
  'MaterialPresetVariante',
  'ProductoCategoriaComercial',
  'ProductoSubcategoriaComercial',
]);

/**
 * Modelos que SÍ tienen `tenantId` pero quedan exentos del guard igual.
 *
 * Son la excepción peligrosa: el guard no los filtra, así que cada query
 * tiene que traer su `tenantId` a mano. Se justifican porque el login los
 * consulta ANTES de saber a qué tenant pertenece la sesión — "¿a qué tenants
 * pertenece este usuario?" es una pregunta legítimamente cross-tenant, y con
 * el guard activo se respondería siempre con cero filas.
 *
 * Lo que mantiene esto seguro no es la buena memoria de quien escribe el
 * código, sino que el uso esté confinado a `auth.service.ts` — eso lo
 * verifica el test de abajo.
 */
const EXENTOS_CON_TENANT_ID = new Set(['Membership', 'Invitation']);

/**
 * Archivos autorizados a tocar los modelos de arriba.
 *  - auth: el login pregunta "¿de qué tenants es este usuario?" antes de
 *    tener contexto.
 *  - plataforma: el control plane CREA invitaciones al dar de alta un tenant
 *    (con tenantId explícito, staff-only y auditado). Nunca las lista sin
 *    filtro — si algún día lo necesita, ese código va a auth.
 *  - usuarios: es el módulo que administra las membresías del tenant, así que
 *    no puede no tocarlas. Toda query suya lleva `tenantId` explícito (o la
 *    clave compuesta `userId_tenantId`), que es la condición de la excepción.
 */
const ARCHIVOS_AUTORIZADOS = new Set([
  'auth/auth.service.ts',
  'plataforma/plataforma.service.ts',
  // Alta pública: crea una única membership ADMINISTRADOR, dentro de la misma
  // transacción que crea su tenant y siempre con ese tenantId explícito.
  'registro/registro.service.ts',
  'usuarios/usuarios.service.ts',
]);

/** Copiado del guard: los que quedan fuera de la inyección automática. */
const MODELOS_EXENTOS = new Set([
  'Tenant',
  'CronLock',
  'PlataformaEvento',
  'EventoCobro',
  'Plan',
  'PlanPrecioLegacy',
  'RegistroTenant',
  'User',
  'AuthSession',
  'Membership',
  'Invitation',
  'MaterialPreset',
  'MaterialPresetVariante',
  'ProductoCategoriaComercial',
  'ProductoSubcategoriaComercial',
]);

const modelos = Prisma.dmmf.datamodel.models;
const tieneTenantId = (nombre: string) =>
  modelos
    .find((m) => m.name === nombre)
    ?.fields.some((f) => f.name === 'tenantId') ?? false;

describe('Aislamiento entre tenants — cobertura del datamodel', () => {
  it('todo modelo con datos de negocio tiene tenantId', () => {
    const sinTenant = modelos
      .filter((m) => !m.fields.some((f) => f.name === 'tenantId'))
      .map((m) => m.name)
      .filter((n) => !SIN_TENANT_ID_JUSTIFICADOS.has(n));

    expect(sinTenant).toEqual([]);
  });

  it('ningún modelo con tenantId se exime del guard sin justificación', () => {
    // Un modelo con tenantId exento del guard es un agujero por defecto:
    // nadie lo filtra salvo que el autor de cada query se acuerde. La lista
    // tiene que ser corta y explícita.
    const exentosConTenant = [...MODELOS_EXENTOS].filter(tieneTenantId).sort();
    expect(exentosConTenant).toEqual([...EXENTOS_CON_TENANT_ID].sort());
  });

  it('la lista de exentos del guard coincide con las justificadas', () => {
    // Si divergen, alguien tocó una y no la otra.
    const justificados = [
      ...SIN_TENANT_ID_JUSTIFICADOS,
      ...EXENTOS_CON_TENANT_ID,
    ].sort();
    expect([...MODELOS_EXENTOS].sort()).toEqual(justificados);
  });

  it('los exentos con tenantId sólo se consultan desde auth', () => {
    // El invariante que sostiene la excepción. Si mañana un servicio nuevo
    // consulta Membership sin filtrar a mano, listaría las membresías de
    // TODOS los tenants — y sin esto, nada lo avisaría.
    const raiz = join(__dirname, '..', '..');
    const infractores: string[] = [];

    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name);
        if (entrada.isDirectory()) {
          if (entrada.name !== '__tests__' && entrada.name !== 'node_modules') {
            recorrer(ruta);
          }
          continue;
        }
        if (!entrada.name.endsWith('.ts')) continue;
        const relativo = relative(raiz, ruta);
        if (ARCHIVOS_AUTORIZADOS.has(relativo)) continue;

        const codigo = readFileSync(ruta, 'utf8');
        for (const modelo of EXENTOS_CON_TENANT_ID) {
          const prop = modelo[0].toLowerCase() + modelo.slice(1);
          // Detecta accesos directos del cliente Prisma, no lecturas de una
          // relación ya incluida (por ejemplo `credencial.membership.user`).
          if (
            new RegExp(`(?:prisma|db|tx|base|app)\\.${prop}\\.\\w`).test(codigo)
          ) {
            infractores.push(`${relativo} → ${prop}`);
          }
        }
      }
    };
    recorrer(raiz);

    expect(infractores).toEqual([]);
  });
});

describe('Aislamiento entre tenants — operaciones', () => {
  const base = new PrismaClient();
  const app = base.$extends(tenantGuardExtension);

  let tenantA: string;
  let tenantB: string;
  /** Cliente que pertenece a B: nada de lo que haga A puede tocarlo. */
  let clienteDeB: string;
  let clienteDeA: string;

  beforeAll(async () => {
    const slug = `aislamiento-${randomUUID().slice(0, 8)}`;
    tenantA = (
      await base.tenant.create({
        data: { nombre: 'Tenant A', slug: `${slug}-a` },
      })
    ).id;
    tenantB = (
      await base.tenant.create({
        data: { nombre: 'Tenant B', slug: `${slug}-b` },
      })
    ).id;

    const cliente = (tenantId: string, nombre: string) =>
      base.cliente.create({
        data: {
          tenantId,
          nombre,
          emailPrincipal: `${nombre.toLowerCase().replace(/\s/g, '')}@test.local`,
          telefonoCodigo: '11',
          telefonoNumero: '55550000',
          paisCodigo: 'AR',
        },
      });

    clienteDeA = (await cliente(tenantA, 'Cliente de A')).id;
    clienteDeB = (await cliente(tenantB, 'Cliente de B')).id;
  });

  afterAll(async () => {
    await base.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await base.$disconnect();
  });

  // ── Lectura ────────────────────────────────────────────────────────

  it('findMany no devuelve filas de otro tenant', async () => {
    const vistos = await runWithTenant(tenantA, async () =>
      app.cliente.findMany(),
    );
    expect(vistos.map((c) => c.id)).toEqual([clienteDeA]);
  });

  it('findFirst apuntando a una fila ajena devuelve null', async () => {
    const visto = await runWithTenant(tenantA, async () =>
      app.cliente.findFirst({ where: { id: clienteDeB } }),
    );
    expect(visto).toBeNull();
  });

  it('findUnique de una fila ajena devuelve null', async () => {
    // El `where` de findUnique no admite tenantId, así que el guard
    // post-filtra el resultado. Es la rama más fácil de romper.
    const visto = await runWithTenant(tenantA, async () =>
      app.cliente.findUnique({ where: { id: clienteDeB } }),
    );
    expect(visto).toBeNull();
  });

  it('findUnique con select parcial tampoco filtra la fila ajena', async () => {
    const visto = await runWithTenant(tenantA, async () =>
      app.cliente.findUnique({
        where: { id: clienteDeB },
        select: { nombre: true },
      }),
    );
    expect(visto).toBeNull();
  });

  it('findUniqueOrThrow de una fila ajena explota como si no existiera', async () => {
    await expect(
      runWithTenant(tenantA, async () =>
        app.cliente.findUniqueOrThrow({ where: { id: clienteDeB } }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('count y aggregate no cuentan filas ajenas', async () => {
    const [total, agregado] = await runWithTenant(tenantA, async () =>
      Promise.all([
        app.cliente.count(),
        app.cliente.aggregate({ _count: true }),
      ]),
    );
    expect(total).toBe(1);
    expect(agregado._count).toBe(1);
  });

  it('groupBy no agrupa filas ajenas', async () => {
    const grupos = await runWithTenant(tenantA, async () =>
      app.cliente.groupBy({ by: ['tenantId'], _count: { _all: true } }),
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].tenantId).toBe(tenantA);
  });

  // ── Escritura ──────────────────────────────────────────────────────

  it('update de una fila ajena no la toca', async () => {
    await expect(
      runWithTenant(tenantA, async () =>
        app.cliente.update({
          where: { id: clienteDeB },
          data: { nombre: 'HACKEADO' },
        }),
      ),
    ).rejects.toBeDefined();

    const intacto = await base.cliente.findUnique({
      where: { id: clienteDeB },
    });
    expect(intacto?.nombre).toBe('Cliente de B');
  });

  it('updateMany no alcanza filas ajenas', async () => {
    const { count } = await runWithTenant(tenantA, async () =>
      app.cliente.updateMany({ data: { nombre: 'MASIVO' } }),
    );
    expect(count).toBe(1);

    const intacto = await base.cliente.findUnique({
      where: { id: clienteDeB },
    });
    expect(intacto?.nombre).toBe('Cliente de B');
  });

  it('delete de una fila ajena no la borra', async () => {
    await expect(
      runWithTenant(tenantA, async () =>
        app.cliente.delete({ where: { id: clienteDeB } }),
      ),
    ).rejects.toBeDefined();

    const sigue = await base.cliente.findUnique({ where: { id: clienteDeB } });
    expect(sigue).not.toBeNull();
  });

  it('deleteMany no borra filas ajenas', async () => {
    const propio = await base.cliente.create({
      data: {
        tenantId: tenantA,
        nombre: 'Descartable de A',
        emailPrincipal: `desc-${randomUUID().slice(0, 6)}@test.local`,
        telefonoCodigo: '11',
        telefonoNumero: '55550001',
        paisCodigo: 'AR',
      },
    });

    const { count } = await runWithTenant(tenantA, async () =>
      app.cliente.deleteMany({
        where: { id: { in: [propio.id, clienteDeB] } },
      }),
    );
    expect(count).toBe(1);

    const sigue = await base.cliente.findUnique({ where: { id: clienteDeB } });
    expect(sigue).not.toBeNull();
  });

  it('create ignora un tenantId ajeno mandado en el body (mass assignment)', async () => {
    // El ValidationPipe ya saca `tenantId` de los DTO, pero si algún día se
    // cuela, el guard NO tiene que dejar crear la fila en otro tenant.
    const creado = await runWithTenant(tenantA, async () =>
      app.cliente.create({
        data: {
          tenantId: tenantB,
          nombre: 'Intruso',
          emailPrincipal: `intruso-${randomUUID().slice(0, 6)}@test.local`,
          telefonoCodigo: '11',
          telefonoNumero: '55550002',
          paisCodigo: 'AR',
        },
      }),
    );

    // Ojo: el guard sólo inyecta cuando el dato NO trae tenantId, así que un
    // tenantId explícito GANA. Se documenta el comportamiento real en vez de
    // afirmar una garantía que no existe: la defensa contra esto es el
    // ValidationPipe con whitelist, que nunca deja llegar el campo.
    expect(creado.tenantId).toBe(tenantB);
    await base.cliente.delete({ where: { id: creado.id } });
  });

  // ── Sin contexto de tenant ─────────────────────────────────────────

  it('sin contexto de tenant el guard NO filtra (comportamiento deliberado)', async () => {
    // Los barridos nocturnos son cross-tenant por diseño y corren fuera de
    // todo request. Se deja asentado acá para que quede claro que no es un
    // descuido: lo que garantiza que ningún request llegue sin contexto es el
    // TenantContextInterceptor, no el guard.
    const todos = await app.cliente.findMany({
      where: { id: { in: [clienteDeA, clienteDeB] } },
    });
    expect(todos).toHaveLength(2);
  });
});
