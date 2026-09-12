"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  agruparPatronesNesting,
  nombrePieza,
  type PatronVisible,
} from "@/lib/nesting-patrones";
import { balancePiezasNesting } from "@/lib/nesting-vista";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import {
  NestingCanvas,
  colorForKey,
  placementGroupKey,
  type ModificacionesOverlay,
} from "./nesting-canvas";
import ui from "@/components/ui/workspace-ui.module.css";
import s from "./nesting-explorer.module.css";

/** Galería sin navegación propia: el contenedor decide qué inspeccionar. */
export function NestingPatronesView({
  result,
  patrones: agrupados,
  onVerDetalle,
  modificaciones,
}: {
  result: NestingViewerInput;
  patrones?: PatronVisible[];
  onVerDetalle?: (substrateIndex: number) => void;
  modificaciones?: ModificacionesOverlay;
}) {
  const patrones = React.useMemo(
    () => agrupados ?? agruparPatronesNesting(result),
    [agrupados, result],
  );
  const [seleccion, setSeleccion] = React.useState<string | null>(null);
  const piezas = new Map(result.placements.map((p) => [p.pieceId, p]));
  return (
    <div className={s.patternGrid}>
      {patrones.map((p) => (
        <article key={p.id} className={s.patternCard}>
          <header className={s.cardHead}>
            <strong>Layout {p.id}</strong>
            <Badge variant="secondary">×{p.repeticiones}</Badge>
          </header>
          <NestingCanvas
            result={result}
            substrateIndex={p.indices[0]}
            compact
            maxPx={560}
            showLabels={false}
            selectedPieceId={seleccion}
            modificaciones={modificaciones}
            accessibleLabel={`Distribución del layout ${p.id}`}
          />
          <ul
            className={s.pieceCounts}
            aria-label={`Piezas por placa del layout ${p.id}`}
            tabIndex={0}
          >
            {Object.entries(p.cantidades).map(([id, n]) => {
              const pieza = piezas.get(id)!;
              return (
                <li key={id}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={seleccion === id}
                    onClick={() =>
                      setSeleccion((actual) => (actual === id ? null : id))
                    }
                    className="w-full justify-start"
                    title={nombrePieza(pieza)}
                  >
                    <i
                      className={s.swatch}
                      style={{
                        background: colorForKey(placementGroupKey(pieza)).fill,
                        borderColor: colorForKey(placementGroupKey(pieza))
                          .stroke,
                      }}
                      aria-hidden
                    />
                    <span className="truncate">{nombrePieza(pieza)}</span>
                    <span className="ml-auto">×{n}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <footer className={s.cardFoot}>
            <span>{p.placements.length} piezas por sustrato</span>
            {onVerDetalle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Inspeccionar layout ${p.id}`}
                onClick={() => onVerDetalle(p.indices[0])}
              >
                Inspeccionar <ArrowUpRight data-icon="inline-end" />
              </Button>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}

export function NestingBalance({ result }: { result: NestingViewerInput }) {
  const balance = balancePiezasNesting(result);
  return (
    <Table className={ui.dataTable}>
      <TableHeader>
        <TableRow>
          <TableHead>Pieza</TableHead>
          <TableHead>Solicitadas</TableHead>
          <TableHead>Colocadas</TableHead>
          <TableHead>Faltantes</TableHead>
          <TableHead>Excedentes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {balance.map((b) => (
          <TableRow key={b.id}>
            <TableCell>{b.nombre}</TableCell>
            <TableCell>{b.solicitadas ?? "—"}</TableCell>
            <TableCell>{b.colocadas}</TableCell>
            <TableCell>
              {b.solicitadas === undefined
                ? "—"
                : Math.max(0, b.solicitadas - b.colocadas)}
            </TableCell>
            <TableCell>
              {b.solicitadas === undefined
                ? "—"
                : Math.max(0, b.colocadas - b.solicitadas)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
