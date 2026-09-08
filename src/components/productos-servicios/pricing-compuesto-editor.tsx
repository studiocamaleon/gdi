"use client";

import * as React from "react";
import { CircleAlertIcon, InfoIcon, Layers3Icon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { HumanSelect } from "@/components/ui/human-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import type {
  ModoPricingComponente,
  ProductoReceta,
  ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import { getLabel, metodoPrecioLabels } from "@/lib/labels-humanos";
import {
  TabPrecioEditor,
  type EstrategiaPricingCompuesto,
  type TabPrecioConfig,
} from "./tab-precio-editor";
import {
  actualizarPoliticaPricingComponente,
  leerPoliticaPricingComponente,
  PRECIO_OVERRIDE_INICIAL,
  revisionPricingReceta,
  type ComponentesPricingPorRuta,
} from "./pricing-compuesto-helpers";
import { PricingSectionHeader } from "./pricing-section-header";
import pricingStyles from "./pricing-visual.module.css";

interface Props {
  producto: ProductoDetalle;
  precioConfig: TabPrecioConfig;
  onChangePrecioConfig: (config: TabPrecioConfig) => void;
  recetas: ProductoReceta[];
  componentesPorRuta: ComponentesPricingPorRuta;
  onChangeComponentesPorRuta: (value: ComponentesPricingPorRuta) => void;
  hayCambiosComponentes: boolean;
}

const ESTRATEGIAS: Array<{
  value: EstrategiaPricingCompuesto;
  label: string;
  description: string;
}> = [
  {
    value: "GENERAL",
    label: "General",
    description: "Una regla para todo el costo del producto.",
  },
  {
    value: "MIXTO",
    label: "Mixto",
    description: "Sólo algunos componentes tienen una regla propia.",
  },
  {
    value: "POR_COMPONENTE",
    label: "Por componente",
    description: "Cada componente puede formar su propio bloque de pricing.",
  },
];

const MODOS: Array<{
  value: ModoPricingComponente;
  label: string;
  description: string;
}> = [
  {
    value: "HEREDAR_PADRE",
    label: "Heredar del padre",
    description: "El costo se incorpora al bloque general del producto padre.",
  },
  {
    value: "USAR_PRODUCTO_HIJO",
    label: "Del componente",
    description: "Usa la regla vigente del producto hijo y la congela al guardar.",
  },
  {
    value: "OVERRIDE",
    label: "Específica",
    description: "Define una regla exclusiva para esta relación de la receta.",
  },
];

function metodoLabel(config: TabPrecioConfig | undefined) {
  if (!config) return "Sin snapshot todavía";
  return getLabel(metodoPrecioLabels, config.metodoCalculo).label;
}

function modoLabel(modo: ModoPricingComponente) {
  return MODOS.find((item) => item.value === modo)?.label ?? modo;
}

export function PricingCompuestoEditor({
  producto,
  precioConfig,
  onChangePrecioConfig,
  recetas,
  componentesPorRuta,
  onChangeComponentesPorRuta,
  hayCambiosComponentes,
}: Props) {
  const rutaPreferidaId =
    producto.rutasAlternativas.find((ruta) => ruta.esPreferida)?.id ??
    recetas[0]?.rutaAlternativa.id ??
    "";
  const [rutaSeleccionadaId, setRutaSeleccionadaId] =
    React.useState(rutaPreferidaId);
  const rutaActivaId = recetas.some(
    (receta) => receta.rutaAlternativa.id === rutaSeleccionadaId,
  )
    ? rutaSeleccionadaId
    : rutaPreferidaId;

  const estrategia = precioConfig.compuesto?.estrategia ?? "GENERAL";
  const recetaSeleccionada = recetas.find(
    (receta) => receta.rutaAlternativa.id === rutaActivaId,
  );
  const revision = recetaSeleccionada
    ? revisionPricingReceta(recetaSeleccionada)
    : null;
  const componentes = componentesPorRuta[rutaActivaId] ?? [];
  const heredados = componentes.filter(
    (componente) =>
      leerPoliticaPricingComponente(componente.configuracionJson).modo ===
      "HEREDAR_PADRE",
  ).length;

  const cambiarEstrategia = (next: EstrategiaPricingCompuesto) => {
    onChangePrecioConfig({
      ...precioConfig,
      compuesto: { version: 1, estrategia: next },
    });
  };

  const actualizarComponente = (
    index: number,
    updater: (
      componente: ProductoRecetaComponenteInput,
    ) => ProductoRecetaComponenteInput,
  ) => {
    onChangeComponentesPorRuta({
      ...componentesPorRuta,
      [rutaActivaId]: componentes.map((componente, currentIndex) =>
        currentIndex === index ? updater(componente) : componente,
      ),
    });
  };

  return (
    <Card className={pricingStyles.section}>
      <PricingSectionHeader
        step="02"
        eyebrow="Composición"
        title="Pricing del producto compuesto"
        description="Decide qué costos comparten la regla general y cuáles forman un bloque propio."
        icon={Layers3Icon}
        action={<Badge variant="outline">F4.3</Badge>}
      />
      <CardContent className={pricingStyles.sectionContent}>
        <FieldGroup>
          <Field>
            <FieldLabel>Estrategia</FieldLabel>
            <ToggleGroup
              multiple={false}
              value={[estrategia]}
              onValueChange={(values) => {
                const next = values.at(-1) as
                  | EstrategiaPricingCompuesto
                  | undefined;
                if (next) cambiarEstrategia(next);
              }}
              variant="outline"
              className={`${pricingStyles.segmented} grid w-full grid-cols-1 sm:grid-cols-3`}
            >
              {ESTRATEGIAS.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              {ESTRATEGIAS.find((item) => item.value === estrategia)?.description}
            </FieldDescription>
          </Field>

          {recetas.length > 1 ? (
            <Field>
              <FieldLabel>Ruta productiva</FieldLabel>
              <HumanSelect
                value={rutaActivaId}
                onValueChange={setRutaSeleccionadaId}
                options={recetas.map((receta) => ({
                  value: receta.rutaAlternativa.id,
                  label: receta.rutaAlternativa.nombre,
                  description:
                    revisionPricingReceta(receta)?.estado === "BORRADOR"
                      ? "Políticas tomadas del borrador actual"
                      : "Políticas tomadas de la versión publicada",
                  badge:
                    revisionPricingReceta(receta)?.estado === "BORRADOR"
                      ? "Borrador"
                      : `V${receta.revisionPublicada?.numero ?? "—"}`,
                }))}
              />
              <FieldDescription>
                Las políticas pertenecen a cada relación BOM y pueden variar entre rutas.
              </FieldDescription>
            </Field>
          ) : null}

          <Alert>
            <InfoIcon />
            <AlertTitle>Una sola línea comercial</AlertTitle>
            <AlertDescription>
              Los bloques son internos. Impuestos, comisiones, descuentos y redondeo se
              aplican una sola vez después de consolidarlos.
            </AlertDescription>
          </Alert>

          {!revision ? (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>La ruta todavía no tiene receta</AlertTitle>
              <AlertDescription>
                Creá o publicá la receta desde Routing para poder asignar políticas a sus
                componentes.
              </AlertDescription>
            </Alert>
          ) : estrategia === "GENERAL" ? (
            <Alert>
              <InfoIcon />
              <AlertTitle>Todos los costos usan la regla general</AlertTitle>
              <AlertDescription>
                Las políticas guardadas en la receta se conservan, pero no se activan mientras
                esta estrategia esté seleccionada.
              </AlertDescription>
            </Alert>
          ) : (
            <div className={pricingStyles.componentGrid}>
              {componentes.length === 0 ? (
                <Alert>
                  <InfoIcon />
                  <AlertTitle>Esta receta no tiene componentes fabricados</AlertTitle>
                  <AlertDescription>
                    El costo propio del padre seguirá usando la regla general.
                  </AlertDescription>
                </Alert>
              ) : null}

              {componentes.map((componente, index) => {
                const politica = leerPoliticaPricingComponente(
                  componente.configuracionJson,
                );
                return (
                  <Card
                    key={`${componente.codigo}:${index}`}
                    size="sm"
                    className={pricingStyles.componentCard}
                  >
                    <CardHeader className={pricingStyles.componentHeader}>
                      <CardTitle>{componente.nombre}</CardTitle>
                      <CardDescription>
                        {componente.cantidad} {componente.unidad} en este producto
                      </CardDescription>
                      <CardAction>
                        <Badge
                          variant={
                            politica.modo === "HEREDAR_PADRE"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {modoLabel(politica.modo)}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className={pricingStyles.componentContent}>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Regla de pricing</FieldLabel>
                          <ToggleGroup
                            multiple={false}
                            value={[politica.modo]}
                            onValueChange={(values) => {
                              const modo = values.at(-1) as
                                | ModoPricingComponente
                                | undefined;
                              if (!modo) return;
                              actualizarComponente(index, (current) =>
                                actualizarPoliticaPricingComponente(current, modo),
                              );
                            }}
                            variant="outline"
                            className={`${pricingStyles.segmented} grid w-full grid-cols-1 lg:grid-cols-3`}
                          >
                            {MODOS.map((item) => (
                              <ToggleGroupItem key={item.value} value={item.value}>
                                {item.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                          <FieldDescription>
                            {MODOS.find((item) => item.value === politica.modo)?.description}
                          </FieldDescription>
                        </Field>

                        {politica.modo === "OVERRIDE" ? (
                          <div className={pricingStyles.overridePanel}>
                            <TabPrecioEditor
                              value={
                                politica.precioConfigOverride ??
                                PRECIO_OVERRIDE_INICIAL
                              }
                              onChange={(next) =>
                                actualizarComponente(index, (current) =>
                                  actualizarPoliticaPricingComponente(
                                    current,
                                    "OVERRIDE",
                                    next,
                                  ),
                                )
                              }
                              unidadComercial={producto.unidadComercial}
                            />
                          </div>
                        ) : null}
                      </FieldGroup>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {estrategia === "POR_COMPONENTE" && heredados > 0 ? (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>
                {heredados} {heredados === 1 ? "componente hereda" : "componentes heredan"}
              </AlertTitle>
              <AlertDescription>
                Es válido, pero esos costos seguirán dentro del bloque general. Asignales una
                regla propia si querés separar todo el producto por componentes.
              </AlertDescription>
            </Alert>
          ) : null}

          {hayCambiosComponentes ? (
            <Alert>
              <CircleAlertIcon />
              <AlertTitle>Se actualizará el borrador de Routing</AlertTitle>
              <AlertDescription>
                Después de guardar, publicá la revisión desde Routing para que estas políticas
                entren en vigencia productiva.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className={pricingStyles.preview}>
            <div className={pricingStyles.previewHeader}>
              <div>
                <h3 className={pricingStyles.previewTitle}>Vista previa de bloques</h3>
                <p className={pricingStyles.previewDescription}>
                  Anticipa qué regla se aplicará; los importes se calculan al cotizar con medidas
                  y cantidades reales.
                </p>
              </div>
              {revision ? (
                <Badge variant="secondary">
                  {revision.estado === "BORRADOR"
                    ? "Borrador actual"
                    : `Versión ${revision.numero}`}
                </Badge>
              ) : null}
            </div>
            <div className={pricingStyles.previewTable}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bloque</TableHead>
                    <TableHead>Política</TableHead>
                    <TableHead>Regla efectiva</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Costo propio y heredado</TableCell>
                    <TableCell>General del padre</TableCell>
                    <TableCell>{metodoLabel(precioConfig)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Bloque general</Badge>
                    </TableCell>
                  </TableRow>
                  {componentes.map((componente, index) => {
                    const politica = leerPoliticaPricingComponente(
                      componente.configuracionJson,
                    );
                    const usaBloqueGeneral =
                      estrategia === "GENERAL" ||
                      politica.modo === "HEREDAR_PADRE";
                    const regla = usaBloqueGeneral
                      ? precioConfig
                      : politica.modo === "OVERRIDE"
                        ? politica.precioConfigOverride
                        : politica.precioConfigSnapshot;
                    return (
                      <TableRow key={`preview:${componente.codigo}:${index}`}>
                        <TableCell className="font-medium">
                          {componente.nombre}
                        </TableCell>
                        <TableCell>
                          {estrategia === "GENERAL"
                            ? "General"
                            : modoLabel(politica.modo)}
                        </TableCell>
                        <TableCell>
                          {politica.modo === "USAR_PRODUCTO_HIJO" && !regla
                            ? "Se congela al guardar"
                            : metodoLabel(regla)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={usaBloqueGeneral ? "secondary" : "outline"}>
                            {usaBloqueGeneral ? "Incluido en general" : "Bloque propio"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {revision ? (
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                Fuente: {recetaSeleccionada?.rutaAlternativa.nombre} · {revision.estado === "BORRADOR" ? "borrador actual" : `versión ${revision.numero} publicada`}.
              </p>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
