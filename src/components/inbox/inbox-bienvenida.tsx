"use client";

import {
  CheckCheck,
  FileText,
  Link2,
  MessageCircle,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { InboxConexion } from "./inbox-conexion";
import type { InboxIdentidad } from "@/lib/meta-inbox-api";
import type { MetaConexionApi } from "@/lib/meta-conexion-api";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import s from "./inbox-bienvenida.module.css";

export function InboxBienvenida({
  identidad,
  api,
}: {
  identidad: InboxIdentidad;
  api?: MetaConexionApi;
}) {
  return (
    <Empty className={s.welcome}>
      <div className={s.intro}>
        <EmptyHeader className="max-w-none items-start text-left">
          <div className={s.eyebrow}>
            <MessageCircle size={15} aria-hidden="true" /> CONVERSACIONES QUE
            CONECTAN
          </div>
          <EmptyTitle size="hero" role="heading" aria-level={2}>
            Tu WhatsApp, <br />
            dentro de Grafo<span className={s.dot}>.</span>
          </EmptyTitle>
          <EmptyDescription>
            Del primer mensaje al trabajo terminado. Reuní las conversaciones de
            tu empresa y el contexto de cada cliente en un mismo lugar.
          </EmptyDescription>
        </EmptyHeader>
        <ul className={s.benefits}>
          <li>
            <Smartphone size={18} aria-hidden="true" />
            <div>
              <strong>Tu número de siempre</strong>
              <p>Conectá WhatsApp Business y seguí usándolo en el celular.</p>
            </div>
          </li>
          <li>
            <Link2 size={18} aria-hidden="true" />
            <div>
              <strong>Cada conversación, con contexto</strong>
              <p>
                Identificá al cliente por su teléfono y consultá sus órdenes en
                Grafo.
              </p>
            </div>
          </li>
          <li>
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Vos autorizás el acceso</strong>
              <p>
                La conexión se completa en Meta, con los datos que elijas
                compartir.
              </p>
            </div>
          </li>
        </ul>
      </div>
      <figure
        className={s.illustration}
        aria-label="Ejemplo ilustrativo de una conversación junto a una orden de trabajo"
      >
        <figcaption className={s.caption}>
          <span>UN CHAT. TODO EL CONTEXTO.</span>
          <Badge variant="secondary">Vista ilustrativa</Badge>
        </figcaption>
        <div className={s.mock} aria-hidden="true">
          <div className={s.mockHeader}>
            <span className={s.avatar}>ML</span>
            <div>
              <strong>María López</strong>
              <small>Estudio Norte · Cliente de Grafo</small>
            </div>
            <MessageCircle size={18} />
          </div>
          <div className={s.mockThread}>
            <span className={s.today}>HOY</span>
            <div className={s.incoming}>
              ¡Hola! ¿Cómo viene el pedido de las tarjetas?<small>10:24</small>
            </div>
            <div className={s.outgoing}>
              Hola, María. Ya está en producción.
              <small>
                10:25 <CheckCheck size={13} />
              </small>
            </div>
            <div className={s.order}>
              <span>
                <FileText size={17} /> ORDEN VINCULADA
              </span>
              <strong>Tarjetas personales</strong>
              <div>
                <span>OT-00124 · 500 unidades</span>
                <span className={s.orderState}>En producción</span>
              </div>
            </div>
          </div>
          <div className={s.mockFooter}>
            <Link2 size={14} />
            <span>Cliente identificado por su teléfono</span>
          </div>
        </div>
        <p className={s.illustrationNote}>
          Las conversaciones y las órdenes del ejemplo son ficticias.
        </p>
      </figure>
      <EmptyContent className={s.connection}>
        <InboxConexion
          key={`${identidad.empresaId}:${identidad.usuarioId}`}
          identidad={identidad}
          api={api}
        />
      </EmptyContent>
    </Empty>
  );
}
