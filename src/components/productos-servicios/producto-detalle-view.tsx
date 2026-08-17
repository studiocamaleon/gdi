"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  CogIcon,
  GitBranchIcon,
  PackageIcon,
  PencilIcon,
  RulerIcon,
  TagIcon,
  WrenchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductoValidacionPanel } from "@/components/productos-servicios/producto-validacion-panel";
import type { FamiliaListItem, ProductoDetalle, RutaAlternativaDetalle } from "@/lib/productos-servicios";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";
import {
  getLabel,
  modoActivacionLabels,
  modoMedidasLabels,
  modoSeleccionMaterialLabels,
  modoTiempoLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

function humanizeCode(code: string) {
  if (code === "sustrato_principal") return "Sustrato principal";
  return code
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ProductoDetalleView({ producto }: { producto: ProductoDetalle }) {
  const [rutaActiva, setRutaActiva] = React.useState<string>(
    producto.rutasAlternativas.find((r) => r.esPreferida)?.id ?? producto.rutasAlternativas[0]?.id ?? "",
  );
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);

  React.useEffect(() => {
    getCatalogoFamilias()
      .then((cat) => setFamilias(cat.familias))
      .catch(() => setFamilias([]));
  }, []);

  const familiaLabel = React.useCallback(
    (codigo: string): string => {
      const f = familias.find((x) => x.codigo === codigo);
      return f?.nombre ?? codigo;
    },
    [familias],
  );
  const slotLabel = React.useCallback(
    (familiaCodigo: string, slotCodigo: string): string => {
      const familia = familias.find((x) => x.codigo === familiaCodigo);
      const slot = familia?.slotsRequeridos.find((s) => s.codigo === slotCodigo);
      return slot?.nombre ?? humanizeCode(slotCodigo);
    },
    [familias],
  );

  const unidadLbl = getLabel(unidadComercialLabels, producto.unidadComercial);
  const modoMedidasLbl = getLabel(modoMedidasLabels, producto.modoMedidas);

  return (
    <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          href="/productos-servicios"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Volver al catálogo
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{producto.nombre}</h1>
            <p className="text-muted-foreground font-mono text-xs">{producto.codigo}</p>
            {producto.descripcion && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{producto.descripcion}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={producto.activo ? "default" : "secondary"}>
              {producto.activo ? "Activo" : "Inactivo"}
            </Badge>
            <Link href={`/productos-servicios/${producto.id}/rutas`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <GitBranchIcon className="mr-2 size-3" />
              Configurar rutas
            </Link>
            <Link href={`/productos-servicios/${producto.id}/wizard`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <PencilIcon className="mr-2 size-3" />
              Editar
            </Link>
          </div>
        </div>
      </div>

      {/* F.3.11 — Panel de validación */}
      <ProductoValidacionPanel productoId={producto.id} />

      {/* Atributos comerciales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="Agrupación comercial para reportes y propuestas">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <PackageIcon className="size-3" /> Categoría comercial
            </CardDescription>
            <CardTitle className="text-base">
              {producto.subcategoriaComercial.nombre}
              <span className="text-muted-foreground block text-sm font-normal">
                {producto.subcategoriaComercial.categoria.nombre}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card title={unidadLbl.descripcion}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <TagIcon className="size-3" /> ¿Cómo se cobra?
            </CardDescription>
            <CardTitle className="text-base">{unidadLbl.label}</CardTitle>
          </CardHeader>
        </Card>
        <Card title={modoMedidasLbl.descripcion}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <RulerIcon className="size-3" /> Manejo de medidas
            </CardDescription>
            <CardTitle className="text-base">
              {modoMedidasLbl.label}
              {producto.modoMedidas === "FIJA" && producto.medidaDefaultAnchoMm && (
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  ({producto.medidaDefaultAnchoMm} × {producto.medidaDefaultAltoMm} mm)
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <GitBranchIcon className="size-3" /> Rutas alternativas
            </CardDescription>
            <CardTitle className="text-base">{producto.rutasAlternativas.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Cargos directos a nivel cotización */}
      {producto.cargosDirectosCotizacion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costos globales heredados</CardTitle>
            <CardDescription>
              Configuración anterior conservada por compatibilidad. Los costos
              nuevos se modelan dentro de cada paso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {producto.cargosDirectosCotizacion.map((c) => {
                const lblAct = getLabel(modoActivacionLabels, c.modoActivacion);
                return (
                  <Badge key={c.id} variant="outline" title={lblAct.descripcion}>
                    {c.cargoDirectoCatalogo.nombre}
                    <span className="text-muted-foreground ml-1 text-xs">({lblAct.label})</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de rutas alternativas */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración por ruta</CardTitle>
          <CardDescription>
            Cada ruta alternativa tiene su propia configuración de pasos. La ruta preferida es la
            default al cotizar; el comercial puede elegir otra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={rutaActiva} onValueChange={setRutaActiva}>
            <TabsList>
              {producto.rutasAlternativas.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.nombre}
                  {r.esPreferida && (
                    <Badge variant="default" className="ml-2 px-1 py-0 text-[10px]">
                      preferida
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {producto.rutasAlternativas.map((r) => (
              <TabsContent key={r.id} value={r.id} className="mt-4">
                <RutaAlternativaContent ruta={r} familiaLabel={familiaLabel} slotLabel={slotLabel} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function RutaAlternativaContent({
  ruta,
  familiaLabel,
  slotLabel,
}: {
  ruta: RutaAlternativaDetalle;
  familiaLabel: (codigo: string) => string;
  slotLabel: (familiaCodigo: string, slotCodigo: string) => string;
}) {
  const pasosOrdenados = ruta.ruta.pasos;
  const configByPasoId = new Map(ruta.configPasos.map((c) => [c.rutaPasoId, c]));

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        <span className="font-medium">{ruta.ruta.nombre}</span>
        <span className="mx-2">·</span>
        <span className="font-mono text-xs">{ruta.ruta.codigo}</span>
        <span className="mx-2">·</span>
        <span>v{ruta.rutaVersion}</span>
      </div>

      <div className="space-y-2">
        {pasosOrdenados.map((paso, idx) => {
          const config = configByPasoId.get(paso.id);
          return (
            <Card key={paso.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className="font-medium"
                          title={`Código familia: ${paso.familiaCodigo}`}
                        >
                          {familiaLabel(paso.familiaCodigo)}
                        </div>
                        {config?.modoActivacion && (
                          <div className="text-muted-foreground text-xs">
                            <Badge
                              variant={config.modoActivacion === "OBLIGATORIO" ? "default" : "outline"}
                              className="mr-1 text-[10px]"
                              title={getLabel(modoActivacionLabels, config.modoActivacion).descripcion}
                            >
                              {getLabel(modoActivacionLabels, config.modoActivacion).label}
                            </Badge>
                            {config.modoTiempo && (
                              <span
                                className="text-muted-foreground"
                                title={getLabel(modoTiempoLabels, config.modoTiempo).descripcion}
                              >
                                tiempo: {getLabel(modoTiempoLabels, config.modoTiempo).label}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {config?.maquinaM1 && (
                        <div className="text-right text-xs">
                          <div className="text-muted-foreground inline-flex items-center gap-1">
                            <CogIcon className="size-3" />
                            {config.maquinaM1.nombre}
                          </div>
                          {config.perfilM1 && (
                            <div className="text-muted-foreground">{config.perfilM1.nombre}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {config && config.slotsMateriales.length > 0 && (
                      <div className="ml-0 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {config.slotsMateriales.map((slot) => {
                          const lblSel = getLabel(modoSeleccionMaterialLabels, slot.modoSeleccion);
                          return (
                            <div
                              key={slot.id}
                              className="bg-muted/50 flex items-center gap-2 rounded p-2 text-xs"
                              title={lblSel.descripcion}
                            >
                              <PackageIcon className="text-muted-foreground size-3" />
                              <div className="flex-1">
                                <div className="font-medium" title={slot.slotCodigo}>
                                  {slotLabel(paso.familiaCodigo, slot.slotCodigo)}
                                </div>
                                <div className="text-muted-foreground">
                                  {lblSel.label}
                                  {slot.materialVariante && (
                                    <>
                                      {" · "}
                                      {slot.materialVariante.nombreVariante ?? slot.materialVariante.sku}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {config && config.cargosDirectosPaso.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {config.cargosDirectosPaso.map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px]">
                            <WrenchIcon className="mr-1 size-2.5" />
                            {c.cargoDirectoCatalogo.nombre}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {!config && (
                      <div className="text-muted-foreground text-xs italic">
                        <CircleIcon className="mr-1 inline size-3" />
                        Sin configuración (paso de la ruta sin config en este producto)
                      </div>
                    )}

                    {config?.multiplicadoresActivos && config.multiplicadoresActivos.length > 0 && (
                      <div className="text-muted-foreground text-xs">
                        Multiplicadores:{" "}
                        {config.multiplicadoresActivos.map((m) => (
                          <Badge key={m} variant="secondary" className="mr-1 text-[10px]">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <CheckCircle2Icon
                    className={
                      config?.modoActivacion === "OBLIGATORIO"
                        ? "text-green-500 size-5 shrink-0"
                        : "text-muted-foreground size-5 shrink-0"
                    }
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
