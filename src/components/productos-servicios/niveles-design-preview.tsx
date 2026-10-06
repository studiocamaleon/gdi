"use client";
import { useState } from "react";
import { NivelesPasoFields } from "./niveles-paso-fields";
import { NodosVisualProvider } from "./nodos-ui";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import { nivelesDesdePerfiles } from "@/lib/niveles-paso";
const maquina = {
  id: "plotter-demo",
  nombre: "Plotter de prueba",
  perfilDefaultId: "simple",
  perfiles: [
    {
      id: "simple",
      nombre: "Corte simple",
      productivityValue: 8,
      productivityUnit: "m²/h",
    },
    {
      id: "complejo",
      nombre: "Corte complejo",
      productivityValue: 4,
      productivityUnit: "m²/h",
    },
  ],
};
/** Ensayo visual sin API: todo queda en memoria y usa datos ficticios. */
export function NivelesDesignPreview() {
  const [dark, setDark] = useState(false);
  const [corte, setCorte] = useState<Record<string, unknown>>({
    niveles: nivelesDesdePerfiles(maquina, undefined, "¿Qué nivel de corte?"),
  });
  const [manual, setManual] = useState<Record<string, unknown>>({
    productivityValue: 12,
  });
  return (
    <DesignSystemProvider theme="brand" appearance={dark ? "dark" : "light"}>
      <NodosVisualProvider>
        <main
          className={`${theme.theme} ${theme.legacy}`}
          data-ui="heroui"
          data-appearance={dark ? "dark" : "light"}
          style={{
            minHeight: "100dvh",
            padding: "clamp(16px,4vw,48px)",
            background: "var(--canvas-background)",
            color: "var(--foreground)",
          }}
        >
          <div style={{ maxWidth: 900, margin: "auto" }}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <div>
                <small>VISTA LOCAL · DATOS FICTICIOS</small>
                <h1 style={{ fontSize: 28, marginTop: 8 }}>Niveles del paso</h1>
              </div>
              <ActionButton
                variant="outline"
                onPress={() => setDark((v) => !v)}
              >
                Cambiar apariencia
              </ActionButton>
            </header>
            <section
              style={{
                padding: 24,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--surface-1)",
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                Troquelado · opcional del vinilo impreso
              </h2>
              <p style={{ marginBottom: 20 }}>
                Elegí el perfil del plotter para cada nivel. La impresión
                conserva su propia configuración.
              </p>
              <NivelesPasoFields
                params={corte}
                maquinas={[maquina]}
                tiempoDeMaquina
                dotacionDelPaso={1}
                onChange={(patch) => setCorte((v) => ({ ...v, ...patch }))}
              />
            </section>
            <section
              style={{
                padding: 24,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--surface-1)",
              }}
            >
              <h2 style={{ fontSize: 20, marginBottom: 16 }}>
                Terminación manual
              </h2>
              <NivelesPasoFields
                params={manual}
                dotacionDelPaso={1}
                onChange={(patch) => setManual((v) => ({ ...v, ...patch }))}
              />
            </section>
          </div>
        </main>
      </NodosVisualProvider>
    </DesignSystemProvider>
  );
}
