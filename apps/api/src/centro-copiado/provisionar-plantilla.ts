import { PrismaClient } from '@prisma/client';

/**
 * Provisiona el producto plantilla "Impresión de documento" (SYS-IMPRESION-DOC)
 * del TPV Centro de copiado — Etapa A.
 * Diseño:  docs/tpv-centro-copiado-diseno.md
 * Plan:    docs/tpv-centro-copiado-plan-tecnico.md
 *
 * Decisiones aplicadas:
 *  - Producto plantilla ÚNICO; el modal (Etapa C) varía el jobContext por fila.
 *  - Impresión M-2: candidatas B/N (láser mono) + Color (láser color). El motor
 *    NO auto-rutea por color: usa la que el adaptador setee en
 *    `maquinaSeleccionada_<configPasoId>` según el modoColor del documento.
 *    `modoColorAllowedModes` documenta el ruteo esperado.
 *  - Anillado DIFERIDO: la ruta trae SOLO `impresion_por_hoja`.
 *  - mecanismoCantidad = CALCULADO_POR_PASO: el adaptador pasa piezas del tamaño
 *    del pliego (A4/A3) con márgenes 0 ⇒ 1 pose/pliego ⇒ pliegos = hojas físicas.
 *
 * Idempotente y race-safe: si el producto ya existe (o lo crea otra provisión
 * concurrente), devuelve el existente. Auto-resuelve máquinas/perfiles/papeles
 * por ROL (no hardcodea ids del tenant).
 */

export const CC_RUTA_CODIGO = 'CC-IMPRESION-DOC';
export const CC_PRODUCTO_CODIGO = 'SYS-IMPRESION-DOC';
export const CC_SUBCAT_CODIGO = 'papeleria_comercial';
/** Marca de sistema del producto/ruta del centro de copiado: oculto del
 *  catálogo, no editable/borrable. Ver docs/centro-copiado-modulo-configurable-diseno.md. */
export const CC_SISTEMA_CODIGO = 'centro_copiado';
export const CC_PLIEGO_A4 = { preset: 'A4', anchoMm: 210, altoMm: 297 };

type MaquinaConDetalle = {
  id: string;
  nombre: string;
  componentesDesgaste: { soloColor: boolean }[];
  perfilesOperativos: { id: string; nombre: string }[];
};

const esColorMaquina = (m: MaquinaConDetalle) =>
  m.componentesDesgaste.some((c) => c.soloColor);

const perfilSimpleFaz = (perfiles: { id: string; nombre: string }[]) =>
  perfiles.find((p) => /simple/i.test(p.nombre)) ?? perfiles[0] ?? null;

export type ProvisionResultado =
  | { estado: 'ya_existe'; productoId: string }
  | { estado: 'creado'; productoId: string; detalle: string }
  | { estado: 'omitido'; motivo: string };

