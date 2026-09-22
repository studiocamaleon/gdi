import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  incluirOferta,
  presentarOferta,
} from '../plataforma/planes/ofertas-planes';
import type { ContenidoPlan } from '../plataforma/planes/catalogo-planes';
import {
  diagnosticarCambioPlan,
  requiereCerrarOperacion,
} from '../plataforma/planes/diagnostico-cambio-plan';
import { operacionesCambioPlan } from '../plataforma/planes/operaciones-cambio-plan';
import { cupoAlmacenamiento } from '../archivos/cupo-almacenamiento';
import { resumenCupoUsuarios } from './cupos-usuarios';
import { contratoPublicado, contratoSuscripcion } from './contrato-suscripcion';
import { diferenciasCapacidades } from './evaluador-capacidades';
import type {
  RevisionContratacion,
  SeleccionContratacion,
} from './contratacion-tipos';

/** Se usa al presentar y justo antes de enviar a Paddle. No concede derechos. */
export async function revisarContratacion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  dto: SeleccionContratacion,
) {
  if (
    !Number.isInteger(dto.adicionales) ||
    dto.adicionales < 0 ||
    dto.adicionales > 10000 ||
    !['mensual', 'anual'].includes(dto.ciclo)
  )
    throw new BadRequestException(
      'Indicá un ciclo y una cantidad válida de usuarios adicionales.',
    );
  const [tenant, oferta] = await Promise.all([
    tx.tenant.findUnique({
      where: { id: tenantId },
      include: { suscripcion: { include: { plan: true, planVersion: true } } },
    }),
    tx.planOferta.findUnique({
      where: { id: dto.ofertaId },
      include: { ...incluirOferta, plan: true },
    }),
  ]);
  if (!tenant?.suscripcion)
    throw new NotFoundException(
      'La empresa necesita una suscripción antes de contratar.',
    );
  if (!tenant.activo)
    throw new BadRequestException(
      'La empresa tiene un bloqueo administrativo.',
    );
  const entorno =
    process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';
  if (
    !oferta ||
    oferta.entorno !== entorno ||
    !oferta.plan.activo ||
    (!oferta.plan.publico && tenant.suscripcion.planId !== oferta.planId) ||
    oferta.plan.ofertaActualId !== oferta.id
  )
    throw new ConflictException(
      'Esta oferta ya no está disponible. Actualizá los planes.',
    );
  const s = tenant.suscripcion;
  if (!['manual', 'paddle'].includes(s.proveedor))
    throw new BadRequestException(
      'Esta suscripción se gestiona con otro proveedor.',
    );
  const tipo =
    s.proveedor === 'paddle' && s.referenciaExterna && s.estado !== 'baja'
      ? ('cambio' as const)
      : ('checkout' as const);
  const bloqueos: string[] = [];
  if (
    tipo === 'cambio' &&
    (s.cambioProgramado ||
      !['active', 'trialing'].includes(s.estadoProveedor ?? ''))
  )
    bloqueos.push(
      'Regularizá el pago, la pausa o la cancelación programada antes de cambiar el plan.',
    );
  const p = oferta.version.contenido as unknown as ContenidoPlan;
  if (dto.adicionales && !p.adicionalesPermitidos)
    throw new BadRequestException(
      'Esta oferta no admite usuarios adicionales.',
    );
  const base = oferta.precios.find(
    (i) => i.tipo === 'base' && i.ciclo === dto.ciclo,
  );
  const extra = oferta.precios.find(
    (i) => i.tipo === 'usuario' && i.ciclo === dto.ciclo,
  );
  if (
    !base ||
    (dto.adicionales && (!extra || dto.adicionales > extra.cantidadMaxima))
  )
    throw new BadRequestException(
      'El ciclo o la cantidad de adicionales no están disponibles en esta oferta.',
    );
  const actual = contratoSuscripcion(s);
  const destino = contratoPublicado(oferta.version);
  const diferencias = diferenciasCapacidades(actual, destino);
  const retiradas = new Set(
    diferencias.filter((f) => f.actual && !f.propuesta).map((f) => f.clave),
  );
  const [usuarios, archivos, operaciones] = await Promise.all([
    resumenCupoUsuarios(tx, tenantId),
    cupoAlmacenamiento(tx, tenantId),
    operacionesCambioPlan(tx, tenantId, retiradas),
  ]);
  const diagnostico = diagnosticarCambioPlan(
    actual,
    destino,
    p,
    {
      usuarios: {
        activos: usuarios.activos,
        invitacionesPendientes: usuarios.invitacionesPendientes,
        adicionalesVigentes: dto.adicionales,
      },
      archivos: {
        guardadosBytes: String(archivos.bytes),
        reservadosBytes: String(archivos.bytesReservados),
        cargasPendientes: archivos.cargasPendientes,
      },
    },
    tenant.cuotaBytesArchivos ? String(tenant.cuotaBytesArchivos) : null,
    operaciones,
  );
  bloqueos.push(
    ...diagnostico.hallazgos
      .filter((h) => h.nivel === 'resolver')
      .map((h) => h.detalle),
  );
  const pendientes = operaciones.filter(requiereCerrarOperacion);
  bloqueos.push(
    ...pendientes.map(
      (o) =>
        `${o.titulo}: ${o.cantidad}. Completá o cancelá estos compromisos antes de retirar su función.`,
    ),
  );
  if (
    tipo === 'cambio' &&
    s.ofertaId === oferta.id &&
    s.cicloFacturacion === dto.ciclo &&
    s.usuariosAdicionales === dto.adicionales
  )
    bloqueos.push(
      'La empresa ya tiene este plan, ciclo y cantidad de usuarios adicionales.',
    );
  const cargo = oferta.precios.find(
    (i) => i.tipo === 'implementacion' && i.ciclo === 'unico',
  );
  const implementacion =
    tipo === 'checkout' && !s.implementacionResueltaEl
      ? Number(cargo?.importe ?? 0)
      : 0;
  if (
    tipo === 'checkout' &&
    !s.implementacionResueltaEl &&
    (p.comercial?.implementacion ?? 0) > 0 &&
    !cargo
  )
    throw new ConflictException(
      'La oferta necesita sincronizar su cargo de implementación.',
    );
  const vista: RevisionContratacion = {
    implementacion,
    implementacionPriceId: implementacion > 0 ? cargo!.priceId : null,
    totalInicial:
      Number(base.importe) +
      Number(extra?.importe ?? 0) * dto.adicionales +
      implementacion,
    actual: { nombre: actual.nombre, adicionales: s.usuariosAdicionales },
    destino: {
      nombre: p.nombre,
      version: oferta.version.numero,
      incluidos: p.usuariosIncluidos,
      adicionales: dto.adicionales,
      totalUsuarios: p.usuariosIncluidos + dto.adicionales,
      gb: p.almacenamientoGb,
    },
    diferencias,
    diagnostico,
    bloqueos,
    revisiones: diagnostico.hallazgos
      .filter(
        (h) =>
          h.nivel === 'revisar' &&
          !pendientes.some((o) => o.codigo === h.codigo),
      )
      .map((h) => h.codigo),
    ciclo: dto.ciclo,
    precioBase: Number(base.importe),
    precioUsuario: extra ? Number(extra.importe) : 0,
    totalPeriodo:
      Number(base.importe) +
      (extra ? Number(extra.importe) * dto.adicionales : 0),
  };
  const items = [
    { priceId: base.priceId, quantity: 1 },
    ...(implementacion > 0 ? [{ priceId: cargo!.priceId, quantity: 1 }] : []),
    ...(dto.adicionales && extra
      ? [{ priceId: extra.priceId, quantity: dto.adicionales }]
      : []),
  ];
  const huella = createHash('sha256')
    .update(
      JSON.stringify({
        dto,
        vista,
        operaciones,
        revision: s.revisionContrato,
        referencia: s.referenciaExterna,
        estado: s.estado,
        estadoProveedor: s.estadoProveedor,
        cuota: String(tenant.cuotaBytesArchivos ?? 0),
        usuariosOcupados: usuarios.ocupados,
        bytes: String(archivos.bytes),
        reservas: String(archivos.bytesReservados),
        oferta: presentarOferta(oferta),
      }),
    )
    .digest('hex');
  return { vista, huella, items, oferta, suscripcion: s, tipo };
}
