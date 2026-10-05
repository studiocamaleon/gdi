"use client";
import { Edit3, PackageCheck } from "lucide-react";
import { useState } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import { ActionButton } from "@/components/design-system/action-button";
import { OrdenPersonalPrevisto } from "./orden-personal-previsto";
import { OrdenAccionesMenus } from "./orden-acciones-menus";
import type { EleccionPersonal } from "../../../apps/api/src/ordenes-trabajo/personal-previsto.contrato";

/** Catálogo local aislado: selección y botones sólo afectan este estado en memoria. */
export function OperadoresDesignPreview() {
  const [dark, setDark] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [asignacionesPersonal, setAsignaciones] = useState<EleccionPersonal[]>(
    [],
  );
  const productos = [
    {
      id: "demo",
      nombre: "Impresión de documento",
      cotizacionItemId: "demo-cotizacion",
      asignacionesPersonal,
    },
  ];
  return (
    <DesignSystemProvider theme="brand" appearance={dark ? "dark" : "light"}>
      <main
        className={`${theme.theme} ${theme.legacy}`}
        data-ui="heroui"
        data-appearance={dark ? "dark" : "light"}
        style={{
          minHeight: "100dvh",
          background: "var(--canvas-background)",
          color: "var(--foreground)",
          padding: "clamp(16px, 4vw, 48px)",
        }}
      >
        <div style={{ maxWidth: 1020, margin: "auto" }}>
          <header
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <small>CATÁLOGO DE DISEÑO · DATOS FICTICIOS</small>
              <h1 style={{ fontSize: 28, marginTop: 8 }}>
                Operadores y acciones de la OT
              </h1>
            </div>
            <ActionButton variant="ghost" onPress={() => setDark((v) => !v)}>
              Cambiar apariencia
            </ActionButton>
            <ActionButton
              onPress={() => setMensaje("Edición elegida (muestra)")}
            >
              <Edit3 />
              Editar orden
            </ActionButton>
            <ActionButton
              onPress={() => setMensaje("Entrega elegida (muestra)")}
            >
              <PackageCheck />
              Entregar
            </ActionButton>
            <OrdenAccionesMenus
              documentos={() => setMensaje("Documentos elegidos (muestra)")}
              etiqueta={() => setMensaje("Etiqueta elegida (muestra)")}
              historial={() => setMensaje("Historial elegido (muestra)")}
              seguimiento={() => setMensaje("Enlace elegido (muestra)")}
              qr={() => setMensaje("QR elegido (muestra)")}
              impresionDirecta
            />
          </header>
          <OrdenPersonalPrevisto
            productos={productos}
            preparar={async () => productos}
            onChange={(v) => setAsignaciones(v.get("demo") ?? [])}
            consultar={async (_, elegidos) => ({
              zona: "America/Argentina/Rio_Gallegos",
              items: [
                {
                  cotizacionItemId: "demo-cotizacion",
                  aviso: null,
                  pasos: [
                    {
                      nodoClave: "imprimir",
                      nombre: "Impresión por hoja CMYK",
                      estacion: "Centro de copiado",
                      maquina: "Impresora de producción",
                      personasNecesarias: 1,
                      motivo: null,
                      candidatos: [
                        {
                          id: "ana",
                          nombre: "Ana Demo",
                          tieneHorario: true,
                          asignacionAutomatica: true,
                        },
                        {
                          id: "bruno",
                          nombre: "Bruno Demo",
                          tieneHorario: true,
                          asignacionAutomatica: false,
                        },
                        {
                          id: "carla",
                          nombre: "Carla Demo",
                          tieneHorario: false,
                          asignacionAutomatica: false,
                        },
                      ],
                      finAutomatico: "2026-10-06T13:00:00Z",
                      finElegido: elegidos.demo?.length
                        ? "2026-10-06T14:30:00Z"
                        : "2026-10-06T13:00:00Z",
                    },
                    {
                      nodoClave: "acabado",
                      nombre: "Abrochado",
                      estacion: "Terminaciones",
                      maquina: null,
                      personasNecesarias: 1,
                      motivo: null,
                      candidatos: [
                        {
                          id: "bruno",
                          nombre: "Bruno Demo",
                          tieneHorario: true,
                          asignacionAutomatica: true,
                        },
                      ],
                      finAutomatico: "2026-10-06T13:15:00Z",
                      finElegido: "2026-10-06T14:45:00Z",
                    },
                  ],
                },
              ],
            })}
          />
          <p role="status" style={{ marginTop: 20 }}>
            {mensaje}
          </p>
        </div>
      </main>
    </DesignSystemProvider>
  );
}
