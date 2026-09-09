import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { RecetasProductoService } from '../recetas-producto.service';
import { ProductosService } from '../productos.service';
import { ProductoValidacionService } from '../producto-validacion.service';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';

const db = new PrismaClient();
afterAll(() => db.$disconnect());
type ProductoPrueba = {
  id: string;
  ruta: string;
  paso: string;
  config: string;
};
async function escenario(
  test: (
    tx: Prisma.TransactionClient,
    recetas: RecetasProductoService,
    crear: (codigo: string, compuesto?: boolean) => Promise<ProductoPrueba>,
    tenantId: string,
  ) => Promise<void>,
  concurrente = false,
) {
  const rollback = new Error('rollback publicación automática');
  const ejecutar = async (tx: Prisma.TransactionClient | PrismaClient) => {
    const tenant = await tx.tenant.create({
      data: { nombre: 'Prueba publicación', slug: randomUUID() },
    });
    const categoria = await tx.productoCategoriaComercial.create({
      data: { codigo: randomUUID(), nombre: 'Prueba' },
    });
    const subcategoria = await tx.productoSubcategoriaComercial.create({
      data: {
        categoriaId: categoria.id,
        codigo: randomUUID(),
        nombre: 'Prueba',
        atributosSchemaJson: {},
      },
    });
    const { prisma } = serviciosRecorridoF4(tx);
    const productos = new ProductosService(prisma as never);
    const recetas = new RecetasProductoService(
      prisma as never,
      productos,
      new ProductoValidacionService(productos),
      { publicar: async () => undefined } as never,
    );
    const crear = async (codigo: string, compuesto = false) => {
      const producto = await tx.producto.create({
        data: {
          tenantId: tenant.id,
          subcategoriaComercialId: subcategoria.id,
          codigo,
          nombre: codigo,
          estructuraProducto: compuesto ? 'COMPUESTO' : 'SIMPLE',
          dimensionesRequeridas: [],
        },
      });
      const ruta = await tx.ruta.create({
        data: { tenantId: tenant.id, codigo, nombre: codigo },
      });
      const paso = await tx.rutaPaso.create({
        data: {
          tenantId: tenant.id,
          rutaId: ruta.id,
          familiaCodigo: 'trabajo_manual',
          orden: 0,
        },
      });
      await tx.rutaVersion.create({
        data: {
          tenantId: tenant.id,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: { pasos: [JSON.parse(JSON.stringify(paso))] },
        },
      });
      const alternativa = await tx.productoRutaAlternativa.create({
        data: {
          tenantId: tenant.id,
          productoId: producto.id,
          rutaId: ruta.id,
          rutaVersion: 1,
          nombre: codigo,
          esPreferida: true,
        },
      });
      const config = await tx.productoConfigPaso.create({
        data: {
          tenantId: tenant.id,
          productoRutaAlternativaId: alternativa.id,
          rutaPasoId: paso.id,
          modoActivacion: 'OBLIGATORIO',
          modoTiempo: 'FIJO',
          tiempoFijoOverrideMin: 5,
        },
      });
      return {
        id: producto.id,
        ruta: alternativa.id,
        paso: paso.id,
        config: config.id,
      };
    };
    try {
      await test(tx, recetas, crear, tenant.id);
    } finally {
      if (concurrente) {
        await tx.productoReceta.deleteMany({ where: { tenantId: tenant.id } });
        await tx.producto.deleteMany({ where: { tenantId: tenant.id } });
        await tx.ruta.deleteMany({ where: { tenantId: tenant.id } });
        await tx.tenant.delete({ where: { id: tenant.id } });
        await tx.productoSubcategoriaComercial.delete({
          where: { id: subcategoria.id },
        });
        await tx.productoCategoriaComercial.delete({
          where: { id: categoria.id },
        });
      }
    }
    if (!concurrente) throw rollback;
  };
  if (concurrente) await ejecutar(db);
  else
    await expect(db.$transaction(ejecutar, { timeout: 60000 })).rejects.toBe(
      rollback,
    );
}

