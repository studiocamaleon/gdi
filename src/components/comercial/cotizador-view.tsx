"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalculatorIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";
import {
  cotizar,
  cotizarYGuardar,
  getProductoById,
  type CotizarResponse,
} from "@/lib/productos-servicios-api";
import type {
  ProductoDetalle,
  ProductoListItem,
} from "@/lib/productos-servicios";

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(n);
}

function SelectDisplay({
  label,
  placeholder,
}: {
  label?: string | null;
  placeholder: string;
}) {
  return (
    <span
      className={`block flex-1 truncate text-left ${label ? "" : "text-muted-foreground"}`}
      title={label ?? placeholder}
    >
      {label || placeholder}
    </span>
  );
}

function productoLabel(
  producto?: Pick<ProductoListItem, "codigo" | "nombre"> | null,
) {
  if (!producto) return "";
  return producto.codigo
    ? `${producto.codigo} - ${producto.nombre}`
    : producto.nombre;
}

interface PiezaInput {
  uiKey: string;
  cantidad: number;
  anchoMm: number;
  altoMm: number;
}

interface SlotComercialElige {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  slotCodigo: string;
  candidatos: Array<{
    variantId: string;
    label?: string;
    default?: boolean;
  }>;
}

interface ModoColorComercial {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  label: string;
  options: Array<{
    value: string;
    label: string;
    perfilIds: string[];
  }>;
  defaultMode?: string;
}

function materialSelectionKey(configPasoId: string, slotCodigo: string) {
  return `${configPasoId}_${slotCodigo}`;
}

function getModoColorConfig(params: unknown): {
  enabled?: boolean;
  comercialElige?: boolean;
  defaultMode?: string;
  allowedModes?: string[];
} {
  if (!params || typeof params !== "object") return {};
  const config = (params as { modoColorConfig?: unknown }).modoColorConfig;
  if (!config || typeof config !== "object") return {};
  return config as {
    enabled?: boolean;
    comercialElige?: boolean;
    defaultMode?: string;
    allowedModes?: string[];
  };
}

function normalizeModoColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/WHITE/g, "BLANCO")
    .replace(/W/g, "BLANCO")
    .replace(/BARNIZ|VARNISH|VERNIS/g, "BARNIZ");
  if (!normalized) return undefined;
  if (["BN", "B/N", "K", "NEGRO", "BLACK"].includes(normalized)) return "BN";
  if (normalized === "CMYK") return "CMYK";
  if (["CMYK+BLANCO", "CMYKBLANCO"].includes(normalized)) {
    return "CMYK+blanco";
  }
  if (
    [
      "CMYK+BLANCO+BARNIZ",
      "CMYK+BARNIZ+BLANCO",
      "CMYKBLANCOBARNIZ",
      "CMYKBARNIZBLANCO",
    ].includes(normalized)
  ) {
    return "CMYK+blanco+barniz";
  }
  return value.trim();
}

function getModosColorComercial(
  rutaSel: ProductoDetalle["rutasAlternativas"][number] | undefined,
): ModoColorComercial[] {
  return (
    rutaSel?.configPasos
      .map((cp) => {
        const config = getModoColorConfig(cp.paramsPasoJson);
        const allowedModes = Array.isArray(config.allowedModes)
          ? config.allowedModes.map(normalizeModoColor).filter(Boolean)
          : [];
        const options = (cp.modoColorOptions ?? []).filter(
          (option) =>
            allowedModes.length === 0 ||
            allowedModes.includes(normalizeModoColor(option.value) ?? ""),
        );
        if (options.length === 0) return null;
        const comercialElige =
          config.comercialElige === true ||
          (config.enabled !== false && options.length > 1);
        if (!comercialElige) return null;
        return {
          configPasoId: cp.id,
          familiaCodigo: cp.rutaPaso.familiaCodigo,
          modoActivacion: cp.modoActivacion,
          label: "Modo de color",
          options,
          defaultMode: normalizeModoColor(config.defaultMode),
        };
      })
      .filter((modo): modo is ModoColorComercial => modo !== null) ?? []
  );
}

const ZONAS_VIATICO = [
  { value: "CABA", label: "CABA ($3.000)" },
  { value: "GBA_NORTE", label: "GBA Norte ($5.000)" },
  { value: "GBA_OESTE", label: "GBA Oeste ($5.000)" },
  { value: "GBA_SUR", label: "GBA Sur ($5.000)" },
  { value: "FUERA_AMBA", label: "Fuera AMBA ($12.000)" },
];

