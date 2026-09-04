"use client";

import * as React from "react";
import { FileCheck2Icon, FileUpIcon, ShapesIcon } from "lucide-react";
import {
  escalarGeometriaProporcional,
  obtenerRelacionAspectoSvg,
  type ConfiguracionGeometriasComerciales,
  type EjeEscalaVectorial,
} from "@/lib/producto-geometrias";
import {
  medirSvgFabricacion,
  normalizarFuenteVectorial,
  type FormatoFuenteVectorial,
} from "@/lib/productos-servicios-api";
import styles from "./geometrias-vectoriales-cotizacion.module.css";

export type FuenteVectorialCotizada = {
  schemaVersion: 1 | 2;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  relacionAltoAncho?: number;
  configuracionCapas?: unknown;
  formatoOrigen?: FormatoFuenteVectorial;
  unidadOrigen?: string | null;
};

export function MarcoGeometriaGrafoprint({
  titulo = "Geometría del producto",
  descripcion,
  formato = "SVG / DXF",
  children,
}: {
  titulo?: string;
  descripcion: string;
  formato?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.headerIcon} aria-hidden="true">
          <ShapesIcon />
        </span>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>GrafoNest · Entrada vectorial</span>
          <strong>{titulo}</strong>
          <span>{descripcion}</span>
        </div>
        {formato ? <span className={styles.format}>{formato}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function ControlArchivoVectorial({
  etiqueta = "Archivo de producción",
  nombreArchivo,
  formatoOrigen,
  procesando = false,
  disabled = false,
  required = false,
  onSelect,
}: {
  etiqueta?: string;
  nombreArchivo?: string | null;
  formatoOrigen?: FormatoFuenteVectorial | null;
  procesando?: boolean;
  disabled?: boolean;
  required?: boolean;
  onSelect: (file: File) => void | Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const cargado = Boolean(nombreArchivo);

  return (
    <div
      className={styles.fileControl}
      data-loaded={cargado}
      data-disabled={disabled}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".svg,.dxf,image/svg+xml,image/vnd.dxf,application/dxf"
        className={styles.fileInput}
        aria-label={`Subir ${etiqueta}`}
        required={required && !cargado}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onSelect(file);
          event.target.value = "";
        }}
      />
      <span className={styles.fileGlyph} aria-hidden="true">
        {cargado ? <FileCheck2Icon /> : <FileUpIcon />}
      </span>
      <div className={styles.fileCopy}>
        <span className={styles.fileLabel}>{etiqueta}</span>
        <strong title={nombreArchivo ?? undefined}>
          {nombreArchivo ?? "SVG o DXF listo para producción"}
        </strong>
        <small>
          {procesando
            ? "Analizando contornos…"
            : cargado
              ? `${formatoOrigen ?? "VECTOR"} preparado para GrafoNest`
              : "Textos convertidos a curvas · escala proporcional"}
        </small>
      </div>
      <button
        type="button"
        className={styles.fileAction}
        data-cotizacion-action="cargar-geometria"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <FileUpIcon aria-hidden="true" />
        {cargado ? "Reemplazar" : "Seleccionar archivo"}
      </button>
    </div>
  );
}

function longitudSvgMm(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|in|px)?$/i);
  if (!match) return null;
  const numero = Number(match[1]);
  const unidad = (match[2] ?? "px").toLowerCase();
  if (!(numero > 0)) return null;
  if (unidad === "mm") return numero;
  if (unidad === "cm") return numero * 10;
  if (unidad === "in") return numero * 25.4;
  return (numero * 25.4) / 96;
}

function medidasInicialesSvg(svg: string, relacionAltoAncho?: number) {
  const documento = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documento.documentElement;
  const proporcion =
    relacionAltoAncho && relacionAltoAncho > 0
      ? relacionAltoAncho
      : obtenerRelacionAspectoSvg(svg);
  const anchoDeclarado = longitudSvgMm(root.getAttribute("width"));
  const altoDeclarado = longitudSvgMm(root.getAttribute("height"));
  const anchoFinalMm =
    anchoDeclarado ??
    (altoDeclarado ? altoDeclarado / proporcion : null) ??
    1_000;
  return {
    anchoFinalMm,
    altoFinalMm: anchoFinalMm * proporcion,
  };
}

