import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenant-context';
import { DocumentosOrdenService } from './documentos-orden.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import type { ImpresionService } from './impresion.service';
import type { ArchivosService } from '../archivos/archivos.service';
import type { CurrentAuth } from '../auth/auth.types';
import { revisionPerfil } from './perfiles-impresion.domain';
import { objeto } from './documentos-orden.domain';
const db = new PrismaService();
const tenantId = randomUUID(),
  otroTenant = randomUUID(),
  usuarioId = randomUUID();
const auth = {
  tenantId,
  userId: usuarioId,
  email: 'operario@test.local',
} as CurrentAuth;
const firma = {
  firmarDocumento: jest
    .fn()
    .mockReturnValue({ hash: 'h', firma: 'f', timestamp: 1 }),
} as unknown as ImpresionService;
const perfiles = new PerfilesImpresionService(db, firma);
const archivos = new Map<string, Buffer>();
const service = new DocumentosOrdenService(
  db,
  {
    leerContenido: async (key: string) => archivos.get(key),
  } as ArchivosService,
  firma,
  perfiles,
);
let laser: string,
  cad: string,
  papel: string,
  perfilLaser: string,
  perfilCad: string;
let n = 0;
const run = (fn: () => Promise<void>) => runWithTenant(tenantId, fn);
beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otroTenant].map((id) => ({
      id,
      nombre: 'QA cola',
      slug: `cola-${id}`,
    })),
  });
  await db.user.create({
    data: { id: usuarioId, email: `cola-${usuarioId}@test.local` },
  });
  const planta = await db.planta.create({
    data: { tenantId, nombre: 'QA', codigo: 'QA' },
  });
  const estacion = await db.estacion.create({
    data: { tenantId, nombre: 'QA', activo: true },
  });
  papel = (
    await db.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'P',
        nombre: 'Papel',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_HOJA',
        tipoTecnico: 'papel',
        templateId: 'papel',
        unidadStock: 'HOJA',
        unidadCompra: 'HOJA',
        atributosTecnicosJson: {},
      },
    })
  ).id;
  for (const tipo of ['laser', 'cad']) {
    const m = await db.maquina.create({
      data: {
        tenantId,
        plantaId: planta.id,
        estacionId: estacion.id,
        codigo: tipo,
        nombre: tipo,
        plantilla: 'IMPRESORA_LASER',
        geometriaTrabajo: 'PLIEGO',
        unidadProduccionPrincipal: 'HOJA',
      },
    });
    const d = await db.impresionDestino.create({
      data: {
        tenantId,
        nombre: tipo,
        host: 'localhost',
        impresora: tipo,
        maquinaId: m.id,
        ...(tipo === 'cad'
          ? {
              cad: {
                anchoRolloMm: 914,
                margenMm: 5,
                origenPapel: 'Roll',
                usarOrigenPredeterminado: false,
              },
            }
          : {}),
      },
    });
    const b = await db.impresionBandeja.create({
      data: {
        tenantId,
        destinoId: d.id,
        nombre: 'Origen',
        codigo: tipo,
        papelPreparadoId: papel,
        gramajePreparado: 80,
      },
    });
    const p = await db.impresionPerfil.create({
      data: {
        tenantId,
        bandejaId: b.id,
        nombre: tipo,
        papelMateriaPrimaId: papel,
        gramaje: 80,
        tamano: tipo === 'cad' ? 'CAD' : 'A4',
        color: 'BN',
        faz: 1,
        modo: 'AUTOMATICO',
        probado: true,
        actualizadoPor: 'QA',
        ...(tipo === 'cad'
          ? { cad: { materialVarianteId: 'rollo', rutaAlternativaId: 'ruta' } }
          : {}),
      },
    });
    if (tipo === 'cad') {
      cad = m.id;
      perfilCad = p.id;
    } else {
      laser = m.id;
      perfilLaser = p.id;
    }
  }
});
afterEach(async () => {
  await db.ordenTrabajo.deleteMany({ where: { tenantId } });
  archivos.clear();
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.user.delete({ where: { id: usuarioId } });
  await db.$disconnect();
});
async function nueva(tipo = 'laser', dias = 20) {
  const pdf = await PDFDocument.create();
  const medidas =
    tipo === 'cad'
      ? [
          { anchoMm: 594, altoMm: 841 },
          { anchoMm: 841, altoMm: 1189 },
        ]
      : [{ anchoMm: 210, altoMm: 297 }];
  medidas.forEach((m) => {
    const p = pdf.addPage([(m.anchoMm * 72) / 25.4, (m.altoMm * 72) / 25.4]);
    p.drawText('Grafo QA');
  });
  const bytes = Buffer.from(await pdf.save()),
    ordenId = randomUUID(),
    itemId = randomUUID(),
    key = `${tenantId}/${ordenId}.pdf`;
  archivos.set(key, bytes);
  const meta = {
    nombre: 'Prueba.pdf',
    archivoNombre: 'Prueba.pdf',
    paginas: medidas.length,
    paginasOriginales: medidas.length,
    copias: 1,
    faz: 1,
    tamano: tipo === 'cad' ? 'CAD' : 'A4',
    color: 'BN',
    papelMateriaPrimaId: papel,
    gramaje: 80,
    hojas: tipo === 'cad' ? 4 : 1,
    ...(tipo === 'cad'
      ? {
          modo: 'CAD',
          escala: 100,
          medidasPaginas: medidas,
          copiasPorPagina: [{ pagina: 1, copias: 3 }],
          cad: { perfilId: perfilCad, versionPerfil: 1, versionDestino: 1 },
          materialVarianteId: 'rollo',
          rutaAlternativaId: 'ruta',
        }
      : {}),
  };
  await db.ordenTrabajo.create({
    data: {
      id: ordenId,
      tenantId,
      numero: `OT-QA-${++n}`,
      estado: 'pendiente',
      fechaEntrega: new Date(`2026-09-${dias}`),
    },
  });
  await db.ordenTrabajoItem.create({
    data: {
      id: itemId,
      tenantId,
      ordenId,
      codigo: 'I',
      nombre: 'Prueba',
      familia: 'impresion',
      cantidad: 1,
      cantidadUnidad: 'u',
      subtotal: 1,
      impuestos: 0,
      total: 1,
      jobContextSnapshotJson: { _centroCopiado: meta },
    },
  });
  await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId,
      itemId,
      indice: 1,
      familiaCodigo: 'impresion_digital',
      categoriaFamilia: 'impresion',
      nombre: 'Imprimir',
      maquinaId: tipo === 'cad' ? cad : laser,
    },
  });
  await db.archivo.create({
    data: {
      tenantId,
      ordenItemId: itemId,
      scope: 'ORDEN_ITEM',
      key,
      nombreOriginal: 'Prueba.pdf',
      mimeType: 'application/pdf',
      bytes: bytes.length,
      estado: 'LISTO',
      autogeneradoPor: 'centro-copiado',
    },
  });
  return { ordenId, itemId };
}
async function preparar(
  o: { ordenId: string; itemId: string },
  pagina = 0,
  anterior?: string,
) {
  const v = await service.vista(auth, o.ordenId);
  const d = v.documentos.find((d) => (d.paginaCad?.pagina ?? 0) === pagina)!;
  const p = d.ruta.perfil!;
  return service.preparar(
    auth,
    o.ordenId,
    o.itemId,
    randomUUID(),
    p.bandeja.destino.impresora,
    p.bandeja.destino.host,
    anterior,
    p.id,
    revisionPerfil(p),
    pagina,
  );
}
it('persiste idempotentemente, recupera desde otra sesión y aísla tenants', () =>
  run(async () => {
    const o = await nueva();
    await Promise.all([
      service.solicitar(auth, o.ordenId),
      service.solicitar(auth, o.ordenId),
    ]);
    expect(
      await db.ordenTrabajoEvento.count({
        where: { tenantId, tipo: 'cola_impresion' },
      }),
    ).toBe(1);
    const v = await service.cola(auth);
    expect(v.total).toBe(1);
    expect(v.vistas[0].documentos[0].trabajoId).toBe(`${o.itemId}:0`);
    await expect(
      runWithTenant(otroTenant, () =>
        service.vista({ ...auth, tenantId: otroTenant }, o.ordenId),
      ),
    ).rejects.toThrow('no encontrada');
    expect(
      (
        await runWithTenant(otroTenant, () =>
          service.cola({ ...auth, tenantId: otroTenant }),
        )
      ).total,
    ).toBe(0);
  }));
