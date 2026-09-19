import { CatalogoCadService } from '../centro-copiado/catalogo-cad.service';
import { CentroCopiadoCadService } from '../centro-copiado/centro-copiado-cad.service';
import type { DocumentoInput } from '../centro-copiado/adaptador';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenant-context';
import type { CurrentAuth } from '../auth/auth.types';
import { PerfilesCadService } from './perfiles-cad.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import type { ImpresionService } from './impresion.service';
import type { MotorUniversalService } from '../motor-universal/motor.service';
import type { PerfilCadDto } from './perfiles-cad.dto';

const db = new PrismaService();
const tenantId = randomUUID();
const otro = randomUUID();
const auth = {
  tenantId,
  userId: randomUUID(),
  email: 'cad@test.local',
} as CurrentAuth;
const motor = {
  cotizar: jest
    .fn<Promise<unknown>, Parameters<MotorUniversalService['cotizar']>>()
    .mockResolvedValue({
      exitoso: true,
      cotizacion: {
        desglosePrecio: { precioNetoTotal: 100, precioBrutoTotal: 121 },
      },
    }),
};
const impresion = {
  firmarDocumento: jest
    .fn()
    .mockReturnValue({ hash: 'h', firma: 'f', timestamp: 1 }),
};
const generales = new PerfilesImpresionService(
  db,
  impresion as unknown as ImpresionService,
);
const catalogo = new CatalogoCadService(db);
const service = new PerfilesCadService(
  db,
  generales,
  motor as unknown as MotorUniversalService,
  catalogo,
);
let datos: PerfilCadDto;
let categoriaId: string;
let subId: string;
let maquinaId: string;
let slotId: string;
let candidataId: string;

beforeAll(async () => {
  await db.tenant.create({
    data: { id: tenantId, nombre: 'CAD test', slug: `cad-${tenantId}` },
  });
  await db.tenant.create({
    data: { id: otro, nombre: 'CAD otro', slug: `cad-${otro}` },
  });
  await runWithTenant(tenantId, async () => {
    const planta = await db.planta.create({
      data: { tenantId, codigo: 'P', nombre: 'Planta test' },
    });
    const maquina = await db.maquina.create({
      data: {
        tenantId,
        plantaId: planta.id,
        codigo: 'CAD',
        nombre: 'CAD',
        plantilla: 'PLOTTER_CAD',
        geometriaTrabajo: 'ROLLO',
        unidadProduccionPrincipal: 'M2',
      },
    });
    maquinaId = maquina.id;
    const mp = await db.materiaPrima.create({
      data: {
        tenantId,
        codigo: 'ROLLO',
        nombre: 'Obra 80',
        familia: 'SUSTRATO',
        subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
        tipoTecnico: 'papel',
        templateId: 'papel',
        unidadStock: 'M2',
        unidadCompra: 'ROLLO',
        atributosTecnicosJson: {},
      },
    });
    const variante = await db.materiaPrimaVariante.create({
      data: {
        tenantId,
        materiaPrimaId: mp.id,
        sku: 'R914',
        atributosVarianteJson: { anchoMm: 914, gramajeGr: 80 },
      },
    });
    const cat = await db.productoCategoriaComercial.create({
      data: { codigo: `CAD-${tenantId}`, nombre: 'Test' },
    });
    categoriaId = cat.id;
    const sub = await db.productoSubcategoriaComercial.create({
      data: {
        categoriaId,
        codigo: `CAD-${tenantId}`,
        nombre: 'Test',
        atributosSchemaJson: {},
      },
    });
    subId = sub.id;
    const producto = await db.producto.create({
      data: {
        tenantId,
        codigo: 'CAD',
        nombre: 'Plano CAD',
        subcategoriaComercialId: subId,
      },
    });
    const ruta = await db.ruta.create({
      data: { tenantId, codigo: 'CAD', nombre: 'CAD' },
    });
    const paso = await db.rutaPaso.create({
      data: {
        tenantId,
        rutaId: ruta.id,
        orden: 1,
        familiaCodigo: 'impresion_por_area',
      },
    });
    const alternativa = await db.productoRutaAlternativa.create({
      data: {
        tenantId,
        productoId: producto.id,
        rutaId: ruta.id,
        rutaVersion: 1,
        nombre: 'Estándar',
      },
    });
    const cp = await db.productoConfigPaso.create({
      data: {
        tenantId,
        productoRutaAlternativaId: alternativa.id,
        rutaPasoId: paso.id,
      },
    });
    candidataId = (
      await db.productoConfigPasoMaquinaCandidata.create({
        data: {
          tenantId,
          productoConfigPasoId: cp.id,
          maquinaId,
          modoColorAllowedModes: ['BN', 'CMYK'],
        },
      })
    ).id;
    slotId = (
      await db.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: cp.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: variante.id,
        },
      })
    ).id;
    const d = await generales.guardarDestino(auth, {
      nombre: 'HP',
      host: 'localhost',
      impresora: 'HP T950 TEST',
      maquinaId,
      activo: true,
    });
    const cad = await generales.guardarCad(auth, d.id, {
      version: d.version,
      habilitado: true,
      anchoRolloMm: 914,
      origenPapel: 'Rollo 1',
      usarOrigenPredeterminado: false,
    });
    datos = {
      destinoId: d.id,
      versionDestino: cad.version,
      nombre: 'Planos B/N',
      rutaAlternativaId: alternativa.id,
      materialVarianteId: variante.id,
      gramaje: 80,
      color: 'BN',
      modo: 'PREPARACION',
      probado: false,
      activo: true,
      prioridad: 1,
    };
  });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otro] } } });
  if (subId)
    await db.productoSubcategoriaComercial.delete({ where: { id: subId } });
  if (categoriaId)
    await db.productoCategoriaComercial.delete({ where: { id: categoriaId } });
  await db.$disconnect();
});