export function GeometriasVectorialesCotizacion({
  configuracion,
  values,
  ocultarFuenteId,
  onChange,
}: {
  configuracion: ConfiguracionGeometriasComerciales;
  values: Record<string, FuenteVectorialCotizada>;
  ocultarFuenteId?: string | null;
  onChange: (values: Record<string, FuenteVectorialCotizada>) => void;
}) {
  const [ejesEscala, setEjesEscala] = React.useState<
    Record<string, EjeEscalaVectorial>
  >({});
  const [procesando, setProcesando] = React.useState<Record<string, boolean>>(
    {},
  );
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const medicionesSolicitadas = React.useRef(new Set<string>());
  const fuentes = configuracion.fuentes.filter(
    (fuente) => fuente.id !== ocultarFuenteId,
  );

  React.useEffect(() => {
    const pendientes = configuracion.fuentes
      .filter((fuente) => fuente.id !== ocultarFuenteId)
      .flatMap((fuente) => {
        const value = values[fuente.id];
        if (!value || (value.relacionAltoAncho ?? 0) > 0) return [];
        const firma = `${fuente.id}:${value.nombreArchivo}:${value.svg.length}:${value.anchoFinalMm}`;
        if (medicionesSolicitadas.current.has(firma)) return [];
        medicionesSolicitadas.current.add(firma);
        return [{ fuente, value }];
      });
    if (!pendientes.length) return;
    let active = true;
    setProcesando((current) => ({
      ...current,
      ...Object.fromEntries(pendientes.map(({ fuente }) => [fuente.id, true])),
    }));
    void Promise.all(
      pendientes.map(async ({ fuente, value }) => ({
        fuente,
        value,
        medicion: await medirSvgFabricacion({
          svg: value.svg,
          nombreArchivo: value.nombreArchivo,
        }),
      })),
    )
      .then((resultados) => {
        if (!active) return;
        const next = { ...values };
        for (const { fuente, value, medicion } of resultados) {
          next[fuente.id] = {
            ...value,
            relacionAltoAncho: medicion.relacionAltoAncho,
            ...escalarGeometriaProporcional(
              medicion.relacionAltoAncho,
              "ancho",
              value.anchoFinalMm,
            ),
          };
        }
        onChange(next);
      })
      .catch((cause) => {
        if (!active) return;
        const message =
          cause instanceof Error
            ? cause.message
            : "No se pudo medir el archivo SVG.";
        setErrores((current) => ({
          ...current,
          ...Object.fromEntries(
            pendientes.map(({ fuente }) => [fuente.id, message]),
          ),
        }));
      })
      .finally(() => {
        if (!active) return;
        setProcesando((current) => ({
          ...current,
          ...Object.fromEntries(
            pendientes.map(({ fuente }) => [fuente.id, false]),
          ),
        }));
      });
    return () => {
      active = false;
    };
  }, [configuracion.fuentes, ocultarFuenteId, onChange, values]);

  if (!fuentes.length) return null;

  return (
    <MarcoGeometriaGrafoprint
      descripcion="Cargá los vectores que compartirán los componentes, sin duplicar archivos."
      formato="SVG / DXF"
    >
      <div className={styles.sources}>
        {fuentes.map((fuente) => {
          const value = values[fuente.id];
          const ejeEscala = ejesEscala[fuente.id] ?? "ancho";
          const relacionAltoAncho =
            value?.relacionAltoAncho && value.relacionAltoAncho > 0
              ? value.relacionAltoAncho
              : obtenerRelacionAspectoSvg(value?.svg);
          const update = (patch: Partial<FuenteVectorialCotizada>) =>
            value &&
            onChange({ ...values, [fuente.id]: { ...value, ...patch } });
          const actualizarEscala = (medidaCm: number) =>
            value &&
            update(
              escalarGeometriaProporcional(
                relacionAltoAncho,
                ejeEscala,
                medidaCm * 10,
              ),
            );
          return (
            <section className={styles.source} key={fuente.id}>
              <div className={styles.sourceHead}>
                <strong>{fuente.nombre}</strong>
                {fuente.requerida ? (
                  <span className={styles.required}>Obligatoria</span>
                ) : null}
              </div>
              <ControlArchivoVectorial
                etiqueta="Archivo de producción"
                nombreArchivo={value?.nombreArchivo}
                formatoOrigen={value?.formatoOrigen}
                required={fuente.requerida && !value}
                procesando={procesando[fuente.id] === true}
                disabled={procesando[fuente.id] === true}
                onSelect={async (file) => {
                  const contenido = await file.text();
                  setProcesando((current) => ({
                    ...current,
                    [fuente.id]: true,
                  }));
                  setErrores((current) => ({ ...current, [fuente.id]: "" }));
                  try {
                    const normalizada = await normalizarFuenteVectorial({
                      contenido,
                      nombreArchivo: file.name,
                    });
                    const medidas =
                      normalizada.formatoOrigen === "SVG"
                        ? medidasInicialesSvg(
                            normalizada.svg,
                            normalizada.relacionAltoAncho,
                          )
                        : {
                            anchoFinalMm: normalizada.anchoSugeridoMm,
                            altoFinalMm: normalizada.altoSugeridoMm,
                          };
                    onChange({
                      ...values,
                      [fuente.id]: {
                        schemaVersion: 1,
                        nombreArchivo: file.name,
                        svg: normalizada.svg,
                        formatoOrigen: normalizada.formatoOrigen,
                        unidadOrigen: normalizada.unidadDetectada,
                        relacionAltoAncho: normalizada.relacionAltoAncho,
                        ...medidas,
                      },
                    });
                  } catch (cause) {
                    setErrores((current) => ({
                      ...current,
                      [fuente.id]:
                        cause instanceof Error
                          ? cause.message
                          : "No se pudo interpretar el archivo vectorial.",
                    }));
                  } finally {
                    setProcesando((current) => ({
                      ...current,
                      [fuente.id]: false,
                    }));
                  }
                }}
              />
              {procesando[fuente.id] ? (
                <span className={styles.processing}>Analizando contornos…</span>
              ) : errores[fuente.id] ? (
                <span className={styles.error}>{errores[fuente.id]}</span>
              ) : null}
              {value ? (
                <div className={styles.loaded}>
                  <div className={styles.measures}>
                    <div className={styles.axisSwitch}>
                      <button
                        type="button"
                        data-active={ejeEscala === "ancho"}
                        onClick={() =>
                          setEjesEscala((current) => ({
                            ...current,
                            [fuente.id]: "ancho",
                          }))
                        }
                      >
                        Ancho
                      </button>
                      <button
                        type="button"
                        data-active={ejeEscala === "alto"}
                        onClick={() =>
                          setEjesEscala((current) => ({
                            ...current,
                            [fuente.id]: "alto",
                          }))
                        }
                      >
                        Alto
                      </button>
                    </div>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {ejeEscala === "ancho" ? "Ancho" : "Alto"} final
                      </span>
                      <span className={styles.inputWithUnit}>
                        <input
                          className={styles.nativeInput}
                          type="number"
                          min="0.1"
                          step="any"
                          value={
                            (ejeEscala === "ancho"
                              ? value.anchoFinalMm
                              : (value.altoFinalMm ?? value.anchoFinalMm)) / 10
                          }
                          onChange={(event) =>
                            actualizarEscala(Number(event.target.value))
                          }
                        />
                        <span>cm</span>
                      </span>
                    </label>
                    <div className={styles.resultMeasure}>
                      <span>{ejeEscala === "ancho" ? "Alto" : "Ancho"}</span>
                      <strong>
                        {(
                          (ejeEscala === "ancho"
                            ? (value.altoFinalMm ?? value.anchoFinalMm)
                            : value.anchoFinalMm) / 10
                        ).toLocaleString("es-AR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        cm
                      </strong>
                      <small>Calculado proporcionalmente</small>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </MarcoGeometriaGrafoprint>
  );
}