it('una carrera entrega una sola firma; cada página CAD conserva medidas, copias y reserva propia', () =>
  run(async () => {
    const o = await nueva('cad');
    await service.solicitar(auth, o.ordenId);
    const results = await Promise.allSettled([preparar(o, 1), preparar(o, 1)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const r = results.find((r) => r.status === 'fulfilled')!.value;
    expect(r.params.options).toMatchObject({
      copies: 3,
      size: { width: 914, custom: true },
      scaleContent: false,
      rasterize: false,
      rotation: 0,
      orientation: 'portrait',
      margins: 0,
    });
    const pdf = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(pdf.getPageCount()).toBe(1);
    expect((pdf.getPage(0).getHeight() * 25.4) / 72).toBeCloseTo(604, 5);
    await expect(preparar(o, 2)).rejects.toThrow('envío por revisar');
    await service.estado(auth, o.ordenId, r.intento.id, 'ENVIADO', 'ACK');
    const segundo = await preparar(o, 2);
    expect(segundo.params.options.copies).toBe(1);
    expect(segundo.intento.pagina).toBe(2);
    await expect(preparar(o, 1)).rejects.toThrow();
    await service.confirmar(auth, o.ordenId, [r.intento.id]);
    expect((await service.cola(auth)).total).toBe(1);
    expect(
      (await service.cola(auth)).vistas[0].documentos[0].paginaCad?.pagina,
    ).toBe(2);
    await expect(
      service.confirmar(auth, o.ordenId, [randomUUID()]),
    ).rejects.toThrow('cambiaron');
  }));
it('respeta prioridad por entrega, bloquea la máquina incierta y permite otra máquina', () =>
  run(async () => {
    const despues = await nueva('laser', 25),
      antes = await nueva('laser', 20),
      plotter = await nueva('cad', 25);
    for (const o of [despues, antes, plotter])
      await service.solicitar(auth, o.ordenId);
    expect((await service.cola(auth)).vistas[0].ordenId).toBe(antes.ordenId);
    await expect(preparar(despues)).rejects.toThrow('trabajo anterior');
    const r = await preparar(antes);
    await service.estado(
      auth,
      antes.ordenId,
      r.intento.id,
      'SIN_CONFIRMAR',
      'Timeout',
    );
    await expect(preparar(despues)).rejects.toThrow('envío por revisar');
    await expect(preparar(plotter, 1)).resolves.toBeTruthy();
    await service.confirmar(auth, antes.ordenId, [r.intento.id]);
    await expect(preparar(despues)).resolves.toBeTruthy();
  }));
it('libera papel para varias OT con una revisión común; cambiar la bandeja invalida las autorizaciones', () =>
  run(async () => {
    await db.impresionPerfil.update({
      where: { id: perfilLaser },
      data: { modo: 'PREPARACION' },
    });
    const a = await nueva(),
      b = await nueva();
    for (const o of [a, b]) await service.solicitar(auth, o.ordenId);
    const p = (await service.vista(auth, a.ordenId)).documentos[0].ruta.perfil!;
    expect(
      (await service.vista(auth, a.ordenId)).documentos[0].ruta.estado,
    ).toBe('PREPARACION');
    await service.liberarLote(
      auth,
      [
        { ordenId: a.ordenId, trabajos: [`${a.itemId}:0`] },
        { ordenId: b.ordenId, trabajos: [`${b.itemId}:0`] },
      ],
      p.id,
      revisionPerfil(p),
    );
    expect(
      (await service.vista(auth, a.ordenId)).documentos[0].ruta.estado,
    ).toBe('LISTO');
    expect(
      (await service.vista(auth, b.ordenId)).documentos[0].ruta.estado,
    ).toBe('LISTO');
    await db.impresionBandeja.update({
      where: { id: p.bandeja.id },
      data: { version: { increment: 1 }, papelPreparadoId: null },
    });
    expect(
      (await service.vista(auth, a.ordenId)).documentos[0].ruta.estado,
    ).toBe('PREPARACION');
    expect(
      objeto(
        (await db.ordenTrabajoEvento.findFirst({
          where: { tenantId, ordenId: a.ordenId, tipo: 'cola_impresion' },
        }))!.datosJson,
      ).preparacion,
    ).toBeTruthy();
  }));
