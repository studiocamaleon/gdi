"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { normalizarFuenteVectorial } from "@/lib/productos-servicios-api";
import { registrarImportacionDxf } from "@/lib/escala-dxf";
import { obtenerRelacionAspectoSvg } from "@/lib/producto-geometrias";
import {
  ControlArchivoVectorial,
  MarcoGeometriaGrafoprint,
  type FuenteVectorialCotizada,
} from "./geometrias-vectoriales-cotizacion";
import { EscalaDxf } from "./escala-dxf";
import styles from "./geometrias-vectoriales-cotizacion.module.css";

/** Una fuente completa se hereda por cada material; el motor de cada
 * componente decide placa, máquina, rotación y división de los contornos. */
export function DisenoCompartidoCotizacion({
  titulo,
  value,
  permitirReemplazo = true,
  reemplazaPiezas = false,
  onChange,
  onProcesandoChange,
}: {
  titulo: string;
  value?: FuenteVectorialCotizada;
  permitirReemplazo?: boolean;
  reemplazaPiezas?: boolean;
  onChange: (value: FuenteVectorialCotizada) => void;
  onProcesandoChange: (value: boolean) => void;
}) {
  const analisis = useCapacidad("analisis_vectorial");
  const nesting = useCapacidad("nesting_irregular");
  const habilitado = analisis && nesting;
  const id = useId();
  const [anchoInicialCm, setAnchoInicialCm] = useState(100);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const avisar = useRef(onProcesandoChange);
  avisar.current = onProcesandoChange;
  const solicitud = useRef(0);
  const invalida = value ? !(value.anchoFinalMm > 0) : !(anchoInicialCm > 0);
  useEffect(() => {
    avisar.current(procesando || invalida);
  }, [procesando, invalida]);
  useEffect(
    () => () => {
      solicitud.current++;
      avisar.current(false);
    },
    [],
  );

  async function cargar(file: File) {
    const actual = ++solicitud.current;
    setProcesando(true);
    setError("");
    try {
      const normalizada = await normalizarFuenteVectorial({
        contenido: await file.text(),
        nombreArchivo: file.name,
      });
      if (actual !== solicitud.current) return;
      const anchoFinalMm =
        normalizada.formatoOrigen === "DXF"
          ? normalizada.anchoSugeridoMm
          : (value?.anchoFinalMm ?? anchoInicialCm * 10);
      onChange({
        schemaVersion: 1,
        nombreArchivo: file.name,
        svg: normalizada.svg,
        anchoFinalMm,
        altoFinalMm: anchoFinalMm * normalizada.relacionAltoAncho,
        relacionAltoAncho: normalizada.relacionAltoAncho,
        formatoOrigen: normalizada.formatoOrigen,
        unidadOrigen: normalizada.unidadDetectada,
        importacionDxf: registrarImportacionDxf(normalizada),
      });
    } catch (cause) {
      if (actual === solicitud.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo interpretar el archivo.",
        );
    } finally {
      if (actual === solicitud.current) setProcesando(false);
    }
  }

  const proporcion =
    value?.relacionAltoAncho ?? obtenerRelacionAspectoSvg(value?.svg);
  const anchoCm = value ? value.anchoFinalMm / 10 : anchoInicialCm;
  const altoCm = value
    ? (value.altoFinalMm ?? value.anchoFinalMm * proporcion) / 10
    : null;
  const fija = !permitirReemplazo || Boolean(value?.procedencia);
  const numero = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return (
    <MarcoGeometriaGrafoprint
      titulo={titulo}
      descripcion="Cargá el diseño una vez e indicá su medida final. Cada material se calcula con su propia placa y máquina."
    >
      <div className={styles.editorBody}>
        {!habilitado && (
          <p>
            El análisis vectorial y el nesting irregular deben estar incluidos
            en tu plan.
          </p>
        )}
        <FieldGroup>
          <Field data-invalid={invalida}>
            <FieldLabel htmlFor={id}>Ancho final del diseño (cm)</FieldLabel>
            <Input
              id={id}
              type="number"
              min={0.1}
              step="any"
              disabled={!habilitado || procesando || fija}
              aria-invalid={invalida}
              value={anchoCm || ""}
              onChange={(event) => {
                const ancho = Number(event.target.value);
                setAnchoInicialCm(ancho);
                if (value)
                  onChange({
                    ...value,
                    anchoFinalMm: ancho * 10,
                    altoFinalMm: ancho * 10 * proporcion,
                  });
              }}
            />
            <FieldDescription>
              {altoCm == null
                ? "El alto se ajusta automáticamente al cargar el archivo."
                : `Alto proporcional: ${numero(altoCm)} cm. Se conserva la proporción del diseño completo.`}
            </FieldDescription>
          </Field>
        </FieldGroup>
        {value && !fija && (
          <EscalaDxf
            value={value}
            onChange={(medidas) => onChange({ ...value, ...medidas })}
          />
        )}
        {/* SVG local normalizado; no requiere optimización de imágenes remotas. */}
        {value?.svg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="max-h-40 w-full object-contain"
            alt={`Diseño completo: ${value.nombreArchivo}`}
            src={`data:image/svg+xml,${encodeURIComponent(value.svg)}`}
          />
        )}
        {permitirReemplazo ? (
          <ControlArchivoVectorial
            etiqueta={
              reemplazaPiezas
                ? "Diseño completo para reemplazar las piezas"
                : "Diseño compartido"
            }
            nombreArchivo={value?.nombreArchivo}
            formatoOrigen={value?.formatoOrigen}
            procesando={procesando}
            disabled={!habilitado || procesando}
            onSelect={cargar}
          />
        ) : (
          <p>
            {value
              ? `Archivo fijo: ${value.nombreArchivo}.`
              : "Piezas fijas de la receta."}{" "}
            Se conserva la interpretación de la receta.
          </p>
        )}
        {reemplazaPiezas && (
          <p className="text-sm text-muted-foreground">
            Al cargar un diseño completo se reemplazan las piezas de esta
            fuente. Las otras fuentes del producto se conservan.
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </MarcoGeometriaGrafoprint>
  );
}
