import type { PrismaService } from '../prisma/prisma.service';
import type { PasoCargado } from '../motor-universal/tipos';
import {
  CC_PRODUCTO_CODIGO,
  CC_RUTA_CODIGO,
  CC_SISTEMA_CODIGO,
} from './provisionar-plantilla';

/** El anillado de copiado usa los materiales activos del inventario actual.
 * La plantilla puede haberse creado antes de instalar o reemplazar un anillo.
 * Sólo hidrata candidatos en memoria; el motor valida precio, unidad y capacidad.
 */
export async function cargarAnilladoMotorCopiado(
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
  const slots = pasos
    .filter((p) => p.familiaCodigo === 'encuadernado_anillado')
    .flatMap((p) => p.slots)
    .filter(
      (s) =>
        (s.slotCodigo === 'anillo' && s.modoSeleccion === 'MOTOR_ELIGE_AUTO') ||
        (['tapa_frontal', 'tapa_posterior'].includes(s.slotCodigo) &&
          s.modoSeleccion === 'COMERCIAL_ELIGE'),
    );
  if (!slots.length) return;
  const materiales = await db.materiaPrima.findMany({
    where: {
      tenantId,
      activo: true,
      familia: 'TERMINACION_EDITORIAL',
      subfamilia: { in: ['ANILLADO_ENCUADERNACION', 'TAPA_ENCUADERNACION'] },
      variantes: { some: { tenantId, activo: true } },
    },
    select: {
      id: true,
      subfamilia: true,
      variantes: {
        where: { tenantId, activo: true },
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        select: { id: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  for (const slot of slots) {
    const subfamilia =
      slot.slotCodigo === 'anillo'
        ? 'ANILLADO_ENCUADERNACION'
        : 'TAPA_ENCUADERNACION';
    const existentes = new Map(
      slot.candidatos.map((c) => [c.materiaPrimaId, c.id]),
    );
    slot.candidatos = materiales
      .filter((m) => m.subfamilia === subfamilia)
      .map((m, orden) => ({
        id: existentes.get(m.id) ?? m.id,
        materiaPrimaId: m.id,
        defaultVarianteId: null,
        orden,
        variantes: m.variantes.map((v, i) => ({ varianteId: v.id, orden: i })),
      }));
  }
}
