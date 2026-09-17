"use client";

import type { ProgresoProduccion } from "@/lib/progreso-produccion";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./progreso-produccion.module.css";

export type { ProgresoLote } from "@/lib/progreso-produccion";
import type { ProgresoLote } from "@/lib/progreso-produccion";

export function ProgresoValor({
  progreso,
  valor,
}: {
  progreso?: ProgresoProduccion;
  valor?: number | null;
}) {
  const pct = progreso ? progreso.porcentaje : valor;
  const texto = pct == null ? "—" : `${pct}%`;
  if (!progreso) return <span>{texto}</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className={styles.valor}
              aria-label={`${texto}. ${progreso.explicacion}`}
            />
          }
        >
          {texto}
        </TooltipTrigger>
        <TooltipContent>{progreso.explicacion}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProgresoExplicado({
  progreso,
  lotes = [],
  titulo = "Avance de producción",
}: {
  progreso: ProgresoProduccion;
  lotes?: ProgresoLote[];
  titulo?: string;
}) {
  // A…Z, AA…AZ: el orden de llegada del tablero puede ser distinto del comercial.
  const filas = [...lotes].sort(
    (a, b) =>
      a.productoNombre.localeCompare(b.productoNombre, "es") ||
      a.nombre.length - b.nombre.length ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  return (
    <section className={styles.resumen} aria-label={titulo}>
      {progreso.porcentaje == null ? (
        <strong>{titulo} · Sin avance calculable</strong>
      ) : (
        <Progress value={progreso.porcentaje}>
          <ProgressLabel>{titulo}</ProgressLabel>
          <span className={styles.porcentaje}>{progreso.porcentaje}%</span>
        </Progress>
      )}
      <p className={styles.explicacion}>{progreso.explicacion}</p>
      <p className={styles.nota}>
        Avance del trabajo previsto. No representa unidades terminadas ni
        entregadas.
      </p>
      {lotes.length > 0 ? (
        <details className={styles.detalle}>
          <summary>Avance por lote · {lotes.length} lotes</summary>
          <div
            className={styles.scroll}
            tabIndex={0}
            role="region"
            aria-label="Avance por lote"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote / producto</TableHead>
                  <TableHead>Cantidad prevista</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead>Operaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell>
                      <strong>{lote.nombre}</strong>
                      <div className={styles.nota}>{lote.productoNombre}</div>
                    </TableCell>
                    <TableCell>
                      {lote.cantidad.toLocaleString("es-AR")} {lote.unidad}
                    </TableCell>
                    <TableCell>
                      <ProgresoValor progreso={lote.progreso} />
                    </TableCell>
                    <TableCell>
                      {lote.progreso.operacionesCompletadas} de{" "}
                      {lote.progreso.operacionesTotal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
