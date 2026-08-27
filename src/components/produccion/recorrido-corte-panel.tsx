"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  RouteIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  cambiarEstadoPreparacionCorte,
  descargaPreparacionHref,
  getPreparacionesRecorridoCorte,
  regenerarPreparacionesRecorridoCorte,
  type PreparacionRecorridoCorte,
} from "@/lib/recorridos-vectoriales-api";
import {
  distanciasAcumuladasRecorrido,
  tramoVisibleRecorrido,
} from "@/lib/recorrido-simulacion";

export function RecorridoCortePanel({ itemId }: { itemId: string }) {
  const [items, setItems] = React.useState<PreparacionRecorridoCorte[]>([]);
  const [active, setActive] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [regenerating, setRegenerating] = React.useState(false);
  const canSupervise = usePuede("produccion.supervisar");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getPreparacionesRecorridoCorte(itemId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo preparar el recorrido de corte.",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  React.useEffect(() => void load(), [load]);

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Preparando recorridos y archivos TAP…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="font-medium text-destructive">
          No se pudo preparar el corte
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={load}>
          <RefreshCwIcon /> Reintentar
        </Button>
      </div>
    );
  }
  if (items.length === 0) return null;

  const current = items[Math.min(active, items.length - 1)];
  const regenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      setItems(await regenerarPreparacionesRecorridoCorte(itemId));
      setActive(0);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo regenerar.",
      );
    } finally {
      setRegenerating(false);
    }
  };
  const mark = async (
    estado: "REVISADA" | "APROBADA" | "ENVIADA_MAQUINA",
  ) => {
    try {
      const response = await cambiarEstadoPreparacionCorte(current.id, estado);
      setItems((previous) =>
        previous.map((item) =>
          item.id === current.id ? { ...item, estado: response.estado } : item,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cambiar el estado.",
      );
    }
  };

  return (
    <section className="mt-4 overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <RouteIcon className="size-4" /> Preparación de corte
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recorrido continuo, simulación y archivo TAP por placa.
          </p>
        </div>
        {canSupervise ? (
          <Button
            variant="outline"
            size="sm"
            disabled={regenerating}
            onClick={regenerate}
          >
            <RefreshCwIcon className={regenerating ? "animate-spin" : ""} />
            Regenerar
          </Button>
        ) : null}
      </header>

      {items.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b bg-muted/20 p-2">
          {items.map((item, index) => (
            <Button
              key={item.id}
              variant={index === active ? "default" : "ghost"}
              size="sm"
              onClick={() => setActive(index)}
            >
              Placa {item.placaIndice + 1}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <SimuladorRecorrido preparation={current} />
        <aside className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric
              label="Recorrido"
              value={`${format(current.metricas.longitudTotalMm / 1000)} m`}
            />
            <Metric
              label="Tiempo"
              value={duration(current.metricas.tiempoEstimadoSeg)}
            />
            <Metric
              label="Velocidad"
              value={`${format(current.perfilMaquina.velocidadMmMin)} mm/min`}
            />
            <Metric
              label="Conexiones"
              value={String(current.metricas.cantidadConexiones)}
            />
          </div>
          <div className="rounded-lg border p-3 text-xs">
            <div className="font-medium">{current.perfilMaquina.nombre}</div>
            <div className="mt-1 text-muted-foreground">
              Revisión {current.revision} · {statusLabel(current.estado)}
            </div>
          </div>
          <div className="grid gap-2">
            <a
              className={buttonVariants()}
              href={descargaPreparacionHref(current.id, "tap")}
            >
              <DownloadIcon /> Descargar TAP
            </a>
            <a
              className={buttonVariants({ variant: "outline" })}
              href={descargaPreparacionHref(current.id, "linked-svg")}
            >
              <DownloadIcon /> SVG con recorrido
            </a>
            <a
              className={buttonVariants({ variant: "outline" })}
              href={descargaPreparacionHref(current.id, "source-svg")}
            >
              <DownloadIcon /> SVG de la placa
            </a>
          </div>
          {canSupervise && current.estado === "BORRADOR" ? (
            <Button variant="outline" onClick={() => mark("REVISADA")}>
              <CheckCircle2Icon /> Marcar revisado
            </Button>
          ) : canSupervise && current.estado === "REVISADA" ? (
            <Button variant="outline" onClick={() => mark("APROBADA")}>
              <CheckCircle2Icon /> Aprobar recorrido
            </Button>
          ) : canSupervise && current.estado === "APROBADA" ? (
            <Button
              variant="outline"
              onClick={() => mark("ENVIADA_MAQUINA")}
            >
              <CheckCircle2Icon /> Marcar enviado a máquina
            </Button>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function SimuladorRecorrido({
  preparation,
}: {
  preparation: PreparacionRecorridoCorte;
}) {
  const route = preparation.route.svg;
  const cumulative = React.useMemo(
    () => distanciasAcumuladasRecorrido(route),
    [route],
  );
  const total = cumulative.at(-1) ?? 0;
  const [distance, setDistance] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(10);
  const lastTime = React.useRef<number | null>(null);

  React.useEffect(() => {
    setDistance(0);
    setPlaying(false);
  }, [preparation.id]);

  React.useEffect(() => {
    if (!playing || total <= 0) return;
    let frame = 0;
    const animate = (now: number) => {
      const previous = lastTime.current ?? now;
      lastTime.current = now;
      const elapsedSeconds = (now - previous) / 1000;
      const advance =
        (preparation.perfilMaquina.velocidadMmMin / 60) *
        elapsedSeconds *
        speed;
      setDistance((current) => {
        const next = current + advance;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      lastTime.current = null;
    };
  }, [playing, preparation.perfilMaquina.velocidadMmMin, speed, total]);

  const progress = total > 0 ? Math.min(1, distance / total) : 0;
  const visibleRoute = React.useMemo(
    () => tramoVisibleRecorrido(route, cumulative, distance),
    [cumulative, distance, route],
  );
  const routePoints = React.useMemo(
    () => visibleRoute.map((point) => `${point.x},${point.y}`).join(" "),
    [visibleRoute],
  );
  const workArea = preparation.report.svgWorkArea ?? {};
  const width =
    Number(workArea.widthMm) || preparation.perfilMaquina.anchoUtilMm;
  const height =
    Number(workArea.heightMm) || preparation.perfilMaquina.altoUtilMm;
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preparation.linkedSvg)}`;

  return (
    <div className="min-w-0">
      <div className="relative overflow-hidden rounded-lg border bg-[#fffdf4]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Simulación del recorrido de corte"
        >
          <image href={image} x="0" y="0" width={width} height={height} />
          {routePoints ? (
            <polyline
              points={routePoints}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-destructive"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (distance >= total) setDistance(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? "Pausar" : "Simular"}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setDistance(0);
          }}
          aria-label="Reiniciar simulación"
        >
          <RotateCcwIcon />
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Velocidad visual
          <select
            className="rounded-md border bg-background px-2 py-1 text-foreground"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={1}>1×</option>
            <option value={10}>10×</option>
            <option value={50}>50×</option>
            <option value={100}>100×</option>
          </select>
        </label>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
        {(progress * 100).toLocaleString("es-AR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
        % recorrido
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function duration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes} min ${String(remainder).padStart(2, "0")} s`;
}

function format(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

function statusLabel(status: PreparacionRecorridoCorte["estado"]) {
  const labels: Record<PreparacionRecorridoCorte["estado"], string> = {
    BORRADOR: "Borrador",
    REVISADA: "Revisada",
    APROBADA: "Aprobada",
    ENVIADA_MAQUINA: "Enviada a máquina",
    REEMPLAZADA: "Reemplazada",
  };
  return labels[status];
}
