"use client";

import * as React from "react";
import { CheckIcon, LayersIcon, RefreshCwIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { leerCantidadesNesting, listarNestingsProducto, prepararNestingsProducto, type PreparacionNesting } from "@/lib/nestings-guardados-api";
import styles from "./nestings-guardados.module.css";

const pendiente = (fila: PreparacionNesting) => fila.estado === "PENDIENTE" || fila.estado === "PROCESANDO";
const etiquetas = { PENDIENTE: "En cola", PROCESANDO: "Calculando", PREPARADO: "Preparado", FALLIDO: "Requiere atención" };

export function NestingsGuardadosProducto({ productoId, rutaAlternativaId }: { productoId: string; rutaAlternativaId?: string }) {
  const [cantidades, setCantidades] = React.useState("10, 25, 50, 100");
  const [filas, setFilas] = React.useState<PreparacionNesting[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actualizar, setActualizar] = React.useState(0);
  const id = React.useId();
  const cantidadesInicializadas = React.useRef(false);

  React.useEffect(() => {
    let activo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cargar = async () => {
      try {
        const datos = await listarNestingsProducto(productoId);
        if (!activo) return;
        setFilas(datos);
        if (!cantidadesInicializadas.current) {
          const preparadas = datos.filter(f => !rutaAlternativaId || f.rutaClave === rutaAlternativaId);
          if (preparadas.length) setCantidades(preparadas.map(f => f.cantidad).join(", "));
          cantidadesInicializadas.current = true;
        }
        setError(null);
        if (datos.some(pendiente)) timer = setTimeout(() => void cargar(), 5000);
      } catch (e) {
        if (activo) setError(e instanceof Error ? e.message : "No se pudieron consultar los nestings.");
      } finally {
        if (activo) setCargando(false);
      }
    };
    void cargar();
    return () => { activo = false; if (timer) clearTimeout(timer); };
  }, [productoId, rutaAlternativaId, actualizar]);

  const preparar = async (seleccion?: number[]) => {
    try {
      const valores = seleccion ?? leerCantidadesNesting(cantidades);
      setError(null);
      setEnviando(true);
      setFilas(await prepararNestingsProducto(productoId, valores, rutaAlternativaId));
      setActualizar(v => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la preparación.");
    } finally {
      setEnviando(false);
    }
  };
  const visibles = filas.filter(f => !rutaAlternativaId || f.rutaClave === rutaAlternativaId);

  return (
    <section className={styles.panel} aria-labelledby={`${id}-titulo`}>
      <header className={styles.header}>
        <span className={styles.icono}><LayersIcon aria-hidden="true" /></span>
        <div><span className={styles.eyebrow}>GrafoNest · preparación anticipada</span><h2 id={`${id}-titulo`}>Nestings guardados</h2>
          <p>Prepará las cantidades habituales para cotizar sin repetir la búsqueda.</p></div>
      </header>
      <div className={styles.contenido}>
        <FieldGroup>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={`${id}-cantidades`}>Cantidades de producto</FieldLabel>
            <div className={styles.acciones}>
              <Input id={`${id}-cantidades`} value={cantidades} disabled={cargando || enviando} onChange={e => setCantidades(e.target.value)} placeholder="10, 25, 50, 100" aria-invalid={!!error} />
              <Button type="button" disabled={cargando || enviando} onClick={() => void preparar()}>{enviando ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}Preparar nestings</Button>
            </div>
            <FieldDescription>Busca hasta 5 minutos por nesting y conserva el mejor resultado. Usa las piezas y la configuración guardadas; continúa aunque cierres esta pantalla. Si hay varias cantidades o procesos, la preparación puede tardar más.</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </FieldGroup>
        {cargando ? <p className={styles.estado}><Spinner /> Consultando preparaciones…</p> : visibles.length ? (
          <div className={styles.lista} aria-live="polite">
            {visibles.map(fila => (
              <div className={styles.fila} key={fila.id}>
                <div className={styles.cantidad}><strong>{fila.cantidad.toLocaleString("es-AR")}</strong><span>{fila.cantidad === 1 ? "producto" : "productos"}</span></div>
                <div className={styles.detalle}>
                  <Badge variant={fila.estado === "FALLIDO" ? "destructive" : "secondary"}>
                    {pendiente(fila) ? <Spinner data-icon="inline-start" /> : fila.estado === "PREPARADO" ? <CheckIcon data-icon="inline-start" /> : null}
                    {etiquetas[fila.estado]}
                  </Badge>
                  {fila.error ? <p>{fila.error}</p> : fila.estado === "PREPARADO" ? <small>Calculado el {new Date(fila.updatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</small> : <small>{fila.estado === "PROCESANDO" ? "Buscando el mejor acomodo de las piezas." : "Esperando un turno de cálculo."}</small>}
                </div>
                <Button type="button" variant="ghost" size="sm" disabled={enviando || pendiente(fila)} onClick={() => void preparar([fila.cantidad])} aria-label={`Actualizar nesting de ${fila.cantidad} ${fila.cantidad === 1 ? "producto" : "productos"}`}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>
              </div>
            ))}
          </div>
        ) : <p className={styles.estado}>Todavía no hay cantidades preparadas desde esta ficha.</p>}
      </div>
      <footer className={styles.footer}>Los nestings calculados al cotizar también se guardan automáticamente. Se reutilizan cuando coinciden las piezas y las condiciones de fabricación; los tiempos y costos se calculan con los valores vigentes.</footer>
    </section>
  );
}
