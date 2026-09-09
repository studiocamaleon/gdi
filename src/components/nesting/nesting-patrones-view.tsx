"use client";
import * as React from "react";
import { ExpandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  agruparPatronesNesting,
  contornosPatron,
  metaPieza,
  nombrePieza,
  type PatronVisible,
} from "@/lib/nesting-patrones";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import styles from "./plan-fabricacion.module.css";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import { useCapasFabricacion } from "@/hooks/use-capas-fabricacion";
import {
  CapasFabricacionPlacement,
  EstadoCapasFabricacion,
} from "./capas-fabricacion-nesting";

const paleta = [
  "#2383a5",
  "#d88c30",
  "#41956d",
  "#9254ae",
  "#b64c69",
  "#5a70bc",
  "#857b32",
  "#59888c",
];
const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function NestingPatronesView({
  result: original,
  onVerDetalle,
  ampliacionEnLinea = false,
  archivos,
}: {
  result: NestingViewerInput;
  onVerDetalle?: () => void;
  ampliacionEnLinea?: boolean;
  archivos?: React.ReactNode;
}) {
  const { result, ...estadoCapas } = useCapasFabricacion(original);
  const patrones = React.useMemo(
    () => agruparPatronesNesting(result),
    [result],
  );
  const [seleccion, setSeleccion] = React.useState<string | null>(null);
  const [ampliado, setAmpliado] = React.useState<string | null>(null);
  const idVisor = React.useId();
  const piezas = React.useMemo(
    () =>
      [...new Map(result.placements.map((p) => [p.pieceId, p])).values()].sort(
        (a, b) => String(a.pieceId).localeCompare(String(b.pieceId)),
      ),
    [result.placements],
  );
  const colores = new Map(
    piezas.map((p, i) => [p.pieceId, paleta[i % paleta.length]]),
  );
  const nombres = new Map(piezas.map((p) => [p.pieceId, nombrePieza(p)]));
  const totalPlacas = patrones.reduce((s, p) => s + p.repeticiones, 0);
  const balance = piezas.map((p) => ({
    id: p.pieceId,
    nombre: nombrePieza(p),
    colocadas: patrones.reduce(
      (n, t) => n + (t.cantidades[p.pieceId] ?? 0) * t.repeticiones,
      0,
    ),
    solicitadas: result.solucionNesting?.problema.demandas.find(
      (d) => d.id === p.pieceId,
    )?.cantidad,
  }));
  const detalle = patrones.find((p) => p.id === ampliado);
  function listaPiezas(p: PatronVisible) {
    return (
      <ul
        className={styles.pieceCounts}
        aria-label={`Piezas por placa del layout ${p.id}`}
        tabIndex={0}
      >
        {Object.entries(p.cantidades).map(([id, n]) => (
          <li key={id}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={seleccion === id}
              onClick={() => setSeleccion((s) => (s === id ? null : id))}
              title={nombres.get(id)}
            >
              <i style={{ background: colores.get(id) }} aria-hidden="true" />
              <span className={styles.pieceName}>{nombres.get(id)}</span>
              <b>×{n}</b>
            </Button>
          </li>
        ))}
      </ul>
    );
  }
  function placa(p: PatronVisible, grande = false) {
    const m = result.visualConfig?.margins;
    const manejo = result.visualConfig?.manejoPlaca;
    const trabajo = manejo && manejo.excedenteMm > 0 ? manejo.workArea : null;
    const areaMargenes = trabajo
      ? result.visualConfig?.usableArea
      : m && {
          xMm: m.leftMm,
          yMm: m.topMm,
          widthMm: Math.max(0, p.anchoMm - m.leftMm - m.rightMm),
          heightMm: Math.max(0, p.altoMm - m.topMm - m.bottomMm),
        };
    const idRayado = `${idVisor}-${p.id}-${grande ? "detalle" : "miniatura"}-exceso`;
    const pasoRayado = Math.max(p.anchoMm, p.altoMm) / 40;
    return (
      <figure className={styles.patternFigure}>
        <svg
          viewBox={`-3 -3 ${p.anchoMm + 6} ${p.altoMm + 6}`}
          role="img"
          aria-label={`Distribución del layout ${p.id}`}
          className={grande ? "h-[60vh] w-full" : "h-72 w-full"}
        >
          {trabajo && (
            <>
              <desc>
                La zona rayada queda fuera del alcance de la máquina. No se
                ubican piezas allí. {manejo?.mensaje}
              </desc>
              <defs>
                <pattern
                  id={idRayado}
                  patternUnits="userSpaceOnUse"
                  width={pasoRayado}
                  height={pasoRayado}
                >
                  <rect width={pasoRayado} height={pasoRayado} fill="#fff1e8" />
                  <path
                    d={`M0,${pasoRayado} L${pasoRayado},0`}
                    stroke="#efb497"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                </pattern>
              </defs>
            </>
          )}
          <rect
            width={p.anchoMm}
            height={p.altoMm}
            rx={2}
            fill="white"
            stroke="#cbd1d5"
            vectorEffect="non-scaling-stroke"
          />
          {trabajo && (
            <g pointerEvents="none">
              <path
                d={`M0,0 H${p.anchoMm} V${p.altoMm} H0 Z M${trabajo.xMm},${trabajo.yMm} h${trabajo.widthMm} v${trabajo.heightMm} h${-trabajo.widthMm} Z`}
                fill={`url(#${idRayado})`}
                fillRule="evenodd"
              />
              <rect
                x={trabajo.xMm}
                y={trabajo.yMm}
                width={trabajo.widthMm}
                height={trabajo.heightMm}
                fill="none"
                stroke="#e86c35"
                strokeDasharray="5 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}
          {areaMargenes && (
            <rect
              x={areaMargenes.xMm}
              y={areaMargenes.yMm}
              width={areaMargenes.widthMm}
              height={areaMargenes.heightMm}
              fill="none"
              stroke="#c0c7ca"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {p.placements.map((pieza, i) => {
            const contornos = contornosPatron(pieza),
              color = colores.get(pieza.pieceId);
            const opacity =
              seleccion && seleccion !== pieza.pieceId?.toString() ? 0.16 : 1;
            const title = `${nombres.get(pieza.pieceId)} · ${numero(pieza.widthMm)} × ${numero(pieza.heightMm)} mm · ${String(metaPieza(pieza).rotacionGrados ?? (pieza.rotated ? 90 : 0))}°`;
            return (
              <g key={i} opacity={opacity}>
                <title>{title}</title>
                {contornos.length ? (
                  <path
                    d={contornos
                      .map(
                        (c) =>
                          `M${c.puntos.map((v) => `${v.x},${v.y}`).join(" L")} Z`,
                      )
                      .join(" ")}
                    fill={color}
                    fillOpacity={0.17}
                    fillRule="evenodd"
                    stroke={color}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <rect
                    x={pieza.xMm}
                    y={pieza.yMm}
                    width={pieza.widthMm}
                    height={pieza.heightMm}
                    fill={color}
                    fillOpacity={0.17}
                    stroke={color}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <CapasFabricacionPlacement placement={pieza} />
              </g>
            );
          })}
        </svg>
        <figcaption className={styles.plateCaption}>
          <span>Placa: {numero(p.anchoMm)} × {numero(p.altoMm)} mm</span>
          {trabajo && manejo && (
            <>
              <span>
                Área de trabajo: {numero(trabajo.widthMm)} × {numero(trabajo.heightMm)} mm
              </span>
              <span className={styles.overhangLegend} title={manejo.mensaje}>
                <i aria-hidden="true" />
                {numero(manejo.excedenteMm)} mm fuera de alcance · sin piezas
              </span>
            </>
          )}
        </figcaption>
      </figure>
    );
  }
  return (
    <section
      className={styles.patterns}
      aria-label="Revisar nesting por layouts"
    >
      <EstadoCapasFabricacion {...estadoCapas} />
      <div className={styles.patternHeading}>
        <div>
          <h3>
            {numero(totalPlacas)} {totalPlacas === 1 ? "placa" : "placas"} ·{" "}
            {patrones.length} {patrones.length === 1 ? "layout" : "layouts"}
          </h3>
          <p>
            {numero(balance.reduce((s, b) => s + b.colocadas, 0))} piezas ·{" "}
            {numero(result.aprovechamientoPct)}% de aprovechamiento
          </p>
        </div>
        {onVerDetalle && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onVerDetalle}
          >
            Ver placas y detalles
          </Button>
        )}
      </div>
      <Tabs defaultValue="patrones">
        <TabsList
          variant="line"
          className={styles.tabList}
          aria-label="Detalle del plan"
        >
          <TabsTrigger value="patrones">Layouts</TabsTrigger>
          <TabsTrigger value="balance">Balance de piezas</TabsTrigger>
          {archivos ? (
            <TabsTrigger value="archivos">Archivos de corte</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="patrones">
          {ampliacionEnLinea && detalle ? (
            <div className={styles.detail}>
              <div className={styles.detailHead}>
                <h3>
                  Layout {detalle.id} · Repetir ×{detalle.repeticiones}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmpliado(null)}
                >
                  Volver a los layouts
                </Button>
              </div>
              <p>
                Pasá el cursor sobre una pieza para consultar su medida y giro.
              </p>
              <div className={styles.detailLayout}>
                {placa(detalle, true)}
                {listaPiezas(detalle)}
              </div>
            </div>
          ) : (
            <div
              className={styles.patternGrid}
              data-single={patrones.length === 1}
            >
              {patrones.map((p) => (
                <article key={p.id} className={styles.patternCard}>
                  <header className={styles.cardHead}>
                    <strong>Layout {p.id}</strong>
                    <span
                      className={styles.copies}
                      title={`Repetir en ${p.repeticiones} placas`}
                    >
                      ×{p.repeticiones}
                    </span>
                  </header>
                  <div className={styles.plate}>
                    {placa(p)}
                  </div>
                  {listaPiezas(p)}
                  <footer className={styles.cardFoot}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Inspeccionar layout ${p.id}`}
                      onClick={() => setAmpliado(p.id)}
                    >
                      Inspeccionar layout
                      <ExpandIcon />
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="balance">
          <div className={styles.balanceWrap}>
            <table className={styles.balance}>
              <thead>
                <tr>
                  <th>Pieza</th>
                  <th>Solicitadas</th>
                  <th>Colocadas</th>
                  <th>Excedentes</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((b) => (
                  <tr key={b.id}>
                    <td>{b.nombre}</td>
                    <td>
                      {b.solicitadas === undefined
                        ? "—"
                        : numero(b.solicitadas)}
                    </td>
                    <td>{numero(b.colocadas)}</td>
                    <td>
                      {b.solicitadas === undefined
                        ? "—"
                        : numero(Math.max(0, b.colocadas - b.solicitadas))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        {archivos ? (
          <TabsContent value="archivos">{archivos}</TabsContent>
        ) : null}
      </Tabs>
      <Dialog
        open={!ampliacionEnLinea && !!detalle}
        onOpenChange={(open) => {
          if (!open) setAmpliado(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Layout {detalle?.id} · Repetir ×{detalle?.repeticiones}
            </DialogTitle>
            <DialogDescription>
              Pasá el cursor sobre una pieza para consultar su medida y giro.
            </DialogDescription>
          </DialogHeader>
          {detalle && (
            <div className={styles.detailLayout}>
              {placa(detalle, true)}
              {listaPiezas(detalle)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