export async function provisionarPlantillaCentroCopiado(
  prisma: PrismaClient,
  tenantId: string,
): Promise<ProvisionResultado> {
  const existente = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    select: { id: true, sistemaCodigo: true },
  });
  if (existente) {
    // Backfill idempotente: la plantilla creada antes de existir la marca de
    // sistema queda sin flag; se la sana en el primer uso (así se esconde del
    // catálogo y se bloquea su edición sin una migración de datos aparte).
    if (existente.sistemaCodigo !== CC_SISTEMA_CODIGO) {
      await prisma.producto.update({
        where: { id: existente.id },
        data: { sistemaCodigo: CC_SISTEMA_CODIGO },
      });
      await prisma.ruta.updateMany({
        where: { tenantId, codigo: CC_RUTA_CODIGO },
        data: { sistemaCodigo: CC_SISTEMA_CODIGO },
      });
    }
    return { estado: 'ya_existe', productoId: existente.id };
  }

  const subcat = await prisma.productoSubcategoriaComercial.findUnique({
    where: { codigo: CC_SUBCAT_CODIGO },
  });
  if (!subcat)
    return { estado: 'omitido', motivo: `sin subcategoría '${CC_SUBCAT_CODIGO}'` };

  const laseres = (await prisma.maquina.findMany({
    where: { tenantId, plantilla: 'IMPRESORA_LASER', activo: true },
    include: { componentesDesgaste: true, perfilesOperativos: true },
  })) as unknown as MaquinaConDetalle[];
  if (laseres.length === 0)
    return { estado: 'omitido', motivo: 'sin IMPRESORA_LASER' };

  const colorM =
    laseres
      .filter(esColorMaquina)
      .sort(
        (a, b) => b.perfilesOperativos.length - a.perfilesOperativos.length,
      )[0] ?? null;
  const bnM = laseres.find((m) => !esColorMaquina(m)) ?? null;

  const perfilColor = colorM ? perfilSimpleFaz(colorM.perfilesOperativos) : null;
  const perfilBn = bnM ? perfilSimpleFaz(bnM.perfilesOperativos) : null;

  const papeles = (
    await prisma.materiaPrima.findMany({
      where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
      include: { variantes: { where: { activo: true }, orderBy: { sku: 'asc' } } },
      orderBy: { nombre: 'asc' },
    })
  ).filter((p) => p.variantes.length > 0);
  if (papeles.length === 0)
    return { estado: 'omitido', motivo: 'sin papeles SUSTRATO_HOJA' };

  const papelDefault =
    papeles.find((p) => /obra/i.test(p.nombre)) ?? papeles[0];
  const maquinaBase = colorM ?? bnM!;
  const perfilBase = perfilColor ?? perfilBn;

  let productoId: string;
  try {
    productoId = await prisma.$transaction(async (tx) => {
      const ruta = await tx.ruta.create({
        data: {
          tenantId,
          codigo: CC_RUTA_CODIGO,
          nombre: 'Impresión de documento (centro de copiado)',
          descripcion:
            'Ruta plantilla del TPV Centro de copiado. Solo impresión por hoja; anillado diferido.',
          versionActual: 1,
          sistemaCodigo: CC_SISTEMA_CODIGO,
          activo: true,
        },
      });
      const paso = await tx.rutaPaso.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          orden: 0,
          familiaCodigo: 'impresion_por_hoja',
          icono: 'Printer',
          activo: true,
        },
      });
      // El motor valida la ruta contra el snapshot de la RutaVersion (no basta
      // con los RutaPaso vivos): sin esta fila, cotizar falla con
      // "no tiene snapshot de versión 1".
      await tx.rutaVersion.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: {
            pasos: [{ id: paso.id, orden: 0, familia: 'impresion_por_hoja' }],
          },
          cambios: 'Versión inicial (plantilla TPV centro de copiado)',
        },
      });
      const producto = await tx.producto.create({
        data: {
          tenantId,
          codigo: CC_PRODUCTO_CODIGO,
          nombre: 'Impresión de documento',
          descripcion:
            'Producto plantilla del TPV Centro de copiado. No se cotiza directo desde el catálogo: lo consume el modal de carga rápida (un renglón por documento).',
          subcategoriaComercialId: subcat.id,
          unidadComercial: 'unidad',
          modoMedidas: 'MIXTA',
          medidaDefaultAnchoMm: CC_PLIEGO_A4.anchoMm,
          medidaDefaultAltoMm: CC_PLIEGO_A4.altoMm,
          categoriaFiscal: 'general',
          sistemaCodigo: CC_SISTEMA_CODIGO,
          precioConfigJson: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 40, minimumMarginPct: 25 },
          },
          activo: true,
        },
      });
      const rutaAlt = await tx.productoRutaAlternativa.create({
        data: {
          tenantId,
          productoId: producto.id,
          rutaId: ruta.id,
          rutaVersion: 1,
          nombre: 'Impresión digital',
          esPreferida: true,
          orden: 0,
          activo: true,
        },
      });
      const configPaso = await tx.productoConfigPaso.create({
        data: {
          tenantId,
          productoRutaAlternativaId: rutaAlt.id,
          rutaPasoId: paso.id,
          modoActivacion: 'OBLIGATORIO',
          modoTiempo: 'T-3',
          mecanismoCantidad: 'CALCULADO_POR_PASO',
          multiplicadoresActivos: ['caras'],
          maquinaM1Id: maquinaBase.id,
          perfilM1Id: perfilBase ? perfilBase.id : null,
          paramsPasoJson: {
            nestingConfig: {
              pliegoImpresion: CC_PLIEGO_A4,
              extraMargins: { topMm: 0, leftMm: 0, rightMm: 0, bottomMm: 0 },
              allowRotation: false,
            },
          },
          activo: true,
        },
      });

      const candidatas: {
        maquinaId: string;
        perfilDefaultId: string | null;
        modos: string[];
        esPreferida: boolean;
        orden: number;
      }[] = [];
      if (colorM)
        candidatas.push({
          maquinaId: colorM.id,
          perfilDefaultId: perfilColor ? perfilColor.id : null,
          modos: ['CMYK'],
          esPreferida: true,
          orden: 0,
        });
      if (bnM)
        candidatas.push({
          maquinaId: bnM.id,
          perfilDefaultId: perfilBn ? perfilBn.id : null,
          modos: ['BN'],
          esPreferida: !colorM,
          orden: colorM ? 1 : 0,
        });
      for (const c of candidatas) {
        await tx.productoConfigPasoMaquinaCandidata.create({
          data: {
            tenantId,
            productoConfigPasoId: configPaso.id,
            maquinaId: c.maquinaId,
            esPreferida: c.esPreferida,
            orden: c.orden,
            activo: true,
            perfilDefaultId: c.perfilDefaultId,
            modoColorAllowedModes: c.modos,
          },
        });
      }

      const slot = await tx.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'COMERCIAL_ELIGE',
          estrategiaCosto: 'simple',
          formula: 'por_unidad_productiva',
          aplicaMultiCaras: false, // el papel se cuenta por hoja, no por carilla
          activo: true,
        },
      });
      let ord = 0;
      for (const p of papeles) {
        await tx.productoConfigPasoSlotMaterialCandidato.create({
          data: {
            tenantId,
            slotMaterialId: slot.id,
            materiaPrimaId: p.id,
            defaultVarianteId: p.variantes[0].id,
            orden: ord++,
            todasLasVariantes: true,
          },
        });
      }

      return producto.id;
    });
  } catch (e) {
    // Carrera con otra provisión concurrente (dos requests/tests provisionando a
    // la vez): si el producto ya quedó creado, devolverlo; si no, propagar.
    const yaExiste = await prisma.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    });
    if (yaExiste) return { estado: 'ya_existe', productoId: yaExiste.id };
    throw e;
  }

  const detalle =
    `color: ${colorM ? colorM.nombre : '—'} (${perfilColor ? perfilColor.nombre : '—'}) · ` +
    `B/N: ${bnM ? bnM.nombre : '—'} (${perfilBn ? perfilBn.nombre : '—'}) · ` +
    `papeles: ${papeles.map((p) => p.nombre).join(', ')} · default: ${papelDefault.nombre}`;
  return { estado: 'creado', productoId, detalle };
}
