"use client";

import { DownloadIcon } from "lucide-react";

import { ActionButton } from "@/components/design-system/action-button";
import {
  nombreArchivoReporte,
  serializarCsv,
  type FilaCsv,
} from "@/lib/reporte-csv";

function texto(elemento: Element | null | undefined): string {
  return (
    elemento?.getAttribute("data-reporte-exportar") ??
    elemento?.textContent ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function filasVisibles(reporte: string, raiz: Element): FilaCsv[] {
  const filas: FilaCsv[] = [
    ["Reporte", reporte],
    [
      "Exportado",
      new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
    ],
  ];
  const periodo = texto(raiz.querySelector("[data-reporte-periodo]"));
  if (periodo) filas.push(["Período", periodo]);

  const kpis = Array.from(
    raiz.querySelectorAll("[data-reporte-indicador], .d-kpi"),
  );
  if (kpis.length > 0) {
    filas.push([], ["Indicadores"], ["Indicador", "Valor", "Detalle"]);
    kpis.forEach((kpi) => {
      filas.push([
        texto(kpi.querySelector("[data-reporte-etiqueta], .d-kpi-lbl")),
        texto(kpi.querySelector("[data-reporte-valor], .d-kpi-val")),
        texto(kpi.querySelector("[data-reporte-detalle], .d-kpi-foot")),
      ]);
    });
  }

  raiz.querySelectorAll("table").forEach((tabla, indice) => {
    const tarjeta = tabla.closest("[data-reporte-seccion], .d-card");
    const titulo =
      texto(
        tarjeta?.querySelector("[data-reporte-titulo], .d-card-head .ttl"),
      ) || `Tabla ${indice + 1}`;
    filas.push([], [titulo]);
    const encabezados = Array.from(tabla.querySelectorAll("thead th")).map(
      (celda) => texto(celda),
    );
    if (encabezados.some(Boolean)) filas.push(encabezados);
    tabla.querySelectorAll("tbody tr").forEach((fila) => {
      filas.push(
        Array.from(fila.querySelectorAll("th, td")).map((celda) =>
          texto(celda),
        ),
      );
    });
  });

  const fuente = texto(raiz.querySelector("[data-reporte-fuente], .d-meta"));
  if (fuente) filas.push([], ["Fuente", fuente]);
  return filas;
}

export function ReporteExportButton({ reporte }: { reporte: string }) {
  const exportar = () => {
    const raiz = document.querySelector("[data-reporte-cuerpo]");
    if (!raiz) return;
    const csv = `\uFEFF${serializarCsv(filasVisibles(reporte, raiz))}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivoReporte(reporte);
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ActionButton
      type="button"
      variant="outline"
      onPress={exportar}
      title="Exportar indicadores y tablas visibles"
    >
      <DownloadIcon data-icon="inline-start" />
      Exportar CSV
    </ActionButton>
  );
}
