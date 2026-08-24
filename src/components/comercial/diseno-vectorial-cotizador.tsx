"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  FileUpIcon,
  Layers3Icon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  PlayIcon,
  ShapesIcon,
  Trash2Icon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  analizarSvgFabricacion,
  type AnalisisSvgFabricacion,
  type ConfiguracionCapasVectoriales,
  type ConfiguracionEncastresVectoriales,
} from "@/lib/productos-servicios-api";

import s from "./diseno-vectorial-cotizador.module.css";

export type FuenteDisenoVectorial = {
  schemaVersion: 1 | 2;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  configuracionCapas?: ConfiguracionCapasVectoriales;
};

export type CotizacionVectorialManual = {
  placas: number;
  metrosCortePorPlaca: number;
};

type Props = {
  value: FuenteDisenoVectorial | null;
  analisis: AnalisisSvgFabricacion | null;
  modoCotizacion: "svg" | "placas";
  cotizacionManual: CotizacionVectorialManual;
  cantidad: number;
  placa: { anchoMm: number; altoMm: number } | null;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  configuracionEncastres: ConfiguracionEncastresVectoriales;
  onChange: (
    value: FuenteDisenoVectorial | null,
    analisis: AnalisisSvgFabricacion | null,
  ) => void;
  onModoCotizacionChange: (modo: "svg" | "placas") => void;
  onCotizacionManualChange: (value: CotizacionVectorialManual) => void;
};

