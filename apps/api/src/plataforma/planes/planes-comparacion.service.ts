import { resumenCupoUsuarios } from '../../suscripciones/cupos-usuarios';
import { cupoAlmacenamiento } from '../../archivos/cupo-almacenamiento';
import { diagnosticarCambioPlan } from './diagnostico-cambio-plan';
import { operacionesCambioPlan } from './operaciones-cambio-plan';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  contratoPropuesto,
  diferenciasCapacidades,
} from '../../suscripciones/evaluador-capacidades';
import type { ContenidoPlan } from './catalogo-planes';
import type { ComparacionPlanes } from './comparacion-planes';

@Injectable()
export class PlanesComparacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async comparar(
    tenantId: string,
    catalogoVersion: number,
    planes: ContenidoPlan[],
  ): Promise<ComparacionPlanes> {
    const propuestas = planes.map((p) => {
      try {
        return contratoPropuesto(p, catalogoVersion);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Propuesta inválida.',
        );
      }
    });
    // Una única foto consistente. No asigna planes, modifica cupos ni toca la pasarela.
    return this.prisma.$transaction(
      async (tx) => {
        const actual = await this.capacidades.actual(tenantId, tx);
        const retiradas = new Set(
          propuestas.flatMap((p) =>
            diferenciasCapacidades(actual.contrato, p)
              .filter((d) => d.actual && !d.propuesta)
              .map((d) => d.clave),
          ),
        );
        const [ocupacion, archivos, operaciones] = await Promise.all([
          resumenCupoUsuarios(tx, tenantId),
          cupoAlmacenamiento(tx, tenantId),
          operacionesCambioPlan(tx, tenantId, retiradas),
        ]);
        const usuariosOcupados = ocupacion.ocupados;
        const uso = {
          usuarios: {
            activos: ocupacion.activos,
            invitacionesPendientes: ocupacion.invitacionesPendientes,
            adicionalesVigentes: ocupacion.adicionales,
          },
          archivos: {
            guardadosBytes: String(archivos.bytes),
            reservadosBytes: String(archivos.bytesReservados),
            cargasPendientes: archivos.cargasPendientes,
          },
        };
        return {
          calculadoEl: new Date().toISOString(),
          empresa: actual.empresa,
          accesoActual: actual.acceso,
          actual: {
            nombre: actual.contrato.nombre,
            limites: actual.contrato.limites,
          },
          almacenamientoAjustadoBytes: actual.almacenamientoAjustadoBytes,
          usuariosOcupados,
          uso,
          propuestas: propuestas.map((propuesta, index) => ({
            nombre: propuesta.nombre,
            limites: propuesta.limites,
            adicionalesPermitidos: planes[index].adicionalesPermitidos,
            usuariosSobreIncluidos: Math.max(
              0,
              usuariosOcupados -
                (propuesta.limites.usuariosMax ?? usuariosOcupados),
            ),
            diferencias: diferenciasCapacidades(actual.contrato, propuesta),
            diagnostico: diagnosticarCambioPlan(
              actual.contrato,
              propuesta,
              planes[index],
              uso,
              actual.almacenamientoAjustadoBytes,
              operaciones,
            ),
            advertencias: [
              ...(actual.acceso.modo !== 'operativo'
                ? [
                    'El cambio de plan no levanta el bloqueo o la restricción actual de la cuenta.',
                  ]
                : []),
            ],
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
