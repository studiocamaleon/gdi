import { randomUUID } from 'node:crypto';
import { ControlTrabajosGeometriaService } from './control-trabajos-geometria.service';
import type { CrearTrabajoNestingOpenNestDto } from './geometria/geometria-jobs.dto';
import { GeometriaJobsService } from './geometria/geometria-jobs.service';

async function main(): Promise<void> {
  const control = new ControlTrabajosGeometriaService();
  const service = new GeometriaJobsService(control);
  const tenantId = `smoke-${randomUUID()}`;
  const dto = solicitud(`smoke-complete-${randomUUID()}`, 5);
  try {
    const initial = await service.crear({ tenantId, dto });
    const states = new Set([initial.estado]);
    let current = initial;
    const deadline = Date.now() + 15_000;
    while (
      (current.estado === 'pendiente' || current.estado === 'procesando') &&
      Date.now() < deadline
    ) {
      await esperar(200);
      current = await service.consultar(tenantId, current.id);
      states.add(current.estado);
    }
    if (
      current.estado !== 'completado' ||
      current.resultado?.cantidadColocada !== 5
    )
      throw new Error(`Estado final inesperado: ${JSON.stringify(current)}`);

    const scope = `smoke-obsolete-${randomUUID()}`;
    const first = await service.crear({
      tenantId,
      dto: solicitud(scope, 150),
    });
    const second = await service.crear({
      tenantId,
      dto: solicitud(scope, 151),
    });
    const obsolete = await service.consultar(tenantId, first.id);
    if (
      obsolete.estado !== 'cancelado' ||
      obsolete.cancelacion?.motivo !== 'obsoleto' ||
      obsolete.cancelacion.reemplazadoPor !== second.id
    )
      throw new Error(
        `El reemplazo de trabajo no quedó registrado: ${JSON.stringify(obsolete)}`,
      );
    const cancelled = await service.cancelar(tenantId, second.id);
    if (
      cancelled.estado !== 'cancelado' ||
      cancelled.cancelacion?.motivo !== 'usuario'
    )
      throw new Error(
        `La cancelación no quedó registrada: ${JSON.stringify(cancelled)}`,
      );

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          trabajoCompletado: current.id,
          estadosObservados: [...states],
          validacion: current.resultado.validacion,
          trabajoObsoleto: first.id,
          reemplazadoPor: second.id,
          cancelacionExplicita: cancelled.estado,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await service.onApplicationShutdown();
    control.onApplicationShutdown();
  }
}

function solicitud(
  claveSolicitud: string,
  cantidad: number,
): CrearTrabajoNestingOpenNestDto {
  return {
    motor: 'collision',
    placa: { anchoMm: 100, altoMm: 60, margenMm: 2, maxPlacas: 100 },
    separacionMm: 3,
    timeoutMs: 10_000,
    semilla: 7,
    claveSolicitud,
    piezas: [
      {
        id: 'rectangulo',
        cantidad,
        rotaciones: 4,
        contorno: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
          { x: 30, y: 20 },
          { x: 0, y: 20 },
        ],
      },
    ],
  };
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