it('vincula la receta y el rollo, cotiza con máquina/color correctos y firma sólo una prueba fija', async () =>
  runWithTenant(tenantId, async () => {
    expect(
      (await service.opciones(tenantId, datos.destinoId)).opciones,
    ).toHaveLength(1);
    const p = await service.guardar(auth, datos);
    const prueba = {
      version: p.version,
      versionDestino: datos.versionDestino,
      formato: 'A1' as const,
    };
    const r = await service.cotizarMuestra(auth, p.id, prueba);
    expect(r).toMatchObject({
      subtotal: 100,
      impuestos: 21,
      total: 121,
      color: 'BN',
    });
    expect(impresion.firmarDocumento).not.toHaveBeenCalled();
    const input = motor.cotizar.mock.calls[0][0];
    expect(input).toMatchObject({
      tenantId,
      rutaAlternativaId: datos.rutaAlternativaId,
      jobContext: {
        cantidad: 1,
        caras: 1,
        modoColor: 'BN',
        piezas: [{ cantidad: 1, anchoMm: 594, altoMm: 841 }],
      },
    });
    expect(Object.values(input.jobContext.slotMateriales ?? {})).toEqual([
      datos.materialVarianteId,
    ]);
    expect(
      Object.entries(input.jobContext).find(([k]) =>
        k.startsWith('maquinaSeleccionada_'),
      )?.[1],
    ).toBe(maquinaId);
    const job = await service.prueba(auth, p.id, prueba);
    expect(job.params.options).toMatchObject({
      colorType: 'grayscale',
      scaleContent: false,
      rasterize: false,
      printerTray: 'Rollo 1',
    });
    const editado = await service.guardar(
      auth,
      { ...datos, version: p.version, color: 'COLOR', probado: true },
      p.id,
    );
    expect(editado.probado).toBe(false);
    await expect(service.prueba(auth, p.id, prueba)).rejects.toThrow(
      'cambiaron',
    );
    await expect(
      service.guardar(auth, { ...datos, version: p.version }, p.id),
    ).rejects.toThrow('cambió');
    const color = await service.cotizarMuestra(auth, p.id, {
      ...prueba,
      version: editado.version,
    });
    expect(color.color).toBe('COLOR');
    expect(motor.cotizar.mock.calls.at(-1)?.[0].jobContext.modoColor).toBe(
      'CMYK',
    );
    motor.cotizar.mockResolvedValueOnce({
      exitoso: false,
      errores: [
        {
          mensaje: 'Falta confirmar la unidad del precio.',
          sugerencia: 'Revisá Compra y costos del material.',
        },
      ],
    });
    await expect(
      service.cotizarMuestra(auth, p.id, {
        ...prueba,
        version: editado.version,
      }),
    ).rejects.toThrow(
      'Falta confirmar la unidad del precio. Revisá Compra y costos del material.',
    );
  }));

