"use client";

import * as React from "react";
import { AlertCircleIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";
import {
  analizarSvgFabricacionEnWorker,
  normalizarFuenteVectorial,
  type AnalisisSvgFabricacion,
  type ConfiguracionCapasVectoriales,
  type ConfiguracionEncastresVectoriales,
  type FormatoFuenteVectorial,
  type TrabajoAnalisisVectorial,
} from "@/lib/productos-servicios-api";
import { obtenerRelacionAspectoSvg } from "@/lib/producto-geometrias";
import {
  ControlArchivoVectorial,
  MarcoGeometriaGrafoprint,
} from "./geometrias-vectoriales-cotizacion";
import styles from "./geometrias-vectoriales-cotizacion.module.css";
import { OpenNestLoading } from "./opennest-loading";

const VERSION_POLITICA_ORIENTACION_GRAFONEST = 3;

export type FuenteDisenoVectorial = {
  schemaVersion: 1 | 2;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  configuracionCapas?: ConfiguracionCapasVectoriales;
  formatoOrigen?: FormatoFuenteVectorial;
  unidadOrigen?: string | null;
};

export type CotizacionVectorialManual = {
  placas: number;
  metrosCortePorPlaca: number;
};

type Props = {
  titulo?: string;
  value: FuenteDisenoVectorial | null;
  analisis: AnalisisSvgFabricacion | null;
  modoCotizacion: "svg" | "placas";
  cotizacionManual: CotizacionVectorialManual;
  cantidad: number;
  placa: { anchoMm: number; altoMm: number } | null;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  permitirSegmentacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  configuracionEncastres: ConfiguracionEncastresVectoriales;
  onChange: (
    value: FuenteDisenoVectorial | null,
    analisis: AnalisisSvgFabricacion | null,
  ) => void;
  onCotizacionManualChange: (value: CotizacionVectorialManual) => void;
};

export function DisenoVectorialCotizador({
  titulo,
  value,
  analisis,
  modoCotizacion,
  cotizacionManual,
  cantidad,
  placa,
  margenMm = 5,
  separacionMm = 5,
  permitirRotacion = true,
  permitirSegmentacion = true,
  preservarComposicionOriginalSiEntra = false,
  configuracionEncastres,
  onChange,
  onCotizacionManualChange,
}: Props) {
  const analisisAbortRef = React.useRef<AbortController | null>(null);
  const scopeIdRef = React.useRef<string | null>(null);
  const [procesando, setProcesando] = React.useState(false);
  const [estadoCalculo, setEstadoCalculo] = React.useState<string | null>(null);
  const [progresoCalculo, setProgresoCalculo] = React.useState<number | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [medidaIngresada, setMedidaIngresada] = React.useState<
    "ancho" | "alto"
  >("ancho");
  const relacionAspectoInicial = obtenerRelacionAspectoSvg(value?.svg);
  const [anchoCm, setAnchoCm] = React.useState(
    value ? value.anchoFinalMm / 10 : 100,
  );
  const [altoCm, setAltoCm] = React.useState(
    value?.altoFinalMm
      ? value.altoFinalMm / 10
      : value
        ? redondearMedida((value.anchoFinalMm / 10) * relacionAspectoInicial)
        : redondearMedida(100 * relacionAspectoInicial),
  );

  const analizar = React.useCallback(
    async (fuente: FuenteDisenoVectorial, nextCantidad = cantidad) => {
      if (!placa) {
        setError("Seleccioná primero una placa con ancho y alto configurados.");
        return;
      }
      analisisAbortRef.current?.abort();
      const controller = new AbortController();
      analisisAbortRef.current = controller;
      setProcesando(true);
      setEstadoCalculo("Preparando geometría…");
      setProgresoCalculo(0);
      setError(null);
      try {
        const request = {
          svg: fuente.svg,
          nombreArchivo: fuente.nombreArchivo,
          anchoFinalMm: fuente.anchoFinalMm,
          cantidad: Math.max(1, Math.ceil(nextCantidad)),
          anchoPlacaMm: placa.anchoMm,
          altoPlacaMm: placa.altoMm,
          margenMm,
          separacionMm,
          permitirRotacion,
          permitirSegmentacion,
          preservarComposicionOriginalSiEntra,
          configuracionEncastres,
          configuracionCapas: undefined,
          claveSolicitud: `cotizador-vectorial-${(scopeIdRef.current ??= crypto.randomUUID())}`,
        };
        const result = await analizarSvgFabricacionEnWorker(request, {
          signal: controller.signal,
          onEstado: (trabajo) => {
            setEstadoCalculo(etiquetaEstadoCalculo(trabajo));
            setProgresoCalculo(trabajo.progreso.porcentaje);
          },
        });
        const normalized: FuenteDisenoVectorial = {
          ...fuente,
          schemaVersion: 1,
          altoFinalMm: result.geometria.altoMm,
          configuracionCapas: undefined,
        };
        setAltoCm(redondearMedida(result.geometria.altoMm / 10));
        onChange(normalized, result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message =
          cause instanceof Error
            ? cause.message
            : "No se pudo analizar el archivo vectorial.";
        setError(message);
        onChange(fuente, null);
      } finally {
        if (analisisAbortRef.current === controller) {
          analisisAbortRef.current = null;
          setProcesando(false);
          setEstadoCalculo(null);
          setProgresoCalculo(null);
        }
      }
    },
    [
      cantidad,
      configuracionEncastres,
      margenMm,
      onChange,
      permitirRotacion,
      permitirSegmentacion,
      placa,
      preservarComposicionOriginalSiEntra,
      separacionMm,
    ],
  );

  React.useEffect(
    () => () => {
      analisisAbortRef.current?.abort();
    },
    [],
  );

  const cargarArchivo = async (file: File) => {
    if (!/\.(svg|dxf)$/i.test(file.name)) {
      setError("El archivo debe tener extensión SVG o DXF.");
      return;
    }
    setProcesando(true);
    setEstadoCalculo("Interpretando archivo…");
    setError(null);
    try {
      const normalizada = await normalizarFuenteVectorial({
        contenido: await file.text(),
        nombreArchivo: file.name,
      });
      const anchoInicialMm = Math.max(
        10,
        normalizada.formatoOrigen === "DXF"
          ? normalizada.anchoSugeridoMm
          : anchoCm * 10,
      );
      const altoInicialMm = Math.max(
        10,
        anchoInicialMm * normalizada.relacionAltoAncho,
      );
      const fuente: FuenteDisenoVectorial = {
        schemaVersion: 1,
        nombreArchivo: file.name,
        svg: normalizada.svg,
        formatoOrigen: normalizada.formatoOrigen,
        unidadOrigen: normalizada.unidadDetectada,
        anchoFinalMm: anchoInicialMm,
        altoFinalMm: altoInicialMm,
      };
      setAnchoCm(redondearMedida(anchoInicialMm / 10));
      setAltoCm(redondearMedida(altoInicialMm / 10));
      onChange(fuente, null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo interpretar el archivo vectorial.",
      );
    } finally {
      setProcesando(false);
      setEstadoCalculo(null);
    }
  };

  const anchoFinalMm = Math.max(10, anchoCm * 10);
  const analisisActualizado = Boolean(
    value &&
    placa &&
    analisisCoincideConEntrada({
      analisis,
      fuente: value,
      anchoFinalMm,
      cantidad,
      placa,
      margenMm,
      preservarComposicionOriginalSiEntra,
      configuracionEncastres,
    }),
  );
  const nestingActualizado = analisisActualizado;
  const unionesFisicas = analisis
    ? (analisis.nesting.unionesFisicas ??
      (analisis.nesting.uniones?.length ?? 0) * cantidad)
    : 0;

  React.useEffect(() => {
    if (!value || !analisis || analisisActualizado || procesando) return;
    // Cambiar medida, cantidad, placa o configuración invalida el resultado,
    // pero no vuelve a ejecutar el nesting. El usuario decide cuándo calcular.
    onChange(value, null);
  }, [analisis, analisisActualizado, onChange, procesando, value]);

  const relacionAspectoActual = analisis
    ? analisis.geometria.altoMm / analisis.geometria.anchoMm
    : obtenerRelacionAspectoSvg(value?.svg);

  const actualizarAncho = (nextAnchoCm: number) => {
    const nextAltoCm = redondearMedida(nextAnchoCm * relacionAspectoActual);
    setAnchoCm(nextAnchoCm);
    setAltoCm(nextAltoCm);
    setError(null);
    if (!value) return;
    onChange(
      {
        ...value,
        anchoFinalMm: Math.max(10, nextAnchoCm * 10),
        altoFinalMm: Math.max(10, nextAltoCm * 10),
      },
      null,
    );
  };

  const actualizarAlto = (nextAltoCm: number) => {
    const nextAnchoCm = redondearMedida(nextAltoCm / relacionAspectoActual);
    setAltoCm(nextAltoCm);
    setAnchoCm(nextAnchoCm);
    setError(null);
    if (!value) return;
    onChange(
      {
        ...value,
        anchoFinalMm: Math.max(10, nextAnchoCm * 10),
        altoFinalMm: Math.max(10, nextAltoCm * 10),
      },
      null,
    );
  };

  const calcularNesting = () => {
    if (!value) return;
    void analizar(
      {
        ...value,
        anchoFinalMm,
        altoFinalMm: undefined,
      },
      cantidad,
    );
  };

  const estadoNesting = procesando
    ? (estadoCalculo ?? "Calculando…")
    : nestingActualizado
      ? analisis?.nesting.motorNesting === "opennest-v1" ||
        analisis?.nesting.motorNesting === "grafonest-baseline-v1"
        ? "GrafoNest"
        : "Calculado"
      : "Pendiente";

  return (
    <MarcoGeometriaGrafoprint
      titulo={
        modoCotizacion === "svg"
          ? (titulo ?? "Geometría del producto")
          : "Cotización manual"
      }
      descripcion={
        modoCotizacion === "svg"
          ? "Cargá el vector terminado, definí su escala y generá el nesting con GrafoNest."
          : "Estimación sin geometría ni nesting. Indicá las placas y el corte aproximado."
      }
      formato={modoCotizacion === "svg" ? "SVG / DXF" : null}
    >
      <div className={styles.editorBody} data-testid="diseno-vectorial-card">
        {modoCotizacion === "placas" ? (
          <>
            <div className={styles.manualGrid}>
              <label className={styles.field} htmlFor="vector-manual-plates">
                <span className={styles.fieldLabel}>Placas necesarias</span>
                <input
                  className={styles.nativeInput}
                  id="vector-manual-plates"
                  type="number"
                  min={1}
                  step={1}
                  value={cotizacionManual.placas}
                  onChange={(event) =>
                    onCotizacionManualChange({
                      ...cotizacionManual,
                      placas: Math.max(
                        1,
                        Math.ceil(Number(event.target.value) || 1),
                      ),
                    })
                  }
                />
              </label>
              <label className={styles.field} htmlFor="vector-manual-cut">
                <span className={styles.fieldLabel}>Corte por placa (m)</span>
                <input
                  className={styles.nativeInput}
                  id="vector-manual-cut"
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={cotizacionManual.metrosCortePorPlaca}
                  onChange={(event) =>
                    onCotizacionManualChange({
                      ...cotizacionManual,
                      metrosCortePorPlaca: Math.max(
                        0.1,
                        Number(event.target.value) || 0.1,
                      ),
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Placa seleccionada</span>
                <input
                  className={styles.nativeInput}
                  disabled
                  value={
                    placa
                      ? `${placa.anchoMm / 10} × ${placa.altoMm / 10} cm`
                      : "Sin placa configurada"
                  }
                  readOnly
                />
              </label>
            </div>
            <div className={styles.metrics}>
              <Metric
                label="Corte total"
                value={`${formatNumber(
                  cotizacionManual.placas *
                    cotizacionManual.metrosCortePorPlaca,
                )} m`}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.measureGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  Medida final del diseño (cm)
                </span>
                <div
                  className={styles.axisSwitch}
                  role="group"
                  aria-label="Elegir la medida a ingresar"
                >
                  <button
                    type="button"
                    data-active={medidaIngresada === "ancho"}
                    aria-pressed={medidaIngresada === "ancho"}
                    onClick={() => setMedidaIngresada("ancho")}
                  >
                    Ancho
                  </button>
                  <button
                    type="button"
                    data-active={medidaIngresada === "alto"}
                    aria-pressed={medidaIngresada === "alto"}
                    onClick={() => setMedidaIngresada("alto")}
                  >
                    Alto
                  </button>
                </div>
                <input
                  className={styles.nativeInput}
                  id="vector-final-size"
                  type="number"
                  min={1}
                  step={0.1}
                  aria-label={`${medidaIngresada === "ancho" ? "Ancho" : "Alto"} final del cartel en centímetros`}
                  value={medidaIngresada === "ancho" ? anchoCm : altoCm}
                  onChange={(event) => {
                    const next = Number(event.target.value) || 0;
                    if (medidaIngresada === "ancho") actualizarAncho(next);
                    else actualizarAlto(next);
                  }}
                />
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Placa seleccionada</span>
                <input
                  className={styles.nativeInput}
                  disabled
                  value={
                    placa
                      ? `${placa.anchoMm / 10} × ${placa.altoMm / 10} cm`
                      : "Sin placa configurada"
                  }
                  readOnly
                />
              </label>
            </div>

            <ControlArchivoVectorial
              nombreArchivo={value?.nombreArchivo}
              formatoOrigen={value?.formatoOrigen}
              procesando={procesando}
              disabled={!placa || procesando}
              onSelect={cargarArchivo}
            />

            {value ? (
              <section className={styles.nestingPanel}>
                <header className={styles.nestingHeader}>
                  <div className={styles.nestingTitle}>
                    <strong>Nesting irregular</strong>
                    <span>
                      Generá el acomodo cuando termines de definir los datos.
                    </span>
                  </div>
                  <span
                    className={styles.status}
                    data-ready={nestingActualizado}
                  >
                    {estadoNesting}
                  </span>
                </header>
                {analisis && nestingActualizado ? (
                  <>
                    <div className={styles.metrics}>
                      <Metric label="Placas" value={analisis.nesting.placas} />
                      <Metric
                        label="Corte total"
                        value={`${formatNumber(
                          (analisis.nesting.perimetroCorteMm ??
                            analisis.geometria.perimetroTotalMm * cantidad) /
                            1_000,
                        )} m`}
                      />
                      <Metric
                        label="Aprovechamiento"
                        value={`${formatNumber(analisis.nesting.aprovechamientoPct)}%`}
                      />
                    </div>
                    <NestingPreview analisis={analisis} />
                    {analisis.nesting.optimizacionAgotada ? (
                      <div className={styles.nestingNote}>
                        GrafoNest alcanzó el límite de optimización y conservó
                        el mejor acomodo válido. Este resultado calcula el
                        precio.
                      </div>
                    ) : null}
                  </>
                ) : null}
                {procesando ? (
                  <OpenNestLoading
                    compact
                    status={estadoCalculo}
                    progress={progresoCalculo}
                  />
                ) : null}
                <footer className={styles.nestingFooter}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    data-cotizacion-action="generar-nesting"
                    disabled={!placa || procesando || anchoCm <= 0}
                    onClick={calcularNesting}
                  >
                    {procesando ? (
                      <LoaderCircleIcon
                        className={styles.spinner}
                        aria-hidden="true"
                      />
                    ) : (
                      <PlayIcon aria-hidden="true" />
                    )}
                    {procesando
                      ? "Calculando…"
                      : nestingActualizado
                        ? "Regenerar nesting"
                        : "Generar nesting"}
                  </button>
                  {analisis && nestingActualizado && unionesFisicas > 0 ? (
                    <span className={styles.joinNote}>
                      {analisis.nesting.segmentos} partes · {unionesFisicas}{" "}
                      {unionesFisicas === 1 ? "unión" : "uniones"}
                    </span>
                  ) : null}
                </footer>
              </section>
            ) : null}

            {error ? (
              <div className={styles.errorBox} role="alert">
                <AlertCircleIcon aria-hidden="true" />
                <div>
                  <strong>No se puede cotizar este vector</strong>
                  <span>{error}</span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </MarcoGeometriaGrafoprint>
  );
}

function analisisCoincideConEntrada({
  analisis,
  fuente,
  anchoFinalMm,
  cantidad,
  placa,
  margenMm,
  preservarComposicionOriginalSiEntra,
  configuracionEncastres,
}: {
  analisis: AnalisisSvgFabricacion | null;
  fuente: FuenteDisenoVectorial;
  anchoFinalMm: number;
  cantidad: number;
  placa: { anchoMm: number; altoMm: number };
  margenMm: number;
  preservarComposicionOriginalSiEntra: boolean;
  configuracionEncastres: ConfiguracionEncastresVectoriales;
}): boolean {
  if (
    !analisis ||
    analisis.nombreArchivo !== fuente.nombreArchivo ||
    fuente.schemaVersion !== 1 ||
    fuente.configuracionCapas ||
    ((analisis.nesting.motorNesting === "opennest-v1" ||
      analisis.nesting.motorNesting === "grafonest-baseline-v1") &&
      analisis.nesting.versionPoliticaOrientacion !==
        VERSION_POLITICA_ORIENTACION_GRAFONEST)
  )
    return false;
  const expectedPlacements =
    analisis.nesting.segmentos ??
    analisis.geometria.piezas.length * Math.max(1, Math.ceil(cantidad));
  const entraComposicion =
    analisis.geometria.anchoMm <= placa.anchoMm - margenMm * 2 + 0.001 &&
    analisis.geometria.altoMm <= placa.altoMm - margenMm * 2 + 0.001;
  const estrategiaEsperada =
    preservarComposicionOriginalSiEntra && entraComposicion
      ? "composicion_original"
      : "nesting_optimizado";
  return (
    Math.abs(analisis.geometria.anchoMm - anchoFinalMm) < 0.01 &&
    analisis.nesting.anchoPlacaMm === placa.anchoMm &&
    analisis.nesting.altoPlacaMm === placa.altoMm &&
    Math.abs(analisis.nesting.anchoUtilMm - (placa.anchoMm - margenMm * 2)) <
      0.01 &&
    Math.abs(analisis.nesting.altoUtilMm - (placa.altoMm - margenMm * 2)) <
      0.01 &&
    analisis.nesting.placements.length === expectedPlacements &&
    analisis.nesting.estrategiaDisposicion === estrategiaEsperada &&
    JSON.stringify(analisis.configuracionEncastres) ===
      JSON.stringify(configuracionEncastres)
  );
}

function etiquetaEstadoCalculo(trabajo: TrabajoAnalisisVectorial): string {
  if (trabajo.estado === "pendiente") return "En cola…";
  if (trabajo.estado === "procesando") {
    return trabajo.progreso.etapa === "validando"
      ? "Validando solución…"
      : `Nestando… ${Math.round(trabajo.progreso.porcentaje)}%`;
  }
  if (trabajo.estado === "completado") return "GrafoNest";
  return "No completado";
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <dl className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

function redondearMedida(value: number) {
  return Math.round(value * 100) / 100;
}

function NestingPreview({ analisis }: { analisis: AnalisisSvgFabricacion }) {
  const { nesting } = analisis;
  const shown = Math.min(nesting.placas, 8);
  return (
    <div className={styles.preview}>
      <div className={styles.previewHead}>
        <div className={styles.previewCopy}>
          <strong>Distribución en placas</strong>
          <span>
            {nesting.estrategiaDisposicion === "composicion_original"
              ? "Composición original centrada para conservar el negativo"
              : "Vista previa del nesting automático"}
          </span>
        </div>
        {nesting.placas > shown ? (
          <span className={styles.status}>
            Primeras {shown} de {nesting.placas} placas
          </span>
        ) : null}
      </div>
      <div className={styles.previewGrid}>
        {Array.from({ length: shown }, (_, substrateIndex) => {
          const placements = nesting.placements.filter(
            (placement) => placement.substrateIndex === substrateIndex,
          );
          return (
            <figure key={substrateIndex} className={styles.plate}>
              <figcaption className={styles.previewCaption}>
                <strong>Placa {substrateIndex + 1}</strong>
                <span>
                  {placements.length}{" "}
                  {placements.length === 1 ? "ubicación" : "ubicaciones"}
                </span>
              </figcaption>
              <svg
                viewBox={`0 0 ${nesting.anchoPlacaMm} ${nesting.altoPlacaMm}`}
                role="img"
                aria-label={`Distribución de la placa ${substrateIndex + 1}`}
              >
                {placements.flatMap((placement) =>
                  placement.contornos.map((contorno, contourIndex) => (
                    <polygon
                      key={`${placement.pieceId}-${placement.copyIndex}-${contourIndex}`}
                      points={contorno.puntos
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill={
                        contorno.esHueco
                          ? "var(--background)"
                          : "var(--primary)"
                      }
                      fillOpacity={contorno.esHueco ? 1 : 0.18}
                      stroke="var(--primary)"
                      strokeWidth={1.5}
                      strokeLinejoin="miter"
                      strokeLinecap="square"
                      vectorEffect="non-scaling-stroke"
                    />
                  )),
                )}
                {placements.flatMap((placement) =>
                  (placement.cortesInternos ?? []).map(
                    (contorno, contourIndex) => (
                      <polygon
                        key={`${placement.pieceId}-${placement.copyIndex}-interno-${contourIndex}`}
                        points={contorno.puntos
                          .map((p) => `${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth={1.5}
                        strokeLinejoin="miter"
                        strokeLinecap="square"
                        vectorEffect="non-scaling-stroke"
                      />
                    ),
                  ),
                )}
              </svg>
              <span className={styles.plateSize}>
                {formatNumber(nesting.anchoPlacaMm / 10)} ×{" "}
                {formatNumber(nesting.altoPlacaMm / 10)} cm
              </span>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
