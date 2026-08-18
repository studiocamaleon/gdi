"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { nombreArchivoReporte, serializarCsv, type FilaCsv } from "@/lib/reporte-csv";

function texto(elemento: Element | null | undefined): string {
  return (elemento?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function filasVisibles(reporte: string, raiz: Element): FilaCsv[] {
  const filas: FilaCsv[] = [
    ["Reporte", reporte],
    ["Exportado", new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date())],
  ];

  const kpis = Array.from(raiz.querySelectorAll(".d-kpi"));
  if (kpis.length > 0) {
    filas.push([], ["Indicadores"], ["Indicador", "Valor", "Detalle"]);
    kpis.forEach((kpi) => {
      filas.push([
        texto(kpi.querySelector(".d-kpi-lbl")),
        texto(kpi.querySelector(".d-kpi-val")),
        texto(kpi.querySelector(".d-kpi-foot")),
      ]);
    });
  }

  raiz.querySelectorAll("table").forEach((tabla, indice) => {
    const tarjeta = tabla.closest(".d-card");
    const titulo = texto(tarjeta?.querySelector(".d-card-head .ttl")) || `Tabla ${indice + 1}`;
    filas.push([], [titulo]);
    const encabezados = Array.from(tabla.querySelectorAll("thead th")).map((celda) => texto(celda));
    if (encabezados.some(Boolean)) filas.push(encabezados);
    tabla.querySelectorAll("tbody tr").forEach((fila) => {
      filas.push(Array.from(fila.querySelectorAll("th, td")).map((celda) => texto(celda)));
    });
  });

  const fuente = texto(raiz.querySelector(".d-meta"));
  if (fuente) filas.push([], ["Fuente", fuente]);
  return filas;
}

export function ReporteExportButton({ reporte }: { reporte: string }) {
  const exportar = () => {
    const raiz = document.querySelector("[data-reporte-cuerpo]");
    if (!raiz) return;
    const csv = `\uFEFF${serializarCsv(filasVisibles(reporte, raiz))}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivoReporte(reporte);
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" variant="outline" onClick={exportar} title="Exportar indicadores y tablas visibles">
      <DownloadIcon data-icon="inline-start" />
      Exportar CSV
    </Button>
  );
}