it('cotiza rangos CAD mixtos, conserva receta/cantidad y rechaza rollos incompatibles y otro tenant', async () =>
  runWithTenant(tenantId, async () => {
    const cad = new CentroCopiadoCadService(
      db,
      catalogo,
      motor as unknown as MotorUniversalService,
    );
    const p = await service.guardar(auth, datos);
    const opciones = await cad.opciones(tenantId);
    expect(opciones.perfiles.find((o) => o.color === 'BN')).toMatchObject({
      color: 'BN',
    });
    expect(opciones.perfiles[0]).not.toHaveProperty('host');
    const doc: DocumentoInput = {
      id: 'plano',
      nombre: 'Mixto',
      archivoNombre: 'mixto.pdf',
      modo: 'CAD',
      paginasOriginales: 3,
      paginas: 2,
      rangoPaginas: '1-2',
      copias: 2,
      medidasPaginas: [
        { anchoMm: 594, altoMm: 841 },
        { anchoMm: 841, altoMm: 1189 },
        { anchoMm: 910, altoMm: 1200 },
      ],
      cad: {
        cotizacion: {
          id: opciones.perfiles.find((o) => o.color === 'BN')!.id,
          revision: opciones.perfiles.find((o) => o.color === 'BN')!.revision,
        },
      },
      papelMateriaPrimaId: p.papelMateriaPrimaId,
      gramaje: p.gramaje,
      color: 'BN',
      faz: 1,
      tamano: 'CAD',
      tamanoAnchoMm: 594,
      tamanoAltoMm: 841,
    };
    // Cotiza aunque todas las conexiones estén desactivadas. El catálogo no
    // debe consultar las tablas de impresión ni necesitar claves/certificados.
    await db.impresionDestino.update({
      where: { id: datos.destinoId },
      data: { activo: false },
    });
    const sinImpresion = new Proxy(db, {
      get(target, prop) {
        if (String(prop).startsWith('impresion'))
          throw new Error('Dependencia de impresión en la cotización');
        return Reflect.get(target, prop) as unknown;
      },
    });
    const independiente = new CentroCopiadoCadService(
      sinImpresion,
      new CatalogoCadService(sinImpresion),
      motor as unknown as MotorUniversalService,
    );
    try {
      expect((await independiente.opciones(tenantId)).perfiles).toEqual(
        opciones.perfiles,
      );
      expect(
        (await independiente.construir(tenantId, doc, 'sin-qz', null)).error,
      ).toBeNull();
    } finally {
      await db.impresionDestino.update({
        where: { id: datos.destinoId },
        data: { activo: true },
      });
    }
    const r = await cad.construir(tenantId, doc, 'carga-cad', null);
    expect(r.error).toBeNull();
    expect(r).toMatchObject({
      cantidad: 4,
      subtotal: 100,
      total: 121,
      unidad: 'unidad',
    });
    expect(r.jobContext).toMatchObject({
      cantidad: 4,
      caras: 1,
      piezas: [
        { cantidad: 2, anchoMm: 594, altoMm: 841 },
        { cantidad: 2, anchoMm: 841, altoMm: 1189 },
      ],
      _centroCopiado: {
        modo: 'CAD',
        paginasOriginales: 3,
        rangoPaginas: '1-2',
        grupoCargaId: 'carga-cad',
        medidasPaginas: doc.medidasPaginas,
      },
    });
    const ctx = r.jobContext._centroCopiado as {
      planes: Array<{ giro: number; escala: number }>;
    };
    expect(ctx.planes.map((p) => [p.giro, p.escala])).toEqual([
      [90, 100],
      [0, 100],
    ]);
    expect(motor.cotizar.mock.calls.at(-1)?.[0].rutaAlternativaId).toBe(
      datos.rutaAlternativaId,
    );
    const antesDesglose = motor.cotizar.mock.calls.length;
    const desglosado = await cad.construir(
      tenantId,
      {
        ...doc,
        copiasPorPagina: [
          { pagina: 1, copias: 3 },
          { pagina: 2, copias: 1 },
          { pagina: 3, copias: 99 },
        ],
      },
      'carga-cad',
      null,
    );
    expect(desglosado.error).toBeNull();
    expect(desglosado.cantidad).toBe(4);
    expect(desglosado.jobContext).toMatchObject({
      cantidad: 4,
      piezas: [{ cantidad: 3 }, { cantidad: 1 }],
      _centroCopiado: {
        copias: 2,
        copiasPorPagina: [
          { pagina: 1, copias: 3 },
          { pagina: 2, copias: 1 },
          { pagina: 3, copias: 99 },
        ],
        planes: [
          { pagina: 1, copias: 3 },
          { pagina: 2, copias: 1 },
        ],
      },
    });
    expect(motor.cotizar.mock.calls).toHaveLength(antesDesglose + 1);
    const previewDesglose = await cad.cotizar(
      tenantId,
      { ...doc, copiasPorPagina: [{ pagina: 1, copias: 4 }] },
      null,
    );
    expect(previewDesglose).toMatchObject({
      carillas: 6,
      hojas: 6,
      pliegos: 6,
      error: null,
    });
    expect(() =>
      cad.validar({ ...doc, copiasPorPagina: [{ pagina: 1, copias: 10000 }] }),
    ).toThrow('10.000');
    expect(() =>
      cad.validar({ ...doc, copiasPorPagina: [{ pagina: 1, copias: 1.5 }] }),
    ).toThrow('entero');
    expect(() =>
      cad.validar({ ...doc, copiasPorPagina: [{ pagina: 4, copias: 1 }] }),
    ).toThrow('PDF original');
    expect(() =>
      cad.validar({
        ...doc,
        copiasPorPagina: [
          { pagina: 1, copias: 1 },
          { pagina: 1, copias: 2 },
        ],
      }),
    ).toThrow('sin repetirlas');
    const previo = motor.cotizar.mock.calls.length;
    expect(
      (
        await cad.construir(
          tenantId,
          { ...doc, rangoPaginas: '', paginas: 3 },
          '',
          null,
        )
      ).error,
    ).toContain('Página 3');
    expect(
      (await cad.construir(tenantId, { ...doc, color: 'COLOR' }, '', null))
        .error,
    ).toContain('disponible');
    expect(
      (
        await cad.construir(
          tenantId,
          {
            ...doc,
            cad: {
              cotizacion: { ...doc.cad!.cotizacion!, revision: 'cambio' },
            },
          },
          '',
          null,
        )
      ).error,
    ).toContain('cambió');
    expect(() => cad.validar({ ...doc, faz: 2 })).toThrow('simple faz');
    expect(() =>
      cad.validar({ ...doc, medidasPaginas: [{ anchoMm: 1, altoMm: 1 }] }),
    ).toThrow('cada página');
    await runWithTenant(otro, async () => {
      expect((await cad.opciones(otro)).perfiles).toEqual([]);
      expect((await cad.construir(otro, doc, '', null)).error).toContain(
        'no está disponible',
      );
    });
    expect(motor.cotizar.mock.calls).toHaveLength(previo);
  }));

