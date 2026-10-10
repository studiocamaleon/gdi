import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ORDEN_CANALES_VENTA } from '../../ordenes-trabajo/canales-venta';

export type CanalCopiado = (typeof ORDEN_CANALES_VENTA)[number];
const motor = z.object({ modalidad: z.literal('MOTOR') }).strict();
const tarifario = z
  .object({ modalidad: z.literal('TARIFARIO'), tarifarioId: z.uuid() })
  .strict();
const politicaSchema = z
  .object({
    esquema: z.literal(1),
    general: z.discriminatedUnion('modalidad', [motor, tarifario]),
    // El PUT reemplaza el documento completo: no se pierden excepciones omitidas.
    canales: z.record(
      z.enum(ORDEN_CANALES_VENTA),
      z.discriminatedUnion('modalidad', [
        motor,
        tarifario,
        z.object({ modalidad: z.literal('HEREDAR') }).strict(),
      ]),
    ),
  })
  .strict();

export type PoliticaPrecios = z.infer<typeof politicaSchema>;

export function politicaPreciosInicial(): PoliticaPrecios {
  return {
    esquema: 1,
    general: { modalidad: 'MOTOR' },
    canales: {
      whatsapp: { modalidad: 'HEREDAR' },
      mostrador: { modalidad: 'HEREDAR' },
      email: { modalidad: 'HEREDAR' },
      web: { modalidad: 'HEREDAR' },
      app_movil: { modalidad: 'HEREDAR' },
    },
  };
}

export function validarPoliticaPrecios(contenido: unknown): PoliticaPrecios {
  const resultado = politicaSchema.safeParse(contenido);
  if (!resultado.success)
    throw new BadRequestException({
      message:
        'Revisá la política general y las opciones de todos los canales.',
      campos: resultado.error.issues.slice(0, 20).map((i) => i.path.join('.')),
    });
  return resultado.data;
}

export function validarCanalCopiado(canal: unknown): CanalCopiado {
  const resultado = z.enum(ORDEN_CANALES_VENTA).safeParse(canal);
  if (!resultado.success)
    throw new BadRequestException(
      'Elegí un canal de venta válido para cotizar Centro de copiado.',
    );
  return resultado.data;
}

export function seleccionarPolitica(
  contenido: PoliticaPrecios,
  canal: unknown,
) {
  const canalVenta = validarCanalCopiado(canal);
  const configurada = contenido.canales[canalVenta];
  return configurada.modalidad === 'HEREDAR'
    ? { canalVenta, origen: 'GENERAL' as const, politica: contenido.general }
    : { canalVenta, origen: 'CANAL' as const, politica: configurada };
}

export function idsTarifariosPolitica(contenido: PoliticaPrecios) {
  return [
    ...new Set(
      [contenido.general, ...Object.values(contenido.canales)].flatMap((p) =>
        p.modalidad === 'TARIFARIO' ? [p.tarifarioId] : [],
      ),
    ),
  ];
}

/** Referencia de selección del servidor. No es una autorización de precio ni
 * sustituye los controles de pedido/oferta/acuerdos al emitir.
 */
export type ReferenciaPoliticaPrecios = {
  tenantId: string;
  politicaRevision: number;
  canalVenta: CanalCopiado;
  monedaCodigo: string;
} & (
  | { modalidad: 'MOTOR' }
  | { modalidad: 'TARIFARIO'; tarifarioId: string; versionId: string }
);

export function mismaReferenciaPolitica(
  a: ReferenciaPoliticaPrecios,
  b: ReferenciaPoliticaPrecios,
) {
  return (
    a.tenantId === b.tenantId &&
    a.politicaRevision === b.politicaRevision &&
    a.canalVenta === b.canalVenta &&
    a.monedaCodigo === b.monedaCodigo &&
    ((a.modalidad === 'MOTOR' && b.modalidad === 'MOTOR') ||
      (a.modalidad === 'TARIFARIO' &&
        b.modalidad === 'TARIFARIO' &&
        a.tarifarioId === b.tarifarioId &&
        a.versionId === b.versionId))
  );
}
