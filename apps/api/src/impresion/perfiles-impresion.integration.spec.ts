import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenant-context';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import type { ImpresionService } from './impresion.service';
import type { CurrentAuth } from '../auth/auth.types';
import { resolverPerfil } from './perfiles-impresion.domain';
import { PerfilImpresionDto } from './perfiles-impresion.dto';
import { validate } from 'class-validator';
import { esConfiguracionCad } from './cad.domain';

const db = new PrismaService();
const tenants = [randomUUID(), randomUUID()];
const auth = tenants.map(
  (tenantId) =>
    ({
      tenantId,
      userId: randomUUID(),
      email: 'operario@test.local',
    }) as CurrentAuth,
);
const service = new PerfilesImpresionService(db, {
  firmarDocumento: jest
    .fn()
    .mockReturnValue({ timestamp: 1, hash: 'hash', firma: 'firma' }),
} as unknown as ImpresionService);
let maquinaId: string;
let maquinaColorId: string;
let papelId: string;
beforeAll(async () => {
  for (const id of tenants)
    await db.tenant.create({
      data: { id, nombre: 'Test perfiles', slug: `perfiles-${id}` },
    });
  const planta = await db.planta.create({
    data: { tenantId: tenants[0], codigo: 'P', nombre: 'Prueba' },
  });
  maquinaId = (
    await db.maquina.create({
      data: {
        tenantId: tenants[0],
        plantaId: planta.id,
        codigo: 'R',
        nombre: 'Ricoh prueba',
        plantilla: 'IMPRESORA_LASER',
        geometriaTrabajo: 'PLIEGO',
        unidadProduccionPrincipal: 'HOJA',
      },
    })
  ).id;
  maquinaColorId = (
    await db.maquina.create({
      data: {
        tenantId: tenants[0],
        plantaId: planta.id,
        codigo: 'C',
        nombre: 'Impresora color prueba',
        plantilla: 'IMPRESORA_LASER',
        geometriaTrabajo: 'PLIEGO',
        unidadProduccionPrincipal: 'HOJA',
      },
    })
  ).id;
  papelId = (
    await db.materiaPrima.create({
      data: {
        tenantId: tenants[0],
        codigo: 'OBRA',
        nombre: 'Obra prueba',
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
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await db.$disconnect();
});
it('persiste configuración y preparación con guard de tenant, rechaza concurrencia y destinos ajenos', async () => {
  await runWithTenant(tenants[0], async () => {
    const d = await service.guardarDestino(auth[0], {
      nombre: 'Ricoh',
      host: 'localhost',
      impresora: 'RICOH',
      maquinaId,
      activo: true,
    });
    await expect(
      service.guardarDestino(auth[0], {
        nombre: 'Otro driver',
        host: 'localhost',
        impresora: 'OTRA',
        maquinaId,
        activo: true,
      }),
    ).rejects.toThrow('ya tiene');
    const b = await service.agregarBandeja(auth[0], d.id, {
      nombre: 'Bandeja 1',
      codigo: 'Tray 1',
    });
    const datos = {
      bandejaId: b.id,
      nombre: 'Obra A4',
      papelMateriaPrimaId: papelId,
      gramaje: 75,
      tamano: 'A4',
      color: 'BN',
      faz: 2,
      modo: 'AUTOMATICO',
      probado: true,
      activo: true,
      prioridad: 1,
    };
    const p = await service.guardarPerfil(auth[0], datos);
    let config = await service.configuracion(auth[0]);
    expect(config.destinos).toHaveLength(1);
    expect(config.perfiles).toHaveLength(1);
    expect(config.maquinas.find((m) => m.id === maquinaId)).toMatchObject({ plantilla: 'IMPRESORA_LASER', activo: true });
    const doc = {
      papelMateriaPrimaId: papelId,
      papelNombre: 'Obra',
      gramaje: 75,
      tamano: 'A4',
      color: 'BN',
      faz: 2,
    };
    expect(resolverPerfil(doc, config.perfiles).estado).toBe('PREPARACION');
    const prueba = await service.prueba(auth[0], p.id);
    expect(prueba.params.options).toMatchObject({
      printerTray: 'Tray 1',
      duplex: 'long-edge',
      copies: 1,
    });
    await service.prepararBandeja(auth[0], b.id, {
      version: 1,
      perfilId: p.id,
    });
    config = await service.configuracion(auth[0]);
    expect(resolverPerfil(doc, config.perfiles).estado).toBe('LISTO');
    await expect(
      service.prepararBandeja(auth[0], b.id, { version: 1 }),
    ).rejects.toThrow('cambió');
    const cambiado = await service.guardarPerfil(
      auth[0],
      { ...datos, gramaje: 150, version: p.version },
      p.id,
    );
    expect(cambiado.probado).toBe(false);
    await expect(
      service.guardarPerfil(auth[0], { ...datos, version: p.version }, p.id),
    ).rejects.toThrow('cambió');
    await runWithTenant(tenants[1], async () => {
      expect((await service.configuracion(auth[1])).destinos).toHaveLength(0);
      expect((await service.configuracion(auth[1])).perfiles).toHaveLength(0);
      await expect(
        service.agregarBandeja(auth[1], d.id, {
          nombre: 'Ajena',
          codigo: 'Tray 2',
        }),
      ).rejects.toThrow('no encontrado');
      await expect(service.guardarPerfil(auth[1], datos)).rejects.toThrow(
        'Revisá',
      );
      await expect(
        service.prepararBandeja(auth[1], b.id, { version: 2, perfilId: p.id }),
      ).rejects.toThrow('no encontrada');
    });
    await service.guardarDestino(
      auth[0],
      {
        nombre: d.nombre,
        host: d.host,
        impresora: 'RICOH NUEVA',
        maquinaId,
        activo: true,
        version: d.version,
      },
      d.id,
    );
    config = await service.configuracion(auth[0]);
    expect(config.perfiles[0].probado).toBe(false);
    expect(config.destinos[0].bandejas[0].papelPreparadoId).toBeNull();
  });
});
it('persiste perfiles B/N y Color en una misma impresora y exige nueva verificación al cambiar color', async () => {
  await runWithTenant(tenants[0], async () => {
    const destino = await service.guardarDestino(auth[0], {
      nombre: 'Color',
      host: 'localhost',
      impresora: 'IMPRESORA COLOR',
      maquinaId: maquinaColorId,
      activo: true,
    });
    const bandeja = await service.agregarBandeja(auth[0], destino.id, {
      nombre: 'Bandeja',
      codigo: 'top',
    });
    const datos = {
      nombre: 'Obra color',
      bandejaId: bandeja.id,
      papelMateriaPrimaId: papelId,
      gramaje: 75,
      tamano: 'A4',
      color: 'COLOR',
      faz: 2,
      modo: 'AUTOMATICO',
      probado: false,
      activo: true,
      prioridad: 1,
    };
    expect(
      await validate(Object.assign(new PerfilImpresionDto(), datos)),
    ).toHaveLength(0);
    expect(
      await validate(
        Object.assign(new PerfilImpresionDto(), {
          ...datos,
          color: 'DESCONOCIDO',
        }),
      ),
    ).not.toHaveLength(0);
    const color = await service.guardarPerfil(auth[0], datos);
    const mono = await service.guardarPerfil(auth[0], {
      ...datos,
      nombre: 'Obra B/N',
      color: 'BN',
      probado: true,
    });
    const doc = { ...datos, papelNombre: 'Obra' };
    expect(
      resolverPerfil(doc, await service.perfiles(tenants[0]), [maquinaColorId])
        .estado,
    ).toBe('REVISAR');
    const prueba = await service.prueba(auth[0], color.id);
    expect(prueba.params).toMatchObject({
      printer: { name: 'IMPRESORA COLOR' },
      options: {
        colorType: 'color',
        copies: 1,
        printerTray: 'top',
        duplex: 'long-edge',
      },
    });
    expect(
      (await service.prueba(auth[0], mono.id)).params.options.colorType,
    ).toBe('grayscale');
    const verificado = await service.guardarPerfil(
      auth[0],
      { ...datos, probado: true, version: color.version },
      color.id,
    );
    await service.prepararBandeja(auth[0], bandeja.id, {
      version: 1,
      perfilId: color.id,
    });
    const perfiles = await service.perfiles(tenants[0]);
    expect(resolverPerfil(doc, perfiles, [maquinaColorId])).toMatchObject({
      estado: 'LISTO',
      perfil: { id: color.id },
    });
    expect(
      resolverPerfil({ ...doc, color: 'BN' }, perfiles, [maquinaColorId]),
    ).toMatchObject({ estado: 'LISTO', perfil: { id: mono.id } });
    const cambiado = await service.guardarPerfil(
      auth[0],
      { ...datos, color: 'BN', probado: true, version: verificado.version },
      color.id,
    );
    expect(cambiado.probado).toBe(false);
    expect(cambiado.version).toBe(verificado.version + 1);
  });
});

it('configura CAD por tenant, bloquea A4, firma tamaño real y rechaza versiones viejas', async () => {
  await runWithTenant(tenants[0], async () => {
    const base = await db.maquina.findUniqueOrThrow({
      where: { id: maquinaId },
    });
    const maquina = await db.maquina.create({
      data: {
        tenantId: tenants[0],
        plantaId: base.plantaId,
        codigo: 'CAD',
        nombre: 'HP prueba',
        plantilla: base.plantilla,
        geometriaTrabajo: base.geometriaTrabajo,
        unidadProduccionPrincipal: base.unidadProduccionPrincipal,
      },
    });
    const d = await service.guardarDestino(auth[0], {
      nombre: 'Plotter',
      host: 'localhost',
      impresora: 'HP T950 TEST',
      maquinaId: maquina.id,
      activo: true,
    });
    const b = await service.agregarBandeja(auth[0], d.id, {
      nombre: 'Rollo',
      codigo: 'roll',
    });
    const perfil = {
      nombre: 'Obra previo',
      bandejaId: b.id,
      papelMateriaPrimaId: papelId,
      gramaje: 80,
      tamano: 'A4',
      color: 'COLOR',
      faz: 1,
      modo: 'AUTOMATICO',
      probado: true,
      activo: true,
      prioridad: 1,
    };
    const p = await service.guardarPerfil(auth[0], perfil);
    const config = {
      version: d.version,
      habilitado: true,
      anchoRolloMm: 914,
      origenPapel: 'roll',
      usarOrigenPredeterminado: false,
    };
    const cad = await service.guardarCad(auth[0], d.id, config);
    expect(esConfiguracionCad(cad.cad)).toBe(true);
    expect(cad.version).toBe(d.version + 1);
    expect(
      (await service.perfiles(tenants[0])).find((x) => x.id === p.id)?.probado,
    ).toBe(false);
    await expect(service.guardarCad(auth[0], d.id, config)).rejects.toThrow(
      'cambió',
    );
    await expect(service.prueba(auth[0], p.id)).rejects.toThrow('prueba CAD');
    await expect(service.guardarPerfil(auth[0], perfil)).rejects.toThrow(
      'piloto CAD',
    );
    expect(
      resolverPerfil(
        { ...perfil, papelNombre: 'Obra' },
        await service.perfiles(tenants[0]),
        [maquina.id],
      ).perfil,
    ).toBeNull();
    const prueba = await service.pruebaCad(auth[0], d.id, {
      version: cad.version,
      formato: 'A1',
    });
    expect(prueba.params).toMatchObject({
      printer: { name: 'HP T950 TEST' },
      options: {
        size: { width: 914, height: 604, custom: true },
        colorType: 'color',
        scaleContent: false,
        rasterize: false,
        printerTray: 'roll',
        copies: 1,
        duplex: 'one-sided',
        orientation: 'portrait',
        margins: 0,
      },
    });
    expect(prueba.totalPaginas).toBe(1);
    const bn = await service.pruebaCad(auth[0], d.id, {
      version: cad.version,
      formato: 'A1',
      color: 'BN',
    });
    expect(bn.params.options).toEqual({
      ...prueba.params.options,
      colorType: 'grayscale',
      jobName: 'Grafo prueba CAD A1 B-N',
    });
    expect(bn.params.options).not.toHaveProperty('density');
    expect(bn.params.options).not.toHaveProperty('printQuality');
    await expect(
      service.pruebaCad(auth[0], d.id, { version: d.version, formato: 'A1' }),
    ).rejects.toThrow('cambió');
    await runWithTenant(tenants[1], async () => {
      await expect(
        service.guardarCad(auth[1], d.id, { ...config, version: cad.version }),
      ).rejects.toThrow('no encontrado');
      await expect(
        service.pruebaCad(auth[1], d.id, {
          version: cad.version,
          formato: 'A1',
        }),
      ).rejects.toThrow('no encontrado');
    });
    const otraCola = await service.guardarDestino(
      auth[0],
      {
        nombre: d.nombre,
        host: d.host,
        impresora: 'HP OTRA COLA',
        maquinaId: maquina.id,
        activo: true,
        version: cad.version,
      },
      d.id,
    );
    expect(esConfiguracionCad(otraCola.cad)).toBe(false);
    await expect(
      service.pruebaCad(auth[0], d.id, {
        version: otraCola.version,
        formato: 'A1',
      }),
    ).rejects.toThrow('Configurá primero');
    const sinCad = await service.guardarCad(auth[0], d.id, {
      ...config,
      version: otraCola.version,
      habilitado: false,
    });
    expect(sinCad.cad).toBeNull();
    await expect(
      service.pruebaCad(auth[0], d.id, {
        version: sinCad.version,
        formato: 'A1',
      }),
    ).rejects.toThrow('Configurá primero');
  });
});
