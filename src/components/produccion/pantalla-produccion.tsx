"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Maximize,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDesignTheme } from "@/components/design-system/appearance";
import {
  capacidadPantalla,
  paginarEntregas,
  type DatosPantalla,
  type EstadoVinculo,
} from "@/lib/pantalla-produccion";
import s from "./pantalla-produccion.module.css";

class ErrorPantalla extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function pedir<T>(accion: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/pantalla/${accion}`, {
    method: ["iniciar", "reiniciar"].includes(accion) ? "POST" : "GET",
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000),
  });
  const body = await res.json();
  if (!res.ok)
    throw new ErrorPantalla(
      typeof body.message === "string"
        ? body.message
        : "No se pudo conectar con Grafo.",
      res.status,
    );
  return body as T;
}

export function PantallaProduccion() {
  const theme = useDesignTheme();
  const [vinculo, setVinculo] = useState<EstadoVinculo | null>(null);
  const [datos, setDatos] = useState<DatosPantalla | null>(null);
  const [error, setError] = useState("");
  const [bloqueada, setBloqueada] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [ciclo, setCiclo] = useState(0);
  const [ahora, setAhora] = useState<number | null>(null);
  const [recibidoEl, setRecibidoEl] = useState<number | null>(null);
  const [pausada, setPausada] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [capacidad, setCapacidad] = useState({ columnas: 1, filas: 1 });
  const contenedor = useRef<HTMLDivElement>(null);
  // Evita crear dos solicitudes durante la comprobación de efectos de React.
  const inicio = useRef<Promise<EstadoVinculo> | null>(null);
  const tieneDatos = datos !== null;

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    let activo = true;
    const controller = new AbortController();
    let temporizador: ReturnType<typeof setTimeout>;
    let autorizado = false;
    async function consultar(primera = false) {
      try {
        if (!autorizado) {
          if (primera)
            inicio.current ??= pedir<EstadoVinculo>("iniciar").catch((e) => {
              inicio.current = null;
              throw e;
            });
          const estado = primera
            ? await inicio.current!
            : await pedir<EstadoVinculo>("estado", controller.signal);
          if (!activo) return;
          setVinculo(estado);
          autorizado = estado.estado === "vinculada";
          setError("");
        }
        if (autorizado) {
          const lectura = await pedir<DatosPantalla>(
            "datos",
            controller.signal,
          );
          if (!activo) return;
          setDatos(lectura);
          setRecibidoEl(Date.now());
          setError("");
        }
      } catch (e) {
        if (!activo) return;
        setError(
          e instanceof Error ? e.message : "No se pudo conectar con Grafo.",
        );
        if (e instanceof ErrorPantalla && [401, 403].includes(e.status)) {
          setDatos(null);
          setVinculo(null);
          setRecibidoEl(null);
          setBloqueada(true);
          return;
        }
      }
      if (activo)
        temporizador = setTimeout(
          () => void consultar(!autorizado && !inicio.current),
          autorizado ? 10_000 : 3_000,
        );
    }
    void consultar(true);
    return () => {
      activo = false;
      controller.abort();
      clearTimeout(temporizador);
    };
  }, [ciclo]);

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento || !tieneDatos) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = capacidadPantalla(
        entry.contentRect.width,
        entry.contentRect.height,
      );
      setCapacidad((prev) =>
        prev.columnas === next.columnas && prev.filas === next.filas
          ? prev
          : next,
      );
    });
    observer.observe(elemento);
    return () => observer.disconnect();
  }, [tieneDatos]);

  const paginas = paginarEntregas(
    datos?.filas ?? [],
    capacidad.filas * capacidad.columnas,
  );
  const paginaActual = pagina % paginas.length;
  const segundos = datos?.intervaloSegundos ?? 15;
  useEffect(() => {
    if (pausada || paginas.length < 2) return;
    const timer = setInterval(() => setPagina((p) => p + 1), segundos * 1000);
    return () => clearInterval(timer);
  }, [pausada, paginas.length, segundos, capacidad.filas, capacidad.columnas]);

  const nuevoCodigo = useCallback(async () => {
    setGenerando(true);
    try {
      const pendiente = await pedir<EstadoVinculo>("reiniciar");
      inicio.current = Promise.resolve(pendiente);
      setBloqueada(false);
      setVinculo(pendiente);
      setError("");
      setCiclo((c) => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el código.");
    } finally {
      setGenerando(false);
    }
  }, []);

  const sinConexion =
    Boolean(error) ||
    Boolean(recibidoEl && ahora && ahora - recibidoEl > 30_000);
  const zona = datos?.zona ?? "America/Argentina/Buenos_Aires";
  const hora = (fecha: number | string) =>
    new Date(fecha).toLocaleTimeString("es-AR", {
      timeZone: zona,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  const vencido =
    vinculo?.estado === "pendiente" &&
    ahora != null &&
    new Date(vinculo.venceCodigoEl).getTime() <= ahora;

  if (!datos)
    return (
      <main className={`${theme} ${s.pairing}`} data-appearance="light">
        <div className={s.pairCard}>
          <div className={s.wordmark}>
            grafo<span>.</span>
          </div>
          <Monitor className={s.pairIcon} aria-hidden="true" />
          <h1>Producción en tiempo real</h1>
          <p>Vinculá este televisor con tu empresa.</p>
          {vinculo?.estado === "pendiente" && !vencido && (
            <>
              <div
                className={s.code}
                aria-label={`Código de vinculación ${vinculo.codigo}`}
              >
                {vinculo.codigo.slice(0, 4)}–{vinculo.codigo.slice(4)}
              </div>
              <p>
                Desde tu cuenta de Grafo entrá a{" "}
                <strong>Producción → Tablero → Pantallas</strong> e ingresá este
                código.
              </p>
              <div className={s.pairHint}>
                Vence a las {hora(vinculo.venceCodigoEl)} · Esperando
                autorización
              </div>
            </>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {bloqueada || vencido ? (
            <Button onClick={nuevoCodigo} loading={generando}>
              <RefreshCw data-icon="inline-start" />
              Generar nuevo código
            </Button>
          ) : !vinculo && !error ? (
            <p role="status">Conectando con Grafo…</p>
          ) : null}
          <p className={s.pairHint}>
            Acceso de sólo lectura. No hace falta iniciar sesión en el
            televisor.
          </p>
        </div>
      </main>
    );

  return (
    <main
      className={`${theme} ${s.screen}`}
      data-appearance="light"
      data-offline={sinConexion}
    >
      <header className={s.header}>
        <div>
          <div className={s.brandLine}>
            <span className={s.wordmark}>
              grafo<span>.</span>
            </span>
            <span>
              {datos.empresa} · {datos.pantalla}
            </span>
          </div>
          <h1>
            Producción en tiempo real<span className={s.dot}>.</span>
          </h1>
        </div>
        <div className={s.clock}>
          <time>{ahora ? hora(ahora) : "—:—"}</time>
          <span>
            {ahora
              ? new Date(ahora).toLocaleDateString("es-AR", {
                  timeZone: zona,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : ""}
          </span>
        </div>
      </header>
      <div className={s.summary}>
        <div data-tone="late">
          <span>Atrasadas</span>
          <strong>{datos.resumen.atrasadas}</strong>
          <small>entregas pendientes</small>
        </div>
        <div>
          <span>Para hoy</span>
          <strong>{datos.resumen.hoy}</strong>
          <small>entregas del día</small>
        </div>
        <div data-tone="ready">
          <span>Listas para entregar</span>
          <strong>{datos.resumen.listas}</strong>
          <small>de hoy y atrasadas</small>
        </div>
      </div>
      <div className={s.sectionTitle}>
        <h2>
          Entregas pendientes <span>{datos.filas.length}</span>
        </h2>
        <span>Primero las más atrasadas</span>
      </div>
      {sinConexion && (
        <div className={s.offline} role="status">
          <WifiOff aria-hidden="true" /> Sin conexión · Mostrando la última
          lectura de las {hora(datos.actualizadoEl)}. Reintentando…
        </div>
      )}
      <div ref={contenedor} className={s.viewport}>
        {datos.filas.length ? (
          <div
            className={s.cards}
            style={{
              gridTemplateColumns: `repeat(${capacidad.columnas}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${capacidad.filas}, minmax(0, 1fr))`,
            }}
          >
            {paginas[paginaActual].map((fila) => (
              <article
                className={s.card}
                key={fila.id}
                data-late={fila.atrasada}
                data-ready={fila.estado === "lista"}
              >
                <div className={s.cardTop}>
                  <strong>{fila.orden}</strong>
                  <span className={s.due}>
                    {fila.atrasada
                      ? `Atrasada · ${fila.fecha.split("-").reverse().join("/")}`
                      : "Entrega hoy"}
                  </span>
                </div>
                <h3 title={fila.producto}>{fila.producto}</h3>
                <div className={s.customer}>
                  <span title={fila.cliente}>{fila.cliente}</span>
                  <strong>
                    {fila.cantidad.toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {fila.unidad}
                  </strong>
                </div>
                <div className={s.stage}>
                  <span className={s.stageText} title={fila.etapa}>
                    {fila.estado === "lista" ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                    {fila.etapa}
                  </span>
                  <span>
                    {fila.pasosTotal
                      ? `${fila.pasosHechos}/${fila.pasosTotal}`
                      : ""}
                  </span>
                </div>
                {fila.pasosTotal > 0 && (
                  <div
                    className={s.progress}
                    aria-label={`${fila.pasosHechos} de ${fila.pasosTotal} pasos terminados`}
                  >
                    <span
                      style={{
                        width: `${(fila.pasosHechos / fila.pasosTotal) * 100}%`,
                      }}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={s.empty}>
            <Check aria-hidden="true" />
            <h2>Todo al día</h2>
            <p>No hay entregas de hoy ni atrasadas pendientes.</p>
          </div>
        )}
      </div>
      <footer className={s.footer}>
        <div className={s.connection} data-offline={sinConexion}>
          <i />
          {sinConexion ? "Sin conexión" : "Actualización automática"}
          <span>Última lectura {hora(datos.actualizadoEl)}</span>
        </div>
        <div className={s.controls}>
          <span>
            Página {paginaActual + 1} de {paginas.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPausada((p) => !p)}
            aria-label={pausada ? "Reanudar rotación" : "Pausar rotación"}
          >
            {pausada ? <Play /> : <Pause />}
          </Button>
          <span>{pausada ? "En pausa" : `${segundos} s`}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Pantalla completa"
            onClick={() => {
              void document.documentElement
                .requestFullscreen?.()
                .catch(() => {});
            }}
          >
            <Maximize />
          </Button>
        </div>
      </footer>
    </main>
  );
}
