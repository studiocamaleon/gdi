"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SaveIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import {
  getProductoMotorConfig,
  upsertProductoMotorConfig,
} from "@/lib/productos-servicios-api";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import type { MateriaPrima } from "@/lib/materias-primas";

type MaterialOption = { id: string; label: string };

function buildPapelOptions(materiasPrimas: MateriaPrima[]): MaterialOption[] {
  const items: MaterialOption[] = [];
  for (const mp of materiasPrimas) {
    if (mp.subfamilia !== "sustrato_hoja") continue;
    for (const variante of mp.variantes) {
      items.push({
        id: variante.id,
        label: getMateriaPrimaVarianteLabel(mp, variante, { maxDimensiones: 6 }),
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function buildAllMaterialOptions(materiasPrimas: MateriaPrima[]): MaterialOption[] {
  const items: MaterialOption[] = [];
  for (const mp of materiasPrimas) {
    for (const variante of mp.variantes) {
      items.push({
        id: variante.id,
        label: getMateriaPrimaVarianteLabel(mp, variante, { maxDimensiones: 6 }),
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

type TipoCopiaValor = "COPIA_SIMPLE" | "DUPLICADO" | "TRIPLICADO" | "CUADRUPLICADO";

type PapelCapa = {
  capaIndex: number;
  capaLabel: string;
  papelVarianteId: string | null;
  colorPapel: string;
};

type TipoCopiaDefinicion = {
  valor: TipoCopiaValor;
  capas: number;
  numerosXTalonarioSugerido: number;
  papeles: PapelCapa[];
};

type EncuadernacionConfig = {
  tipo: "abrochado" | "emblocado";
  cantidadGrapas: number | null;
  posicionGrapas: string | null;
  bordeEncolar: string | null;
};

type PuntilladoConfig = {
  habilitado: boolean;
  tipo: string | null;
  distanciaBordeMm: number | null;
  borde: string | null;
};

type MaterialExtraItem = {
  habilitado: boolean;
  materiaPrimaVarianteId: string | null;
};

type NumeracionConfig = {
  habilitado: boolean;
  posicion: string | null;
};

type TalonarioMotorParams = {
  tamanoPliegoImpresion: {
    codigo: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
  };
  tipoCorte: string;
  demasiaCorteMm: number;
  lineaCorteMm: number;
  mermaAdicionalPct: number;
  numerosXTalonarioDefault: number;
  tipoCopiaDefiniciones: TipoCopiaDefinicion[];
  encuadernacion: EncuadernacionConfig;
  puntillado: PuntilladoConfig;
  modoTalonarioIncompleto: "aprovechar_pliego" | "pose_completa";
  materialesExtra: {
    cartonBase: MaterialExtraItem;
    hojaBlancaSuperior: MaterialExtraItem;
  };
  numeracion: NumeracionConfig;
};

const TIPO_COPIA_LABELS: Record<TipoCopiaValor, string> = {
  COPIA_SIMPLE: "Simple (solo original)",
  DUPLICADO: "Duplicado",
  TRIPLICADO: "Triplicado",
  CUADRUPLICADO: "Cuadruplicado",
};

const COLORES_PAPEL = [
  { value: "blanco", label: "Blanco" },
  { value: "amarillo", label: "Amarillo" },
  { value: "rosa", label: "Rosa" },
  { value: "celeste", label: "Celeste" },
  { value: "verde", label: "Verde" },
];

const POSICIONES_BROCHES = [
  { value: "superior", label: "Superior" },
  { value: "lateral", label: "Lateral" },
];
const POSICIONES_BROCHES_LABEL = new Map(POSICIONES_BROCHES.map((p) => [p.value, p.label]));

const BORDES = [
  { value: "superior", label: "Superior" },
  { value: "inferior", label: "Inferior" },
  { value: "izquierdo", label: "Izquierdo" },
  { value: "derecho", label: "Derecho" },
];
const BORDES_LABEL = new Map(BORDES.map((b) => [b.value, b.label]));

const POSICIONES_NUMERACION = [
  { value: "superior_derecho", label: "Superior derecho" },
  { value: "superior_izquierdo", label: "Superior izquierdo" },
  { value: "inferior_derecho", label: "Inferior derecho" },
  { value: "inferior_izquierdo", label: "Inferior izquierdo" },
];
const POSICIONES_NUMERACION_LABEL = new Map(POSICIONES_NUMERACION.map((p) => [p.value, p.label]));

const ENCUADERNACION_LABELS: Record<string, string> = {
  abrochado: "Abrochado (grapas)",
  emblocado: "Emblocado (cola)",
};

const PUNTILLADO_TIPO_LABELS: Record<string, string> = {
  lateral: "Lateral",
  matriz_comprobante: "Matriz + comprobante",
};

const MODO_INCOMPLETO_LABELS: Record<string, string> = {
  pose_completa: "Pose completa (desperdicio)",
  aprovechar_pliego: "Aprovechar pliego (dividir)",
};

export function TalonarioComposicionTab(props: ProductTabProps) {
  const { producto, materiasPrimas } = props;
  const papelOptions = React.useMemo(() => buildPapelOptions(materiasPrimas), [materiasPrimas]);
  const allMaterialOptions = React.useMemo(() => buildAllMaterialOptions(materiasPrimas), [materiasPrimas]);
  const papelLabelById = React.useMemo(() => new Map(papelOptions.map((p) => [p.id, p.label])), [papelOptions]);
  const materialLabelById = React.useMemo(() => new Map(allMaterialOptions.map((p) => [p.id, p.label])), [allMaterialOptions]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [params, setParams] = React.useState<TalonarioMotorParams | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProductoMotorConfig(producto.id)
      .then((config) => {
        if (cancelled) return;
        setParams(config.parametros as unknown as TalonarioMotorParams);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [producto.id]);

  const handleSave = async () => {
    if (!params) return;
    setSaving(true);
    try {
      const result = await upsertProductoMotorConfig(producto.id, params as unknown as Record<string, unknown>);
      setParams(result.parametros as unknown as TalonarioMotorParams);
      await props.refreshMotorConfig();
      toast.success("Composición del talonario guardada");
    } catch {
      toast.error("Error al guardar la composición");
    } finally {
      setSaving(false);
    }
  };

  const updateParams = (patch: Partial<TalonarioMotorParams>) => {
    setParams((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateEncuadernacion = (patch: Partial<EncuadernacionConfig>) => {
    setParams((prev) =>
      prev ? { ...prev, encuadernacion: { ...prev.encuadernacion, ...patch } } : prev,
    );
  };

  const updatePuntillado = (patch: Partial<PuntilladoConfig>) => {
    setParams((prev) =>
      prev ? { ...prev, puntillado: { ...prev.puntillado, ...patch } } : prev,
    );
  };

  const updateNumeracion = (patch: Partial<NumeracionConfig>) => {
    setParams((prev) =>
      prev ? { ...prev, numeracion: { ...prev.numeracion, ...patch } } : prev,
    );
  };

  const toggleTipoCopia = (valor: TipoCopiaValor, enabled: boolean) => {
    setParams((prev) => {
      if (!prev) return prev;
      if (enabled) {
        const capas = valor === "COPIA_SIMPLE" ? 1 : valor === "DUPLICADO" ? 2 : valor === "TRIPLICADO" ? 3 : 4;
        const capaLabels = ["Original", "Duplicado", "Triplicado", "Cuadruplicado"];
        const colores = ["blanco", "amarillo", "rosa", "celeste"];
        const papeles: PapelCapa[] = Array.from({ length: capas }, (_, i) => ({
          capaIndex: i,
          capaLabel: capaLabels[i],
          papelVarianteId: null,
          colorPapel: colores[i],
        }));
        const existing = prev.tipoCopiaDefiniciones.find((d) => d.valor === valor);
        if (existing) return prev;
        return {
          ...prev,
          tipoCopiaDefiniciones: [
            ...prev.tipoCopiaDefiniciones,
            {
              valor,
              capas,
              numerosXTalonarioSugerido: capas >= 3 ? 25 : capas === 2 ? 50 : 100,
              papeles,
            },
          ],
        };
      }
      return {
        ...prev,
        tipoCopiaDefiniciones: prev.tipoCopiaDefiniciones.filter((d) => d.valor !== valor),
      };
    });
  };

  const updateTipoCopiaField = (
    valor: TipoCopiaValor,
    field: keyof TipoCopiaDefinicion,
    value: unknown,
  ) => {
    setParams((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tipoCopiaDefiniciones: prev.tipoCopiaDefiniciones.map((d) =>
          d.valor === valor ? { ...d, [field]: value } : d,
        ),
      };
    });
  };

  const updatePapelColor = (valor: TipoCopiaValor, capaIndex: number, colorPapel: string) => {
    setParams((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tipoCopiaDefiniciones: prev.tipoCopiaDefiniciones.map((d) =>
          d.valor === valor
            ? {
                ...d,
                papeles: d.papeles.map((p) =>
                  p.capaIndex === capaIndex ? { ...p, colorPapel } : p,
                ),
              }
            : d,
        ),
      };
    });
  };

  const updatePapelVarianteId = (valor: TipoCopiaValor, capaIndex: number, papelVarianteId: string | null) => {
    setParams((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tipoCopiaDefiniciones: prev.tipoCopiaDefiniciones.map((d) =>
          d.valor === valor
            ? {
                ...d,
                papeles: d.papeles.map((p) =>
                  p.capaIndex === capaIndex ? { ...p, papelVarianteId } : p,
                ),
              }
            : d,
        ),
      };
    });
  };

  const updateMaterialExtra = (
    key: "cartonBase" | "hojaBlancaSuperior",
    materiaPrimaVarianteId: string | null,
  ) => {
    setParams((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        materialesExtra: {
          ...prev.materialesExtra,
          [key]: { ...prev.materialesExtra[key], materiaPrimaVarianteId },
        },
      };
    });
  };

  if (loading || !params) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tipoCopiaValues: TipoCopiaValor[] = ["COPIA_SIMPLE", "DUPLICADO", "TRIPLICADO", "CUADRUPLICADO"];
  const enabledTiposCopia = new Set(params.tipoCopiaDefiniciones.map((d) => d.valor));

  return (
    <div className="space-y-6">
      {/* Tipos de copia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipos de copia disponibles</CardTitle>
          <CardDescription>
            Define qué opciones de copia puede tener este producto. Al cotizar, el vendedor
            elegirá una de estas opciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tipoCopiaValues.map((valor) => {
            const enabled = enabledTiposCopia.has(valor);
            const def = params.tipoCopiaDefiniciones.find((d) => d.valor === valor);
            return (
              <div key={valor} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => toggleTipoCopia(valor, checked)}
                  />
                  <Label className="text-sm font-medium">{TIPO_COPIA_LABELS[valor]}</Label>
                  {enabled && def && (
                    <Badge variant="secondary" className="text-xs">
                      {def.capas} {def.capas === 1 ? "capa" : "capas"}
                    </Badge>
                  )}
                </div>
                {enabled && def && (
                  <div className="ml-10 space-y-3 rounded-md border p-3">
                    <div className="flex items-center gap-4">
                      <Label className="w-48 text-xs text-muted-foreground">
                        Números por talonario sugeridos
                      </Label>
                      <Input
                        type="number"
                        className="w-24 h-8 text-sm"
                        value={def.numerosXTalonarioSugerido}
                        onChange={(e) =>
                          updateTipoCopiaField(
                            valor,
                            "numerosXTalonarioSugerido",
                            parseInt(e.target.value) || 50,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Papeles por capa</Label>
                      {def.papeles.map((papel) => (
                        <div key={papel.capaIndex} className="flex items-center gap-3 ml-2">
                          <span className="text-xs w-20 flex-shrink-0 font-medium">{papel.capaLabel}</span>
                          <Select
                            value={papel.colorPapel}
                            onValueChange={(v) => v && updatePapelColor(valor, papel.capaIndex, v)}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs flex-shrink-0">
                              <SelectValue>
                                {COLORES_PAPEL.find((c) => c.value === papel.colorPapel)?.label ?? papel.colorPapel}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {COLORES_PAPEL.map((color) => (
                                <SelectItem key={color.value} value={color.value} className="text-xs">
                                  {color.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={papel.papelVarianteId ?? "__none__"}
                            onValueChange={(v) => updatePapelVarianteId(valor, papel.capaIndex, v === "__none__" ? null : v)}
                          >
                            <SelectTrigger className="h-7 text-xs min-w-0 flex-1">
                              <SelectValue placeholder="Elegir materia prima...">
                                {papel.papelVarianteId
                                  ? (papelLabelById.get(papel.papelVarianteId) ?? "Materia prima seleccionada")
                                  : "Elegir materia prima..."}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="min-w-[400px]">
                              <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                Sin asignar
                              </SelectItem>
                              {papelOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {valor !== "CUADRUPLICADO" && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Números por talonario default */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Números por talonario</CardTitle>
          <CardDescription>
            Cantidad de hojas/números por defecto en cada talonario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="text-sm">Cantidad por defecto</Label>
            <Input
              type="number"
              className="w-24 h-8 text-sm"
              value={params.numerosXTalonarioDefault}
              onChange={(e) =>
                updateParams({ numerosXTalonarioDefault: parseInt(e.target.value) || 50 })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Encuadernación */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Encuadernación</CardTitle>
          <CardDescription>
            Método de unión del talonario. Afecta la imposición (abrochado = misma orientación,
            emblocado = poses enfrentadas tête-bêche).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={params.encuadernacion.tipo}
            onValueChange={(v) =>
              v && updateEncuadernacion({ tipo: v as "abrochado" | "emblocado" })
            }
          >
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue>{ENCUADERNACION_LABELS[params.encuadernacion.tipo] ?? params.encuadernacion.tipo}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abrochado">Abrochado (grapas)</SelectItem>
              <SelectItem value="emblocado">Emblocado (cola)</SelectItem>
            </SelectContent>
          </Select>

          {params.encuadernacion.tipo === "abrochado" && (
            <div className="flex items-center gap-6 ml-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Cantidad de grapas</Label>
                <Input
                  type="number"
                  className="w-16 h-8 text-sm"
                  value={params.encuadernacion.cantidadGrapas ?? 2}
                  onChange={(e) =>
                    updateEncuadernacion({
                      cantidadGrapas: parseInt(e.target.value) || 2,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Posición</Label>
                <Select
                  value={params.encuadernacion.posicionGrapas ?? "superior"}
                  onValueChange={(v) => v && updateEncuadernacion({ posicionGrapas: v })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue>{POSICIONES_BROCHES_LABEL.get(params.encuadernacion.posicionGrapas ?? "superior") ?? "Superior"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {POSICIONES_BROCHES.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {params.encuadernacion.tipo === "emblocado" && (
            <div className="flex items-center gap-2 ml-6">
              <Label className="text-xs text-muted-foreground">Borde a encolar</Label>
              <Select
                value={params.encuadernacion.bordeEncolar ?? "superior"}
                onValueChange={(v) => v && updateEncuadernacion({ bordeEncolar: v })}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue>{BORDES_LABEL.get(params.encuadernacion.bordeEncolar ?? "superior") ?? "Superior"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BORDES.map((b) => (
                    <SelectItem key={b.value} value={b.value} className="text-xs">
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Puntillado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Puntillado / Perforado</CardTitle>
          <CardDescription>
            Línea de perforación para arrancar hojas. Se muestra en la imposición y restringe la
            orientación de las poses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={params.puntillado.habilitado}
              onCheckedChange={(checked) => updatePuntillado({ habilitado: checked })}
            />
            <Label>Puntillado habilitado</Label>
          </div>
          {params.puntillado.habilitado && (
            <div className="ml-10 space-y-3">
              <div className="flex items-center gap-4">
                <Label className="text-xs text-muted-foreground w-32">Tipo</Label>
                <Select
                  value={params.puntillado.tipo ?? "lateral"}
                  onValueChange={(v) => v && updatePuntillado({ tipo: v })}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue>{PUNTILLADO_TIPO_LABELS[params.puntillado.tipo ?? "lateral"] ?? "Lateral"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lateral" className="text-xs">Lateral</SelectItem>
                    <SelectItem value="matriz_comprobante" className="text-xs">
                      Matriz + comprobante
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-xs text-muted-foreground w-32">Borde</Label>
                <Select
                  value={params.puntillado.borde ?? "superior"}
                  onValueChange={(v) => v && updatePuntillado({ borde: v })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue>{BORDES_LABEL.get(params.puntillado.borde ?? "superior") ?? "Superior"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {BORDES.map((b) => (
                      <SelectItem key={b.value} value={b.value} className="text-xs">
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <Label className="text-xs text-muted-foreground w-32">Distancia (mm)</Label>
                <Input
                  type="number"
                  className="w-24 h-8 text-sm"
                  value={params.puntillado.distanciaBordeMm ?? 30}
                  onChange={(e) =>
                    updatePuntillado({
                      distanciaBordeMm: parseFloat(e.target.value) || 30,
                    })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modo impar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Modo talonario incompleto</CardTitle>
          <CardDescription>
            Qué hacer cuando la cantidad de talonarios no es múltiplo de las poses por pliego.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Select
              value={params.modoTalonarioIncompleto}
              onValueChange={(v) =>
                v && updateParams({
                  modoTalonarioIncompleto: v as "aprovechar_pliego" | "pose_completa",
                })
              }
            >
              <SelectTrigger className="w-64 h-8 text-sm">
                <SelectValue>{MODO_INCOMPLETO_LABELS[params.modoTalonarioIncompleto] ?? params.modoTalonarioIncompleto}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pose_completa">Pose completa (desperdicio)</SelectItem>
                <SelectItem value="aprovechar_pliego">Aprovechar pliego (dividir)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {params.modoTalonarioIncompleto === "pose_completa"
                ? "Se imprime como si fueran par. La pose sobrante es desperdicio. Más simple, más costo de material."
                : "El talonario sobrante se divide entre las poses del pliego. Menos desperdicio, más trabajo manual."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Materiales extra */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Materiales extra</CardTitle>
          <CardDescription>
            Materiales adicionales por talonario. El cartón va al tamaño del pliego.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={params.materialesExtra.cartonBase.habilitado}
                onCheckedChange={(checked) =>
                  updateParams({
                    materialesExtra: {
                      ...params.materialesExtra,
                      cartonBase: { ...params.materialesExtra.cartonBase, habilitado: checked },
                    },
                  })
                }
              />
              <Label>Cartón base (al tamaño del pliego, se corta con guillotina)</Label>
            </div>
            {params.materialesExtra.cartonBase.habilitado && (
              <div className="ml-10">
                <Select
                  value={params.materialesExtra.cartonBase.materiaPrimaVarianteId ?? "__none__"}
                  onValueChange={(v) => updateMaterialExtra("cartonBase", v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Elegir materia prima...">
                      {params.materialesExtra.cartonBase.materiaPrimaVarianteId
                        ? (materialLabelById.get(params.materialesExtra.cartonBase.materiaPrimaVarianteId) ?? "Materia prima seleccionada")
                        : "Elegir materia prima..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-[400px]">
                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                      Sin asignar
                    </SelectItem>
                    {allMaterialOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={params.materialesExtra.hojaBlancaSuperior.habilitado}
                onCheckedChange={(checked) =>
                  updateParams({
                    materialesExtra: {
                      ...params.materialesExtra,
                      hojaBlancaSuperior: {
                        ...params.materialesExtra.hojaBlancaSuperior,
                        habilitado: checked,
                      },
                    },
                  })
                }
              />
              <Label>Hoja blanca superior</Label>
            </div>
            {params.materialesExtra.hojaBlancaSuperior.habilitado && (
              <div className="ml-10">
                <Select
                  value={params.materialesExtra.hojaBlancaSuperior.materiaPrimaVarianteId ?? "__none__"}
                  onValueChange={(v) => updateMaterialExtra("hojaBlancaSuperior", v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Elegir materia prima...">
                      {params.materialesExtra.hojaBlancaSuperior.materiaPrimaVarianteId
                        ? (materialLabelById.get(params.materialesExtra.hojaBlancaSuperior.materiaPrimaVarianteId) ?? "Materia prima seleccionada")
                        : "Elegir materia prima..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-[400px]">
                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                      Sin asignar
                    </SelectItem>
                    {allMaterialOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Numeración */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Numeración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={params.numeracion.habilitado}
              onCheckedChange={(checked) => updateNumeracion({ habilitado: checked })}
            />
            <Label>Numeración digital habilitada</Label>
          </div>
          {params.numeracion.habilitado && (
            <div className="flex items-center gap-2 ml-10">
              <Label className="text-xs text-muted-foreground">Posición</Label>
              <Select
                value={params.numeracion.posicion ?? "superior_derecho"}
                onValueChange={(v) => v && updateNumeracion({ posicion: v })}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue>{POSICIONES_NUMERACION_LABEL.get(params.numeracion.posicion ?? "superior_derecho") ?? "Superior derecho"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {POSICIONES_NUMERACION.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SaveIcon className="mr-2 h-4 w-4" />
          )}
          Guardar composición
        </Button>
      </div>
    </div>
  );
}