export function DisenoVectorialCotizador({
  value,
  analisis,
  modoCotizacion,
  cotizacionManual,
  cantidad,
  placa,
  margenMm = 5,
  separacionMm = 5,
  permitirRotacion = true,
  preservarComposicionOriginalSiEntra = false,
  configuracionEncastres,
  onChange,
  onModoCotizacionChange,
  onCotizacionManualChange,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = React.useState(false);
  const [preparandoCapas, setPreparandoCapas] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editorAbierto, setEditorAbierto] = React.useState(false);
  const [medidaIngresada, setMedidaIngresada] = React.useState<
    "ancho" | "alto"
  >("ancho");
  const [analisisEditor, setAnalisisEditor] =
    React.useState<AnalisisSvgFabricacion | null>(null);
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
      setProcesando(true);
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
          preservarComposicionOriginalSiEntra,
          configuracionEncastres,
          configuracionCapas: fuente.configuracionCapas,
        };
        let result = await analizarSvgFabricacion(request);
        const configuracionCapas = normalizarConfiguracionCapas(
          fuente.configuracionCapas,
          result,
        );
        if (
          JSON.stringify(result.configuracionCapas) !==
          JSON.stringify(configuracionCapas)
        ) {
          result = await analizarSvgFabricacion({
            ...request,
            configuracionCapas,
          });
        }
        const normalized: FuenteDisenoVectorial = {
          ...fuente,
          altoFinalMm: result.geometria.altoMm,
          configuracionCapas,
        };
        setAltoCm(redondearMedida(result.geometria.altoMm / 10));
        onChange(normalized, {
          ...result,
          configuracionCapas: result.configuracionCapas ?? configuracionCapas,
        });
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
      configuracionEncastres,
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
    const relacionAspecto = obtenerRelacionAspectoSvg(svg);
    const nextAltoCm = redondearMedida(anchoCm * relacionAspecto);
    const fuente: FuenteDisenoVectorial = {
      schemaVersion: 2,
      nombreArchivo: file.name,
      svg,
      anchoFinalMm: Math.max(10, anchoCm * 10),
      altoFinalMm: Math.max(10, nextAltoCm * 10),
    };
    setAltoCm(nextAltoCm);
    setAnalisisEditor(null);
    setError(null);
    onChange(fuente, null);
    void prepararEditorCapas(fuente);
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
  const configuracionCapasActualizada = Boolean(
    value &&
    analisis &&
    firmaFabricacionCapas(value.configuracionCapas) ===
      firmaFabricacionCapas(analisis.configuracionCapas),
  );
  const nestingActualizado =
    analisisActualizado && configuracionCapasActualizada;
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

  const relacionAspectoActual = analisisEditor
    ? analisisEditor.geometria.altoMm / analisisEditor.geometria.anchoMm
    : analisis
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

  const prepararEditorCapas = React.useCallback(
    async (fuente: FuenteDisenoVectorial) => {
      if (!placa || preparandoCapas) return;
      setPreparandoCapas(true);
      setError(null);
      try {
        const result = await analizarSvgFabricacion({
          svg: fuente.svg,
          nombreArchivo: fuente.nombreArchivo,
          anchoFinalMm: fuente.anchoFinalMm,
          cantidad: Math.max(1, Math.ceil(cantidad)),
          anchoPlacaMm: placa.anchoMm,
          altoPlacaMm: placa.altoMm,
          margenMm,
          separacionMm,
          permitirRotacion,
          preservarComposicionOriginalSiEntra,
          configuracionEncastres,
          configuracionCapas: fuente.configuracionCapas,
        });
        const configuracionCapas = normalizarConfiguracionCapas(
          fuente.configuracionCapas,
          result,
        );
        const preparado = { ...result, configuracionCapas };
        setAnalisisEditor(preparado);
        setAltoCm(redondearMedida(result.geometria.altoMm / 10));
        onChange(
          {
            ...fuente,
            altoFinalMm: result.geometria.altoMm,
            configuracionCapas,
          },
          null,
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo interpretar el archivo vectorial.",
        );
      } finally {
        setPreparandoCapas(false);
      }
    },
    [
      cantidad,
      configuracionEncastres,
      margenMm,
      onChange,
      permitirRotacion,
      placa,
      preparandoCapas,
      preservarComposicionOriginalSiEntra,
      separacionMm,
    ],
  );

  const tipoCartel =
    (value?.configuracionCapas?.niveles.length ?? 1) > 1 ? "capas" : "una_capa";

  const cambiarTipoCartel = (tipo: "una_capa" | "capas") => {
    if (!value) return;
    const analisisBase = analisisEditor ?? analisis;
    const configuracion = analisisBase
      ? normalizarConfiguracionCapas(value.configuracionCapas, analisisBase)
      : normalizarConfiguracionSinAnalisis(value.configuracionCapas);
    const primera = configuracion.niveles[0];
    const niveles =
      tipo === "una_capa"
        ? [primera]
        : configuracion.niveles.length > 1
          ? configuracion.niveles
          : [
              primera,
              {
                id: "nivel-2",
                nombre: "Frente",
                orden: 2,
                colorVisual: 2,
              },
            ];
    const asignaciones = configuracion.asignaciones.map((asignacion) => ({
      ...asignacion,
      nivelId: tipo === "una_capa" ? primera.id : asignacion.nivelId,
    }));
    const next = normalizarModosPorNivel({
      ...configuracion,
      niveles,
      asignaciones,
    });
    const nextValue = { ...value, configuracionCapas: next };
    setAnalisisEditor(analisisBase);
    onChange(nextValue, null);
    if (tipo === "capas" && !analisisBase) void prepararEditorCapas(nextValue);
  };

  React.useEffect(() => {
    if (
      !editorAbierto ||
      tipoCartel !== "capas" ||
      !value ||
      analisisEditor ||
      analisis ||
      preparandoCapas
    )
      return;
    void prepararEditorCapas(value);
  }, [
    analisis,
    analisisEditor,
    editorAbierto,
    preparandoCapas,
    prepararEditorCapas,
    tipoCartel,
    value,
  ]);

  const analisisParaCapas = analisisEditor ?? analisis;
  const capasDefinidas = Boolean(
    tipoCartel === "capas" &&
    value?.configuracionCapas?.niveles.every((nivel) =>
      value.configuracionCapas?.asignaciones.some(
        (asignacion) => asignacion.nivelId === nivel.id,
      ),
    ),
  );

  return (
    <Card
      size="sm"
      data-testid="diseno-vectorial-card"
      className="@container/vector col-span-full w-full"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShapesIcon />
          {modoCotizacion === "svg" ? "Diseño vectorial" : "Placas y corte"}
        </CardTitle>
        {modoCotizacion === "svg" ? (
          <CardAction>
            <Badge variant="secondary">SVG</Badge>
          </CardAction>
        ) : null}
        <CardDescription>
          {modoCotizacion === "svg"
            ? "Cargá el vector terminado para calcular piezas, corte y placas."
            : "Indicá las placas necesarias y el corte aproximado de cada una."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[modoCotizacion]}
          onValueChange={(values) => {
            const next = values.at(-1);
            if (next === "svg" || next === "placas")
              onModoCotizacionChange(next);
          }}
          aria-label="Modo de cotización del cartel"
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="svg">Con SVG</ToggleGroupItem>
          <ToggleGroupItem value="placas">Por placas</ToggleGroupItem>
        </ToggleGroup>

        {modoCotizacion === "placas" ? (
          <>
            <FieldGroup className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">
              <Field>
                <FieldLabel htmlFor="vector-manual-plates">
                  Placas necesarias
                </FieldLabel>
                <Input
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
              </Field>
              <Field>
                <FieldLabel htmlFor="vector-manual-cut">
                  Corte por placa (m)
                </FieldLabel>
                <Input
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
              </Field>
            </FieldGroup>
            <Metric
              label="Corte total"
              value={`${formatNumber(
                cotizacionManual.placas * cotizacionManual.metrosCortePorPlaca,
              )} m`}
            />
          </>
        ) : (
          <>
            <FieldGroup className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
              <Field>
                <FieldLabel htmlFor="vector-final-size">
                  Medida final del cartel (cm)
                </FieldLabel>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  value={[medidaIngresada]}
                  onValueChange={(values) => {
                    const next = values.at(-1);
                    if (next === "ancho" || next === "alto")
                      setMedidaIngresada(next);
                  }}
                  aria-label="Elegir la medida a ingresar"
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="ancho">Ancho</ToggleGroupItem>
                  <ToggleGroupItem value="alto">Alto</ToggleGroupItem>
                </ToggleGroup>
                <Input
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
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileUpIcon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {value?.nombreArchivo ?? "Archivo de producción"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {value
                      ? "Archivo vectorial cargado"
                      : "SVG con textos convertidos a curvas"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={!placa || procesando || preparandoCapas}
                onClick={() => inputRef.current?.click()}
              >
                <FileUpIcon data-icon="inline-start" />
                {value ? "Reemplazar" : "Seleccionar SVG"}
              </Button>
            </div>

            {value ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers3Icon />
                    {tipoCartel === "capas"
                      ? "Con relieve por capas"
                      : "Un solo nivel"}
                  </CardTitle>
                  <CardAction>
                    <Badge
                      variant={nestingActualizado ? "secondary" : "outline"}
                    >
                      {nestingActualizado ? "Calculado" : "Pendiente"}
                    </Badge>
                  </CardAction>
                  <CardDescription>
                    {tipoCartel === "capas"
                      ? `${value.configuracionCapas?.niveles.length ?? 2} niveles de montaje configurados.`
                      : "Los interiores se obtienen del mismo corte y quedan al ras."}
                  </CardDescription>
                </CardHeader>
                {analisis && nestingActualizado ? (
                  <CardContent className="grid grid-cols-3 gap-2">
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
                  </CardContent>
                ) : null}
                <CardFooter className="flex items-center justify-between gap-3 bg-card">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditorAbierto(true)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Editar capas
                  </Button>
                  {analisis && nestingActualizado && unionesFisicas > 0 ? (
                    <span className="text-right text-xs text-muted-foreground">
                      {analisis.nesting.segmentos} partes · {unionesFisicas}{" "}
                      {unionesFisicas === 1 ? "unión" : "uniones"}
                    </span>
                  ) : null}
                </CardFooter>
              </Card>
            ) : null}

            {error && !editorAbierto ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>No se puede cotizar este vector</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {value ? (
              <Sheet open={editorAbierto} onOpenChange={setEditorAbierto}>
                <SheetContent
                  className="z-[1003] w-full gap-0 sm:!max-w-[720px]"
                  overlayClassName="z-[1002]"
                >
                  <SheetHeader className={s.header}>
                    <SheetTitle>Capas y nesting</SheetTitle>
                    <SheetDescription>
                      Asigná cada forma del diseño a un nivel de montaje.
                    </SheetDescription>
                  </SheetHeader>
                  <div className={s.body}>
                    <section className={s.modeSection}>
                      <ToggleGroup
                        multiple={false}
                        variant="outline"
                        value={[tipoCartel]}
                        onValueChange={(values) => {
                          const next = values.at(-1);
                          if (next === "una_capa" || next === "capas") {
                            cambiarTipoCartel(next);
                          }
                        }}
                        className="grid w-full grid-cols-2"
                      >
                        <ToggleGroupItem value="una_capa">
                          Un solo nivel
                        </ToggleGroupItem>
                        <ToggleGroupItem value="capas">
                          Con relieve por capas
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </section>

                    {preparandoCapas && tipoCartel === "capas" ? (
                      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <LoaderCircleIcon className="animate-spin" />
                        Preparando niveles del diseño…
                      </div>
                    ) : null}

                    {analisisParaCapas && tipoCartel === "capas" ? (
                      <EditorCapasVectoriales
                        fuente={value}
                        analisis={analisisParaCapas}
                        onChange={(configuracionCapas) => {
                          setAnalisisEditor({
                            ...analisisParaCapas,
                            configuracionCapas,
                          });
                          onChange({ ...value, configuracionCapas }, null);
                        }}
                      />
                    ) : null}

                    {value && (tipoCartel === "una_capa" || capasDefinidas) ? (
                      <div className={s.calculationBar}>
                        <Button
                          type="button"
                          disabled={!placa || procesando || anchoCm <= 0}
                          onClick={calcularNesting}
                          className="flex-1"
                        >
                          {procesando ? (
                            <LoaderCircleIcon
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                          ) : (
                            <PlayIcon data-icon="inline-start" />
                          )}
                          {procesando
                            ? "Calculando…"
                            : nestingActualizado
                              ? "Recalcular nesting"
                              : "Calcular nesting"}
                        </Button>
                      </div>
                    ) : null}

                    {error ? (
                      <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertTitle>No se puede cotizar este vector</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : null}

                    {analisis && nestingActualizado ? (
                      <>
                        {analisis.diagnosticos.some(
                          (diagnostico) => diagnostico.severidad === "WARNING",
                        ) ? (
                          <Alert>
                            <AlertCircleIcon />
                            <AlertTitle>
                              Vector optimizado para cotizar
                            </AlertTitle>
                            <AlertDescription>
                              <ul className="list-disc space-y-1 pl-4">
                                {analisis.diagnosticos
                                  .filter(
                                    (diagnostico) =>
                                      diagnostico.severidad === "WARNING",
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
                        <div className={s.resultHeader}>
                          <div>
                            <h3>Resultado del corte</h3>
                            <p className="truncate">{analisis.nombreArchivo}</p>
                          </div>
                          <Badge variant="secondary">Listo para cotizar</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Metric
                            label="Placas"
                            value={analisis.nesting.placas}
                          />
                          <Metric
                            label="Corte total"
                            value={`${formatNumber(
                              (analisis.nesting.perimetroCorteMm ??
                                analisis.geometria.perimetroTotalMm *
                                  cantidad) / 1_000,
                            )} m`}
                          />
                          <Metric
                            label="Aprovechamiento"
                            value={`${formatNumber(analisis.nesting.aprovechamientoPct)}%`}
                          />
                        </div>
                        {(analisis.nesting.uniones?.length ?? 0) > 0 ? (
                          <p className={s.segmentationNote}>
                            <ShapesIcon aria-hidden="true" />
                            Se fabricará en {analisis.nesting.segmentos} partes
                            con {unionesFisicas}{" "}
                            {unionesFisicas === 1 ? "unión" : "uniones"}. El
                            corte adicional ya está incluido.
                          </p>
                        ) : null}
                        <NestingPreview analisis={analisis} />
                      </>
                    ) : null}
                  </div>
                  <SheetFooter className={s.footer}>
                    <SheetClose render={<Button type="button" />}>
                      Aplicar y volver
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            ) : null}
          </>
        )}
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
    analisis.nesting.estrategiaDisposicion === estrategiaEsperada &&
    JSON.stringify(analisis.configuracionEncastres) ===
      JSON.stringify(configuracionEncastres)
  );
}

type PiezaAnalisis = AnalisisSvgFabricacion["geometria"]["piezas"][number];

type ObjetoVectorial = {
  id: string;
  etiqueta: string;
  colorFuente?: string;
  orden: number;
  piezas: PiezaAnalisis[];
};

function objetosVectoriales(
  analisis: AnalisisSvgFabricacion,
): ObjetoVectorial[] {
  const grouped = new Map<string, ObjetoVectorial>();
  for (const pieza of analisis.geometria.piezas) {
    const source = pieza.objetoFuente;
    const id = source?.id ?? pieza.id;
    const current = grouped.get(id);
    grouped.set(id, {
      id,
      etiqueta:
        current?.etiqueta ??
        source?.etiqueta ??
        source?.grupoRuta.at(-1) ??
        `Objeto ${grouped.size + 1}`,
      colorFuente: current?.colorFuente ?? source?.colorRelleno,
      orden: current?.orden ?? source?.orden ?? grouped.size,
      piezas: [...(current?.piezas ?? []), pieza],
    });
  }
  return Array.from(grouped.values()).sort((a, b) => a.orden - b.orden);
}

function normalizarConfiguracionCapas(
  configuracion: ConfiguracionCapasVectoriales | undefined,
  analisis: AnalisisSvgFabricacion,
): ConfiguracionCapasVectoriales {
  const objetos = objetosVectoriales(analisis);
  const niveles = configuracion?.niveles.length
    ? configuracion.niveles
        .filter(
          (nivel, index, all) =>
            nivel.id && all.findIndex((item) => item.id === nivel.id) === index,
        )
        .map((nivel, index) => ({
          ...nivel,
          nombre: nivel.nombre.trim() || `Nivel ${index + 1}`,
          orden: index + 1,
          colorVisual: ((nivel.colorVisual - 1) % 5) + 1,
        }))
    : [
        {
          id: "nivel-1",
          nombre: "Nivel 1",
          orden: 1,
          colorVisual: 1,
        },
      ];
  const validLevels = new Set(niveles.map((nivel) => nivel.id));
  const previousAssignments = new Map(
    (configuracion?.asignaciones ?? [])
      .filter((item) => validLevels.has(item.nivelId))
      .map((item) => [item.objetoId, item]),
  );
  return normalizarModosPorNivel({
    schemaVersion: 1,
    niveles,
    asignaciones: objetos.map((objeto) => ({
      objetoId: objeto.id,
      nivelId: previousAssignments.get(objeto.id)?.nivelId ?? niveles[0].id,
      modo: "pieza" as const,
    })),
  });
}

function normalizarConfiguracionSinAnalisis(
  configuracion: ConfiguracionCapasVectoriales | undefined,
): ConfiguracionCapasVectoriales {
  if (configuracion?.niveles.length) return configuracion;
  return {
    schemaVersion: 1,
    niveles: [
      {
        id: "nivel-1",
        nombre: "Nivel único",
        orden: 1,
        colorVisual: 1,
      },
    ],
    asignaciones: [],
  };
}

function normalizarModosPorNivel(
  configuracion: ConfiguracionCapasVectoriales,
): ConfiguracionCapasVectoriales {
  const vistos = new Set<string>();
  return {
    ...configuracion,
    asignaciones: configuracion.asignaciones.map((asignacion) => {
      const modo = vistos.has(asignacion.nivelId) ? "encastre" : "pieza";
      vistos.add(asignacion.nivelId);
      return { ...asignacion, modo };
    }),
  };
}

function firmaFabricacionCapas(
  configuracion: ConfiguracionCapasVectoriales | undefined,
): string {
  if (!configuracion) return "";
  return JSON.stringify({
    niveles: configuracion.niveles.map((nivel) => ({
      id: nivel.id,
      orden: nivel.orden,
    })),
    asignaciones: configuracion.asignaciones.map((asignacion) => ({
      objetoId: asignacion.objetoId,
      nivelId: asignacion.nivelId,
    })),
  });
}

function EditorCapasVectoriales({
  fuente,
  analisis,
  onChange,
}: {
  fuente: FuenteDisenoVectorial;
  analisis: AnalisisSvgFabricacion;
  onChange: (configuracion: ConfiguracionCapasVectoriales) => void;
}) {
  const objetos = React.useMemo(() => objetosVectoriales(analisis), [analisis]);
  const configuracion = React.useMemo(
    () => normalizarConfiguracionCapas(fuente.configuracionCapas, analisis),
    [analisis, fuente.configuracionCapas],
  );
  const [seleccionados, setSeleccionados] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [objetoEnHover, setObjetoEnHover] = React.useState<string | null>(null);
  const patternId = React.useId().replaceAll(":", "");
  const asignacionPorObjeto = React.useMemo(
    () =>
      new Map(
        configuracion.asignaciones.map((asignacion) => [
          asignacion.objetoId,
          asignacion.nivelId,
        ]),
      ),
    [configuracion.asignaciones],
  );
  const nivelPorId = React.useMemo(
    () => new Map(configuracion.niveles.map((nivel) => [nivel.id, nivel])),
    [configuracion.niveles],
  );
  const seleccionarObjeto = (objetoId: string, multiple: boolean) => {
    setSeleccionados((current) => {
      if (!multiple) return new Set([objetoId]);
      const next = new Set(current);
      if (next.has(objetoId)) next.delete(objetoId);
      else next.add(objetoId);
      return next;
    });
  };

  const asignarSeleccion = (nivelId: string) => {
    if (seleccionados.size === 0) return;
    onChange(
      normalizarModosPorNivel({
        ...configuracion,
        asignaciones: configuracion.asignaciones.map((asignacion) =>
          seleccionados.has(asignacion.objetoId)
            ? { ...asignacion, nivelId }
            : asignacion,
        ),
      }),
    );
  };

  const agregarNivel = () => {
    const siguiente = configuracion.niveles.length + 1;
    const ids = new Set(configuracion.niveles.map((nivel) => nivel.id));
    let suffix = siguiente;
    while (ids.has(`nivel-${suffix}`)) suffix++;
    onChange(
      normalizarModosPorNivel({
        ...configuracion,
        niveles: [
          ...configuracion.niveles,
          {
            id: `nivel-${suffix}`,
            nombre: `Nivel ${siguiente}`,
            orden: siguiente,
            colorVisual: ((siguiente - 1) % 5) + 1,
          },
        ],
      }),
    );
  };

  const cambiarColorNivel = (nivelId: string, colorVisual: number) => {
    onChange({
      ...configuracion,
      niveles: configuracion.niveles.map((nivel) =>
        nivel.id === nivelId ? { ...nivel, colorVisual } : nivel,
      ),
    });
  };

  const renombrarNivel = (nivelId: string, nombre: string) => {
    onChange(
      normalizarModosPorNivel({
        ...configuracion,
        niveles: configuracion.niveles.map((nivel) =>
          nivel.id === nivelId ? { ...nivel, nombre } : nivel,
        ),
      }),
    );
  };

  const eliminarNivel = (nivelId: string) => {
    if (configuracion.niveles.length <= 1) return;
    const fallback = configuracion.niveles.find(
      (nivel) => nivel.id !== nivelId,
    );
    if (!fallback) return;
    onChange(
      normalizarModosPorNivel({
        ...configuracion,
        niveles: configuracion.niveles
          .filter((nivel) => nivel.id !== nivelId)
          .map((nivel, index) => ({ ...nivel, orden: index + 1 })),
        asignaciones: configuracion.asignaciones.map((asignacion) =>
          asignacion.nivelId === nivelId
            ? { ...asignacion, nivelId: fallback.id }
            : asignacion,
        ),
      }),
    );
  };

  const nivelSeleccionComun = (() => {
    const niveles = new Set(
      Array.from(seleccionados)
        .map((id) => asignacionPorObjeto.get(id))
        .filter(Boolean),
    );
    return niveles.size === 1 ? Array.from(niveles)[0] : undefined;
  })();
  return (
    <Card size="sm" className="shrink-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers3Icon /> Niveles del diseño
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {configuracion.niveles.length}{" "}
            {configuracion.niveles.length === 1 ? "nivel" : "niveles"}
          </Badge>
        </CardAction>
        <CardDescription>
          Seleccioná las formas y asignales el nivel donde se montan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <svg
              viewBox={`0 0 ${analisis.geometria.anchoMm} ${analisis.geometria.altoMm}`}
              role="img"
              aria-label="Objetos seleccionables del diseño vectorial"
              className="size-64 shrink-0 self-center"
            >
              <defs>
                <pattern
                  id={`${patternId}-hover`}
                  patternUnits="userSpaceOnUse"
                  width="18"
                  height="18"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="18"
                    stroke="var(--foreground)"
                    strokeWidth="4"
                    strokeOpacity="0.35"
                  />
                </pattern>
                <pattern
                  id={`${patternId}-selected`}
                  patternUnits="userSpaceOnUse"
                  width="22"
                  height="22"
                >
                  <path
                    d="M 0 0 L 22 22 M 22 0 L 0 22"
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth="3"
                    strokeOpacity="0.32"
                  />
                </pattern>
              </defs>
              {objetos.flatMap((objeto) => {
                const nivel = nivelPorId.get(
                  asignacionPorObjeto.get(objeto.id) ?? "",
                );
                const selected = seleccionados.has(objeto.id);
                const hovered = objetoEnHover === objeto.id;
                return objeto.piezas.map((pieza) => {
                  const path = pathPieza(pieza);
                  const transform = `translate(${pieza.origenXmm ?? 0} ${pieza.origenYmm ?? 0})`;
                  return (
                    <React.Fragment key={pieza.id}>
                      <path
                        d={path}
                        transform={transform}
                        fill={`var(--chart-${nivel?.colorVisual ?? 1})`}
                        fillOpacity={selected ? 0.78 : hovered ? 0.62 : 0.45}
                        fillRule="evenodd"
                        stroke={
                          selected || hovered
                            ? "var(--foreground)"
                            : "var(--border)"
                        }
                        strokeWidth={selected ? 3 : hovered ? 2.25 : 1.25}
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer transition-opacity"
                        role="button"
                        tabIndex={0}
                        aria-label={`Seleccionar ${objeto.etiqueta}`}
                        onMouseEnter={() => setObjetoEnHover(objeto.id)}
                        onMouseLeave={() => setObjetoEnHover(null)}
                        onFocus={() => setObjetoEnHover(objeto.id)}
                        onBlur={() => setObjetoEnHover(null)}
                        onClick={(event) =>
                          seleccionarObjeto(objeto.id, event.shiftKey)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          seleccionarObjeto(objeto.id, event.shiftKey);
                        }}
                      />
                      {selected || hovered ? (
                        <path
                          d={path}
                          transform={transform}
                          fill={`url(#${patternId}-${selected ? "selected" : "hover"})`}
                          fillRule="evenodd"
                          stroke="none"
                          pointerEvents="none"
                          aria-hidden="true"
                        />
                      ) : null}
                    </React.Fragment>
                  );
                });
              })}
            </svg>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Capas de montaje</p>
              <p className="text-xs text-muted-foreground">
                El nivel 1 queda detrás de los siguientes.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={configuracion.niveles.length >= 8}
              onClick={agregarNivel}
            >
              <PlusIcon data-icon="inline-start" />
              Agregar nivel
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {configuracion.niveles.map((nivel) => (
              <Field key={nivel.id} orientation="horizontal">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Cambiar color de ${nivel.nombre}`}
                        onClick={() =>
                          cambiarColorNivel(
                            nivel.id,
                            (nivel.colorVisual % 5) + 1,
                          )
                        }
                      />
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{
                        backgroundColor: `var(--chart-${nivel.colorVisual})`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cambiar color del nivel</p>
                  </TooltipContent>
                </Tooltip>
                <Input
                  aria-label={`Nombre del nivel ${nivel.orden}`}
                  value={nivel.nombre}
                  onChange={(event) =>
                    renombrarNivel(nivel.id, event.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={configuracion.niveles.length <= 1}
                  aria-label={`Eliminar ${nivel.nombre}`}
                  onClick={() => eliminarNivel(nivel.id)}
                >
                  <Trash2Icon />
                </Button>
              </Field>
            ))}
          </div>

          <Field data-disabled={seleccionados.size === 0}>
            <FieldLabel>Asignar selección</FieldLabel>
            <ToggleGroup
              multiple={false}
              variant="outline"
              value={nivelSeleccionComun ? [nivelSeleccionComun] : []}
              onValueChange={(values) => {
                const nivelId = values.at(-1);
                if (nivelId) asignarSeleccion(nivelId);
              }}
              disabled={seleccionados.size === 0}
              className="flex-wrap justify-start"
            >
              {configuracion.niveles.map((nivel) => (
                <ToggleGroupItem key={nivel.id} value={nivel.id}>
                  {nivel.nombre}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              {seleccionados.size > 0
                ? `${seleccionados.size} ${seleccionados.size === 1 ? "objeto seleccionado" : "objetos seleccionados"}`
                : "Seleccioná uno o varios objetos en la vista previa."}
            </FieldDescription>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function pathPieza(pieza: PiezaAnalisis): string {
  return pieza.contornos
    .map((contorno) => {
      const [first, ...rest] = contorno.puntos;
      if (!first) return "";
      return `M ${first.x} ${first.y} ${rest
        .map((point) => `L ${point.x} ${point.y}`)
        .join(" ")} Z`;
    })
    .filter(Boolean)
    .join(" ");
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

function redondearMedida(value: number) {
  return Math.round(value * 100) / 100;
}

function obtenerRelacionAspectoSvg(svg?: string): number {
  if (!svg) return 1;
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return 1;

  const viewBox = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const width = values[2];
    const height = values[3];
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0) {
      return height / width;
    }
  }

  const readDimension = (name: "width" | "height") => {
    const raw = root.match(
      new RegExp(`\\b${name}\\s*=\\s*["']([0-9]*\\.?[0-9]+)`, "i"),
    )?.[1];
    return raw ? Number(raw) : 0;
  };
  const width = readDimension("width");
  const height = readDimension("height");
  return width > 0 && height > 0 ? height / width : 1;
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
                  {placements.length === 1 ? "ubicación" : "ubicaciones"}
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
