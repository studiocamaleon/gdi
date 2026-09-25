import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { configuracionMetaPiloto } from '../integraciones/meta/meta-piloto.config';

export interface CambioWebhook {
  tipo: string;
  wamid: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  payload: Record<string, unknown>;
}
const objeto = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

@Injectable()
export class WebhooksWhatsappService {
  constructor(private readonly prisma: PrismaService) {}
  get puedeVerificarFirma() {
    return Boolean(process.env.META_APP_SECRET);
  }
  get verifyToken() {
    return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined;
  }

  verificarFirma(rawBody: Buffer, header?: string): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !header || !/^sha256=[0-9a-f]{64}$/i.test(header))
      return false;
    const esperada = createHmac('sha256', secret).update(rawBody).digest();
    return timingSafeEqual(esperada, Buffer.from(header.slice(7), 'hex'));
  }

  extraerCambios(body: unknown): CambioWebhook[] {
    const cambios: CambioWebhook[] = [];
    for (const rawEntry of lista(objeto(body).entry)) {
      const entry = objeto(rawEntry);
      for (const rawChange of lista(entry.changes)) {
        const change = objeto(rawChange);
        if (
          typeof change.field !== 'string' ||
          !change.value ||
          typeof change.value !== 'object' ||
          Array.isArray(change.value)
        )
          continue;
        const value = objeto(change.value);
        const base = {
          wabaId: texto(entry.id),
          phoneNumberId: texto(objeto(value.metadata).phone_number_id),
        };
        // Separar todos los elementos. Un lote puede contener varios mensajes y
        // estados; deduplicar por el primero perdía el resto del lote.
        let separado = false;
        if (change.field === 'messages') {
          for (const key of ['statuses', 'messages', 'errors']) {
            for (const item of lista(value[key])) {
              if (!item || typeof item !== 'object' || Array.isArray(item))
                continue;
              const {
                statuses: _s,
                messages: _m,
                errors: _e,
                ...common
              } = value;
              cambios.push({
                ...base,
                tipo: key,
                wamid: texto(objeto(item).id),
                payload: { ...common, [key]: [item] },
              });
              separado = true;
            }
          }
        }
        if (!separado)
          cambios.push({
            ...base,
            tipo: change.field,
            wamid: null,
            payload: value,
          });
      }
    }
    return cambios;
  }

  async persistir(cambios: CambioWebhook[]): Promise<void> {
    if (!cambios.length) return;
    const rutas = new Map<string, string | null>();
    const filas: (CambioWebhook & {
      tenantId: string | null;
      dedupClave: string;
      payload: Prisma.InputJsonObject;
    })[] = [];
    for (const c of cambios) {
      const key = `${c.wabaId}:${c.phoneNumberId}`;
      if (!rutas.has(key)) rutas.set(key, await this.tenantDe(c));
      filas.push({
        ...c,
        tenantId: rutas.get(key) ?? null,
        dedupClave: createHash('sha256').update(canonico(c)).digest('hex'),
        payload: c.payload as Prisma.InputJsonObject,
      });
    }
    // Si falla el guardado O el procesamiento se devuelve error a Meta para
    // que reintente. Las huellas y las actualizaciones condicionales permiten
    // repetir el lote sin duplicar eventos ni retroceder estados.
    await this.prisma.$transaction(async (tx) => {
      await tx.webhookWhatsappCrudo.createMany({
        data: filas,
        skipDuplicates: true,
      });
      for (const fila of filas) {
        if (fila.tipo !== 'statuses' || !fila.tenantId || !fila.phoneNumberId)
          continue;
        const aplicado = await this.procesarEstado(
          tx,
          fila.tenantId,
          fila.phoneNumberId,
          objeto(lista(fila.payload.statuses)[0]),
        );
        if (aplicado)
          await tx.webhookWhatsappCrudo.updateMany({
            where: { dedupClave: fila.dedupClave },
            data: { procesado: true },
          });
      }
    });
  }

  private async tenantDe(c: CambioWebhook): Promise<string | null> {
    if (!c.wabaId) return null;
    const filters: Prisma.IntegracionTenantWhereInput[] = [
      { metadataJson: { path: ['wabaId'], equals: c.wabaId } },
    ];
    if (c.phoneNumberId)
      filters.push({
        metadataJson: { path: ['phoneNumberId'], equals: c.phoneNumberId },
      });
    const encontrados = await this.prisma.integracionTenant.findMany({
      where: { proveedor: 'META_WHATSAPP', estado: 'CONECTADA', AND: filters },
      select: { tenantId: true },
      take: 2,
    });
    const tenants = new Set(encontrados.map((x) => x.tenantId));
    const piloto = configuracionMetaPiloto();
    if (
      piloto?.listo &&
      c.wabaId === piloto.wabaId &&
      (!c.phoneNumberId || c.phoneNumberId === piloto.phoneNumberId)
    )
      tenants.add(piloto.tenantId);
    // Una asociación ambigua nunca se resuelve eligiendo la primera empresa.
    return tenants.size === 1 ? [...tenants][0] : null;
  }

  private async procesarEstado(
    tx: Prisma.TransactionClient,
    tenantId: string,
    phoneNumberId: string,
    status: Record<string, unknown>,
  ) {
    const wamid = texto(status.id);
    const estado = texto(status.status);
    const timestamp = Number(status.timestamp);
    if (
      !wamid ||
      !estado ||
      !['sent', 'delivered', 'read', 'failed'].includes(estado) ||
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      timestamp > 8.64e12
    )
      return false;
    const correlacion = texto(status.biz_opaque_callback_data);
    const id =
      correlacion &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(correlacion)
        ? correlacion
        : null;
    const scope: Prisma.NotificacionWhatsappWhereInput = {
      tenantId,
      canal: 'META_WHATSAPP',
      metaPhoneNumberId: phoneNumberId,
      OR: [{ metaWamid: wamid }, ...(id ? [{ id, metaWamid: null }] : [])],
    };
    // Monótono: read > delivered > sent. Un failed tardío tampoco deshace
    // una entrega comprobada. Las fechas originales quedan en el evento crudo.
    const anteriores: Record<string, string[]> = {
      sent: [],
      delivered: ['sent', 'failed'],
      read: ['sent', 'delivered', 'failed'],
      failed: ['sent'],
    };
    const codigo = objeto(lista(status.errors)[0]).code;
    await tx.notificacionWhatsapp.updateMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { estadoEntrega: null },
              { estadoEntrega: { in: anteriores[estado] } },
            ],
          },
        ],
      },
      data: {
        metaWamid: wamid,
        estadoEntrega: estado,
        estadoEntregaEl: new Date(timestamp * 1000),
        estado: estado === 'failed' ? 'fallida' : 'enviada',
        metaErrorCodigo:
          estado === 'failed' && Number.isInteger(codigo)
            ? String(codigo)
            : null,
        motivo:
          estado === 'failed'
            ? `Meta informó que no pudo entregar el mensaje${Number.isInteger(codigo) ? ` (código ${codigo})` : ''}.`
            : null,
      },
    });
    return (await tx.notificacionWhatsapp.count({ where: scope })) > 0;
  }
}
