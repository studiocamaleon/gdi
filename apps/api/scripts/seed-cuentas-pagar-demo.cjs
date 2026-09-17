// Ejecución manual sólo en desarrollo: node --env-file=.env -r ts-node/register/transpile-only scripts/seed-cuentas-pagar-demo.cjs --tenant UUID --aplicar
const { PrismaClient } = require('@prisma/client');
const { EgresosService } = require('../src/egresos/egresos.service');
const { writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const p = new PrismaClient();
const tenantId = process.argv[process.argv.indexOf('--tenant') + 1];
const marca = 'DEMO-CXP-20260916';
async function main() {
  const u = new URL(process.env.DATABASE_URL);
  if (
    !['localhost', '127.0.0.1'].includes(u.hostname) ||
    u.pathname !== '/gdi_saas' ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error('Sólo base local de desarrollo gdi_saas.');
  if (!process.argv.includes('--aplicar') || !/^[\da-f-]{36}$/i.test(tenantId))
    throw new Error('Requiere --tenant UUID --aplicar.');
  const m = await p.membership.findFirstOrThrow({
    where: { tenantId, rol: 'ADMINISTRADOR', activa: true },
  });
  const auth = {
    tenantId,
    userId: m.userId,
    membershipId: m.id,
    role: 'ADMINISTRADOR',
    sessionId: 'demo-cxp',
    email: 'demo@example.invalid',
  };
  const service = new EgresosService(p, null, null, null);
  const cats = await p.categoriaEgreso.findMany({
    where: { tenantId, activo: true },
  });
  const cat = (code) => {
    const c = cats.find((c) => c.codigo === code);
    if (!c) throw new Error(`Falta categoría ${code}`);
    return c.id;
  };
  const proveedores = [];
  for (const [nombre, slug, dias] of [
    ['DEMO · Papelera del Sur', 'papelera', 30],
    ['DEMO · Insumos Sign', 'sign', 15],
    ['DEMO · Servicios de taller', 'taller', 7],
  ])
    proveedores.push(
      await p.proveedor.upsert({
        where: { tenantId_nombre: { tenantId, nombre } },
        update: {},
        create: {
          tenantId,
          nombre,
          razonSocial: nombre,
          emailPrincipal: `${slug}@example.invalid`,
          telefonoCodigo: '+54',
          telefonoNumero: '',
          paisCodigo: 'AR',
          condicionPagoDias: dias,
        },
      }),
    );
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Rio_Gallegos',
  }).format(new Date());
  const fecha = (dias) => {
    const d = new Date(hoy + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  const specs = [
    ['Papel ilustración · reposición', 0, -105, 128450.75, 'materiales'],
    ['Tintas UV y consumibles', 1, -73, 246890.3, 'materiales'],
    ['Mantenimiento de taller', 2, -42, 96800.5, 'servicios'],
    ['Vinilo y laminado', 1, -12, 387250.8, 'materiales'],
    ['Papel para producción', 0, 0, 185620.45, 'materiales'],
    ['Flete de insumos', null, 2, 28500.25, 'fletes'],
    ['Servicio eléctrico', 2, 6, 134785.9, 'servicios'],
    ['Rollos de vinilo · compra en cuotas', 1, 21, 450000.75, 'materiales', 3],
  ];
  const creados = [];
  for (const [nombre, prov, dias, neto, cod, cuotas] of specs) {
    const descripcion = `DEMO · ${nombre}`;
    const old = await p.egreso.findFirst({
      where: {
        tenantId,
        notas: marca,
        descripcion: { startsWith: descripcion },
      },
    });
    if (old) {
      creados.push(old);
      continue;
    }
    const result = await service.crear(auth, {
      descripcion,
      categoriaEgresoId: cat(cod),
      ...(prov === null
        ? { beneficiarioNombre: 'DEMO · Flete local' }
        : { proveedorId: proveedores[prov].id }),
      fechaCompetencia: fecha(Math.min(dias - 10, 0)),
      fechaVencimiento: fecha(dias),
      neto,
      iva: 0,
      tipoComprobante: 'SIN_DOCUMENTO',
      notas: marca,
      ...(cuotas ? { cuotas } : {}),
    });
    creados.push(
      await p.egreso.findUniqueOrThrow({ where: { id: result.id } }),
    );
  }
  const cuenta = await p.cuentaFondos.upsert({
    where: { tenantId_nombre: { tenantId, nombre: 'DEMO · Banco de pruebas' } },
    update: {},
    create: {
      tenantId,
      nombre: 'DEMO · Banco de pruebas',
      tipo: 'banco',
      banco: 'Banco ficticio DEMO',
      moneda: 'ARS',
      permiteSaldoNegativo: true,
    },
  });
  const metodo = await p.metodoPago.upsert({
    where: { tenantId_codigo: { tenantId, codigo: 'demo_cxp_transferencia' } },
    update: {},
    create: {
      tenantId,
      codigo: 'demo_cxp_transferencia',
      nombre: 'DEMO · Transferencia de prueba',
      tipo: 'transferencia',
      cuentaDestinoId: cuenta.id,
    },
  });
  const parcial = creados.find(
    (e) => e.descripcion === 'DEMO · Vinilo y laminado',
  );
  if (!parcial) throw new Error('No se encontró el egreso parcial.');
  const pago = await service.registrarPago(auth, {
    idempotencyKey: marca,
    metodoPagoId: metodo.id,
    cuentaOrigenId: cuenta.id,
    fecha: hoy,
    referencia: marca,
    notas: 'Pago ficticio para revisión visual en desarrollo.',
    imputaciones: [{ egresoId: parcial.id, monto: 31250.55 }],
  });
  const egresos = await p.egreso.findMany({
    where: { tenantId, notas: marca },
    select: {
      id: true,
      numero: true,
      descripcion: true,
      total: true,
      pagadoTotal: true,
      estado: true,
    },
  });
  const manifest = {
    marca,
    tenantId,
    fecha: new Date().toISOString(),
    proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre })),
    cuentaId: cuenta.id,
    metodoId: metodo.id,
    pagoId: pago.id,
    egresos,
  };
  const dir = resolve('../../.tmp/demo');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, 'cuentas-pagar-20260916.json'),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify(
      {
        egresos: egresos.length,
        proveedores: proveedores.length,
        pagoParcial: 31250.55,
        cuenta: cuenta.nombre,
        manifest: resolve(dir, 'cuentas-pagar-20260916.json'),
      },
      null,
      2,
    ),
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
