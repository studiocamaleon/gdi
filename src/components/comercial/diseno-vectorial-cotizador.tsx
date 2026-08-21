"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileUpIcon,
  LoaderCircleIcon,
  ShapesIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  analizarSvgFabricacion,
  type AnalisisSvgFabricacion,
} from "@/lib/productos-servicios-api";

export type FuenteDisenoVectorial = {
  schemaVersion: 1;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
};

type Props = {
  value: FuenteDisenoVectorial | null;
  analisis: AnalisisSvgFabricacion | null;
  cantidad: number;
  placa: { anchoMm: number; altoMm: number } | null;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  onChange: (
    value: FuenteDisenoVectorial | null,
    analisis: AnalisisSvgFabricacion | null,
  ) => void;
};

export function DisenoVectorialCotizador({
  value,
  analisis,
  cantidad,
  placa,
  margenMm = 5,
  separacionMm = 5,
  permitirRotacion = true,
  preservarComposicionOriginalSiEntra = false,
  onChange,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [anchoCm, setAnchoCm] = React.useState(
    value ? value.anchoFinalMm / 10 : 100,
  );

  const analizar = React.useCallback(
    async (fuente: FuenteDisenoVectorial, nextCantidad = cantidad) => {
      if (!placa) {
        setError("Seleccioná primero una placa con ancho y alto configurados.");
        return;
      }
      setProcesando(true);
      setError(null);
      try {
        const result = await analizarSvgFabricacion({
          svg: fuente.svg,
          nombreArchivo: fuente.nombreArchivo,
          anchoFinalMm: fuente.anchoFinalMm,
          altoFinalMm: fuente.altoFinalMm,
          cantidad: Math.max(1, Math.ceil(nextCantidad)),
          anchoPlacaMm: placa.anchoMm,
          altoPlacaMm: placa.altoMm,
          margenMm,
          separacionMm,
          permitirRotacion,
          preservarComposicionOriginalSiEntra,
        });
        const normalized: FuenteDisenoVectorial = {
          ...fuente,
          altoFinalMm: result.geometria.altoMm,
        };
        onChange(normalized, result);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "No se pudo analizar el archivo vectorial.";
        setError(message);
        onChange(fuente, null);
      } finally {
        setProcesando(false);
      }
    },
    [
      cantidad,
      margenMm,
      onChange,
      permitirRotacion,
      placa,
      preservarComposicionOriginalSiEntra,
      separacionMm,
    ],
  );

  const cargarArchivo = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg")) {
      setError("El archivo debe tener extensión SVG.");
      return;
    }
    const svg = await file.text();
    const fuente: FuenteDisenoVectorial = {
      schemaVersion: 1,
      nombreArchivo: file.name,
      svg,
      anchoFinalMm: Math.max(10, anchoCm * 10),
    };
    await analizar(fuente);
  };

  React.useEffect(() => {
    if (!value || !placa || procesando) return;
    if (
      analisisCoincideConEntrada({
        analisis,
        fuente: value,
        anchoFinalMm: Math.max(10, anchoCm * 10),
        cantidad,
        placa,
        margenMm,
        preservarComposicionOriginalSiEntra,
      })
    )
      return;
    const timer = window.setTimeout(() => {
      void analizar(
        {
          ...value,
          anchoFinalMm: Math.max(10, anchoCm * 10),
          altoFinalMm: undefined,
        },
        cantidad,
      );
    }, 350);
    return () => window.clearTimeout(timer);
    // `analizar` cambia cuando cambia cantidad/placa; eso es justamente lo que
    // debe volver a calcular el consumo. `procesando` no debe rearmar el timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analisis,
    anchoCm,
    cantidad,
    margenMm,
    preservarComposicionOriginalSiEntra,
    placa?.anchoMm,
    placa?.altoMm,
    value,
  ]);

  return (
    <Card
      size="sm"
      data-testid="diseno-vectorial-card"
      className="@container/vector col-span-full w-full"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShapesIcon /> Diseño vectorial
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">SVG</Badge>
        </CardAction>
        <CardDescription>
          Cargá el vector terminado para calcular piezas, corte y placas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">
          <Field>
            <FieldLabel htmlFor="vector-final-width">
              Ancho final del cartel
            </FieldLabel>
            <Input
              id="vector-final-width"
              type="number"
              min={1}
              step={0.1}
              value={anchoCm}
              onChange={(event) => setAnchoCm(Number(event.target.value) || 0)}
            />
            <FieldDescription>
              En centímetros. El alto conserva la proporción.
            </FieldDescription>
          </Field>
          <Field data-disabled={!placa}>
            <FieldLabel>Placa seleccionada</FieldLabel>
            <Input
              disabled
              value={
                placa
                  ? `${placa.anchoMm / 10} × ${placa.altoMm / 10} cm`
                  : "Sin placa configurada"
              }
            />
            <FieldDescription>
              Definida por el espesor y color elegidos.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <input
          ref={inputRef}
          type="file"
          accept="image/svg+xml,.svg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void cargarArchivo(file);
            event.target.value = "";
          }}
        />
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileUpIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {value ? "Archivo vectorial cargado" : "Archivo de producción"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {value?.nombreArchivo ??
                  "SVG de una capa y textos convertidos a curvas"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={value ? "outline" : "default"}
            disabled={!placa || procesando}
            onClick={() => inputRef.current?.click()}
            className="w-full"
          >
            {procesando ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <FileUpIcon data-icon="inline-start" />
            )}
            {procesando
              ? "Analizando vector…"
              : value
                ? "Reemplazar archivo"
                : "Seleccionar archivo SVG"}
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>No se puede cotizar este vector</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {analisis ? (
          <>
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>Vector listo para cotizar</AlertTitle>
              <AlertDescription className="min-w-0">
                <span className="block truncate">{analisis.nombreArchivo}</span>
                <span className="block">
                  {analisis.geometria.piezas.length}{" "}
                  {analisis.geometria.piezas.length === 1 ? "pieza" : "piezas"}{" "}
                  · {formatNumber(analisis.geometria.anchoMm / 10)} ×{" "}
                  {formatNumber(analisis.geometria.altoMm / 10)} cm
                </span>
              </AlertDescription>
            </Alert>
            {analisis.nesting.estrategiaDisposicion ===
            "composicion_original" ? (
              <Alert>
                <ShapesIcon />
                <AlertTitle>Composición original conservada</AlertTitle>
                <AlertDescription>
                  El diseño entra completo: las piezas mantienen su posición y
                  orientación para que el negativo de la placa pueda utilizarse
                  como molde de colocación.
                </AlertDescription>
              </Alert>
            ) : preservarComposicionOriginalSiEntra ? (
              <Alert>
                <ShapesIcon />
                <AlertTitle>Nesting optimizado por tamaño</AlertTitle>
                <AlertDescription>
                  El diseño completo no entra en el área útil; se aplicó el
                  acomodo optimizado y, cuando corresponde, la segmentación con
                  encastres.
                </AlertDescription>
              </Alert>
            ) : null}
            {analisis.diagnosticos.some(
              (diagnostico) => diagnostico.severidad === "WARNING",
            ) ? (
              <Alert>
                <AlertCircleIcon />
                <AlertTitle>Vector optimizado para cotizar</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {analisis.diagnosticos
                      .filter(
                        (diagnostico) => diagnostico.severidad === "WARNING",
                      )
                      .slice(0, 3)
                      .map((diagnostico) => (
                        <li
                          key={`${diagnostico.codigo}-${diagnostico.mensaje}`}
                        >
                          {diagnostico.mensaje}
                        </li>
                      ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2">
              <Metric
                label="Placas necesarias"
                value={analisis.nesting.placas}
              />
              <Metric
                label="Corte total"
                value={`${formatNumber(
                  (analisis.nesting.perimetroCorteMm ??
                    analisis.geometria.perimetroTotalMm * cantidad) / 1_000,
                )} m`}
              />
              <Metric
                label={
                  (analisis.nesting.segmentos ?? 0) >
                  (analisis.nesting.piezasOriginales ?? 0)
                    ? "Partes a cortar"
                    : "Piezas por cartel"
                }
                value={
                  analisis.nesting.segmentos ??
                  analisis.geometria.piezas.length * cantidad
                }
              />
              <Metric
                label="Pedido"
                value={`${cantidad} ${cantidad === 1 ? "cartel" : "carteles"}`}
              />
            </div>
            {(analisis.nesting.uniones?.length ?? 0) > 0 ? (
              <Alert>
                <ShapesIcon />
                <AlertTitle>
                  El cartel se fabricará en partes encastrables
                </AlertTitle>
                <AlertDescription>
                  {analisis.nesting.segmentos} partes ·{" "}
                  {analisis.nesting.unionesFisicas ??
                    (analisis.nesting.uniones?.length ?? 0) * cantidad}{" "}
                  {(analisis.nesting.unionesFisicas ??
                    (analisis.nesting.uniones?.length ?? 0) * cantidad) === 1
                    ? "unión"
                    : "uniones"}{" "}
                  · encastres cola de milano de 3 × 3 cm. El corte adicional
                  ya está incluido en el cálculo.
                </AlertDescription>
              </Alert>
            ) : null}
            <Progress
              value={Math.min(100, analisis.nesting.aprovechamientoPct)}
              aria-label="Aprovechamiento de las placas"
            >
              <ProgressLabel>Aprovechamiento del material</ProgressLabel>
              <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                {formatNumber(analisis.nesting.aprovechamientoPct)}%
              </span>
            </Progress>
            <NestingPreview analisis={analisis} />
          </>
        ) : null}
      </CardContent>
    </Card>
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
}: {
  analisis: AnalisisSvgFabricacion | null;
  fuente: FuenteDisenoVectorial;
  anchoFinalMm: number;
  cantidad: number;
  placa: { anchoMm: number; altoMm: number };
  margenMm: number;
  preservarComposicionOriginalSiEntra: boolean;
}): boolean {
  if (!analisis || analisis.nombreArchivo !== fuente.nombreArchivo)
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
    analisis.nesting.estrategiaDisposicion === estrategiaEsperada
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <dl className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3">
      <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </dl>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

function NestingPreview({ analisis }: { analisis: AnalisisSvgFabricacion }) {
  const { nesting } = analisis;
  const shown = Math.min(nesting.placas, 8);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Distribución en placas</span>
          <span className="text-xs text-muted-foreground">
            {nesting.estrategiaDisposicion === "composicion_original"
              ? "Composición original centrada para conservar el negativo"
              : "Vista previa del nesting automático"}
          </span>
        </div>
        {nesting.placas > shown ? (
          <Badge variant="secondary">
            Primeras {shown} de {nesting.placas} placas
          </Badge>
        ) : null}
      </div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        {Array.from({ length: shown }, (_, substrateIndex) => {
          const placements = nesting.placements.filter(
            (placement) => placement.substrateIndex === substrateIndex,
          );
          return (
            <figure
              key={substrateIndex}
              className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/20 p-2"
            >
              <figcaption className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">Placa {substrateIndex + 1}</span>
                <span className="text-muted-foreground">
                  {placements.length}{" "}
                  {placements.length === 1 ? "pieza" : "piezas"}
                </span>
              </figcaption>
              <svg
                viewBox={`0 0 ${nesting.anchoPlacaMm} ${nesting.altoPlacaMm}`}
                role="img"
                aria-label={`Distribución de la placa ${substrateIndex + 1}`}
                className="h-auto w-full rounded-md border bg-background"
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
              </svg>
              <span className="text-center text-xs text-muted-foreground">
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
