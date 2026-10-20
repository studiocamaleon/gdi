import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  validarCondicionesEstadoPasos,
  type PasoConEstado,
} from '../motor-universal/estado-pasos';

type Alternativa = { id: string; rutaId: string; rutaVersion: number };
type Cambio = Partial<PasoConEstado> & { rutaPasoId: string; activo?: boolean };

/** Misma secuencia que cotiza el motor: pasos base de la versión y extras
 * de esta alternativa. El estado puede depender de un paso anterior o posterior. */
export async function validarEstadosPasosRuta(
  tx: Prisma.TransactionClient,
  tenantId: string,
  alternativa: Alternativa,
  cambio: Cambio,
): Promise<void> {
  const [bases, configs, extras] = await Promise.all([
    tx.rutaPaso.findMany({
      where: {
        tenantId,
        rutaId: alternativa.rutaId,
        version: alternativa.rutaVersion,
        activo: true,
      },
    }),
    tx.productoConfigPaso.findMany({
      where: {
        tenantId,
        productoRutaAlternativaId: alternativa.id,
        activo: true,
      },
    }),
    tx.productoPasoExtra.findMany({
      where: { tenantId, rutaAlternativaId: alternativa.id, activo: true },
    }),
  ]);
  const pasos: PasoConEstado[] = [
    ...bases.map((paso) => {
      const config = configs.find((item) => item.rutaPasoId === paso.id);
      return {
        rutaPasoId: paso.id,
        configPasoId: config?.id ?? paso.id,
        nombreVisible: config?.nombreVisible || paso.nombreVisible,
        familiaCodigo: paso.familiaCodigo,
        modoActivacion: config?.modoActivacion ?? 'OBLIGATORIO',
        condicionActivacionJson: config?.condicionActivacionJson,
      };
    }),
    ...extras.map((extra) => ({
      rutaPasoId: extra.id,
      configPasoId: extra.id,
      nombreVisible: extra.nombreVisible,
      familiaCodigo: extra.familiaCodigo,
      modoActivacion: extra.modoActivacion ?? 'OBLIGATORIO',
      condicionActivacionJson: extra.condicionActivacionJson,
    })),
  ];
  const indice = pasos.findIndex(
    (paso) => paso.rutaPasoId === cambio.rutaPasoId,
  );
  if (cambio.activo === false) {
    if (indice >= 0) pasos.splice(indice, 1);
  } else if (indice >= 0) {
    pasos[indice] = { ...pasos[indice], ...cambio };
  } else {
    // Alta de un extra o reactivación: el llamador ya verificó su pertenencia.
    pasos.push({ configPasoId: cambio.rutaPasoId, ...cambio });
  }
  try {
    validarCondicionesEstadoPasos(pasos);
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}
