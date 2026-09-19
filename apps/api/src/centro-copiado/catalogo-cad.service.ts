import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Catálogo comercial derivado de recetas, máquinas y materiales. Nunca consulta
 * destinos, conexiones QZ, bandejas ni pruebas físicas de impresión. */
@Injectable()
export class CatalogoCadService {
  constructor(private readonly prisma: PrismaService) {}
  async opcionesMaquina(
    tenantId: string,
    maquinaId: string,
    anchoRolloMm?: number,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const rutas = await db.productoRutaAlternativa.findMany({
      where: {
        tenantId,
        activo: true,
        producto: { tenantId, activo: true, estructuraProducto: 'SIMPLE' },
        ruta: { tenantId, activo: true },
        configPasos: {
          some: {
            activo: true,
            maquinasCandidatas: {
              some: { activo: true, maquinaId: maquinaId },
            },
          },
        },
      },
      include: {
        producto: { select: { id: true, nombre: true, codigo: true } },
        configPasos: {
          where: { activo: true, rutaPaso: { activo: true } },
          include: {
            rutaPaso: true,
            maquinasCandidatas: { where: { activo: true } },
            slotsMateriales: { where: { activo: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    const ids = rutas.flatMap((r) =>
      r.configPasos.flatMap((p) =>
        p.slotsMateriales.flatMap((s) =>
          s.materialVarianteId ? [s.materialVarianteId] : [],
        ),
      ),
    );
    const materiales = await db.materiaPrimaVariante.findMany({
      where: {
        id: { in: ids },
        tenantId,
        activo: true,
        materiaPrima: {
          tenantId,
          activo: true,
          subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
        },
      },
      include: { materiaPrima: true },
    });
    const opciones = rutas.flatMap((r) => {
      // El piloto conecta rutas con un único paso de impresión y material fijo.
      // No elegir materiales por nombre ni ignorar restricciones de la receta.
      const impresiones = r.configPasos.filter((p) =>
        p.rutaPaso.familiaCodigo.startsWith('impresion_'),
      );
      const paso = impresiones[0];
      if (
        impresiones.length !== 1 ||
        paso.rutaPaso.familiaCodigo !== 'impresion_por_area' ||
        paso.tercerizado
      )
        return [];
      const candidata = paso.maquinasCandidatas.find(
        (c) => c.maquinaId === maquinaId,
      );
      const slot = paso.slotsMateriales.find(
        (s) =>
          s.slotCodigo === 'sustrato_principal' &&
          s.modoSeleccion === 'HARDCODED',
      );
      const material = materiales.find(
        (m) => m.id === slot?.materialVarianteId,
      );
      if (!candidata || !material) return [];
      const attrs = {
        ...obj(material.materiaPrima.atributosTecnicosJson),
        ...obj(material.atributosVarianteJson),
      };
      const anchoMm = Number(attrs.anchoMm ?? Number(attrs.ancho) * 1000);
      if (
        !Number.isFinite(anchoMm) ||
        anchoMm < 300 ||
        anchoMm > 914.4 ||
        (anchoRolloMm !== undefined && Math.abs(anchoMm - anchoRolloMm) > 0.5)
      )
        return [];
      const gramaje = Number(attrs.gramajeGr ?? attrs.gramaje);
      const colores = (['BN', 'COLOR'] as const).filter((c) =>
        candidata.modoColorAllowedModes.includes(c === 'BN' ? 'BN' : 'CMYK'),
      );
      if (!colores.length) return [];
      return [
        {
          rutaAlternativaId: r.id,
          productoId: r.producto.id,
          productoNombre: r.producto.nombre,
          productoCodigo: r.producto.codigo,
          rutaNombre: r.nombre,
          configPasoId: paso.id,
          materialVarianteId: material.id,
          papelMateriaPrimaId: material.materiaPrimaId,
          materialNombre:
            material.nombreVariante || material.materiaPrima.nombre,
          papelNombre: material.materiaPrima.nombre,
          anchoMm,
          gramaje: Number.isFinite(gramaje) && gramaje > 0 ? gramaje : null,
          colores,
          revisionBase: [
            r.updatedAt,
            material.updatedAt,
            material.materiaPrima.updatedAt,
            paso,
            candidata,
            slot,
          ],
        },
      ];
    });
    return { opciones };
  }

  async configuraciones(tenantId: string) {
    const maquinas = await this.prisma.maquina.findMany({
      where: { tenantId, activo: true, plantilla: 'PLOTTER_CAD' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, updatedAt: true },
    });
    const grupos = await Promise.all(
      maquinas.map(async (maquina) => {
        const { opciones } = await this.opcionesMaquina(tenantId, maquina.id);
        return opciones.flatMap(({ revisionBase, ...opcion }) =>
          opcion.colores.map((color) => ({
            ...opcion,
            id: `${maquina.id}:${opcion.rutaAlternativaId}:${opcion.materialVarianteId}:${color}`,
            revision: createHash('sha256')
              .update(
                JSON.stringify([
                  maquina.updatedAt,
                  revisionBase,
                  opcion,
                  color,
                ]),
              )
              .digest('hex'),
            nombre: opcion.productoNombre,
            maquinaId: maquina.id,
            maquinaNombre: maquina.nombre,
            color,
            gramaje: opcion.gramaje,
            prioridad: 1,
            rollo: { anchoRolloMm: opcion.anchoMm, margenMm: 5 },
          })),
        );
      }),
    );
    return grupos.flat();
  }
}