it('cotiza por variante exacta aunque el material no declare gramaje y no lo infiere del nombre', async () =>
  runWithTenant(tenantId, async () => {
    await db.materiaPrimaVariante.update({
      where: { id: datos.materialVarianteId },
      data: { atributosVarianteJson: { anchoMm: 914 } },
    });
    try {
      const cad = new CentroCopiadoCadService(
        db,
        catalogo,
        motor as unknown as MotorUniversalService,
      );
      const opciones = await cad.opciones(tenantId);
      const opcion = opciones.perfiles.find((o) => o.color === 'BN')!;
      expect(opcion.gramaje).toBeNull();
      const doc: DocumentoInput = {
        id: 'sin-gramaje',
        nombre: 'Plano',
        archivoNombre: 'plano.pdf',
        modo: 'CAD',
        paginasOriginales: 1,
        paginas: 1,
        copias: 1,
        medidasPaginas: [{ anchoMm: 594, altoMm: 841 }],
        cad: { cotizacion: { id: opcion.id, revision: opcion.revision } },
        papelMateriaPrimaId: opcion.papelMateriaPrimaId,
        color: 'BN',
        faz: 1,
        tamano: 'CAD',
        tamanoAnchoMm: 594,
        tamanoAltoMm: 841,
      };
      const resultado = await cad.construir(tenantId, doc, '', null);
      expect(resultado.error).toBeNull();
      expect(resultado.jobContext._centroCopiado).toMatchObject({
        gramaje: null,
        materialVarianteId: datos.materialVarianteId,
      });
      expect(
        (await cad.construir(tenantId, { ...doc, gramaje: 80 }, '', null))
          .error,
      ).toContain('coincidir');
    } finally {
      await db.materiaPrimaVariante.update({
        where: { id: datos.materialVarianteId },
        data: { atributosVarianteJson: { anchoMm: 914, gramajeGr: 80 } },
      });
    }
  }));

