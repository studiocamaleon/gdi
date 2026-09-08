"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agruparPatronesNesting } from "@/lib/nesting-patrones";
import {
  crearSvgDePatron,
  crearDxfFabricacionDePatron,
  crearResumenPatrones,
  nombreArchivoPatron,
} from "@/lib/nesting-patrones-export";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import styles from "./plan-fabricacion.module.css";
import { toast } from "sonner";
import { useCapasFabricacion } from "@/hooks/use-capas-fabricacion";
import { EstadoCapasFabricacion } from "./capas-fabricacion-nesting";
import { completarFabricacionNesting } from "@/lib/fabricacion-export";

export function NestingPatronesDescargas({
  result: original,
  nombreBase,
  permitirDxf,
}: {
  result: NestingViewerInput;
  nombreBase: string;
  permitirDxf: boolean;
}) {
  const { result, ...estadoCapas } = useCapasFabricacion(original);
  const patrones = React.useMemo(
    () => agruparPatronesNesting(result),
    [result],
  );
  const [descargando, setDescargando] = React.useState(false);
  const descargar = async (
    contenido: () => string | Promise<string>,
    nombre: string,
    tipo: string,
  ) => {
    setDescargando(true);
    try {
      const url = URL.createObjectURL(
        new Blob([await contenido()], { type: tipo }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo exportar el patrón.",
      );
    } finally {
      setDescargando(false);
    }
  };
  if (!patrones.length) return null;
  return (
    <section className={styles.downloads} aria-label="Archivos por patrón">
      <EstadoCapasFabricacion {...estadoCapas} />
      <p className="text-sm text-muted-foreground">
        Un archivo por patrón. Fabricá la cantidad de copias indicada.
      </p>
      <div className={styles.downloadRows}>
        {patrones.map((p) => (
          <div key={p.id} className={styles.downloadRow}>
            <span className="text-sm">
              Patrón {p.id} · {p.repeticiones} copias
            </span>
            <Button
              disabled={
                descargando || estadoCapas.cargando || !!estadoCapas.error
              }
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Descargar patrón ${p.id} SVG, ${p.repeticiones} copias`}
              onClick={() =>
                descargar(
                  async () =>
                    crearSvgDePatron(
                      await completarFabricacionNesting(result),
                      p.id,
                    ),
                  `${nombreArchivoPatron(nombreBase, p)}.svg`,
                  "image/svg+xml",
                )
              }
            >
              <DownloadIcon data-icon="inline-start" />
              SVG
            </Button>
            {permitirDxf && (
              <Button
                disabled={
                  descargando || estadoCapas.cargando || !!estadoCapas.error
                }
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Descargar patrón ${p.id} DXF, ${p.repeticiones} copias`}
                onClick={() =>
                  descargar(
                    () => crearDxfFabricacionDePatron(result, p.id),
                    `${nombreArchivoPatron(nombreBase, p)}.dxf`,
                    "application/dxf",
                  )
                }
              >
                <DownloadIcon data-icon="inline-start" />
                DXF
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            descargar(
              () => crearResumenPatrones(result),
              `${nombreBase}-plan-de-fabricacion.txt`,
              "text/plain;charset=utf-8",
            )
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Resumen del plan
        </Button>
      </div>
    </section>
  );
}
