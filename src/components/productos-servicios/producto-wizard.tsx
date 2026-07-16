"use client";

/**
 * <ProductoWizard /> — flujo guiado de 5 pasos para crear/editar un producto.
 *
 * Reemplaza las 6 pantallas separadas (identidad, rutas, config-pasos, cargos,
 * precio, validar) por un wizard con barra de progreso lateral, validación
 * por step y navegación libre cuando el producto ya existe.
 *
 * Steps:
 *   1. Identidad + Comercial — qué es y cómo se cobra.
 *   2. Rutas — elegir ruta(s) alternativa(s) con preferida.
 *   3. Configurar pasos — para cada ruta, ir al editor de config-pasos.
 *   4. Cargos extras — cargos directos a nivel cotización.
 *   5. Precio + revisar — Tab Precio + panel de validación final.
 *
 * Modo "crear": step 1 crea el producto y redirige al wizard del recién creado.
 * Modo "editar": el producto ya existe; el wizard se abre en `?step=N` (default 1).
 *
 * Las páginas deep-link existentes (`/[id]/rutas`, `/[id]/cargos`,
 * `/[id]/rutas/[rutaAltId]`) siguen funcionando — el wizard no las reemplaza,
 * las usa como _navegación_ desde steps que necesitan más espacio (config-pasos).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleIcon,
  CogIcon,
  GitBranchIcon,
  PackageIcon,
  ReceiptIcon,
  SaveIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ProductoValidacionPanel } from "@/components/productos-servicios/producto-validacion-panel";
import {
  precioConfigKey,
  type TabPrecioConfig,
} from "@/components/productos-servicios/tab-precio-editor";
import { TabPrecioCompleto } from "@/components/productos-servicios/tab-precio-completo";
import {
  actualizarProducto,
  actualizarProductoRutaAlt,
  asociarCargoCotizacion,
  crearProducto,
  crearProductoRutaAlt,
  desasociarCargoCotizacion,
  eliminarProductoRutaAlt,
  getCatalogoComercial,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  MedidaPredefinidaProducto,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
  RutaListItem,
} from "@/lib/productos-servicios";
import { unidadComercialProductoItems } from "@/lib/productos-servicios";
import {
  getMedidasPredefinidas,
  medidaLabel,
  normalizeMedidasDraft,
} from "@/lib/producto-medidas";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

// ─── Configuración de steps ────────────────────────────────────────

const STEPS = [
  {
    id: "identidad",
    nombre: "Identidad",
    descripcion: "Qué es y cómo se cobra",
    icon: TagIcon,
  },
  {
    id: "rutas",
    nombre: "Rutas",
    descripcion: "Caminos de producción",
    icon: GitBranchIcon,
  },
  {
    id: "config-pasos",
    nombre: "Configurar pasos",
    descripcion: "Máquinas y materiales",
    icon: CogIcon,
  },
  {
    id: "cargos",
    nombre: "Cargos",
    descripcion: "Extras de cotización",
    icon: ReceiptIcon,
  },
  {
    id: "precio",
    nombre: "Precio + revisar",
    descripcion: "Cómo se cobra y validar",
    icon: SaveIcon,
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const MODOS_MEDIDAS = [
  { value: "FIJA", label: "Fija" },
  { value: "LIBRE", label: "Libre" },
  { value: "COMERCIAL_ELIGE", label: "Comercial elige" },
  { value: "MIXTA", label: "Mixta" },
];

function modoMedidasUsaPredefinidas(modo: string) {
  return modo !== "LIBRE";
}

function normalizarMedidasPorModo(
  modo: string,
  medidas: MedidaPredefinidaProducto[],
) {
  if (!modoMedidasUsaPredefinidas(modo)) return [];
  const normalizadas = normalizeMedidasDraft(medidas);
  if (modo !== "FIJA") return normalizadas;
  const defaultMedida = normalizadas.find((medida) => medida.esDefault) ?? normalizadas[0];
  return defaultMedida ? [{ ...defaultMedida, esDefault: true }] : [];
}

function nuevaMedidaPredefinida(index: number): MedidaPredefinidaProducto {
  return {
    id: `medida-${Date.now()}-${index}`,
    nombre: "",
    anchoMm: 0,
    altoMm: 0,
    esDefault: index === 0,
  };
}

function MedidasPredefinidasWizard({
  medidas,
  onChange,
}: {
  medidas: MedidaPredefinidaProducto[];
  onChange: (medidas: MedidaPredefinidaProducto[]) => void;
}) {
  const updateMedida = (
    id: string,
    patch: Partial<MedidaPredefinidaProducto>,
  ) => {
    onChange(medidas.map((medida) => (medida.id === id ? { ...medida, ...patch } : medida)));
  };
  const setDefault = (id: string) => {
    onChange(medidas.map((medida) => ({ ...medida, esDefault: medida.id === id })));
  };
  const removeMedida = (id: string) => {
    const next = medidas.filter((medida) => medida.id !== id);
    onChange(
      next.some((medida) => medida.esDefault)
        ? next
        : next.map((medida, index) => ({ ...medida, esDefault: index === 0 })),
    );
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Medidas disponibles</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...medidas, nuevaMedidaPredefinida(medidas.length)])}
        >
          Agregar medida
        </Button>
      </div>
      <div className="space-y-2">
        {medidas.map((medida, index) => (
          <div
            key={medida.id}
            className="grid grid-cols-[1.4fr_0.8fr_0.8fr_auto_auto] items-center gap-2"
          >
            <Input
              value={medida.nombre}
              onChange={(event) => updateMedida(medida.id, { nombre: event.target.value })}
              placeholder={medidaLabel({ ...medida, nombre: "" })}
              aria-label={`Nombre de medida ${index + 1}`}
            />
            <Input
              type="number"
              min="0"
              value={medida.anchoMm || ""}
              onChange={(event) =>
                updateMedida(medida.id, { anchoMm: Number(event.target.value) || 0 })
              }
              placeholder="Ancho"
              aria-label={`Ancho de medida ${index + 1}`}
            />
            <Input
              type="number"
              min="0"
              value={medida.altoMm || ""}
              onChange={(event) =>
                updateMedida(medida.id, { altoMm: Number(event.target.value) || 0 })
              }
              placeholder="Alto"
              aria-label={`Alto de medida ${index + 1}`}
            />
            <Button
              type="button"
              variant={medida.esDefault ? "default" : "outline"}
              size="icon"
              onClick={() => setDefault(medida.id)}
              aria-pressed={medida.esDefault}
              title={
                medida.esDefault
                  ? "Medida predeterminada"
                  : "Marcar como predeterminada"
              }
            >
              <StarIcon className="size-4" fill={medida.esDefault ? "currentColor" : "none"} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeMedida(medida.id)}
              disabled={medidas.length <= 1}
              title="Eliminar medida"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        La medida con estrella se usa por defecto al cotizar.
      </p>
    </div>
  );
}

interface Props {
  modo: "crear" | "editar";
  productoExistente?: ProductoDetalle;
  rutasDisponibles?: RutaListItem[];
  catalogoCargos?: CargoDirectoCatalogo[];
}

interface ValidacionStep {
  errores: string[];
  warnings: string[];
}

// ─── Validaciones por step ─────────────────────────────────────────

function validarIdentidad(state: { nombre: string }): ValidacionStep {
  const errores: string[] = [];
  if (!state.nombre.trim()) errores.push("Falta nombre");
  return { errores, warnings: [] };
}

function validarRutas(producto: ProductoDetalle | undefined): ValidacionStep {
  if (!producto) return { errores: ["Falta crear el producto en el step 1"], warnings: [] };
  const errores: string[] = [];
  const warnings: string[] = [];
  if (producto.rutasAlternativas.length === 0) {
    errores.push("Sin rutas asociadas (mínimo 1 para cotizar)");
  }
  const tienePreferida = producto.rutasAlternativas.some((r) => r.esPreferida);
  if (producto.rutasAlternativas.length > 0 && !tienePreferida) {
    warnings.push("No hay ruta marcada como preferida");
  }
  return { errores, warnings };
}

function validarConfigPasos(producto: ProductoDetalle | undefined): ValidacionStep {
  if (!producto) return { errores: ["Falta crear el producto"], warnings: [] };
  const errores: string[] = [];
  const warnings: string[] = [];
  for (const ra of producto.rutasAlternativas) {
    const totalPasos = ra.ruta.pasos.length;
    const configurados = ra.configPasos.length;
    if (configurados < totalPasos) {
      warnings.push(`${ra.nombre}: ${configurados}/${totalPasos} pasos configurados`);
    }
  }
  return { errores, warnings };
}

function validarCargos(): ValidacionStep {
  // Cargos son opcionales — sin errores duros
  return { errores: [], warnings: [] };
}

function validarPrecio(precioConfig: TabPrecioConfig | null): ValidacionStep {
  const errores: string[] = [];
  if (!precioConfig?.metodoCalculo) errores.push("Falta método de cálculo de precio");
  return { errores, warnings: [] };
}

// ─── Wizard principal ──────────────────────────────────────────────

export function ProductoWizard({
  modo,
  productoExistente,
  rutasDisponibles = [],
  catalogoCargos = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepFromUrl = searchParams.get("step") as StepId | null;

  // Si modo editar, default a step desde URL o "identidad"; si crear, siempre "identidad"
  const [stepActivo, setStepActivo] = React.useState<StepId>(() => {
    if (modo === "crear") return "identidad";
    if (stepFromUrl && STEPS.some((s) => s.id === stepFromUrl)) return stepFromUrl;
    return "identidad";
  });

  // Estado de step 1 — Identidad
  const [codigo, setCodigo] = React.useState(productoExistente?.codigo ?? "");
  const [nombre, setNombre] = React.useState(productoExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(productoExistente?.descripcion ?? "");
  const [catalogoComercial, setCatalogoComercial] = React.useState<ProductoCategoriaComercial[]>([]);
  const [subcategoriaComercialCodigo, setSubcategoriaComercialCodigo] = React.useState(
    productoExistente?.subcategoriaComercial?.codigo ?? "producto_a_medida",
  );
  const [unidadComercial, setUnidadComercial] = React.useState(
    productoExistente?.unidadComercial ?? "unidad",
  );
  const [modoMedidas, setModoMedidas] = React.useState<ModoMedidasProducto>(
    productoExistente?.modoMedidas ?? "FIJA",
  );
  const [medidas, setMedidas] = React.useState<MedidaPredefinidaProducto[]>(
    () =>
      productoExistente
        ? getMedidasPredefinidas(productoExistente)
        : [
            {
              id: "default",
              nombre: "",
              anchoMm: 90,
              altoMm: 50,
              esDefault: true,
            },
          ],
  );
  const [activo, setActivo] = React.useState(productoExistente?.activo ?? true);
  // Producto por unidad sin medida (merchandising comprado: taza, remera). Se
  // persiste como modoMedidas FIJA + medidas vacías; el motor cotiza por unidad
  // y la estampa la maneja la personalización.
  // Ver docs/productos-comprados-merchandising-diseno.md
  const [sinMedida, setSinMedida] = React.useState<boolean>(() =>
    productoExistente
      ? (productoExistente.modoMedidas ?? "FIJA") === "FIJA" &&
        getMedidasPredefinidas(productoExistente).length === 0
      : false,
  );

  // "Sin medida" solo aplica a productos por unidad; si cambia a m²/ml, se apaga.
  React.useEffect(() => {
    if (unidadComercial !== "unidad" && sinMedida) setSinMedida(false);
  }, [unidadComercial, sinMedida]);

  // Estado de step 5 — Precio
  const [precioPersistido, setPrecioPersistido] = React.useState<TabPrecioConfig>(
    () =>
      (productoExistente?.precioConfigJson as TabPrecioConfig | null) ?? {
        metodoCalculo: "por_margen",
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
  );
  const [precioConfig, setPrecioConfig] = React.useState<TabPrecioConfig>(
    () =>
      (productoExistente?.precioConfigJson as TabPrecioConfig | null) ?? {
        metodoCalculo: "por_margen",
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
  );

  const [guardandoStep, setGuardandoStep] = React.useState(false);
  const precioDirty = React.useMemo(
    () => precioConfigKey(precioConfig) !== precioConfigKey(precioPersistido),
    [precioConfig, precioPersistido],
  );

  React.useEffect(() => {
    getCatalogoComercial()
      .then((catalogo) => {
        setCatalogoComercial(catalogo);
        setSubcategoriaComercialCodigo((current) =>
          catalogo.some((categoria) =>
            categoria.subcategorias.some((subcategoria) => subcategoria.codigo === current),
          )
            ? current
            : (catalogo[0]?.subcategorias[0]?.codigo ?? "producto_a_medida"),
        );
      })
      .catch(() => setCatalogoComercial([]));
  }, []);

  // Validaciones por step (tiempo real)
  const valIdentidad = validarIdentidad({ nombre });
  const valRutas = validarRutas(productoExistente);
  const valConfigPasos = validarConfigPasos(productoExistente);
  const valCargos = validarCargos();
  const valPrecio = validarPrecio(precioConfig);

  const validaciones: Record<StepId, ValidacionStep> = {
    identidad: valIdentidad,
    rutas: valRutas,
    "config-pasos": valConfigPasos,
    cargos: valCargos,
    precio: valPrecio,
  };

  // Navegación entre steps
  const irAStep = (id: StepId) => {
    setStepActivo(id);
    if (productoExistente) {
      router.replace(`/productos-servicios/${productoExistente.id}/wizard?step=${id}`, {
        scroll: false,
      });
    }
  };

  const indiceActual = STEPS.findIndex((s) => s.id === stepActivo);
  const stepAnterior = indiceActual > 0 ? STEPS[indiceActual - 1] : null;
  const stepSiguiente = indiceActual < STEPS.length - 1 ? STEPS[indiceActual + 1] : null;

  // ── Step 1: guardar identidad (crea o actualiza) ──────────────────
  const guardarIdentidad = async (avanzar: boolean) => {
    if (valIdentidad.errores.length > 0) {
      toast.error(valIdentidad.errores[0]);
      return;
    }
    const modoMedidasEfectivo = sinMedida ? "FIJA" : modoMedidas;
    const medidasNormalizadas = sinMedida
      ? []
      : normalizarMedidasPorModo(modoMedidas, medidas);
    const medidaDefault = medidasNormalizadas.find((medida) => medida.esDefault);
    if (!sinMedida && modoMedidas === "FIJA" && !medidaDefault) {
      toast.error("Agregá al menos una medida predefinida.");
      return;
    }
    setGuardandoStep(true);
    try {
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (productoExistente?.atributosComercialesJson as Record<string, unknown> | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidasEfectivo,
        medidaDefaultAnchoMm: medidaDefault?.anchoMm,
        medidaDefaultAltoMm: medidaDefault?.altoMm,
        medidasPredefinidasJson: medidasNormalizadas,
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
      };
      if (modo === "crear") {
        const creado = (await crearProducto(payload)) as { id: string };
        toast.success("Producto creado · seguí con las rutas");
        router.push(`/productos-servicios/${creado.id}?tab=${avanzar ? "rutas" : "identidad"}`);
        router.refresh();
      } else if (productoExistente) {
        await actualizarProducto(productoExistente.id, { ...payload, activo });
        toast.success("Identidad guardada");
        router.refresh();
        if (avanzar) irAStep("rutas");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardandoStep(false);
    }
  };

  // ── Step 5: guardar precio ────────────────────────────────────────
  const guardarPrecio = async () => {
    if (!productoExistente) return;
    const modoMedidasEfectivo = sinMedida ? "FIJA" : modoMedidas;
    const medidasNormalizadas = sinMedida
      ? []
      : normalizarMedidasPorModo(modoMedidas, medidas);
    const medidaDefault = medidasNormalizadas.find((medida) => medida.esDefault);
    setGuardandoStep(true);
    try {
      await actualizarProducto(productoExistente.id, {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (productoExistente?.atributosComercialesJson as Record<string, unknown> | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidasEfectivo,
        medidaDefaultAnchoMm: medidaDefault?.anchoMm,
        medidaDefaultAltoMm: medidaDefault?.altoMm,
        medidasPredefinidasJson: medidasNormalizadas,
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
        activo,
      });
      setPrecioPersistido(precioConfig);
      router.refresh();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Error guardando");
    } finally {
      setGuardandoStep(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={
              productoExistente
                ? `/productos-servicios/${productoExistente.id}`
                : "/productos-servicios"
            }
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
          >
            <ArrowLeftIcon className="mr-1 size-4" />
            {productoExistente ? "Salir del wizard" : "Volver al catálogo"}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {modo === "crear" ? "Nuevo producto" : `Editar: ${productoExistente?.nombre}`}
          </h1>
        </div>
        {productoExistente && (
          <Badge variant={productoExistente.activo ? "default" : "secondary"}>
            {productoExistente.activo ? "Activo" : "Inactivo"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar de progreso */}
        <aside className="lg:col-span-1">
          <Card className="lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Progreso</CardTitle>
              <CardDescription className="text-xs">
                {modo === "crear"
                  ? "Empezá creando el producto en el step 1."
                  : "Tocá un step para saltar."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {STEPS.map((step, idx) => {
                const val = validaciones[step.id];
                const Icon = step.icon;
                const isActive = step.id === stepActivo;
                const ok = val.errores.length === 0;
                const disponible = modo === "editar" || step.id === "identidad";
                return (
                  <button
                    key={step.id}
                    onClick={() => disponible && irAStep(step.id)}
                    disabled={!disponible}
                    className={[
                      "w-full rounded-md border px-3 py-2 text-left transition-all",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted",
                      !disponible ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          ok
                            ? "bg-green-100 text-green-700"
                            : val.errores.length > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {ok ? <CheckIcon className="size-3" /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="size-3" />
                          {step.nombre}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {step.descripcion}
                        </div>
                      </div>
                      {val.errores.length > 0 && (
                        <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                          {val.errores.length}
                        </Badge>
                      )}
                      {val.errores.length === 0 && val.warnings.length > 0 && (
                        <Badge
                          variant="outline"
                          className="h-4 border-amber-300 bg-amber-50 px-1 text-[10px] text-amber-700"
                        >
                          {val.warnings.length}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </aside>

        {/* Contenido del step */}
        <div className="space-y-4 lg:col-span-3">
          {stepActivo === "identidad" && (
            <StepIdentidad
              modo={modo}
              codigo={codigo}
              setCodigo={setCodigo}
              nombre={nombre}
              setNombre={setNombre}
              descripcion={descripcion}
              setDescripcion={setDescripcion}
              catalogoComercial={catalogoComercial}
              subcategoriaComercialCodigo={subcategoriaComercialCodigo}
              setSubcategoriaComercialCodigo={setSubcategoriaComercialCodigo}
              unidadComercial={unidadComercial}
              setUnidadComercial={setUnidadComercial}
              modoMedidas={modoMedidas}
              setModoMedidas={setModoMedidas}
              sinMedida={sinMedida}
              setSinMedida={setSinMedida}
              medidas={medidas}
              setMedidas={setMedidas}
              activo={activo}
              setActivo={setActivo}
              productoExistente={productoExistente}
              validacion={valIdentidad}
            />
          )}

          {stepActivo === "rutas" && productoExistente && (
            <StepRutas
              producto={productoExistente}
              rutasDisponibles={rutasDisponibles}
              validacion={valRutas}
            />
          )}

          {stepActivo === "config-pasos" && productoExistente && (
            <StepConfigPasos producto={productoExistente} validacion={valConfigPasos} />
          )}

          {stepActivo === "cargos" && productoExistente && (
            <StepCargos
              producto={productoExistente}
              catalogoCargos={catalogoCargos}
              validacion={valCargos}
            />
          )}

          {stepActivo === "precio" && (
            <StepPrecio
              producto={productoExistente}
              precioConfig={precioConfig}
              setPrecioConfig={setPrecioConfig}
              precioDirty={precioDirty}
              guardandoStep={guardandoStep}
              guardarPrecio={guardarPrecio}
              validacion={valPrecio}
              unidadComercial={unidadComercial}
            />
          )}

          {/* Bloqueo si modo crear y producto no existe pero el step requiere producto */}
          {stepActivo !== "identidad" && !productoExistente && (
            <Card>
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Necesitás crear primero el producto en el step &quot;Identidad&quot;.
              </CardContent>
            </Card>
          )}

          {/* Navegación inferior */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => stepAnterior && irAStep(stepAnterior.id)}
              disabled={!stepAnterior}
            >
              <ArrowLeftIcon className="mr-2 size-4" />
              {stepAnterior?.nombre ?? "Atrás"}
            </Button>
            {stepActivo === "identidad" ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => guardarIdentidad(false)}
                  disabled={guardandoStep || valIdentidad.errores.length > 0}
                >
                  <SaveIcon className="mr-2 size-4" />
                  Guardar borrador
                </Button>
                <Button
                  onClick={() => guardarIdentidad(true)}
                  disabled={guardandoStep || valIdentidad.errores.length > 0}
                >
                  {guardandoStep ? "Guardando..." : modo === "crear" ? "Crear y continuar" : "Continuar"}
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => stepSiguiente && irAStep(stepSiguiente.id)}
                disabled={!stepSiguiente}
              >
                {stepSiguiente?.nombre ?? "Listo"}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Identidad + Comercial ─────────────────────────────────

interface StepIdentidadProps {
  modo: "crear" | "editar";
  codigo: string;
  setCodigo: (v: string) => void;
  nombre: string;
  setNombre: (v: string) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
  catalogoComercial: ProductoCategoriaComercial[];
  subcategoriaComercialCodigo: string;
  setSubcategoriaComercialCodigo: (v: string) => void;
  unidadComercial: string;
  setUnidadComercial: (v: string) => void;
  modoMedidas: ModoMedidasProducto;
  setModoMedidas: (v: ModoMedidasProducto) => void;
  sinMedida: boolean;
  setSinMedida: (v: boolean) => void;
  medidas: MedidaPredefinidaProducto[];
  setMedidas: (v: MedidaPredefinidaProducto[]) => void;
  activo: boolean;
  setActivo: (v: boolean) => void;
  productoExistente?: ProductoDetalle;
  validacion: ValidacionStep;
}

function StepIdentidad(props: StepIdentidadProps) {
  const subcategoriaOptions = props.catalogoComercial.flatMap((categoria) =>
    categoria.subcategorias.map((subcategoria) => ({
      value: subcategoria.codigo,
      label: `${categoria.nombre} · ${subcategoria.nombre}`,
    })),
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
          <CardDescription>Cómo se llama el producto en el catálogo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.modo === "editar" ? (
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={props.codigo}
                disabled
                placeholder="Generado por el sistema"
              />
              <p className="text-muted-foreground text-xs">El código no se puede modificar.</p>
            </div>
          ) : (
            <p className="rounded-md border bg-muted/35 px-3 py-2 text-muted-foreground text-xs">
              El código se genera automáticamente al guardar el producto.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              value={props.nombre}
              onChange={(e) => props.setNombre(e.target.value)}
              placeholder="Tarjetas de Visita Premium 300gr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={props.descripcion}
              onChange={(e) => props.setDescripcion(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcategoriaComercial">Categoría comercial *</Label>
            <HumanSelect
              id="subcategoriaComercial"
              value={props.subcategoriaComercialCodigo}
              onValueChange={(value) =>
                props.setSubcategoriaComercialCodigo(value || "producto_a_medida")
              }
              options={subcategoriaOptions}
            />
            <p className="text-muted-foreground text-xs">
              Se usa para reportes y para definir las especificaciones visibles en propuestas.
            </p>
          </div>
          {props.modo === "editar" && (
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="activo">Activo</Label>
                <p className="text-muted-foreground text-xs">
                  Si está inactivo no aparece en el cotizador.
                </p>
              </div>
              <Switch id="activo" checked={props.activo} onCheckedChange={props.setActivo} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comercial y medidas</CardTitle>
          <CardDescription>Cómo se cobra y cómo se manejan las medidas al cotizar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <LabelConTooltip
              label="¿Cómo se cobra?"
              htmlFor="unidad"
              tooltip={getLabel(unidadComercialLabels, props.unidadComercial).descripcion}
            />
            <HumanSelect
              value={props.unidadComercial}
              onValueChange={(v) => props.setUnidadComercial(v || "unidad")}
              options={unidadComercialProductoItems.map((it) =>
                optionFromLabel(it.value, unidadComercialLabels),
              )}
              id="unidad"
            />
          </div>
          {props.unidadComercial === "unidad" && (
            <div className="space-y-2">
              <LabelConTooltip
                label="¿El producto tiene medida?"
                htmlFor="sinMedida"
                tooltip="Los productos comprados por unidad (tazas, remeras, lapiceras) no tienen medida propia: se cotizan por unidad y la estampa la maneja la personalización. Elegí «Sin medida» para ellos."
              />
              <HumanSelect
                value={props.sinMedida ? "sin" : "con"}
                onValueChange={(v) => props.setSinMedida(v === "sin")}
                options={[
                  {
                    value: "con",
                    label: "Con medida",
                    description: "El producto tiene una medida física (ej. tarjeta 90×50 mm).",
                  },
                  {
                    value: "sin",
                    label: "Sin medida (por unidad)",
                    description: "Merchandising comprado: taza, remera, lapicera. Se cotiza por unidad.",
                  },
                ]}
                id="sinMedida"
              />
            </div>
          )}
          {!props.sinMedida && (
            <div className="space-y-2">
              <LabelConTooltip
                label="Manejo de medidas"
                htmlFor="modoMedidas"
                tooltip={getLabel(modoMedidasLabels, props.modoMedidas).descripcion}
                ejemplo={getLabel(modoMedidasLabels, props.modoMedidas).ejemplo}
              />
              <HumanSelect
                value={props.modoMedidas}
                onValueChange={(v) => props.setModoMedidas((v || "FIJA") as ModoMedidasProducto)}
                options={MODOS_MEDIDAS.map((it) => optionFromLabel(it.value, modoMedidasLabels))}
                id="modoMedidas"
              />
            </div>
          )}
          {!props.sinMedida && modoMedidasUsaPredefinidas(props.modoMedidas) && (
            <MedidasPredefinidasWizard
              medidas={props.medidas}
              onChange={props.setMedidas}
            />
          )}
        </CardContent>
      </Card>

      {props.validacion.errores.length > 0 && (
        <div className="lg:col-span-2">
          <ListaValidacion validacion={props.validacion} />
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Rutas ────────────────────────────────────────────────

interface StepRutasProps {
  producto: ProductoDetalle;
  rutasDisponibles: RutaListItem[];
  validacion: ValidacionStep;
}

function StepRutas({ producto, rutasDisponibles, validacion }: StepRutasProps) {
  const router = useRouter();
  const [agregando, setAgregando] = React.useState(false);
  const [nuevaRutaId, setNuevaRutaId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");

  const yaUsadas = new Set(producto.rutasAlternativas.map((ra) => ra.ruta.id));
  const disponibles = rutasDisponibles.filter((r) => !yaUsadas.has(r.id));

  const agregar = async () => {
    if (!nuevaRutaId || !nuevoNombre.trim()) {
      toast.error("Elegí una ruta y dale un nombre");
      return;
    }
    setAgregando(true);
    try {
      const ruta = rutasDisponibles.find((r) => r.id === nuevaRutaId);
      await crearProductoRutaAlt(producto.id, {
        rutaId: nuevaRutaId,
        rutaVersion: ruta?.versionActual ?? 1,
        nombre: nuevoNombre,
        esPreferida: producto.rutasAlternativas.length === 0,
        orden: producto.rutasAlternativas.length,
      });
      toast.success("Ruta agregada");
      setNuevaRutaId("");
      setNuevoNombre("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAgregando(false);
    }
  };

  const marcarPreferida = async (rutaAltId: string) => {
    try {
      await actualizarProductoRutaAlt(rutaAltId, { esPreferida: true });
      toast.success("Ruta preferida actualizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const quitar = async (rutaAltId: string, nombre: string) => {
    if (!confirm(`¿Quitar ruta "${nombre}"?`)) return;
    try {
      await eliminarProductoRutaAlt(rutaAltId);
      toast.success("Ruta quitada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rutas alternativas</CardTitle>
          <CardDescription>
            Cada ruta es un camino de producción reusable. La preferida es el default al cotizar;
            el comercial puede elegir otra alternativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {producto.rutasAlternativas.length === 0 ? (
            <p className="text-muted-foreground rounded border border-dashed p-4 text-center text-sm italic">
              Sin rutas asociadas todavía. Agregá al menos 1 abajo.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {producto.rutasAlternativas.map((ra) => (
                <div
                  key={ra.id}
                  className={[
                    "flex items-center justify-between rounded border p-2",
                    ra.esPreferida ? "border-primary bg-primary/5" : "bg-muted/30",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {ra.esPreferida && <StarIcon className="text-primary size-3" />}
                      {ra.nombre}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {ra.ruta.nombre} · v{ra.rutaVersion} · {ra.ruta.pasos.length} pasos
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!ra.esPreferida && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => marcarPreferida(ra.id)}
                        className="h-7 text-xs"
                      >
                        Preferida
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => quitar(ra.id, ra.nombre)}
                      className="h-7 text-red-600"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {disponibles.length > 0 && (
            <div className="space-y-2 rounded border p-3">
              <div className="text-sm font-medium">Agregar ruta del catálogo</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <HumanSelect
                  value={nuevaRutaId}
                  onValueChange={(v) => setNuevaRutaId(v || "")}
                  options={disponibles.map((r) => ({
                    value: r.id,
                    label: r.nombre,
                    code: r.codigo,
                    description: `v${r.versionActual} · ${r.pasos.length} pasos`,
                  }))}
                  placeholder="Elegí ruta"
                />
                <Input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Standard / Vía láser..."
                />
              </div>
              <Button
                size="sm"
                onClick={agregar}
                disabled={agregando || !nuevaRutaId || !nuevoNombre.trim()}
              >
                {agregando ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          )}

          {disponibles.length === 0 && producto.rutasAlternativas.length === 0 && (
            <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
              No hay rutas en el catálogo todavía.{" "}
              <Link href="/productos-servicios/rutas/nueva" className="text-primary underline">
                Creá una ruta
              </Link>{" "}
              primero.
            </div>
          )}
        </CardContent>
      </Card>

      {(validacion.errores.length > 0 || validacion.warnings.length > 0) && (
        <ListaValidacion validacion={validacion} />
      )}
    </div>
  );
}

// ─── Step 3: Configurar pasos ─────────────────────────────────────

function StepConfigPasos({
  producto,
  validacion,
}: {
  producto: ProductoDetalle;
  validacion: ValidacionStep;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurar pasos por ruta</CardTitle>
          <CardDescription>
            Para cada ruta alternativa, configurá la máquina, perfil y materiales de cada paso.
            El editor se abre en pantalla completa para no perder espacio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {producto.rutasAlternativas.length === 0 ? (
            <p className="text-muted-foreground rounded border border-dashed p-4 text-center text-sm italic">
              Necesitás agregar al menos 1 ruta en el step anterior.
            </p>
          ) : (
            producto.rutasAlternativas.map((ra) => {
              const totalPasos = ra.ruta.pasos.length;
              const configurados = ra.configPasos.length;
              const completo = configurados === totalPasos;
              return (
                <div
                  key={ra.id}
                  className="bg-muted/30 flex items-center justify-between rounded border p-3"
                >
                  <div className="flex items-center gap-3">
                    {completo ? (
                      <CheckCircle2Icon className="text-green-500 size-5 shrink-0" />
                    ) : (
                      <CircleIcon className="text-muted-foreground size-5 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        {ra.esPreferida && <StarIcon className="text-primary size-3" />}
                        {ra.nombre}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {ra.ruta.nombre} · {configurados}/{totalPasos} pasos configurados
                      </div>
                    </div>
                  </div>
                  <Link href={`/productos-servicios/${producto.id}/rutas/${ra.id}`}>
                    <Button variant={completo ? "outline" : "default"} size="sm">
                      <CogIcon className="mr-2 size-3" />
                      {completo ? "Revisar" : "Configurar"}
                    </Button>
                  </Link>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {(validacion.errores.length > 0 || validacion.warnings.length > 0) && (
        <ListaValidacion validacion={validacion} />
      )}
    </div>
  );
}

// ─── Step 4: Cargos ───────────────────────────────────────────────

function StepCargos({
  producto,
  catalogoCargos,
  validacion,
}: {
  producto: ProductoDetalle;
  catalogoCargos: CargoDirectoCatalogo[];
  validacion: ValidacionStep;
}) {
  const router = useRouter();
  const [cargoSel, setCargoSel] = React.useState("");
  const [modoActivacion, setModoActivacion] = React.useState("OPCIONAL");
  const [agregando, setAgregando] = React.useState(false);

  const yaAsociados = new Set(
    producto.cargosDirectosCotizacion.map((c) => c.cargoDirectoCatalogo.codigo),
  );
  const disponibles = catalogoCargos.filter((c) => c.activo && !yaAsociados.has(c.codigo));

  const asociar = async () => {
    if (!cargoSel) return;
    setAgregando(true);
    try {
      await asociarCargoCotizacion(producto.id, {
        cargoDirectoCatalogoId: cargoSel,
        modoActivacion: modoActivacion as "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL",
      });
      toast.success("Cargo asociado");
      setCargoSel("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAgregando(false);
    }
  };

  const desasociar = async (asocId: string, nombre: string) => {
    if (!confirm(`¿Quitar cargo "${nombre}"?`)) return;
    try {
      await desasociarCargoCotizacion(asocId);
      toast.success("Cargo quitado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cargos directos a nivel cotización</CardTitle>
          <CardDescription>
            Cargos como viático, recargo por urgencia o tercerización. Se ofrecen al comercial
            cuando cotiza este producto. Son opcionales — podés saltar este step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {producto.cargosDirectosCotizacion.length === 0 ? (
            <p className="text-muted-foreground rounded border border-dashed p-3 text-center text-sm italic">
              Sin cargos asociados (opcional).
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {producto.cargosDirectosCotizacion.map((c) => {
                const lblCalc = getLabel(modoCalculoCargoLabels, c.cargoDirectoCatalogo.modoCalculo);
                const lblAct = getLabel(modoActivacionLabels, c.modoActivacion);
                return (
                  <div
                    key={c.id}
                    className="bg-muted/30 flex items-start justify-between rounded border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <PackageIcon className="size-3" />
                        {c.cargoDirectoCatalogo.nombre}
                      </div>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]" title={lblCalc.descripcion}>
                          {lblCalc.label}
                        </Badge>
                        <Badge
                          variant={c.modoActivacion === "OBLIGATORIO" ? "default" : "secondary"}
                          className="text-[10px]"
                          title={lblAct.descripcion}
                        >
                          {lblAct.label}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => desasociar(c.id, c.cargoDirectoCatalogo.nombre)}
                      className="text-red-600"
                    >
                      ×
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {disponibles.length > 0 && (
            <div className="space-y-2 rounded border p-3">
              <div className="text-sm font-medium">Asociar cargo del catálogo</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <HumanSelect
                  value={cargoSel}
                  onValueChange={(v) => setCargoSel(v || "")}
                  options={disponibles.map((c) => {
                    const lblCalc = getLabel(modoCalculoCargoLabels, c.modoCalculo);
                    return {
                      value: c.id,
                      label: c.nombre,
                      code: c.codigo,
                      description: lblCalc.label,
                    };
                  })}
                  placeholder="Elegí cargo"
                />
                <HumanSelect
                  value={modoActivacion}
                  onValueChange={(v) => setModoActivacion(v || "OPCIONAL")}
                  options={["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"].map((m) =>
                    optionFromLabel(m, modoActivacionLabels),
                  )}
                />
              </div>
              <Button size="sm" onClick={asociar} disabled={agregando || !cargoSel}>
                {agregando ? "Asociando..." : "Asociar"}
              </Button>
            </div>
          )}

          {disponibles.length === 0 && producto.cargosDirectosCotizacion.length === 0 && (
            <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
              Sin cargos en el catálogo del tenant.{" "}
              <Link
                href="/productos-servicios/cargos-directos"
                className="text-primary underline"
              >
                Creá cargos
              </Link>{" "}
              primero si necesitás.
            </div>
          )}
        </CardContent>
      </Card>

      {(validacion.errores.length > 0 || validacion.warnings.length > 0) && (
        <ListaValidacion validacion={validacion} />
      )}
    </div>
  );
}

// ─── Step 5: Precio + revisar ─────────────────────────────────────

function StepPrecio({
  producto,
  precioConfig,
  setPrecioConfig,
  precioDirty,
  guardandoStep,
  guardarPrecio,
  validacion,
  unidadComercial,
}: {
  producto: ProductoDetalle | undefined;
  precioConfig: TabPrecioConfig;
  setPrecioConfig: (v: TabPrecioConfig) => void;
  precioDirty: boolean;
  guardandoStep: boolean;
  guardarPrecio: () => Promise<void>;
  validacion: ValidacionStep;
  unidadComercial: string;
}) {
  return (
    <div className="space-y-4">
      <TabPrecioCompleto
        productoId={producto?.id ?? null}
        precioConfig={precioConfig}
        onChangePrecioConfig={setPrecioConfig}
        unidadComercial={producto?.unidadComercial ?? unidadComercial}
        precioDirty={precioDirty}
        guardandoPrecio={guardandoStep}
        onGuardarPrecio={guardarPrecio}
      />

      {producto && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validación final</CardTitle>
            <CardDescription>
              Estado del producto antes de habilitarlo en el cotizador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductoValidacionPanel productoId={producto.id} />
          </CardContent>
        </Card>
      )}

      {(validacion.errores.length > 0 || validacion.warnings.length > 0) && (
        <ListaValidacion validacion={validacion} />
      )}
    </div>
  );
}

// ─── Lista de validación reusable ──────────────────────────────────

function ListaValidacion({ validacion }: { validacion: ValidacionStep }) {
  if (validacion.errores.length === 0 && validacion.warnings.length === 0) return null;
  return (
    <Card
      className={
        validacion.errores.length > 0
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }
    >
      <CardContent className="pt-4 text-xs">
        {validacion.errores.map((e, idx) => (
          <div key={`e-${idx}`} className="flex items-start gap-1 text-red-700">
            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
            <span>{e}</span>
          </div>
        ))}
        {validacion.warnings.map((w, idx) => (
          <div key={`w-${idx}`} className="flex items-start gap-1 text-amber-700">
            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
            <span>{w}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
