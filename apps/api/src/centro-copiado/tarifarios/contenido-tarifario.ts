import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { monedas } from '../../common/monedas';
import { CENTRO_COPIADO_COBERTURAS } from '../centro-copiado.domain';
import {
  ErrorCalculoComercial,
  indexarTarifario,
} from '../comercial/validaciones';
import { indexarTarifarioCad } from '../comercial/validaciones-cad';

const entero = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const decimal = z.string().max(40);
const importe = z.string().regex(/^\d{1,18}(\.\d{1,12})?$/);
const acumulacion = z.enum(['COMBINACION', 'ARCHIVO']);
const cobertura = z.enum(['UNICA', 'DIFERENCIADA']);
const baseCombinacion = {
  papelMateriaPrimaId: z.uuid(),
  gramaje: entero.nullable(),
  color: z.enum(['BN', 'COLOR']),
  cobertura: z.enum(CENTRO_COPIADO_COBERTURAS).nullable(),
};
const rangosHojas = z.array(entero).min(1).max(100);
const rangosCad = z.array(decimal).min(1).max(100);

/** Contrato persistido, independiente de los IDs y permisos de la solicitud.
 * Las reglas semánticas siguen siendo las mismas que usa el cálculo comercial.
 */
const contenidoSchema = z
  .object({
    esquema: z.literal(1),
    monedaCodigo: z.string().refine((v) => monedas.some((m) => m.codigo === v)),
    hojas: z
      .object({
        reglas: z
          .object({
            unidad: z.enum(['HOJA', 'CARILLA']),
            acumulacion,
            cobertura,
            ultimaHojaImpar: z.enum(['MANTENER_DOBLE', 'COBRAR_SIMPLE']),
          })
          .strict(),
        rangosGenerales: rangosHojas,
        filas: z
          .array(
            z
              .object({
                combinacion: z
                  .object({
                    ...baseCombinacion,
                    tamano: z.string().min(1).max(30),
                    faz: z.union([z.literal(1), z.literal(2)]),
                  })
                  .strict(),
                rangosPropios: rangosHojas.nullable().optional(),
                precios: z
                  .array(
                    z
                      .object({
                        desdeCantidad: entero,
                        precioUnitario: decimal.nullable(),
                      })
                      .strict(),
                  )
                  .max(100),
              })
              .strict(),
          )
          .max(5000),
      })
      .strict()
      .nullable(),
    cad: z
      .object({
        reglas: z
          .object({
            unidad: z.literal('ML'),
            acumulacion,
            cobertura,
            redondeo: z.discriminatedUnion('modalidad', [
              z.object({ modalidad: z.literal('SIN_REDONDEO') }).strict(),
              z
                .object({
                  modalidad: z.literal('HACIA_ARRIBA'),
                  incrementoMl: decimal,
                })
                .strict(),
            ]),
          })
          .strict(),
        rangosGenerales: rangosCad,
        filas: z
          .array(
            z
              .object({
                combinacion: z
                  .object({
                    ...baseCombinacion,
                    anchoRolloMm: z.number().positive(),
                  })
                  .strict(),
                rangosPropios: rangosCad.nullable().optional(),
                precios: z
                  .array(
                    z
                      .object({
                        desdeCantidad: decimal,
                        precioUnitario: decimal.nullable(),
                      })
                      .strict(),
                  )
                  .max(100),
              })
              .strict(),
          )
          .max(5000),
      })
      .strict()
      .nullable(),
    composicion: z
      .object({
        iva: z.enum(['INCLUIDO', 'MAS_IVA']),
        preparacion: z.discriminatedUnion('modalidad', [
          z.object({ modalidad: z.literal('INCLUIDA') }).strict(),
          z.object({ modalidad: z.literal('FIJA_PEDIDO'), importe }).strict(),
        ]),
        minimo: z.discriminatedUnion('modalidad', [
          z.object({ modalidad: z.literal('SIN_MINIMO') }).strict(),
          z
            .object({ modalidad: z.literal('IMPORTE_PEDIDO'), importe })
            .strict(),
        ]),
      })
      .strict(),
  })
  .strict();

export type ContenidoTarifario = z.infer<typeof contenidoSchema>;

export function validarContenidoTarifario(valor: unknown): ContenidoTarifario {
  const resultado = contenidoSchema.safeParse(valor);
  if (!resultado.success) {
    throw new BadRequestException({
      message: 'Revisá la estructura del tarifario.',
      campos: resultado.error.issues.slice(0, 20).map((i) => i.path.join('.')),
    });
  }
  const c = resultado.data;
  if (!c.hojas && !c.cad) {
    throw new BadRequestException('El tarifario debe incluir hojas o CAD.');
  }
  if (c.hojas && c.cad && c.hojas.reglas.cobertura !== c.cad.reglas.cobertura) {
    throw new BadRequestException(
      'La modalidad de cobertura es general por tarifario.',
    );
  }
  const referencia = {
    tenantId: 'validacion',
    tarifarioId: 'validacion',
    versionId: 'borrador',
  };
  try {
    if (c.hojas) indexarTarifario({ ...referencia, ...c.hojas });
    if (c.cad) indexarTarifarioCad({ ...referencia, ...c.cad });
  } catch (error) {
    if (error instanceof ErrorCalculoComercial)
      throw new BadRequestException(error.message);
    throw error;
  }
  return c;
}
