"use client";
import * as React from "react";
import { Card } from "@heroui/react";
import { LayersIcon } from "lucide-react";
import { TelefonoField } from "@/components/clientes/telefono-field";
import { DetalleLoteFacturacion } from "@/components/administracion/facturacion-lotes";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import type { LoteFacturacion } from "@/lib/administracion-api";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import list from "@/components/design-system/list-page.module.css";
import s from "@/components/administracion/facturacion-lotes.module.css";
import page from "@/components/administracion/facturacion.module.css";

const lote: LoteFacturacion = {
  id: "demo",
  createdAt: "2026-10-08T21:52:00Z",
  estado: "completado",
  items: [1, 2].map((n) => ({
    id: `demo-${n}`,
    ordenIds: [],
    numeros: [`OT-DEMO-000${n}`],
    estado: "emitida",
    comprobanteId: null,
    error: null,
    avisoEstado: "enviada",
    avisoDetalle: null,
    pdfEstado: "listo",
  })),
};
/** Datos ficticios, sin API, facturación ni envío a clientes. */
export function FacturacionTelefonosPreview() {
  const [telefono, setTelefono] = React.useState({ codigo: "54", numero: "" });
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brand.theme} ${list.page} ${page.page}`}
      >
        <header className={list.header}>
          <div>
            <p className={page.eyebrow}>
              Administración · Seguimiento de facturación
            </p>
            <h1>
              Historial de lotes<span className={page.dot}>.</span>
            </h1>
            <p className={list.subtitle}>
              Tus facturas, sus envíos y cualquier observación, en un solo
              lugar.
            </p>
          </div>
        </header>
        <Card className={s.card}>
          <Card.Header className={s.cardHeader}>
            <span className={s.icon}>
              <LayersIcon aria-hidden />
            </span>
            <div>
              <Card.Title>Actividad de tus lotes</Card.Title>
              <Card.Description>
                Consultá el resultado de cada factura y sus envíos. Los lotes
                terminados se conservan acá.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content className={s.resultBody}>
            <DetalleLoteFacturacion lote={lote} seleccionado />
            <DetalleLoteFacturacion
              lote={{
                ...lote,
                id: "observaciones",
                createdAt: "2026-10-08T21:43:00Z",
                estado: "con_observaciones",
                items: [
                  {
                    ...lote.items[0],
                    avisoEstado: "omitida",
                    avisoDetalle: "Revisá el teléfono del cliente en su ficha.",
                  },
                ],
              }}
            />
          </Card.Content>
        </Card>
        <Card className={s.card}>
          <Card.Header className={s.cardHeader}>
            <div>
              <Card.Title>Teléfono del cliente</Card.Title>
              <Card.Description>
                Vista de prueba con datos ficticios. El número inicial está
                vacío.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content className={s.resultBody}>
            <TelefonoField
              id="telefono-demo"
              label="Teléfono principal (opcional)"
              codigo={telefono.codigo}
              numero={telefono.numero}
              onChange={(codigo, numero) => setTelefono({ codigo, numero })}
            />
          </Card.Content>
        </Card>
      </main>
    </DesignSystemProvider>
  );
}
