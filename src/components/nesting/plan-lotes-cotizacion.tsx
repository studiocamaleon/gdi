"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { DesgloseOperacionesCorte } from "@/components/comercial/desglose-operaciones-corte";

import * as React from "react";
import { ArrowUpRightIcon, Layers3Icon, } from "lucide-react";
import theme from "@/components/ui/workspace-theme.module.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  obtenerPlanesFabricacion,
  type CotizacionFabricacion,
} from "@/lib/plan-fabricacion-cotizacion";
import { agruparPatronesNesting } from "@/lib/nesting-patrones";
import { NestingViewer } from "./nesting-viewer";
import { NestingPatronesDescargas } from "./nesting-patrones-descargas";
import { nombreBaseSvg } from "@/lib/nesting-vectorial-export";
import styles from "./plan-fabricacion.module.css";

export function PlanLotesCotizacion({
  cotizacion,
  jobContext,
  esperado = false,
  estado = "listo",
  onOpenChange,
}: {
  cotizacion?: CotizacionFabricacion | null;
  jobContext?: Record<string, unknown>;
  esperado?: boolean;
  estado?: "listo" | "calculando" | "pendiente" | "error";
  onOpenChange?: (open: boolean) => void;
}) {
  const [abierta, setAbierta] = React.useState<CotizacionFabricacion | null>(
    null,
  );
  const setOpen = (value: boolean) =>
    setAbierta(value ? (cotizacion ?? null) : null);
  const [seleccionado, setSeleccionado] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const planes = React.useMemo(
    () => obtenerPlanesFabricacion(cotizacion, jobContext),
    [cotizacion, jobContext],
  );
  const resumen = React.useMemo(
    () =>
      planes.reduce(
        (r, p) => {
          const patrones = agruparPatronesNesting(p.result);
          const placas = p.result.substrates.reduce(
            (n, t) => n + (t.kind === "sheet" ? t.count : 0),
            0,
          );
          const metros = p.result.substrates.reduce(
            (n, t) => n + (t.kind === "roll" ? t.lengthMm / 1000 : 0),
            0,
          );
          return {
            placas: r.placas + placas,
            metros: r.metros + metros,
            patrones: r.patrones + patrones.length,
            piezas:
              r.piezas +
              (patrones.length
                ? patrones.reduce(
                    (n, t) =>
                      n +
                      Object.values(t.cantidades).reduce((s, q) => s + q, 0) *
                        t.repeticiones,
                    0,
                  )
                : p.result.piezasAcomodadas),
          };
        },
        { placas: 0, metros: 0, patrones: 0, piezas: 0 },
      ),
    [planes],
  );
  const vigente = estado === "listo" && planes.length > 0;
  const visible = !!abierta && abierta === cotizacion && vigente;
  React.useEffect(() => {
    onOpenChange?.(visible);
    return () => {
      onOpenChange?.(false);
    };
  }, [visible, onOpenChange]);
  if (!planes.length && !esperado) return null;
  const actual = planes.find((p) => p.id === seleccionado) ?? planes[0];
  const cortes = actual?.operaciones.filter((o) => o.esCorte) ?? [];
  const formato = (n: number) => n.toLocaleString("es-AR");
  return (
    <>
      <section
        className={cn(theme.theme, styles.summary)}
        aria-label="Resumen del plan de fabricación"
      >
        <div className={styles.summaryHeading}>
          <Layers3Icon aria-hidden="true" />
          <strong>Plan de fabricación</strong>
          <span className={styles.status} data-ready={vigente} role="status">
            {estado === "calculando" ? (
              <>
                <GdiSpinner className="size-4" /> Calculando…
              </>
            ) : estado === "error" ? (
              "Requiere atención"
            ) : vigente ? (
              "Calculado"
            ) : (
              "Pendiente de cálculo"
            )}
          </span>
        </div>
        {vigente ? (
          <>
            <div className={styles.metrics}>
              {resumen.placas > 0 ? (
                <span>
                  <b>{formato(resumen.placas)}</b>{" "}
                  {resumen.placas === 1 ? "placa" : "placas"}
                </span>
              ) : null}
              {resumen.metros > 0 ? (
                <span>
                  <b>
                    {resumen.metros.toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })}
                  </b>{" "}
                  metros lineales
                </span>
              ) : null}
              {resumen.patrones > 0 ? (
                <span>
                  <b>{formato(resumen.patrones)}</b>{" "}
                  {resumen.patrones === 1 ? "layout" : "layouts"}
                </span>
              ) : null}
              <span>
                <b>{formato(resumen.piezas)}</b> piezas
              </span>
            </div>
            <div className={styles.summaryFoot}>
              <p>
                {planes.some((p) => p.operaciones.length > 1)
                  ? "Impresión y corte comparten las placas vinculadas."
                  : "Revisá la distribución antes de agregar el producto."}
              </p>
              <Button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(true)}
              >
                Ver plan <ArrowUpRightIcon />
              </Button>
            </div>
          </>
        ) : (
          <p className={styles.pending}>
            {estado === "calculando"
              ? "Estamos calculando las placas y sus layouts para esta configuración."
              : estado === "error"
                ? "Resolvé el aviso de cotización para obtener el plan de fabricación."
                : "Al calcular la cotización vas a poder revisar las placas y los layouts."}
          </p>
        )}
      </section>
      <Dialog open={visible} onOpenChange={setOpen}>
        <DialogContent
          data-plan-fabricacion-dialog
          className={cn(theme.theme, styles.modal)}
          overlayClassName={styles.overlay}
          finalFocus={triggerRef}
        >
          <DialogHeader className={styles.modalHeader}>
            <span className={styles.eyebrow}>Antes de producir</span>
            <DialogTitle className={styles.modalTitle}>
              Plan de fabricación
            </DialogTitle>
            <DialogDescription>
              {cotizacion?.productoNombre} ·{" "}
              {formato(cotizacion?.cantidadPedida ?? 0)}{" "}
              {cotizacion?.cantidadPedida === 1 ? "unidad" : "unidades"}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.modalBody}>
            {planes.length > 1 ? (
              <label className={styles.lotSelector}>
                Lote de fabricación
                <select
                  value={actual?.id}
                  onChange={(e) => setSeleccionado(e.target.value)}
                >
                  {planes.map((p, i) => (
                    <option key={p.id} value={p.id}>
                      Lote {i + 1} · {p.material} ·{" "}
                      {p.operaciones.map((o) => o.nombre).join(" + ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {actual ? (
              <>
                <div className={styles.lotHeader}>
                  <strong>{actual.material}</strong>
                  <span>
                    {actual.operaciones.map((o) => o.nombre).join(" + ")}
                  </span>
                </div>
                {actual.operaciones.length > 1 ? (
                  <p className={styles.sharedNote}>
                    Un mismo acomodo para {actual.operaciones.length}{" "}
                    operaciones. Las placas se contabilizan una sola vez.
                  </p>
                ) : null}
                {actual.operaciones
                  .filter((o) => o.procesamientoCorte)
                  .map((o) => (
                    <DesgloseOperacionesCorte
                      key={o.id}
                      valor={o.procesamientoCorte}
                    />
                  ))}
                <NestingViewer
                  key={actual.id}
                  result={actual.result}
                  archivos={
                    cortes.length > 0 ? (
                      <div className={styles.exports}>
                        {cortes.map((o) => (
                          <section key={o.id}>
                            <h3>{o.nombre}</h3>
                            <NestingPatronesDescargas
                              result={o.result}
                              nombreBase={`${nombreBaseSvg(cotizacion?.productoNombre ?? "producto")}-lote-${planes.indexOf(actual) + 1}-${nombreBaseSvg(o.nombre)}`}
                              permitirDxf
                            />
                          </section>
                        ))}
                      </div>
                    ) : undefined
                  }
                />
              </>
            ) : null}
          </div>
          <footer className={styles.modalFooter}>
            <span>El plan corresponde a esta cotización.</span>
            <DialogClose render={<Button type="button" />}>
              Volver a la cotización
            </DialogClose>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}
