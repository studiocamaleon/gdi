"use client";

import * as React from "react";
import Image from "next/image";
import {
  DownloadIcon,
  FileArchiveIcon,
  FileCode2Icon,
  FileTextIcon,
  Grid2X2Icon,
  PrinterIcon,
  RefreshCwIcon,
  RulerIcon,
  ScanLineIcon,
  ScissorsIcon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  descargaArchivoInstalacionHref,
  descargaPlantillaInstalacionHref,
  getPlantillaInstalacion,
  type ConfiguracionPlantillaInstalacion,
  type PlantillaInstalacion,
} from "@/lib/recorridos-vectoriales-api";

const DEFAULT_CONFIG: ConfiguracionPlantillaInstalacion = {
  bordeMm: 50,
  anchoPanelMm: 1200,
  altoPanelMm: 600,
  solapeMm: 20,
};

export function PlantillaInstalacionPanel({ itemId }: { itemId: string }) {
  const [draft, setDraft] = React.useState(() => ({
    bordeMm: "50",
    anchoPanelMm: "1200",
    altoPanelMm: "600",
    solapeMm: "20",
  }));
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const [data, setData] = React.useState<PlantillaInstalacion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(
    async (next: ConfiguracionPlantillaInstalacion) => {
      setLoading(true);
      setError("");
      try {
        setData(await getPlantillaInstalacion(itemId, next));
        setConfig(next);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo generar la plantilla de instalación.",
        );
      } finally {
        setLoading(false);
      }
    },
    [itemId],
  );

  React.useEffect(() => {
    let cancelled = false;
    getPlantillaInstalacion(itemId, DEFAULT_CONFIG)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo generar la plantilla de instalación.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const apply = () => {
    const next = {
      bordeMm: parseNumber(draft.bordeMm),
      anchoPanelMm: parseNumber(draft.anchoPanelMm),
      altoPanelMm: parseNumber(draft.altoPanelMm),
      solapeMm: parseNumber(draft.solapeMm),
    };
    if (
      next.bordeMm < 0 ||
      next.anchoPanelMm < 100 ||
      next.altoPanelMm < 100 ||
      next.solapeMm < 0 ||
      next.solapeMm >= next.anchoPanelMm ||
      next.solapeMm >= next.altoPanelMm
    ) {
      setError(
        "Revisá las medidas: los paneles deben medir al menos 100 mm y el solape debe ser menor que ambos lados.",
      );
      return;
    }
    void load(next);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RulerIcon className="size-4 shrink-0" /> Plantilla de instalación
        </CardTitle>
        <CardDescription>
          Negativo 1:1 generado desde la composición original, sin depender del
          nesting de fabricación.
        </CardDescription>
        <CardAction>
          {data ? (
            <a
              className={buttonVariants({ size: "sm" })}
              href={descargaArchivoInstalacionHref(itemId, config, "paquete")}
            >
              <FileArchiveIcon data-icon="inline-start" />
              Descargar paquete
            </a>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo preparar la plantilla</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MeasureField
            id={`${itemId}-template-border`}
            label="Borde del negativo"
            value={draft.bordeMm}
            onChange={(value) =>
              setDraft((current) => ({ ...current, bordeMm: value }))
            }
          />
          <MeasureField
            id={`${itemId}-template-width`}
            label="Ancho máximo del panel"
            value={draft.anchoPanelMm}
            onChange={(value) =>
              setDraft((current) => ({ ...current, anchoPanelMm: value }))
            }
          />
          <MeasureField
            id={`${itemId}-template-height`}
            label="Alto máximo del panel"
            value={draft.altoPanelMm}
            onChange={(value) =>
              setDraft((current) => ({ ...current, altoPanelMm: value }))
            }
          />
          <MeasureField
            id={`${itemId}-template-overlap`}
            label="Solape entre paneles"
            value={draft.solapeMm}
            onChange={(value) =>
              setDraft((current) => ({ ...current, solapeMm: value }))
            }
          />
        </FieldGroup>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={apply}
          >
            <RefreshCwIcon
              data-icon="inline-start"
              className={loading ? "animate-spin" : undefined}
            />
            Actualizar paneles
          </Button>
        </div>

        {loading && !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Diseño final"
                value={`${format(data.anchoDisenoMm)} × ${format(data.altoDisenoMm)} mm`}
              />
              <Metric
                label="Negativo"
                value={`${format(data.anchoPlantillaMm)} × ${format(data.altoPlantillaMm)} mm`}
              />
              <Metric label="Piezas" value={String(data.cantidadPiezas)} />
              <Metric label="Paneles" value={String(data.paneles.length)} />
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Vista de colocación</CardTitle>
                <CardDescription>
                  Así queda la composición original dentro de la plantilla. No
                  representa el nesting usado para fabricar las letras.
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary">Vista explicativa</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="overflow-auto rounded-lg border bg-muted/20 p-3">
                  <Image
                    unoptimized
                    width={1200}
                    height={Math.max(
                      240,
                      Math.round(
                        (1200 * data.altoPlantillaMm) /
                          data.anchoPlantillaMm,
                      ),
                    )}
                    className="max-h-[38rem] min-h-60 w-full object-contain"
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.previewSvg)}`}
                    alt="Plano de la plantilla con material, huecos, paneles, ejes y piezas identificadas"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Gris · material que queda</Badge>
                  <Badge variant="outline">Blanco · retirar</Badge>
                  <Badge variant="outline">Rojo · línea de corte</Badge>
                  <Badge variant="outline">Azul · paneles</Badge>
                  <Badge variant="outline">Celeste · centro y nivel</Badge>
                  {data.cantidadUniones > 0 ? (
                    <Badge variant="outline">Naranja · uniones</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Los círculos P1, P2… identifican cada pieza en su posición
                  final. Para producción usá los archivos PDF, DXF, EPS o SVG
                  descargables debajo.
                </p>
              </CardContent>
            </Card>
            <Separator />
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileArchiveIcon className="size-4 shrink-0" /> Archivos de
                  instalación
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Descargá el paquete completo o solamente el archivo que
                  necesita la instalación.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DownloadCard
                  icon={RulerIcon}
                  title="Plano general acotado"
                  description="Vista general, medidas, centro, nivel, piezas y uniones."
                  extension="PDF"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "plano-pdf",
                  )}
                />
                <DownloadCard
                  icon={PrinterIcon}
                  title="Plantilla para plotter"
                  description="Página de medida completa para imprimir a escala 1:1."
                  extension="PDF"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "papel-plotter-pdf",
                  )}
                />
                <DownloadCard
                  icon={Grid2X2Icon}
                  title="Plantilla mosaico A4"
                  description="Hojas solapadas, numeradas y con marcas de registro."
                  extension="PDF"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "papel-mosaico-pdf",
                  )}
                />
                <DownloadCard
                  icon={ScissorsIcon}
                  title="Plantilla rígida"
                  description="Contornos cerrados y capas para láser o CNC."
                  extension="DXF"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "rigida-dxf",
                  )}
                />
                <DownloadCard
                  icon={FileCode2Icon}
                  title="Plantilla para vinilo"
                  description="Composición original para software de plotter de corte."
                  extension="EPS"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "vinilo-eps",
                  )}
                />
                <DownloadCard
                  icon={ScanLineIcon}
                  title="Patrón perforado"
                  description="Contornos para configurar como pounce en la máquina."
                  extension="DXF"
                  href={descargaArchivoInstalacionHref(
                    itemId,
                    config,
                    "pounce-dxf",
                  )}
                />
                <DownloadCard
                  icon={FileTextIcon}
                  title="Respaldo vectorial"
                  description="Negativo completo para edición o compatibilidad."
                  extension="SVG"
                  href={descargaPlantillaInstalacionHref(itemId, config)}
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Grid2X2Icon className="size-4 shrink-0" /> Archivos panelizados
              </div>
              <div className="flex flex-wrap gap-2">
                {data.paneles.flatMap((panel) => [
                  <a
                    key={`dxf-${panel.indice}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    href={descargaArchivoInstalacionHref(
                      itemId,
                      config,
                      "rigida-dxf",
                      panel.indice,
                    )}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    Panel {panel.indice + 1} DXF · {format(panel.anchoMm)} ×{" "}
                    {format(panel.altoMm)} mm
                  </a>,
                  <a
                    key={`svg-${panel.indice}`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                    })}
                    href={descargaPlantillaInstalacionHref(
                      itemId,
                      config,
                      panel.indice,
                    )}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    SVG {panel.indice + 1}
                  </a>,
                ])}
              </div>
              <p className="text-xs text-muted-foreground">
                Rojo: corte. Azul: centro, nivel y control de 100 mm. Naranja:
                uniones de piezas segmentadas. Las guías no deben cortarse.
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DownloadCard({
  icon: Icon,
  title,
  description,
  extension,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  extension: string;
  href: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant="outline">{extension}</Badge>
          <a
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            href={href}
            aria-label={`Descargar ${title} en ${extension}`}
          >
            <DownloadIcon />
          </a>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function MeasureField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>Milímetros</FieldDescription>
    </Field>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function parseNumber(value: string) {
  const result = Number(value.replace(",", "."));
  return Number.isFinite(result) ? result : -1;
}

function format(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(
    value,
  );
}
