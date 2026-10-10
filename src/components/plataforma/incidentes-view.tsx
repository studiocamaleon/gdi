"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { apiRequest } from "@/lib/api";
import { reportarPruebaCliente } from "@/lib/observabilidad-cliente";
import { fechaHora } from "@/lib/fecha";
import type { ResumenIncidentes } from "../../../apps/api/src/common/incidentes-compartido";
import { Kpi, Panel } from "./kit";
import styles from "./incidentes-view.module.css";

export function IncidentesResultado({ datos }: { datos: ResumenIncidentes }) {
  return (
    <>
      {datos.conexion !== "conectado" && (
        <div className={styles.aviso} role="status">
          <TriangleAlert aria-hidden="true" size={20} />
          <div>
            <strong>
              {datos.conexion === "sin_configurar"
                ? "Conexión pendiente"
                : "No pudimos actualizar los incidentes"}
            </strong>
            <p>
              {datos.conexion === "sin_configurar"
                ? "Falta habilitar el acceso de lectura de Sentry en este entorno."
                : datos.actualizadoEl
                  ? "Se conserva la última consulta disponible. El listado puede estar desactualizado."
                  : "Todavía no hay una consulta disponible. Esto no significa que no haya errores."}
            </p>
          </div>
        </div>
      )}
      {datos.conexion === "conectado" && (
        <div className={styles.metricas}>
          <Kpi
            label="Incidentes encontrados"
            value={`${datos.incidentes.length}${datos.hayMas ? "+" : ""}`}
            sub="Según los filtros elegidos"
          />
          <Kpi
            label="Prioridad alta"
            value={String(
              datos.incidentes.filter((i) => i.prioridad === "alta").length,
            )}
            sub="En los incidentes mostrados"
            alerta={datos.incidentes.some((i) => i.prioridad === "alta")}
          />
          <Kpi
            label="Última consulta"
            value={
              datos.actualizadoEl
                ? new Date(datos.actualizadoEl).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
            sub="Actualización automática cada minuto"
          />
        </div>
      )}
      <Panel
        title="Incidentes recientes"
        sub="Los errores similares se agrupan para investigar su causa."
      >
        {datos.incidentes.length ? (
          <div className={styles.lista}>
            {datos.incidentes.map((i) => (
              <article key={i.id} className={styles.fila}>
                <span
                  className={styles.indicador}
                  data-prioridad={i.prioridad}
                  aria-label={`Prioridad ${i.prioridad}`}
                />
                <div className={styles.detalle}>
                  <div className={styles.referencia}>
                    {i.referencia}{" "}
                    <span>
                      {i.proyecto === "grafoprint-web"
                        ? "Aplicación web"
                        : "API y tareas"}
                    </span>
                  </div>
                  <h3>{i.titulo}</h3>
                  <p>
                    {i.estado === "abierto"
                      ? "Abierto"
                      : i.estado === "resuelto"
                        ? "Resuelto"
                        : "Archivado"}{" "}
                    · Prioridad {i.prioridad} · Último registro:{" "}
                    {i.ultimaVez
                      ? fechaHora(i.ultimaVez)
                      : "sin fecha disponible"}
                  </p>
                </div>
                <div className={styles.repeticiones}>
                  <strong>{i.repeticiones ?? "—"}</strong>
                  <span>en el período</span>
                </div>
                <a
                  className={styles.enlace}
                  href={i.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Investigar ${i.referencia} en Sentry`}
                >
                  <ExternalLink size={18} aria-hidden="true" /> Investigar
                </a>
              </article>
            ))}
            {datos.hayMas && (
              <p className={styles.nota}>
                Se muestran los 50 incidentes más recientes. Podés consultar el
                resto en Sentry.
              </p>
            )}
          </div>
        ) : datos.conexion === "conectado" ? (
          <div className={styles.vacio}>
            <ShieldCheck size={28} aria-hidden="true" />
            <strong>Sin incidentes para estos filtros</strong>
            <p>Los nuevos errores aparecerán acá automáticamente.</p>
          </div>
        ) : (
          <p className={styles.nota}>
            Esperando una consulta válida del monitor.
          </p>
        )}
      </Panel>
    </>
  );
}

export function IncidentesView({
  ambiente,
  esAdmin,
}: {
  ambiente: "produccion" | "staging" | "desarrollo";
  esAdmin: boolean;
}) {
  const [entorno, setEntorno] = useState(
    ambiente === "staging" ? "staging" : "production",
  );
  const [periodo, setPeriodo] = useState("24h");
  const [estado, setEstado] = useState("abiertos");
  const [pruebas, setPruebas] = useState("no");
  const [datos, setDatos] = useState<ResumenIncidentes | null>(null);
  const [fallo, setFallo] = useState(false);
  const [probando, setProbando] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let vigente = true,
      enCurso = false;
    setDatos(null);
    setFallo(false);
    const cargar = async () => {
      if (enCurso || document.visibilityState === "hidden") return;
      enCurso = true;
      try {
        const query = new URLSearchParams({
          entorno,
          periodo,
          estado,
          pruebas,
        });
        const resultado = await apiRequest<ResumenIncidentes>(
          `/plataforma/incidentes?${query}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (vigente) {
          setDatos(resultado);
          setFallo(false);
        }
      } catch {
        if (vigente) setFallo(true);
      } finally {
        enCurso = false;
      }
    };
    void cargar();
    const timer = window.setInterval(() => void cargar(), 60_000);
    const visible = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      vigente = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [entorno, periodo, estado, pruebas]);

  const probar = async () => {
    setProbando(true);
    try {
      const respuesta = await apiRequest<{ mensaje: string }>(
        "/plataforma/incidentes/prueba",
        { method: "POST" },
      );
      const navegador = await reportarPruebaCliente();
      setEntorno(ambiente === "staging" ? "staging" : "production");
      setEstado("todos");
      setPruebas("si");
      toast.success(
        navegador
          ? "Pruebas de API y navegador enviadas. Esperá su aparición en el listado."
          : respuesta.mensaje,
      );
    } catch {
      toast.error(
        "No se pudo enviar la prueba. Comprobá la conexión y esperá un minuto antes de reintentar.",
      );
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className={`cpl-page ${styles.pagina}`}>
      <div className={styles.cabecera}>
        <div>
          <span className={styles.eyebrow}>MONITOR DE ERRORES</span>
          <h2>
            Detectar, investigar y corregir<span>.</span>
          </h2>
          <p>Fallos de la aplicación, la API y las tareas en segundo plano.</p>
        </div>
        <a
          className={styles.enlace}
          href={datos?.enlace ?? "https://grafoprint.sentry.io/issues/"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir Sentry <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
      <FieldGroup className={styles.filtros}>
        <Field>
          <FieldLabel>Entorno</FieldLabel>
          <SelectField
            aria-label="Entorno de incidentes"
            value={entorno}
            onChange={setEntorno}
            options={[
              { value: "production", label: "Producción" },
              { value: "staging", label: "Staging" },
            ]}
          />
        </Field>
        <Field>
          <FieldLabel>Período</FieldLabel>
          <SelectField
            aria-label="Período de incidentes"
            value={periodo}
            onChange={setPeriodo}
            options={[
              { value: "24h", label: "Últimas 24 horas" },
              { value: "7d", label: "Últimos 7 días" },
              { value: "14d", label: "Últimos 14 días" },
            ]}
          />
        </Field>
        <Field>
          <FieldLabel>Estado</FieldLabel>
          <SelectField
            aria-label="Estado de incidentes"
            value={estado}
            onChange={setEstado}
            options={[
              { value: "abiertos", label: "Abiertos" },
              { value: "resueltos", label: "Resueltos" },
              { value: "todos", label: "Todos" },
            ]}
          />
        </Field>
        <Field>
          <FieldLabel>Ensayos</FieldLabel>
          <SelectField
            aria-label="Incluir pruebas de monitoreo"
            value={pruebas}
            onChange={setPruebas}
            options={[
              { value: "no", label: "Excluir pruebas" },
              { value: "si", label: "Incluir pruebas" },
            ]}
          />
        </Field>
      </FieldGroup>
      {fallo && (
        <div className={styles.aviso} role="alert">
          No pudimos consultar el monitor. Se reintentará automáticamente; los
          datos anteriores pueden estar desactualizados.
        </div>
      )}
      {datos ? (
        <IncidentesResultado
          datos={fallo ? { ...datos, conexion: "no_disponible" } : datos}
        />
      ) : !fallo ? (
        <p role="status">Consultando incidentes…</p>
      ) : null}
      <div className={styles.pie}>
        <p>
          Se recopilan referencias técnicas. No se envían contraseñas,
          formularios, archivos ni conversaciones de clientes.
        </p>
        {esAdmin && (
          <ActionButton
            variant="outline"
            isDisabled={probando || ambiente === "desarrollo"}
            onPress={() => void probar()}
          >
            {probando ? "Enviando prueba…" : "Probar monitoreo"}
          </ActionButton>
        )}
      </div>
    </div>
  );
}
