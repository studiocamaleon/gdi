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
  const busqueda = result.solucionNesting?.resultado.busqueda;
  const plan = result.solucionNesting?.resultado.planPatrones;
  const detalle = patrones.find((p) => p.id === ampliado);
  function placa(p: PatronVisible, grande = false) {
    const m = result.visualConfig?.margins;
    return (
      <svg
        viewBox={`-3 -3 ${p.anchoMm + 6} ${p.altoMm + 6}`}
        role="img"
        aria-label={`Distribución del patrón ${p.id}`}
        className={grande ? "h-[60vh] w-full" : "h-72 w-full"}
      >
        <rect
          width={p.anchoMm}
          height={p.altoMm}
          rx={2}
          fill="white"
          stroke="#cbd1d5"
          vectorEffect="non-scaling-stroke"
        />
        {m && (
          <rect
            x={m.leftMm}
            y={m.topMm}
            width={Math.max(0, p.anchoMm - m.leftMm - m.rightMm)}
            height={Math.max(0, p.altoMm - m.topMm - m.bottomMm)}
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
    );
  }
  return (
    <section
      className={styles.patterns}
      aria-label="Revisar nesting por patrones"
    >
      <EstadoCapasFabricacion {...estadoCapas} />
      <div className={styles.patternHeading}>
        <div>
          <h3>
            {numero(totalPlacas)} {totalPlacas === 1 ? "placa" : "placas"} ·{" "}
            {patrones.length} {patrones.length === 1 ? "patrón" : "patrones"}
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
          <TabsTrigger value="patrones">Patrones</TabsTrigger>
          <TabsTrigger value="balance">Balance de piezas</TabsTrigger>
          <TabsTrigger value="calculo">Cómo se calculó</TabsTrigger>
          {archivos ? (
            <TabsTrigger value="archivos">Archivos</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="patrones">
          <div className={styles.legend} aria-label="Resaltar pieza">
            {piezas.map((p) => (
              <Button
                key={p.pieceId}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={seleccion === p.pieceId}
                onClick={() =>
                  setSeleccion((s) => (s === p.pieceId ? null : p.pieceId))
                }
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: colores.get(p.pieceId) }}
                />
                {nombrePieza(p)}
              </Button>
            ))}
          </div>
          {ampliacionEnLinea && detalle ? (
            <div className={styles.detail}>
              <div className={styles.detailHead}>
                <h3>
                  Patrón {detalle.id} · Repetir ×{detalle.repeticiones}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmpliado(null)}
                >
                  Volver a los patrones
                </Button>
              </div>
              <p>
                Pasá el cursor sobre una pieza para consultar su medida y giro.
              </p>
              {placa(detalle, true)}
            </div>
          ) : (
            <div className={styles.patternGrid}>
              {patrones.map((p) => (
                <article key={p.id} className={styles.patternCard}>
                  <header className={styles.cardHead}>
                    <strong>Patrón {p.id}</strong>
                    <span
                      className={styles.copies}
                      title={`Repetir en ${p.repeticiones} placas`}
                    >
                      ×{p.repeticiones}
                    </span>
                  </header>
                  <div className={styles.plate}>
                    {placa(p)}
                    <p className={styles.plateCaption}>
                      {numero(p.anchoMm)} × {numero(p.altoMm)} mm
                    </p>
                  </div>
                  <ul
                    className={styles.pieceCounts}
                    aria-label={`Piezas por placa del patrón ${p.id}`}
                  >
                    {Object.entries(p.cantidades).map(([id, n]) => (
                      <li key={id}>
                        <i
                          style={{ background: colores.get(id) }}
                          aria-hidden="true"
                        />
                        {nombres.get(id)}
                        <b>×{n}</b>
                      </li>
                    ))}
                  </ul>
                  <footer className={styles.cardFoot}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Inspeccionar patrón ${p.id}`}
                      onClick={() => setAmpliado(p.id)}
                    >
                      Inspeccionar patrón
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
        <TabsContent value="calculo">
          <div className={styles.explanation}>
            <p>
              Cada patrón conserva las posiciones y giros del cálculo. Su
              repetición se multiplica por las piezas de cada placa. Los
              patrones con la misma distribución se fabrican con un único
              archivo y la cantidad de copias indicada.
            </p>
            {result.visualConfig && (
              <p>
                Separación entre piezas:{" "}
                {numero(result.visualConfig.spacing.horizontalMm)} ×{" "}
                {numero(result.visualConfig.spacing.verticalMm)} mm.
                <br />
                Márgenes (izquierda / derecha / superior / inferior):{" "}
                {numero(result.visualConfig.margins.leftMm)} /{" "}
                {numero(result.visualConfig.margins.rightMm)} /{" "}
                {numero(result.visualConfig.margins.topMm)} /{" "}
                {numero(result.visualConfig.margins.bottomMm)} mm.
              </p>
            )}
            {plan && (
              <p>
                Se evaluaron {numero(plan.patronesEvaluados)} patrones.{" "}
                {plan.minimoPlacasEnCartera
                  ? "Se demostró el mínimo de placas dentro de esa selección de patrones."
                  : "Se conserva el mejor plan completo encontrado."}{" "}
                {!plan.minimoGeometricoDemostrado
                  ? "Esto no demuestra el mínimo geométrico absoluto."
                  : "Se demostró el mínimo geométrico de placas."}
              </p>
            )}
            {busqueda && (
              <p>
                {busqueda.motivoFin === "MINIMO_PLACAS"
                  ? "La búsqueda alcanzó su cota mínima de placas."
                  : busqueda.motivoFin === "PRESUPUESTO_AGOTADO"
                    ? "Terminó el tiempo de búsqueda; se conserva el mejor resultado validado."
                    : "El optimizador nativo no estuvo disponible; se conserva el mejor resultado validado."}{" "}
                Tiempo:{" "}
                {numero(
                  (result.solucionNesting?.resultado.duracionMs ?? 0) / 1000,
                )}{" "}
                s.
              </p>
            )}
            {result.solucionNesting?.problema.demandas.map((d) =>
              d.propietario?.archivoFuente ? (
                <p key={d.id}>
                  <strong>{nombres.get(d.id) ?? d.id}</strong>
                  <br />
                  {d.propietario.archivoFuente}
                  {d.propietario.interpretacion
                    ? ` · Capa ${d.propietario.interpretacion.capa} · Contorno exterior ${d.propietario.interpretacion.exteriorId}`
                    : ""}
                </p>
              ) : null,
            )}
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
              Patrón {detalle?.id} · Repetir ×{detalle?.repeticiones}
            </DialogTitle>
            <DialogDescription>
              Pasá el cursor sobre una pieza para consultar su medida y giro.
            </DialogDescription>
          </DialogHeader>
          {detalle && placa(detalle, true)}
        </DialogContent>
      </Dialog>
    </section>
  );
}