it('propaga entre simples y compuestos de varios niveles, conserva snapshots y no duplica versiones', async () => {
  await escenario(async (tx, recetas, crear, tenantId) => {
    const hijo = await crear('hijo');
    const padre = await crear('padre', true);
    const abuelo = await crear('abuelo', true);
    const componente = (id: string, paso: string) => ({
      productoComponenteId: id,
      codigo: 'pieza',
      nombre: 'Pieza',
      cantidad: 1,
      formula: 'por_unidad',
      unidad: 'unidad',
      nodoIncorporacionClave: `ruta:${paso}`,
      configuracionJson: {
        version: 1,
        bindings: [
          { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
        ],
      },
    });
    const publicadaPadre = await recetas.guardarConPublicacionAutomatica(
      { tenantId },
      padre.id,
      {
        rutaAlternativaId: padre.ruta,
        componentes: [componente(hijo.id, padre.paso)],
      },
    );
    expect(publicadaPadre.estado).toBe('PUBLICADA');
    const publicadaAbuelo = await recetas.guardarConPublicacionAutomatica(
      { tenantId },
      abuelo.id,
      {
        rutaAlternativaId: abuelo.ruta,
        componentes: [componente(padre.id, abuelo.paso)],
      },
    );
    expect(publicadaAbuelo.publicacionAutomatica.bloqueos).toEqual([]);
    const snapshotAnterior = JSON.stringify(publicadaPadre.snapshotJson);
    const total = await tx.productoRecetaRevision.count({
      where: { tenantId },
    });
    await recetas.sincronizarPublicaciones({ tenantId }, [hijo.id]);
    expect(await tx.productoRecetaRevision.count({ where: { tenantId } })).toBe(
      total,
    );
    await tx.productoConfigPaso.update({
      where: { id: hijo.config },
      data: { tiempoFijoOverrideMin: 12 },
    });
    expect(
      (await recetas.sincronizarPublicaciones({ tenantId }, [hijo.id]))
        .bloqueos,
    ).toEqual([]);
    const actuales = await tx.productoReceta.findMany({
      where: { tenantId },
      include: { revisionPublicada: { include: { componentes: true } } },
    });
    expect(actuales.every((r) => r.revisionPublicada?.numero === 2)).toBe(true);
    const hijoActual = actuales.find(
      (r) => r.productoId === hijo.id,
    )!.revisionPublicada!;
    const padreActual = actuales.find(
      (r) => r.productoId === padre.id,
    )!.revisionPublicada!;
    expect(padreActual.componentes[0].recetaRevisionId).toBe(hijoActual.id);
    expect(
      actuales.find((r) => r.productoId === abuelo.id)!.revisionPublicada!
        .componentes[0].recetaRevisionId,
    ).toBe(padreActual.id);
    expect(
      JSON.stringify(
        (
          await tx.productoRecetaRevision.findUniqueOrThrow({
            where: { id: publicadaPadre.id },
          })
        ).snapshotJson,
      ),
    ).toBe(snapshotAnterior);
    const editada = await recetas.guardarConPublicacionAutomatica(
      { tenantId },
      padre.id,
      {
        rutaAlternativaId: padre.ruta,
        expectedUpdatedAt: padreActual.updatedAt.toISOString(),
        componentes: [{ ...componente(hijo.id, padre.paso), cantidad: 2 }],
      },
    );
    expect(editada.estado).toBe('PUBLICADA');
    // Una publicación técnica no obliga a reabrir el editor que estaba abierto.
    await tx.productoConfigPaso.update({
      where: { id: padre.config },
      data: { tiempoFijoOverrideMin: 14 },
    });
    await recetas.sincronizarPublicaciones({ tenantId }, [padre.id]);
    const rebasada = await recetas.guardarConPublicacionAutomatica(
      { tenantId },
      padre.id,
      {
        rutaAlternativaId: padre.ruta,
        expectedUpdatedAt: editada.updatedAt.toISOString(),
        revisionBaseId: editada.id,
        componentes: [{ ...componente(hijo.id, padre.paso), cantidad: 3 }],
      },
    );
    expect(rebasada.estado).toBe('PUBLICADA');
    await expect(
      recetas.guardarConPublicacionAutomatica({ tenantId }, padre.id, {
        rutaAlternativaId: padre.ruta,
        expectedUpdatedAt: padreActual.updatedAt.toISOString(),
        componentes: [],
      }),
    ).rejects.toThrow('otra sesión');
    expect(
      (
        await recetas.resolverPublicadaParaCotizar(
          tenantId,
          abuelo.id,
          abuelo.ruta,
        )
      )?.componentes[0].recetaRevisionId,
    ).toBe(rebasada.id);
  });
});

it('se recupera al cotizar y publica las rutas válidas aunque otra alternativa esté incompleta', async () => {
  await escenario(async (tx, recetas, crear, tenantId) => {
    const producto = await crear('dos-rutas');
    const ruta = await tx.productoRutaAlternativa.findUniqueOrThrow({
      where: { id: producto.ruta },
    });
    const segunda = await tx.productoRutaAlternativa.create({
      data: {
        tenantId,
        productoId: producto.id,
        rutaId: ruta.rutaId,
        rutaVersion: 1,
        nombre: 'Segunda',
        esPreferida: false,
      },
    });
    const segundoPaso = await tx.productoConfigPaso.create({
      data: {
        tenantId,
        productoRutaAlternativaId: segunda.id,
        rutaPasoId: producto.paso,
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'FIJO',
        tiempoFijoOverrideMin: 8,
      },
    });
    expect(
      (await recetas.sincronizarPublicaciones({ tenantId }, [producto.id]))
        .bloqueos,
    ).toEqual([]);
    await tx.productoConfigPaso.update({
      where: { id: producto.config },
      data: { tiempoFijoOverrideMin: 9 },
    });
    expect(
      (
        await recetas.resolverPublicadaParaCotizar(
          tenantId,
          producto.id,
          producto.ruta,
        )
      )?.version,
    ).toBe(2);
    expect(
      (
        await recetas.resolverPublicadaParaCotizar(
          tenantId,
          producto.id,
          segunda.id,
        )
      )?.version,
    ).toBe(1);
    await tx.productoConfigPaso.delete({ where: { id: segundoPaso.id } });
    await tx.productoConfigPaso.update({
      where: { id: producto.config },
      data: { tiempoFijoOverrideMin: 10 },
    });
    const resultado = await recetas.sincronizarPublicaciones({ tenantId }, [
      producto.id,
    ]);
    expect(resultado.bloqueos).toHaveLength(1);
    expect(resultado.bloqueos[0].rutaAlternativaId).toBe(segunda.id);
    expect(
      (
        await recetas.resolverPublicadaParaCotizar(
          tenantId,
          producto.id,
          producto.ruta,
        )
      )?.version,
    ).toBe(3);
    await expect(
      recetas.resolverPublicadaParaCotizar(tenantId, producto.id, segunda.id),
    ).rejects.toThrow('no tiene configuración');
  });
});

it('serializa publicaciones concurrentes entre conexiones sin duplicar versiones', async () => {
  await escenario(async (tx, recetas, crear, tenantId) => {
    const producto = await crear('concurrente');
    await recetas.sincronizarPublicaciones({ tenantId }, [producto.id]);
    await tx.productoConfigPaso.update({
      where: { id: producto.config },
      data: { tiempoFijoOverrideMin: 19 },
    });
    const resultados = await Promise.all(
      [1, 2, 3].map(() =>
        recetas.sincronizarPublicaciones({ tenantId }, [producto.id]),
      ),
    );
    expect(resultados.every((r) => r.bloqueos.length === 0)).toBe(true);
    const versiones = await tx.productoRecetaRevision.findMany({
      where: { tenantId },
      orderBy: { numero: 'asc' },
    });
    expect(versiones.map((v) => [v.numero, v.estado])).toEqual([
      [1, 'DEPRECADA'],
      [2, 'PUBLICADA'],
    ]);
  }, true);
});
