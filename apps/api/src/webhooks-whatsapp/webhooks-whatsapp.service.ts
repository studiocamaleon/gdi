import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Receptor de webhooks de WhatsApp (Meta Cloud API) — F1a.
 *
 * Regla de oro: PERSISTIR PRIMERO, PROCESAR DESPUÉS. Meta no reenvía
 * history/echoes/state_sync perdidos: lo que no se guarda al llegar se pierde
 * para siempre. Este servicio firma-verifica, desarma el envelope y guarda
 * cada change CRUDO en WebhookWhatsappCrudo; los procesadores (statuses,
 * plantillas, account_update) vienen en F1d y leen de esa tabla.
 *
 * Ver docs/whatsapp-tech-provider-diseno.md §5.
 */

/** Un change del envelope de Meta, ya aplanado para persistir. */
export interface CambioWebhook {
  tipo: string;
  wamid: string | null;
  phoneNumberId: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class WebhooksWhatsappService {
  private readonly logger = new Logger(WebhooksWhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  get puedeVerificarFirma(): boolean {
    return Boolean(process.env.META_APP_SECRET);
  }

  get verifyToken(): string | undefined {
    return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined;
  }

  /**
   * Firma de Meta: `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256 del body
   * CRUDO con NUESTRO app secret. A diferencia de la época Dualhook, acá la
   * firma es verificable de verdad — es LA defensa del endpoint (que es
   * @Public): sin firma válida no se persiste ni se loguea contenido.
   */
  verificarFirma(rawBody: Buffer, header: string | undefined): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !header?.startsWith('sha256=')) return false;
    const esperada = createHmac('sha256', secret).update(rawBody).digest('hex');
    const recibida = header.slice('sha256='.length);
    if (recibida.length !== esperada.length) return false;
    return timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida));
  }

  /**
   * Desarma el envelope estándar de Meta (`entry[].changes[]`) en cambios
   * planos. El `field` del change es el tipo base; para `messages` se afina
   * por contenido (statuses vs mensajes entrantes vs errores) porque Meta
   * los manda por el mismo campo.
   */
  extraerCambios(body: unknown): CambioWebhook[] {
    const cambios: CambioWebhook[] = [];
    const entries = (body as { entry?: unknown[] })?.entry;
    if (!Array.isArray(entries)) return cambios;

    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const c = change as { field?: string; value?: Record<string, unknown> };
        const value = c.value ?? {};
        const metadata = (value.metadata ?? {}) as { phone_number_id?: string };

        let tipo = c.field ?? 'desconocido';
        let wamid: string | null = null;
        if (tipo === 'messages') {
          const statuses = value.statuses as Array<{ id?: string }> | undefined;
          const messages = value.messages as Array<{ id?: string }> | undefined;
          if (Array.isArray(statuses) && statuses.length) {
            tipo = 'statuses';
            wamid = statuses[0]?.id ?? null;
          } else if (Array.isArray(messages) && messages.length) {
            tipo = 'messages';
            wamid = messages[0]?.id ?? null;
          } else if (Array.isArray(value.errors) && value.errors.length) {
            tipo = 'errors';
          }
        }

        cambios.push({
          tipo,
          wamid,
          phoneNumberId: metadata.phone_number_id ?? null,
          payload: value,
        });
      }
    }
    return cambios;
  }

  /**
   * Persiste los cambios crudos, ruteando cada uno a su tenant por
   * phone_number_id (best-effort: si no hay integración conectada para ese
   * número, queda tenantId null y se revisa a mano — nunca se descarta).
   */
  async persistir(cambios: CambioWebhook[]): Promise<void> {
    if (cambios.length === 0) return;

    // Un webhook trae 1..n changes del MISMO número casi siempre: cachear el
    // ruteo por request evita n queries iguales.
    const ruteo = new Map<string, string | null>();
    for (const cambio of cambios) {
      const pni = cambio.phoneNumberId;
      if (!pni || ruteo.has(pni)) continue;
      const integracion = await this.prisma.integracionTenant.findFirst({
        where: {
          proveedor: 'META_WHATSAPP',
          metadataJson: { path: ['phoneNumberId'], equals: pni },
        },
        select: { tenantId: true },
      });
      ruteo.set(pni, integracion?.tenantId ?? null);
    }

    await this.prisma.webhookWhatsappCrudo.createMany({
      data: cambios.map((c) => ({
        tenantId: c.phoneNumberId ? (ruteo.get(c.phoneNumberId) ?? null) : null,
        tipo: c.tipo,
        wamid: c.wamid,
        phoneNumberId: c.phoneNumberId,
        payload: c.payload as object,
      })),
    });

    const sinTenant = cambios.filter(
      (c) => !c.phoneNumberId || !ruteo.get(c.phoneNumberId),
    ).length;
    if (sinTenant > 0) {
      // Esperable durante el modo prueba (número de test sin integración);
      // en producción sostenido es señal de conexión rota.
      this.logger.warn(
        `${sinTenant} webhook(s) de WhatsApp sin tenant ruteable.`,
      );
    }
  }
}
