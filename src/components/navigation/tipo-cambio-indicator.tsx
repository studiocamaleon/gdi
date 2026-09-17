"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/api";
import { latamCountries } from "@/lib/paises";
import { useConfigRegional, useFecha } from "./config-regional-provider";
import {
  DOLAR_REFRESH_MS,
  type DolarResponse,
} from "../../../apps/api/src/cotizaciones/cotizaciones.types";
import s from "./tipo-cambio-indicator.module.css";

const numero = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const importe = (valor: number | null) =>
  valor === null ? "—" : numero.format(valor);

/** Se desmonta al cambiar de país para no mostrar la cotización anterior. */
export function TipoCambioIndicator() {
  const { paisCodigo } = useConfigRegional();
  return <Indicador key={paisCodigo} paisCodigo={paisCodigo} />;
}

function Indicador({ paisCodigo }: { paisCodigo: string }) {
  const [datos, setDatos] = useState<DolarResponse | null>(null);
  const [error, setError] = useState(false);
  const { fechaHora, fechaNumerica, hora } = useFecha();

  useEffect(() => {
    let disposed = false;
    let pending = false;
    let next = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function consultar() {
      if (disposed || pending || document.visibilityState === "hidden") return;
      clearTimeout(timer);
      if (Date.now() < next) {
        timer = setTimeout(consultar, next - Date.now());
        return;
      }
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await apiRequest<DolarResponse>(
          "/cotizaciones/dolar",
          { signal: controller.signal },
        );
        if (disposed) return;
        setDatos(response);
        setError(false);
        next = response.proximaConsultaEn
          ? Math.max(Date.now() + 1000, Date.parse(response.proximaConsultaEn))
          : Date.now() + DOLAR_REFRESH_MS;
      } catch {
        if (disposed) return;
        setError(true);
        next = Date.now() + 60_000;
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (!disposed)
          timer = setTimeout(consultar, Math.max(1000, next - Date.now()));
      }
    }

    void consultar();
    document.addEventListener("visibilitychange", consultar);
    window.addEventListener("focus", consultar);
    window.addEventListener("online", consultar);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", consultar);
      window.removeEventListener("focus", consultar);
      window.removeEventListener("online", consultar);
    };
  }, []);

  const principal = datos?.cotizaciones.find((c) => c.id === datos.principalId);
  const valor = principal && datos ? principal[datos.campoPrincipal] : null;
  const sinActualizar =
    principal && (error || datos?.estado === "sin_actualizar");
  const pais =
    latamCountries.find((p) => p.code === (datos?.paisCodigo ?? paisCodigo))
      ?.name ?? paisCodigo;
  const sinCobertura = datos?.estado === "sin_cobertura";
  const etiqueta =
    principal && datos
      ? datos.campoPrincipal === "venta"
        ? `${principal.nombre} · venta`
        : principal.tipoReferencia === "Referencia"
          ? `${principal.nombre} · referencia`
          : principal.nombre
      : sinCobertura
        ? "Sin cobertura"
        : error || datos?.estado === "no_disponible"
          ? "No disponible"
          : "Consultando…";
  const mensaje = sinCobertura
    ? `DolarAPI todavía no publica cotizaciones para ${pais}.`
    : principal
      ? sinActualizar
        ? "No hay una cotización reciente confirmada. Mostramos el último valor recibido y su fecha original."
        : "Última cotización publicada. Consulta automática cada 5 minutos."
      : error || datos?.estado === "no_disponible"
        ? "No pudimos obtener la cotización. Volveremos a consultar automáticamente."
        : "Consultando la cotización del dólar…";
  const compraVenta = datos?.cotizaciones.some(
    (c) => c.compra !== null || c.venta !== null,
  );
  const referencia = datos?.cotizaciones.some((c) => c.referencia !== null);

  return (
    <div className={s.root} data-appearance="light">
      <Popover>
        <PopoverTrigger
          render={<Button variant="ghost" className={s.trigger} />}
          aria-label={`Cotización del dólar en ${pais}: ${etiqueta}${valor !== null ? `, ${datos?.monedaLocal} ${importe(valor)}` : ""}${sinActualizar ? ", sin actualizar" : ""}`}
        >
          <span className={s.usd}>USD</span>
          <span className={s.label}>{etiqueta}</span>
          {valor !== null && (
            <strong className={s.value}>
              {datos?.monedaLocal} {importe(valor)}
            </strong>
          )}
          {sinActualizar && (
            <span className={s.stale}>
              <Clock3 aria-hidden="true" /> Sin actualizar
            </span>
          )}
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          className={s.popover}
          align="start"
          sideOffset={10}
          data-appearance="light"
          initialFocus={false}
        >
          <PopoverHeader className={s.heading}>
            <span className={s.eyebrow}>TIPO DE CAMBIO · {pais}</span>
            <PopoverTitle className={s.title}>
              Dólar estadounidense
            </PopoverTitle>
            <PopoverDescription className={s.description}>
              {datos?.monedaLocal
                ? `Valores en ${datos.monedaLocal} por 1 USD.`
                : `Cotización de referencia para ${pais}.`}
            </PopoverDescription>
          </PopoverHeader>
          {principal && datos && (
            <>
              <div className={s.featured}>
                <span>{etiqueta}</span>
                <strong>
                  {datos.monedaLocal} {importe(valor)}
                </strong>
                <span className={s.date}>
                  Publicada: {fechaNumerica(principal.fechaActualizacion)} · {hora(principal.fechaActualizacion)}
                </span>
              </div>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <caption className="sr-only">
                    Cotizaciones en {datos.monedaLocal} por dólar; fecha de cada
                    cotización
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Cotización</th>
                      {compraVenta && (
                        <>
                          <th scope="col">Compra</th>
                          <th scope="col">Venta</th>
                        </>
                      )}
                      {referencia && <th scope="col">Referencia</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.cotizaciones.map((cotizacion) => (
                      <tr
                        key={cotizacion.id}
                        data-principal={cotizacion.id === principal.id}
                      >
                        <th scope="row">
                          {cotizacion.nombre}
                          <small>
                            {fechaHora(cotizacion.fechaActualizacion)}
                          </small>
                        </th>
                        {compraVenta && (
                          <>
                            <td>{importe(cotizacion.compra)}</td>
                            <td>{importe(cotizacion.venta)}</td>
                          </>
                        )}
                        {referencia && (
                          <td>{importe(cotizacion.referencia)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className={s.footer}>
            <p role="status" className={sinActualizar ? s.warning : undefined}>
              {mensaje}
            </p>
            <a
              href="https://dolarapi.com/docs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fuente: DolarAPI{" "}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
            <span>Cotizaciones de referencia.</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
