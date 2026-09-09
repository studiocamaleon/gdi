"use client";

import * as React from "react";
import { ZoomInIcon } from "lucide-react";
import type {
  EntidadInspeccion,
  SeleccionVector,
} from "@/lib/geometrias-producto-api";
import styles from "./pieza-interpretacion-preview.module.css";

const AMPLIACION = 4;
const TAMANO_LUPA = 160;

export function PiezaInterpretacionPreview({
  entidades,
  seleccion,
}: {
  entidades: EntidadInspeccion[];
  seleccion: SeleccionVector;
}) {
  const svg = React.useRef<SVGSVGElement>(null);
  const ayudaId = React.useId();
  const [lupa, setLupa] = React.useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    size: number;
    viewBox: string;
  } | null>(null);

  const viewBox = React.useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const entidad of entidades) {
      for (const punto of entidad.puntos) {
        minX = Math.min(minX, punto.x);
        minY = Math.min(minY, punto.y);
        maxX = Math.max(maxX, punto.x);
        maxY = Math.max(maxY, punto.y);
      }
    }
    if (!Number.isFinite(minX)) return "0 0 1 1";
    const ancho = maxX > minX ? maxX - minX : 1;
    const alto = maxY > minY ? maxY - minY : 1;
    return `${minX - ancho * 0.03} ${minY - alto * 0.03} ${ancho * 1.06} ${alto * 1.06}`;
  }, [entidades]);

  // Compartimos los trazos entre ambas vistas sin recalcularlos al mover el mouse.
  const trazos = React.useMemo(() => {
    const operaciones = new Set(seleccion.operaciones.map((o) => o.entidadId));
    const exteriores = new Set(seleccion.exteriorIds ?? [seleccion.exteriorId]);
    const excluidas = new Set(seleccion.excluidas);
    return entidades
      .filter((e) => e.puntos.length > 1)
      .sort(
        (a, b) => Number(exteriores.has(b.id)) - Number(exteriores.has(a.id)),
      )
      .map((e) => {
        const exterior = exteriores.has(e.id);
        return (
          <path
            key={e.id}
            d={`M${e.puntos.map((p) => `${p.x},${p.y}`).join(" L")}${e.cerrada || (exterior && seleccion.cerrarExterior) ? " Z" : ""}`}
            fill={exterior ? "var(--signal-bg)" : "none"}
            stroke={
              exterior
                ? "var(--signal)"
                : operaciones.has(e.id)
                  ? "var(--ps-blue, #2f6fe0)"
                  : "var(--muted-text-2)"
            }
            opacity={excluidas.has(e.id) ? 0.2 : 1}
            vectorEffect="non-scaling-stroke"
            strokeWidth={exterior ? 2 : 1}
          />
        );
      });
  }, [entidades, seleccion]);

  function ampliar(clientX: number, clientY: number) {
    const elemento = svg.current;
    const matriz = elemento?.getScreenCTM();
    if (!elemento || !matriz) return;
    const rect = elemento.getBoundingClientRect();
    const escala = Math.hypot(matriz.a, matriz.b);
    if (!rect.width || !rect.height || !escala) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    // La matriz incluye los márgenes que deja SVG al ajustar piezas altas o anchas.
    const punto = new DOMPoint(rect.left + x, rect.top + y).matrixTransform(
      matriz.inverse(),
    );
    const size = Math.min(TAMANO_LUPA, rect.width, rect.height);
    const lado = size / (escala * AMPLIACION);
    setLupa({
      x,
      y,
      size,
      left: Math.max(0, Math.min(x - size / 2, rect.width - size)),
      top: Math.max(0, Math.min(y - size / 2, rect.height - size)),
      viewBox: `${punto.x - lado / 2} ${punto.y - lado / 2} ${lado} ${lado}`,
    });
  }

  function mover(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") ampliar(event.clientX, event.clientY);
  }

  return (
    <div>
      <div
        className={styles.viewport}
        onPointerEnter={mover}
        onPointerMove={mover}
        onPointerLeave={() => setLupa(null)}
        onPointerCancel={() => setLupa(null)}
      >
        <svg
          ref={svg}
          className={styles.canvas}
          viewBox={viewBox}
          role="img"
          aria-label="Piezas seleccionadas y trazos del archivo"
          aria-describedby={ayudaId}
          tabIndex={0}
          onFocus={(event) => {
            if (!event.currentTarget.matches(":focus-visible")) return;
            const rect = event.currentTarget.getBoundingClientRect();
            ampliar(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }}
          onBlur={() => setLupa(null)}
          onKeyDown={(event) => {
            const desplazamiento: Record<string, [number, number]> = {
              ArrowLeft: [-12, 0],
              ArrowRight: [12, 0],
              ArrowUp: [0, -12],
              ArrowDown: [0, 12],
            };
            const delta = desplazamiento[event.key];
            if (!delta) return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            ampliar(
              rect.left + (lupa?.x ?? rect.width / 2) + delta[0],
              rect.top + (lupa?.y ?? rect.height / 2) + delta[1],
            );
          }}
        >
          {trazos}
        </svg>
        {lupa && (
          <div
            className={styles.lens}
            aria-hidden="true"
            style={{
              left: lupa.left,
              top: lupa.top,
              width: lupa.size,
              height: lupa.size,
            }}
          >
            <svg viewBox={lupa.viewBox}>{trazos}</svg>
            <span className={styles.magnification}>{AMPLIACION}×</span>
          </div>
        )}
      </div>
      <div className={styles.hint} id={ayudaId}>
        <ZoomInIcon aria-hidden="true" />
        <span>Pasá el mouse para ampliar · {AMPLIACION}×</span>
        <span className="sr-only">
          También podés enfocar la vista y usar las flechas del teclado para
          explorar el detalle.
        </span>
      </div>
    </div>
  );
}
