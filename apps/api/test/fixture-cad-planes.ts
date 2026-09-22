import type { Prisma } from '@prisma/client';

/** Adapta la receta de rollo del seed exclusivamente dentro del rollback de
 * conPlanesAsignados. No necesita destinos QZ ni una impresora instalada. */
export async function prepararCadPlanes(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const producto = await tx.producto.findFirstOrThrow({
    where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    include: {
      rutasAlternativas: {
        include: {
          configPasos: { include: { rutaPaso: true, slotsMateriales: true } },
        },
      },
    },
  });
  const ruta = producto.rutasAlternativas[0];
  const paso = ruta.configPasos.find(
    (p) => p.rutaPaso.familiaCodigo === 'impresion_por_area',
  )!;
  const maquinaId = paso.maquinaM1Id!;
  await tx.maquina.update({
    where: { id: maquinaId },
    data: {
      nombre: 'Plotter CAD de prueba',
      plantilla: 'PLOTTER_CAD',
      anchoUtil: 914,
      parametrosTecnicosJson: {
        geometria: 'ROLLO',
        anchoMinRolloMm: 300,
        anchoMaxRolloMm: 914,
        margenesNoImprimiblesMm: { sup: 5, inf: 5, izq: 5, der: 5 },
        coloresSoportados: ['BN', 'CMYK'],
      },
    },
  });
  await tx.maquinaPerfilOperativo.update({
    where: { id: paso.perfilM1Id! },
    data: { detalleJson: { colores: ['BN', 'CMYK'], modoCalidad: 'NORMAL' } },
  });
  const papel = await tx.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'TEST-CAD-PAPEL',
      nombre: 'Rollo Obra CAD',
      familia: 'SUSTRATO',
      subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
      tipoTecnico: 'papel',
      templateId: 'papel',
      unidadStock: 'METRO_LINEAL',
      unidadUso: 'METRO_LINEAL',
      unidadCompra: 'ROLLO',
      atributosTecnicosJson: {},
    },
  });
  const variante = await tx.materiaPrimaVariante.create({
    data: {
      tenantId,
      materiaPrimaId: papel.id,
      sku: 'TEST-CAD-914',
      precioReferencia: 1000,
      unidadPrecio: 'METRO_LINEAL',
      atributosVarianteJson: {
        anchoMm: 914,
        largoMm: 50000,
        largoRolloMm: 50000,
        gramajeGr: 80,
      },
    },
  });
  await tx.productoConfigPasoSlotMaterial.update({
    where: {
      id: paso.slotsMateriales.find(
        (s) => s.slotCodigo === 'sustrato_principal',
      )!.id,
    },
    data: { modoSeleccion: 'HARDCODED', materialVarianteId: variante.id },
  });
  await tx.productoConfigPasoMaquinaCandidata.create({
    data: {
      tenantId,
      productoConfigPasoId: paso.id,
      maquinaId,
      perfilDefaultId: paso.perfilM1Id,
      modoColorAllowedModes: ['BN', 'CMYK'],
      esPreferida: true,
    },
  });
  await tx.productoConfigPaso.updateMany({
    where: {
      tenantId,
      productoRutaAlternativaId: ruta.id,
      id: { not: paso.id },
    },
    data: { activo: false },
  });
  return { producto, ruta, maquinaId, papel, variante };
}
