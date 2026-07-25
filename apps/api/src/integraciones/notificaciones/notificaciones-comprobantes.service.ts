import { Injectable, Logger } from '@nestjs/common';
import { TipoEnlacePublico } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { nombreDelCliente } from './notificaciones-ordenes.service';
import { enContextoDe } from './contexto';
import { urlEnlacePublico } from '../../enlaces-publicos/enlaces-publicos.urls';

/** Como lo dice la gente, no como lo guarda la base. */
const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
};

/**
 * "Emitimos tu factura" — el aviso del comprobante fiscal.
 *
 * Se manda cuando el comprobante tiene CAE, no cuando pasa a `emitido`. Con el
 * provider manual son dos momentos distintos: el comprobante queda emitido y el
 * CAE se carga después, a mano, desde el portal de ARCA. Una factura sin CAE no
 * es un comprobante válido, y mandarle al cliente un PDF que después cambia es
 * peor que esperar. Por eso enganchan los dos caminos —emitir y cargar el CAE—
 * y la clave única del encolado se encarga de que sólo salga una vez.
 *
 * Vale igual para notas de crédito y débito: también son documentos fiscales
 * del cliente, y la plantilla nombra el tipo en el texto.
 * Ver docs/notificaciones-whatsapp-catalogo.md
 */
@Injectable()
export class NotificacionesComprobantesService {
  private readonly logger = new Logger(NotificacionesComprobantesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Pensado para llamarse sin `await` desde el flujo de negocio. */
  async avisar(comprobanteId: string): Promise<void> {
    try {
      await this.intentar(comprobanteId);
    } catch (error) {
      this.logger.error(
        `Falló al avisar el comprobante ${comprobanteId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async intentar(comprobanteId: string): Promise<void> {
    const comprobante = await this.prisma.comprobante.findFirst({
      where: { id: comprobanteId },
      select: {
        id: true,
        tenantId: true,
        tipo: true,
        letra: true,
        numero: true,
        total: true,
        estado: true,
        cae: true,
        clienteId: true,
        ordenId: true,
        cliente: { select: { razonSocial: true } },
        puntoVenta: { select: { numero: true } },
      },
    });
    if (!comprobante) return;

    // Sin CAE no hay comprobante que mostrar: el manual lo carga después y ahí
    // vuelve a pasar por acá.
    if (comprobante.estado !== 'emitido' || !comprobante.cae) return;
    if (!comprobante.clienteId || !comprobante.numero) return;

    const enlace = await this.prisma.enlacePublico.findUnique({
      where: {
        tipo_entidadId: {
          tipo: TipoEnlacePublico.FACTURA,
          entidadId: comprobante.id,
        },
      },
      select: { token: true },
    });
    // El mensaje existe para que el cliente abra el comprobante: sin link no
    // hay nada que abrir.
    if (!enlace) return;

    const parametros = [
      nombreDelCliente(comprobante.cliente?.razonSocial),
      `${TIPO_LABEL[comprobante.tipo] ?? comprobante.tipo} ${comprobante.letra}`,
      numeroFormateado(comprobante.puntoVenta.numero, comprobante.numero),
      money(Number(comprobante.total)),
      urlEnlacePublico(TipoEnlacePublico.FACTURA, enlace.token),
    ];

    // Cargar el CAE a mano puede venir de un flujo con tenant en contexto, pero
    // el encolado lo exige y no cuesta nada asegurarlo desde acá.
    await enContextoDe(comprobante.tenantId, () =>
      this.notificaciones.encolar({
        evento: 'comprobante_emitido',
        entidadId: comprobante.id,
        clienteId: comprobante.clienteId,
        ordenId: comprobante.ordenId,
        parametros,
      }),
    );
  }
}

/** 0003-00001285, como figura impreso en el comprobante. */
function numeroFormateado(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

/** Sin `$`: el símbolo ya está en el texto fijo de la plantilla. */
function money(n: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
