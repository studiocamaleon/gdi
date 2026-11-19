"use client";

import { useState } from "react";
import { SelectorMaterialEstimado } from "@/components/comercial/material-inventario-estimado";
import { ActionButton } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import brand from "@/components/design-system/brand-workspace-theme.module.css";
import { monedaDe } from "@/lib/monedas";
import { formatearMoneda } from "@/lib/moneda";
import { materialesDePrueba } from "./materiales-de-prueba";

export function PruebaMateriales() {
  const [importe, setImporte] = useState(0);
  const [detalle, setDetalle] = useState("");
  const [version, setVersion] = useState(0);
  const moneda = monedaDe("ARS");
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main
        data-ui="heroui"
        data-appearance="light"
        className={`${brand.theme} min-h-dvh bg-background text-foreground`}
      >
        <div className="mx-auto grid max-w-2xl gap-5 px-4 py-10">
          <header>
            <h1 className="text-xl font-semibold">
              Costos estimados de materiales
            </h1>
            <p className="text-sm text-muted-foreground">
              Prueba local con una fuente de 12 V y un rollo de vinilo
              ficticios.
            </p>
          </header>
          <SelectorMaterialEstimado
            key={version}
            catalogo={materialesDePrueba}
            moneda={moneda}
            costo={importe}
            detalle={detalle}
            onAgregar={(total, texto) => {
              setImporte(total);
              setDetalle(texto);
            }}
          />
          <section aria-live="polite">
            <h2 className="font-semibold">
              Total de materiales · {formatearMoneda(importe, moneda)}
            </h2>
            {detalle && (
              <ul className="mt-2 grid gap-1">
                {detalle.split("\n").map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            )}
          </section>
          <ActionButton
            className="w-fit"
            variant="outline"
            onPress={() => {
              setImporte(0);
              setDetalle("");
              setVersion((v) => v + 1);
            }}
          >
            Reiniciar prueba
          </ActionButton>
        </div>
      </main>
    </DesignSystemProvider>
  );
}