it('rechaza receta ajena, gramaje falso, rollo cambiado y color no permitido', async () =>
  runWithTenant(tenantId, async () => {
    await expect(
      service.guardar(auth, { ...datos, rutaAlternativaId: randomUUID() }),
    ).rejects.toThrow('compatibles');
    await expect(
      service.guardar(auth, { ...datos, materialVarianteId: randomUUID() }),
    ).rejects.toThrow('compatibles');
    await expect(
      service.guardar(auth, { ...datos, gramaje: 150 }),
    ).rejects.toThrow('gramaje');
    await expect(
      service.guardar(auth, { ...datos, versionDestino: 1 }),
    ).rejects.toThrow('Cambió');
    await runWithTenant(otro, async () => {
      await expect(
        service.guardar({ ...auth, tenantId: otro }, datos),
      ).rejects.toThrow('no encontrada');
    });
    await db.productoConfigPasoMaquinaCandidata.update({
      where: { id: candidataId },
      data: { modoColorAllowedModes: ['BN'] },
    });
    await expect(
      service.guardar(auth, { ...datos, color: 'COLOR' }),
    ).rejects.toThrow('compatibles');
    await db.productoConfigPasoMaquinaCandidata.update({
      where: { id: candidataId },
      data: { modoColorAllowedModes: ['BN', 'CMYK'] },
    });
    const perfil = await service.guardar(auth, datos);
    await db.productoConfigPasoSlotMaterial.update({
      where: { id: slotId },
      data: { activo: false },
    });
    await expect(
      service.cotizarMuestra(auth, perfil.id, {
        version: perfil.version,
        versionDestino: datos.versionDestino,
        formato: 'A1',
      }),
    ).rejects.toThrow('receta');
    await db.productoConfigPasoSlotMaterial.update({
      where: { id: slotId },
      data: { activo: true },
    });
    await generales.guardarCad(auth, datos.destinoId, {
      version: datos.versionDestino,
      habilitado: true,
      anchoRolloMm: 610,
      origenPapel: 'Rollo 1',
      usarOrigenPredeterminado: false,
    });
    expect(
      (await service.opciones(tenantId, datos.destinoId)).opciones,
    ).toEqual([]);
    expect(
      (await db.impresionPerfil.findUniqueOrThrow({ where: { id: perfil.id } }))
        .probado,
    ).toBe(false);
  }));
