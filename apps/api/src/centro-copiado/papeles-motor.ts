import type { PrismaService } from '../prisma/prisma.service';
import type { PasoCargado } from '../motor-universal/tipos';
import {
  CC_PRODUCTO_CODIGO,
  CC_RUTA_CODIGO,
  CC_SISTEMA_CODIGO,
} from './provisionar-plantilla';

/** La plantilla de copiado ofrece el catálogo vivo, no la foto de papeles del
 * día de su inicialización. Hidrata únicamente su sustrato en memoria; no
 * modifica recetas ni extiende las candidatas de productos de usuario/CAD.
 * Oferta/gramaje/formato se validan en CentroCopiadoService y el motor conserva
 * sus comprobaciones de variante, precio, unidad y compatibilidad productiva.
 */
export async function cargarPapelesMotorCopiado(
  db: Pick<PrismaService, 'materiaPrima'>,
  tenantId: string,
  producto: { codigo: string; sistemaCodigo: string | null },
  ruta: { codigo: string; sistemaCodigo: string | null },
  pasos: PasoCargado[],
): Promise<void> {
  if (
    producto.codigo !== CC_PRODUCTO_CODIGO ||
    producto.sistemaCodigo !== CC_SISTEMA_CODIGO ||
    ruta.codigo !== CC_RUTA_CODIGO ||
    ruta.sistemaCodigo !== CC_SISTEMA_CODIGO
  )
    return;
  for (const paso of pasos) {
    if (paso.familiaCodigo === 'impresion_por_hoja')
      paso.conservaSobrantePapel = true;
  }
  const slots = pasos
    .filter((p) => p.familiaCodigo === 'impresion_por_hoja')
    .flatMap((p) => p.slots)
    .filter(
      (s) =>
        s.slotCodigo === 'sustrato_principal' &&
        s.modoSeleccion === 'COMERCIAL_ELIGE',
    );
  if (!slots.length) return;
  const papeles = await db.materiaPrima.findMany({
    where: {
      tenantId,
      activo: true,
      subfamilia: 'SUSTRATO_HOJA',
      variantes: { some: { tenantId, activo: true } },
    },
    select: {
      id: true,
      variantes: {
        where: { tenantId, activo: true },
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        select: { id: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  for (const slot of slots) {
    const existentes = new Map(
      slot.candidatos.map((c) => [c.materiaPrimaId, c.id]),
    );
    slot.candidatos = papeles.map((papel, orden) => ({
      // Identidad de lectura para materiales agregados después de provisionar.
      id: existentes.get(papel.id) ?? papel.id,
      materiaPrimaId: papel.id,
      defaultVarianteId: null,
      orden,
      variantes: papel.variantes.map((v, i) => ({
        varianteId: v.id,
        orden: i,
      })),
    }));
  }
}