export function CotizadorView({
  productos,
}: {
  productos: ProductoListItem[];
}) {
  const router = useRouter();
  const [productoId, setProductoId] = React.useState<string>("");
  const [productoDetalle, setProductoDetalle] =
    React.useState<ProductoDetalle | null>(null);
  // Catálogo de familias para mostrar nombres humanos en lugar de códigos.
  const [catalogoFamilias, setCatalogoFamilias] = React.useState<
    Map<string, string>
  >(new Map());
  React.useEffect(() => {
    void getCatalogoFamilias().then((cat) => {
      setCatalogoFamilias(
        new Map(cat.familias.map((f) => [f.codigo, f.nombre])),
      );
    });
  }, []);
  const familiaLabel = React.useCallback(
    (codigo: string) => catalogoFamilias.get(codigo) ?? codigo,
    [catalogoFamilias],
  );
  const [rutaAlternativaId, setRutaAlternativaId] = React.useState<string>("");
  const [cantidad, setCantidad] = React.useState<number>(100);
  const [caras, setCaras] = React.useState<1 | 2>(1);
  const [tipoCopia, setTipoCopia] = React.useState<1 | 2 | 3>(1);
  const [opcionalesActivados, setOpcionalesActivados] = React.useState<
    Record<string, boolean>
  >({});
  const [seleccionMaterial, setSeleccionMaterial] = React.useState<
    Record<string, string>
  >({});
  // G-F2: máquina elegida por configPasoId cuando hay candidatas M-2.
  const [seleccionMaquina, setSeleccionMaquina] = React.useState<
    Record<string, string>
  >({});
  const [seleccionModoColor, setSeleccionModoColor] = React.useState<
    Record<string, string>
  >({});
  const [zonaInstalacion, setZonaInstalacion] = React.useState<string>("CABA");
  const [m2Instalados, setM2Instalados] = React.useState<number>(0);
  const [piezas, setPiezas] = React.useState<PiezaInput[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [resultado, setResultado] = React.useState<CotizarResponse | null>(
    null,
  );

  React.useEffect(() => {
    if (!productoId) return;
    setProductoDetalle(null);
    setResultado(null);
    setOpcionalesActivados({});
    setSeleccionMaterial({});
    setSeleccionMaquina({});
    setSeleccionModoColor({});
    setPiezas([]);
    void getProductoById(productoId).then((d) => {
      setProductoDetalle(d);
      const preferida = d.rutasAlternativas.find((r) => r.esPreferida);
      setRutaAlternativaId(preferida?.id ?? d.rutasAlternativas[0]?.id ?? "");
      // Si LIBRE, agregar 1 pieza inicial; si FIJA, dejar vacío (se usa cantidad)
      if (d.modoMedidas === "LIBRE") {
        setPiezas([
          {
            uiKey: `pz-${Date.now()}`,
            cantidad: 1,
            anchoMm: 1000,
            altoMm: 500,
          },
        ]);
      }
    });
  }, [productoId]);

  const productoSel = productos.find((p) => p.id === productoId);
  const rutaSel = productoDetalle?.rutasAlternativas.find(
    (r) => r.id === rutaAlternativaId,
  );
  const esMultiMedida = productoDetalle?.modoMedidas === "LIBRE";
  const rutaLabel = rutaSel
    ? `${rutaSel.nombre}${rutaSel.esPreferida ? " ★" : ""}`
    : "";
  const carasLabel = caras === 2 ? "Doble faz" : "Simple faz";
  const tipoCopiaLabel =
    tipoCopia === 1 ? "Simple" : tipoCopia === 2 ? "Duplicado" : "Triplicado";
  const zonaInstalacionLabel =
    ZONAS_VIATICO.find((z) => z.value === zonaInstalacion)?.label ?? "";
  const pasosOpcionales =
    rutaSel?.configPasos.filter((cp) => cp.modoActivacion === "OPCIONAL") ?? [];
  const cargosOpcionales =
    productoDetalle?.cargosDirectosCotizacion.filter(
      (c) => c.modoActivacion === "OPCIONAL",
    ) ?? [];

  // Slots COMERCIAL_ELIGE: extraer de los configPasos de la ruta seleccionada
  const slotsComercialElige = React.useMemo(
    () =>
      rutaSel?.configPasos.flatMap((cp) =>
      cp.slotsMateriales
        .filter((s) => s.modoSeleccion === "COMERCIAL_ELIGE")
        .map((s) => ({
          configPasoId: cp.id,
          familiaCodigo: cp.rutaPaso.familiaCodigo,
          modoActivacion: cp.modoActivacion,
          slotCodigo: s.slotCodigo,
          candidatos:
            (s.materialesCandidatosJson as Array<{
              variantId: string;
              label?: string;
              default?: boolean;
            }>) ?? [],
        })),
      ) ?? [],
    [rutaSel],
  );
  const slotsMaterialesPrincipales = slotsComercialElige.filter(
    (slot) => slot.modoActivacion !== "OPCIONAL",
  );
  const slotsMaterialesOpcionalesPorPaso = React.useMemo(() => {
    const map = new Map<string, SlotComercialElige[]>();
    for (const slot of slotsComercialElige) {
      if (slot.modoActivacion !== "OPCIONAL") continue;
      map.set(slot.configPasoId, [...(map.get(slot.configPasoId) ?? []), slot]);
    }
    return map;
  }, [slotsComercialElige]);

  // G-F2: pasos con máquinas candidatas M-2 (más de 1) → mostrar selector.
  const pasosConCandidatas =
    rutaSel?.configPasos
      .filter((cp) => (cp.maquinasCandidatas?.length ?? 0) > 1)
      .map((cp) => ({
        configPasoId: cp.id,
        familiaCodigo: cp.rutaPaso.familiaCodigo,
        candidatas: cp.maquinasCandidatas ?? [],
      })) ?? [];
  const modosColorComercial = getModosColorComercial(rutaSel).filter(
    (modo) =>
      modo.modoActivacion !== "OPCIONAL" ||
      Boolean(opcionalesActivados[modo.configPasoId]),
  );
  const modosColorVisibles = modosColorComercial.filter(
    (modo) => modo.options.length > 1,
  );

  const necesitaInstalacion = productoDetalle?.cargosDirectosCotizacion.some(
    (c) => c.cargoDirectoCatalogo.codigo === "viatico",
  );

  const construirJobContext = () => {
    const cantidadTrabajo = esMultiMedida
      ? piezas.reduce(
          (total, pieza) =>
            total + (Number.isFinite(pieza.cantidad) ? pieza.cantidad : 0),
          0,
        ) || 1
      : cantidad;
    const ctx: Record<string, unknown> = {
      cantidad: cantidadTrabajo,
      caras,
      tipoCopia,
      opcionalesActivados,
    };
    if (esMultiMedida && piezas.length > 0) {
      ctx.piezas = piezas.map((p) => ({
        cantidad: p.cantidad,
        anchoMm: p.anchoMm,
        altoMm: p.altoMm,
      }));
      ctx.piezaAnchoMaxMm = Math.max(...piezas.map((p) => p.anchoMm));
      ctx.piezaAltoMaxMm = Math.max(...piezas.map((p) => p.altoMm));
      ctx.piezaAreaTotalM2 = piezas.reduce(
        (total, pieza) =>
          total + (pieza.cantidad * pieza.anchoMm * pieza.altoMm) / 1_000_000,
        0,
      );
    }
    if (m2Instalados > 0) ctx.m2_instalados = m2Instalados;
    if (zonaInstalacion) ctx.zonaInstalacion = zonaInstalacion;
    // Inyectar selección de material por paso+slot. `slotMateriales` sobrevive
    // al ValidationPipe del backend; las claves planas quedan por compatibilidad.
    const slotCounts = slotsComercialElige.reduce<Record<string, number>>(
      (acc, slot) => ({
        ...acc,
        [slot.slotCodigo]: (acc[slot.slotCodigo] ?? 0) + 1,
      }),
      {},
    );
    const slotMateriales: Record<string, string> = {};
    for (const slot of slotsComercialElige) {
      const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
      const variantId = seleccionMaterial[key];
      if (!variantId) continue;
      slotMateriales[key] = variantId;
      ctx[`slotMaterial_${key}`] = variantId;
      if (slotCounts[slot.slotCodigo] === 1) {
        slotMateriales[slot.slotCodigo] = variantId;
        ctx[`slotMaterial_${slot.slotCodigo}`] = variantId;
      }
    }
    if (Object.keys(slotMateriales).length > 0) {
      ctx.slotMateriales = slotMateriales;
    }
    // G-F2: inyectar override de máquina M-2 por configPasoId.
    for (const [configPasoId, maquinaId] of Object.entries(seleccionMaquina)) {
      if (maquinaId) ctx[`maquinaSeleccionada_${configPasoId}`] = maquinaId;
    }
    const modoColorPorPaso: Record<string, string> = {};
    for (const modo of modosColorComercial) {
      const selected =
        normalizeModoColor(seleccionModoColor[modo.configPasoId]) ??
        modo.defaultMode ??
        normalizeModoColor(modo.options[0]?.value);
      if (!selected) continue;
      modoColorPorPaso[modo.configPasoId] = selected;
      ctx[`modoColor_${modo.configPasoId}`] = selected;
      if (modosColorComercial.length === 1) ctx.modoColor = selected;
    }
    if (Object.keys(modoColorPorPaso).length > 0) {
      ctx.modoColorPorPaso = modoColorPorPaso;
    }
    return ctx;
  };

  const ejecutarCotizacion = async () => {
    setCargando(true);
    setResultado(null);
    try {
      const res = await cotizar({
        productoId,
        rutaAlternativaId,
        jobContext: construirJobContext() as never,
        periodo: "2026-03",
      });
      setResultado(res);
      if (!res.exitoso) {
        toast.error(`Cotización falló: ${res.errores[0]?.mensaje}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCargando(false);
    }
  };

  const guardarCotizacion = async () => {
    setGuardando(true);
    try {
      const res = await cotizarYGuardar({
        productoId,
        rutaAlternativaId,
        jobContext: construirJobContext() as never,
        periodo: "2026-03",
      });
      if (res.result.exitoso && res.cotizacionId) {
        toast.success(
          `Cotización guardada (ID: ${res.cotizacionId.slice(0, 8)}...)`,
        );
        router.refresh();
      } else {
        toast.error("No se pudo guardar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setGuardando(false);
    }
  };

  const agregarPieza = () => {
    setPiezas((prev) => [
      ...prev,
      {
        uiKey: `pz-${Date.now()}-${Math.random()}`,
        cantidad: 1,
        anchoMm: 1000,
        altoMm: 500,
      },
    ]);
  };

  const updatePieza = (idx: number, patch: Partial<PiezaInput>) => {
    setPiezas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  const removePieza = (idx: number) => {
    setPiezas((prev) => prev.filter((_, i) => i !== idx));
  };

  const limpiarMaterialesDelPaso = (configPasoId: string) => {
    setSeleccionMaterial((prev) => {
      const next = { ...prev };
      for (const slot of slotsComercialElige) {
        if (slot.configPasoId !== configPasoId) continue;
        delete next[materialSelectionKey(slot.configPasoId, slot.slotCodigo)];
      }
      return next;
    });
  };

  const togglePasoOpcional = (configPasoId: string, checked: boolean) => {
    setResultado(null);
    setOpcionalesActivados((prev) => ({
      ...prev,
      [configPasoId]: checked,
    }));
    if (!checked) limpiarMaterialesDelPaso(configPasoId);
  };

  const renderMaterialSelect = (slot: SlotComercialElige) => {
    const selectionKey = materialSelectionKey(
      slot.configPasoId,
      slot.slotCodigo,
    );
    const selectedMaterialId = seleccionMaterial[selectionKey] ?? "";
    const selectedMaterial =
      slot.candidatos.find((c) => c.variantId === selectedMaterialId) ?? null;
    const defaultCandidate = slot.candidatos.find((c) => c.default);
    const selectedMaterialLabel = selectedMaterial
      ? `${selectedMaterial.label ?? selectedMaterial.variantId}${
          selectedMaterial.default ? " (default)" : ""
        }`
      : "";

    return (
      <div key={selectionKey} className="space-y-1">
        <div className="text-muted-foreground text-xs">
          {familiaLabel(slot.familiaCodigo)} ·{" "}
          {slot.slotCodigo.replace(/_/g, " ")}
          {defaultCandidate && !selectedMaterialId ? (
            <span className="ml-1">
              Sugerido: {defaultCandidate.label ?? defaultCandidate.variantId}
            </span>
          ) : null}
        </div>
        <Select
          value={selectedMaterialId}
          onValueChange={(v) => {
            setResultado(null);
            setSeleccionMaterial((prev) => ({
              ...prev,
              [selectionKey]: v ?? "",
            }));
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectDisplay
              label={selectedMaterialLabel}
              placeholder="Elegí un material"
            />
          </SelectTrigger>
          <SelectContent>
            {slot.candidatos.map((c) => (
              <SelectItem key={c.variantId} value={c.variantId}>
                {c.label ?? c.variantId} {c.default && "(default)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cotizador</h1>
        <p className="text-muted-foreground text-sm">
          Cotizar productos del Modelo Universal. Invoca el motor backend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* COLUMNA IZQUIERDA: Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la cotización</CardTitle>
            <CardDescription>
              Elegí el producto, la ruta alternativa, y los inputs del trabajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="producto">Producto</Label>
              <Select
                value={productoId}
                onValueChange={(v) => setProductoId(v ?? "")}
              >
                <SelectTrigger id="producto">
                  <SelectDisplay
                    label={productoLabel(productoSel)}
                    placeholder="Elegí un producto"
                  />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {productoLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productoDetalle &&
              productoDetalle.rutasAlternativas.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="ruta">Ruta alternativa</Label>
                  <Select
                    value={rutaAlternativaId}
                    onValueChange={(v) => {
                      setRutaAlternativaId(v ?? "");
                      setSeleccionMaterial({});
                      setSeleccionMaquina({});
                      setSeleccionModoColor({});
                      setOpcionalesActivados({});
                    }}
                  >
                    <SelectTrigger id="ruta">
                      <SelectDisplay
                        label={rutaLabel}
                        placeholder="Elegí una ruta"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {productoDetalle.rutasAlternativas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nombre} {r.esPreferida && "★"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {!esMultiMedida && (
              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min={1}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caras">Caras</Label>
                <Select
                  value={String(caras)}
                  onValueChange={(v) => setCaras(Number(v) as 1 | 2)}
                >
                  <SelectTrigger id="caras">
                    <SelectDisplay
                      label={carasLabel}
                      placeholder="Elegí las caras"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Simple faz</SelectItem>
                    <SelectItem value="2">Doble faz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {productoSel?.codigo === "TALON-DUPL-A4" && (
                <div className="space-y-2">
                  <Label htmlFor="tipoCopia">Tipo copia</Label>
                  <Select
                    value={String(tipoCopia)}
                    onValueChange={(v) => setTipoCopia(Number(v) as 1 | 2 | 3)}
                  >
                    <SelectTrigger id="tipoCopia">
                      <SelectDisplay
                        label={tipoCopiaLabel}
                        placeholder="Elegí el tipo"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Simple</SelectItem>
                      <SelectItem value="2">Duplicado</SelectItem>
                      <SelectItem value="3">Triplicado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {modosColorVisibles.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label={
                    modosColorVisibles.length === 1
                      ? "Modo de color"
                      : "Modo de color por paso"
                  }
                  tooltip="Modo comercial admitido por el paso de impresión. Define el perfil de máquina y los consumibles costeados."
                />
                {modosColorVisibles.map((modo) => {
                  const selectedValue =
                    normalizeModoColor(seleccionModoColor[modo.configPasoId]) ??
                    modo.defaultMode ??
                    normalizeModoColor(modo.options[0]?.value) ??
                    "";
                  const selectedOption =
                    modo.options.find(
                      (option) =>
                        normalizeModoColor(option.value) === selectedValue,
                    ) ?? null;
                  const label =
                    modosColorVisibles.length === 1
                      ? "Modo de color"
                      : familiaLabel(modo.familiaCodigo);

                  return (
                    <div key={modo.configPasoId} className="space-y-1">
                      <Label
                        htmlFor={`modo-color-${modo.configPasoId}`}
                        className="text-muted-foreground text-xs"
                      >
                        {label}
                      </Label>
                      <Select
                        value={selectedValue}
                        onValueChange={(v) => {
                          setResultado(null);
                          setSeleccionModoColor((prev) => ({
                            ...prev,
                            [modo.configPasoId]: normalizeModoColor(v) ?? v,
                          }));
                        }}
                      >
                        <SelectTrigger id={`modo-color-${modo.configPasoId}`}>
                          <SelectDisplay
                            label={selectedOption?.label ?? selectedValue}
                            placeholder="Elegí un modo"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {modo.options.map((option) => {
                            const value =
                              normalizeModoColor(option.value) ?? option.value;
                            return (
                              <SelectItem key={value} value={value}>
                                {option.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PIEZAS multi-medida (solo si modoMedidas LIBRE) */}
            {productoDetalle?.modoMedidas === "LIBRE" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Piezas a producir (multi-medida)</Label>
                  <Button onClick={agregarPieza} variant="outline" size="sm">
                    <PlusIcon className="mr-1 size-3" />
                    Agregar pieza
                  </Button>
                </div>
                {piezas.map((p, idx) => (
                  <div
                    key={p.uiKey}
                    className="bg-muted/30 flex items-center gap-2 rounded p-2"
                  >
                    <Input
                      type="number"
                      value={p.cantidad}
                      onChange={(e) =>
                        updatePieza(idx, { cantidad: Number(e.target.value) })
                      }
                      className="h-8 w-20 text-xs"
                      placeholder="cant"
                    />
                    <span className="text-xs">×</span>
                    <Input
                      type="number"
                      value={p.anchoMm}
                      onChange={(e) =>
                        updatePieza(idx, { anchoMm: Number(e.target.value) })
                      }
                      className="h-8 w-20 text-xs"
                      placeholder="ancho"
                    />
                    <span className="text-xs">×</span>
                    <Input
                      type="number"
                      value={p.altoMm}
                      onChange={(e) =>
                        updatePieza(idx, { altoMm: Number(e.target.value) })
                      }
                      className="h-8 w-20 text-xs"
                      placeholder="alto"
                    />
                    <span className="text-muted-foreground text-xs">mm</span>
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePieza(idx)}
                      className="h-7 w-7 p-0 text-red-600"
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Slots COMERCIAL_ELIGE */}
            {slotsMaterialesPrincipales.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Materiales a elegir"
                  tooltip="Materiales requeridos por pasos activos del producto. Los pasos opcionales muestran su material al activarlos."
                />
                {slotsMaterialesPrincipales.map((slot) =>
                  renderMaterialSelect(slot),
                )}
              </div>
            )}

            {/* G-F2: Override de máquina M-2 cuando hay candidatas */}
            {pasosConCandidatas.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Máquina por paso"
                  tooltip="Algunos pasos tienen máquinas alternativas. Podés elegir cuál usar para esta cotización; si no elegís, se usa la marcada como preferida."
                />
                {pasosConCandidatas.map((p) => {
                  const selectedMachineId =
                    seleccionMaquina[p.configPasoId] ?? "";
                  const selectedMachine =
                    p.candidatas.find(
                      (c) => c.maquinaId === selectedMachineId,
                    ) ?? p.candidatas.find((c) => c.esPreferida);
                  const selectedMachineLabel = selectedMachine
                    ? `${selectedMachineId ? "" : "Preferida: "}${selectedMachine.maquina.nombre}${
                        selectedMachine.esPreferida ? " ★" : ""
                      }`
                    : "";

                  return (
                    <div key={p.configPasoId} className="space-y-1">
                      <Label
                        htmlFor={`maq-${p.configPasoId}`}
                        className="text-muted-foreground text-xs"
                      >
                        {familiaLabel(p.familiaCodigo)}
                      </Label>
                      <Select
                        value={selectedMachineId}
                        onValueChange={(v) =>
                          setSeleccionMaquina((prev) => ({
                            ...prev,
                            [p.configPasoId]: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger id={`maq-${p.configPasoId}`}>
                          <SelectDisplay
                            label={selectedMachineLabel}
                            placeholder="Usar máquina preferida"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {p.candidatas.map((c) => (
                            <SelectItem key={c.maquinaId} value={c.maquinaId}>
                              {c.maquina.nombre} {c.esPreferida ? "★" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pasos opcionales */}
            {pasosOpcionales.length > 0 && (
              <div className="space-y-2">
                <LabelConTooltip
                  label="Pasos opcionales"
                  tooltip="Pasos del producto que se incluyen solo si el cliente los elige (ej: laminado, redondeo)."
                />
                <div className="space-y-1.5">
                  {pasosOpcionales.map((cp) => {
                    const slotsPaso =
                      slotsMaterialesOpcionalesPorPaso.get(cp.id) ?? [];
                    const activo = !!opcionalesActivados[cp.id];
                    return (
                      <div key={cp.id} className="rounded">
                        <label className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm">
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={(e) =>
                              togglePasoOpcional(cp.id, e.target.checked)
                            }
                          />
                          <span className="font-medium">
                            {familiaLabel(cp.rutaPaso.familiaCodigo)}
                          </span>
                          {cp.maquinaM1 && (
                            <span className="text-muted-foreground text-xs">
                              ({cp.maquinaM1.nombre})
                            </span>
                          )}
                        </label>
                        {activo && slotsPaso.length > 0 && (
                          <div className="ml-6 space-y-2 border-l pl-3 pb-2">
                            {slotsPaso.map((slot) =>
                              renderMaterialSelect(slot),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cargos directos opcionales */}
            {cargosOpcionales.length > 0 && (
              <div className="space-y-2">
                <Label>Cargos directos opcionales</Label>
                {cargosOpcionales.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <label className="hover:bg-accent flex items-center gap-2 rounded p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!opcionalesActivados[c.id]}
                        onChange={(e) =>
                          setOpcionalesActivados((prev) => ({
                            ...prev,
                            [c.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>{c.cargoDirectoCatalogo.nombre}</span>
                    </label>
                    {/* Si el cargo activo es viático, mostrar selector de zona */}
                    {c.cargoDirectoCatalogo.codigo === "viatico" &&
                      opcionalesActivados[c.id] && (
                        <div className="ml-6 space-y-1">
                          <Label className="text-xs">Zona</Label>
                          <Select
                            value={zonaInstalacion}
                            onValueChange={(v) =>
                              setZonaInstalacion(v ?? "CABA")
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectDisplay
                                label={zonaInstalacionLabel}
                                placeholder="Elegí una zona"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {ZONAS_VIATICO.map((z) => (
                                <SelectItem key={z.value} value={z.value}>
                                  {z.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            {/* Instalación m² (si necesita) */}
            {necesitaInstalacion && (
              <div className="space-y-2">
                <Label htmlFor="m2instalados">m² instalados (si aplica)</Label>
                <Input
                  id="m2instalados"
                  type="number"
                  value={m2Instalados}
                  onChange={(e) => setM2Instalados(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={ejecutarCotizacion}
                disabled={!productoId || cargando}
                className="flex-1"
                size="lg"
              >
                <CalculatorIcon className="mr-2 size-4" />
                {cargando ? "Calculando..." : "Cotizar"}
              </Button>
              <Button
                onClick={guardarCotizacion}
                disabled={!productoId || guardando || !resultado?.exitoso}
                variant="outline"
                size="lg"
              >
                <SaveIcon className="mr-2 size-4" />
                {guardando ? "..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* COLUMNA DERECHA: Resultado */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              Costo + precio + trazabilidad por paso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resultado ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                Configurá el producto y presioná Cotizar
              </div>
            ) : !resultado.exitoso ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircleIcon className="size-5" />
                  <span className="font-medium">Cotización falló</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {resultado.errores.map((e, i) => (
                    <li key={i} className="bg-red-50 rounded p-2 text-red-900">
                      <div className="font-mono text-xs">{e.codigo}</div>
                      <div>{e.mensaje}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : resultado.cotizacion ? (
              <ResultadoCotizacion
                cotizacion={resultado.cotizacion}
                familiaLabel={familiaLabel}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultadoCotizacion({
  cotizacion,
  familiaLabel,
}: {
  cotizacion: NonNullable<CotizarResponse["cotizacion"]>;
  familiaLabel: (codigo: string) => string;
}) {
  const c = cotizacion;
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(
    () => new Set(),
  );
  const toggleStep = (orden: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(orden)) next.delete(orden);
      else next.add(orden);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2Icon className="size-5" />
        <span className="font-medium">Cotización OK</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded p-3">
          <div className="text-muted-foreground text-xs">Costo total</div>
          <div className="text-lg font-semibold">
            {formatARS(c.costos.total)}
          </div>
        </div>
        {c.desglosePrecio ? (
          <div className="bg-primary/10 rounded p-3">
            <div className="text-muted-foreground text-xs">
              Precio total (con IVA)
            </div>
            <div className="text-primary text-lg font-semibold">
              {formatARS(c.desglosePrecio.precioBrutoTotal)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              margen bruto: {c.desglosePrecio.margenEfectivoPct.toFixed(1)}%
              {c.desglosePrecio.precioEspecialCliente && (
                <span className="text-amber-700 ml-1">
                  · precio especial aplicado
                </span>
              )}
            </div>
          </div>
        ) : c.precio ? (
          <div className="bg-primary/10 rounded p-3">
            <div className="text-muted-foreground text-xs">
              Precio total (Tab Precio)
            </div>
            <div className="text-primary text-lg font-semibold">
              {formatARS(c.precio.precioTotal)}
            </div>
            {c.precio.margenAplicadoPct !== undefined && (
              <div className="text-muted-foreground mt-1 text-xs">
                margen: {c.precio.margenAplicadoPct}%
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="text-muted-foreground text-xs">
        Costo unitario: {formatARS(c.costos.unitario)}
        {c.desglosePrecio && (
          <>
            {" "}
            · Precio unitario bruto:{" "}
            {formatARS(c.desglosePrecio.precioBrutoUnitario)}
          </>
        )}
        {!c.desglosePrecio && c.precio && (
          <> · Precio unitario: {formatARS(c.precio.precioUnitario)}</>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Tiempo total:</span>
          <span className="font-mono">{formatARS(c.costos.tiempoTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Materiales total:</span>
          <span className="font-mono">
            {formatARS(c.costos.materialesTotal)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Cargos directos:</span>
          <span className="font-mono">
            {formatARS(c.costos.cargosDirectosTotal)}
          </span>
        </div>
      </div>

      {/* Sprint 5.a — Desglose comercial (precio base + comisiones + impuestos) */}
      {c.desglosePrecio && (
        <details className="text-sm">
          <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
            Desglose comercial del precio
          </summary>
          <div className="mt-2 space-y-2 rounded border bg-muted/30 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precio base:</span>
              <span className="font-mono">
                {formatARS(c.desglosePrecio.precioBase)} / unidad
              </span>
            </div>

            {c.desglosePrecio.comisiones.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Comisiones
                </div>
                {c.desglosePrecio.comisiones.map((com) => (
                  <div
                    key={com.catalogoId}
                    className="flex justify-between text-xs"
                  >
                    <span>
                      {com.nombre}{" "}
                      <span className="text-muted-foreground font-mono">
                        ({com.porcentaje.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 text-sm">
                  <span className="text-muted-foreground">
                    Total comisiones:
                  </span>
                  <span className="font-mono">
                    {formatARS(c.desglosePrecio.totalComisiones)} / unidad
                  </span>
                </div>
              </div>
            )}

            {c.desglosePrecio.impuestos.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="text-muted-foreground text-xs font-medium uppercase">
                  Impuestos
                </div>
                {c.desglosePrecio.impuestos.map((imp) => (
                  <div
                    key={imp.catalogoId}
                    className="flex justify-between text-xs"
                  >
                    <span>
                      {imp.nombre}{" "}
                      <span className="text-muted-foreground font-mono">
                        ({imp.porcentaje.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 text-sm">
                  <span className="text-muted-foreground">
                    Total impuestos:
                  </span>
                  <span className="font-mono">
                    {formatARS(c.desglosePrecio.totalImpuestos)} / unidad
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Precio neto unitario:
                </span>
                <span className="font-mono">
                  {formatARS(c.desglosePrecio.precioNetoUnitario)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Precio bruto unitario (con IVA):</span>
                <span className="font-mono">
                  {formatARS(c.desglosePrecio.precioBrutoUnitario)}
                </span>
              </div>
            </div>

            {c.desglosePrecio.precioEspecialCliente && (
              <div className="border-t pt-2 text-xs text-amber-700">
                ⚠ Se aplicó precio especial del cliente (override del standard).
              </div>
            )}
          </div>
        </details>
      )}

      <details className="text-sm">
        <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
          Trazabilidad por paso ({c.pasos.length})
        </summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Paso</TableHead>
              <TableHead className="text-right">Tiempo</TableHead>
              <TableHead className="text-right">Materiales</TableHead>
              <TableHead className="text-right">Cargos</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.pasos.map((p) => {
              const materialesTotal = sumMateriales(p.materiales);
              const cargosTotal = sumCargos(p.cargosDirectosPaso);
              const expanded = expandedSteps.has(p.rutaPasoOrden);
              const canExpand = p.activado;
              return (
                <React.Fragment key={p.rutaPasoOrden}>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canExpand ? (
                          <button
                            type="button"
                            onClick={() => toggleStep(p.rutaPasoOrden)}
                            className="hover:bg-accent inline-flex size-6 items-center justify-center rounded"
                            aria-label={
                              expanded
                                ? "Ocultar desglose del paso"
                                : "Mostrar desglose del paso"
                            }
                          >
                            <ChevronDownIcon
                              className={`size-4 transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="size-6" />
                        )}
                        {p.activado ? (
                          <CheckCircle2Icon className="size-4 text-green-500" />
                        ) : (
                          <CircleIcon className="size-4 text-gray-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {p.rutaPasoOrden}. {familiaLabel(p.familiaCodigo)}
                      </div>
                      {!p.activado && p.razonNoActivado && (
                        <div className="text-muted-foreground text-xs">
                          {p.razonNoActivado}
                        </div>
                      )}
                      {p.activado && (p.materiales?.length ?? 0) > 0 && (
                        <div className="text-muted-foreground text-xs">
                          {p.materiales!.length}{" "}
                          {p.materiales!.length === 1 ? "ítem" : "ítems"} de
                          material
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.activado && p.tiempo ? (
                        <div>
                          <div>{formatARS(p.tiempo.costo)}</div>
                          <div className="text-muted-foreground">
                            {p.tiempo.totalMin}min
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.activado && materialesTotal > 0 ? (
                        formatARS(materialesTotal)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {p.activado && cargosTotal > 0 ? (
                        formatARS(cargosTotal)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {p.activado ? formatARS(p.costoTotal) : "—"}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow className="bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell colSpan={5}>
                        <PasoCostBreakdown paso={p} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </details>

      {c.cargosDirectosCotizacion.length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="font-medium">Cargos directos cotización</div>
          {c.cargosDirectosCotizacion.map((cd, i) => (
            <div key={i} className="flex justify-between">
              <Badge variant="outline">{cd.cargoNombre}</Badge>
              <span className="font-mono">{formatARS(cd.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {c.pasos.some((p) => p.nestingResult) && (
        <details className="text-sm">
          <summary className="hover:bg-accent cursor-pointer rounded p-2 font-medium">
            Cómo se acomodan las piezas (
            {c.pasos.filter((p) => p.nestingResult).length}{" "}
            {c.pasos.filter((p) => p.nestingResult).length === 1
              ? "paso"
              : "pasos"}
            )
          </summary>
          <div className="space-y-4 mt-2">
            {c.pasos
              .filter((p) => p.nestingResult)
              .map((p) => (
                <div key={p.rutaPasoOrden} className="space-y-2">
                  <div className="text-sm font-medium">
                    Paso {p.rutaPasoOrden}. {familiaLabel(p.familiaCodigo)}
                  </div>
                  <NestingViewer
                    result={p.nestingResult!}
                    costingDetails={p.materiales ?? []}
                  />
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

type PasoCotizado = NonNullable<CotizarResponse["cotizacion"]>["pasos"][number];
type MaterialCotizado = NonNullable<PasoCotizado["materiales"]>[number];
type CargoPasoCotizado = NonNullable<PasoCotizado["cargosDirectosPaso"]>[number];

function PasoCostBreakdown({ paso }: { paso: PasoCotizado }) {
  const materiales = paso.materiales ?? [];
  const cargos = paso.cargosDirectosPaso ?? [];

  return (
    <div className="space-y-4 py-3">
      <div className="grid gap-3 md:grid-cols-3">
        <CostMiniPanel
          label="Tiempo"
          value={paso.tiempo ? formatARS(paso.tiempo.costo) : "—"}
          detail={
            paso.tiempo
              ? `${paso.tiempo.totalMin}min · ${formatARS(paso.tiempo.tarifaHora)}/h`
              : "Sin tiempo calculado"
          }
        />
        <CostMiniPanel
          label="Materiales"
          value={formatARS(sumMateriales(materiales))}
          detail={
            materiales.length > 0
              ? `${materiales.length} ${materiales.length === 1 ? "ítem" : "ítems"}`
              : "Sin materiales"
          }
        />
        <CostMiniPanel
          label="Cargos"
          value={formatARS(sumCargos(cargos))}
          detail={
            cargos.length > 0
              ? `${cargos.length} ${cargos.length === 1 ? "cargo" : "cargos"}`
              : "Sin cargos directos"
          }
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase text-muted-foreground">
          Materiales y consumibles
        </div>
        {materiales.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiales.map((material, index) => (
                <TableRow key={`${material.slotCodigo}-${material.materialVarianteId}-${index}`}>
                  <TableCell>
                    <Badge variant="outline">
                      {materialBadgeLabel(material)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {material.materialDisplayName || material.materialNombre}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {material.materialSku || material.materialNombre}
                      {material.materiaPrimaNombre &&
                        material.materiaPrimaNombre !==
                          material.materialDisplayName && (
                          <> · {material.materiaPrimaNombre}</>
                        )}
                    </div>
                    {material.detalleCosteoNesting && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        Costeo:{" "}
                        {strategyLabel(material.detalleCosteoNesting.strategy)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCantidad(material.cantidad)} {material.unidad}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatARS(material.precioUnitario)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">
                    {formatARS(material.costoTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            Este paso no consumió materiales ni consumibles.
          </div>
        )}
      </div>

      {cargos.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            Cargos directos del paso
          </div>
          <div className="space-y-1">
            {cargos.map((cargo) => (
              <div
                key={`${cargo.cargoCodigo}-${cargo.cargoNombre}`}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{cargo.cargoNombre}</div>
                  <div className="text-muted-foreground text-xs">
                    {cargo.modoCalculo}
                  </div>
                </div>
                <div className="font-mono">{formatARS(cargo.monto)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CostMiniPanel({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-mono text-sm font-medium">{value}</div>
      <div className="text-muted-foreground text-xs">{detail}</div>
    </div>
  );
}

function sumMateriales(materiales?: MaterialCotizado[]) {
  return (materiales ?? []).reduce((acc, material) => acc + material.costoTotal, 0);
}

function sumCargos(cargos?: CargoPasoCotizado[]) {
  return (cargos ?? []).reduce((acc, cargo) => acc + cargo.monto, 0);
}

function formatCantidad(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: value >= 10 ? 2 : 4,
  }).format(value);
}

function materialBadgeLabel(material: MaterialCotizado) {
  if (material.tipoLineaCosto === "CONSUMIBLE_MAQUINA") {
    return "Consumible máquina";
  }
  if (material.slotCodigo === "sustrato_principal") return "Sustrato";
  if (material.modoSeleccion === "COMERCIAL_ELIGE") return "Elegido por comercial";
  if (material.modoSeleccion === "MOTOR_ELIGE_AUTO") return "Elegido por motor";
  return "Fijo";
}

function strategyLabel(strategy: string) {
  const labels: Record<string, string> = {
    simple: "simple",
    "m2-exact": "m² exactos",
    "consumed-length": "largo consumido",
    "plate-segments": "segmentos",
    consumo_maquina_por_m2: "consumo por m²",
  };
  return labels[strategy] ?? strategy;
}
