"use client";

/**
 * <ProductoWizard /> — flujo guiado para crear/editar un producto.
 *
 * Reemplaza las pantallas separadas (identidad, rutas, config-pasos,
 * precio, validar) por un wizard con barra de progreso lateral, validación
 * por step y navegación libre cuando el producto ya existe.
 *
 * Steps:
 *   1. Identidad + Comercial — qué es y cómo se cobra.
 *   2. Rutas — elegir ruta(s) alternativa(s) con preferida.
 *   3. Configurar pasos — para cada ruta, ir al editor de config-pasos.
 *   4. Precio + revisar — Tab Precio + panel de validación final.
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
  SaveIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
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
  crearProducto,
  crearProductoRutaAlt,
  eliminarProductoRutaAlt,
  getCatalogoComercial,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  DimensionProducto,
  MedidaPredefinidaProducto,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
  RutaListItem,
} from "@/lib/productos-servicios";
import { unidadComercialProductoItems } from "@/lib/productos-servicios";
import {
  getDimensionesRequeridas,
  getMedidasPredefinidas,
  medidaLabel,
  normalizeMedidasDraft,
} from "@/lib/producto-medidas";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

import styles from "./producto-wizard.module.css";

// ─── Configuración de steps ────────────────────────────────────────

const STEPS = [
  {
    id: "identidad",
    nombre: "Identidad",
    descripcion: "Qué es y cómo se vende",
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
    id: "precio",
    nombre: "Precio + revisar",
    descripcion: "Precio y validación",
    icon: SaveIcon,
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const MODOS_MEDIDAS = [
  { value: "FIJA", label: "Medida fija" },
  { value: "LIBRE", label: "Medida libre" },
  { value: "COMERCIAL_ELIGE", label: "Medidas predefinidas" },
  { value: "MIXTA", label: "Predefinida o personalizada" },
];

function modoMedidasUsaPredefinidas(modo: string) {
  return modo !== "LIBRE";
}

function normalizarMedidasPorModo(
  modo: string,
  medidas: MedidaPredefinidaProducto[],
  es3D = false,
) {
  if (!modoMedidasUsaPredefinidas(modo)) return [];
  const normalizadas = normalizeMedidasDraft(medidas).map((medida) => ({
    ...medida,
    ...(es3D
      ? { profundidadMm: medida.profundidadMm }
      : { profundidadMm: undefined }),
  }));
  if (modo !== "FIJA") return normalizadas;
  const defaultMedida =
    normalizadas.find((medida) => medida.esDefault) ?? normalizadas[0];
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
  modo,
  es3D,
  onChange,
}: {
  medidas: MedidaPredefinidaProducto[];
  modo: ModoMedidasProducto;
  es3D: boolean;
  onChange: (medidas: MedidaPredefinidaProducto[]) => void;
}) {
  const esMedidaFija = modo === "FIJA";
  const medidaDefault =
    medidas.find((medida) => medida.esDefault) ?? medidas[0] ?? null;
  const medidasVisibles = esMedidaFija
    ? medidaDefault
      ? [medidaDefault]
      : []
    : medidas;
  const updateMedida = (
    id: string,
    patch: Partial<MedidaPredefinidaProducto>,
  ) => {
    onChange(
      medidas.map((medida) =>
        medida.id === id ? { ...medida, ...patch } : medida,
      ),
    );
  };
  const setDefault = (id: string) => {
    onChange(
      medidas.map((medida) => ({ ...medida, esDefault: medida.id === id })),
    );
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
        <Label>
          {esMedidaFija ? "Medida del producto" : "Medidas disponibles"}
        </Label>
        {!esMedidaFija && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([...medidas, nuevaMedidaPredefinida(medidas.length)])
            }
          >
            Agregar medida
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {medidasVisibles.map((medida, index) => (
          <div
            key={medida.id}
            className={`grid items-center gap-2 ${
              es3D
                ? "grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto_auto]"
                : "grid-cols-[1.4fr_0.8fr_0.8fr_auto_auto]"
            }`}
          >
            <Input
              value={medida.nombre}
              onChange={(event) =>
                updateMedida(medida.id, { nombre: event.target.value })
              }
              placeholder={medidaLabel({ ...medida, nombre: "" })}
              aria-label={`Nombre de medida ${index + 1}`}
            />
            <Input
              type="number"
              min="0"
              value={medida.anchoMm ? medida.anchoMm / 10 : ""}
              onChange={(event) =>
                updateMedida(medida.id, {
                  anchoMm: (Number(event.target.value) || 0) * 10,
                })
              }
              placeholder="Ancho cm"
              aria-label={`Ancho de medida ${index + 1}`}
            />
            <Input
              type="number"
              min="0"
              value={medida.altoMm ? medida.altoMm / 10 : ""}
              onChange={(event) =>
                updateMedida(medida.id, {
                  altoMm: (Number(event.target.value) || 0) * 10,
                })
              }
              placeholder="Alto cm"
              aria-label={`Alto de medida ${index + 1}`}
            />
            {es3D && (
              <Input
                type="number"
                min="0"
                value={medida.profundidadMm ? medida.profundidadMm / 10 : ""}
                onChange={(event) =>
                  updateMedida(medida.id, {
                    profundidadMm: (Number(event.target.value) || 0) * 10,
                  })
                }
                placeholder="Profundidad cm"
                aria-label={`Profundidad de medida ${index + 1}`}
              />
            )}
            {!esMedidaFija ? (
              <>
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
                  <StarIcon
                    className="size-4"
                    fill={medida.esDefault ? "currentColor" : "none"}
                  />
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
              </>
            ) : (
              <span className="col-span-2" />
            )}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {esMedidaFija
          ? "Esta medida se aplicará automáticamente al cotizar."
          : "La medida con estrella aparecerá seleccionada inicialmente al cotizar."}
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
  if (!producto)
    return { errores: ["Falta crear el producto en el step 1"], warnings: [] };
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

function validarConfigPasos(
  producto: ProductoDetalle | undefined,
): ValidacionStep {
  if (!producto) return { errores: ["Falta crear el producto"], warnings: [] };
  const errores: string[] = [];
  const warnings: string[] = [];
  for (const ra of producto.rutasAlternativas) {
    const totalPasos = ra.ruta.pasos.length;
    const configurados = ra.configPasos.length;
    if (configurados < totalPasos) {
      warnings.push(
        `${ra.nombre}: ${configurados}/${totalPasos} pasos configurados`,
      );
    }
  }
  return { errores, warnings };
}

function validarPrecio(precioConfig: TabPrecioConfig | null): ValidacionStep {
  const errores: string[] = [];
  if (!precioConfig?.metodoCalculo)
    errores.push("Falta método de cálculo de precio");
  return { errores, warnings: [] };
}

// ─── Wizard principal ──────────────────────────────────────────────

export function ProductoWizard({
  modo,
  productoExistente,
  rutasDisponibles = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepFromUrl = searchParams.get("step") as StepId | null;

  // Si modo editar, default a step desde URL o "identidad"; si crear, siempre "identidad"
  const [stepActivo, setStepActivo] = React.useState<StepId>(() => {
    if (modo === "crear") return "identidad";
    if (stepFromUrl && STEPS.some((s) => s.id === stepFromUrl))
      return stepFromUrl;
    return "identidad";
  });

  // Estado de step 1 — Identidad
  const [nombre, setNombre] = React.useState(productoExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(
    productoExistente?.descripcion ?? "",
  );
  const [catalogoComercial, setCatalogoComercial] = React.useState<
    ProductoCategoriaComercial[]
  >([]);
  const [subcategoriaComercialCodigo, setSubcategoriaComercialCodigo] =
    React.useState(
      productoExistente?.subcategoriaComercial?.codigo ?? "producto_a_medida",
    );
  const [unidadComercial, setUnidadComercial] = React.useState(
    productoExistente?.unidadComercial ?? "unidad",
  );
  const [modoMedidas, setModoMedidas] = React.useState<ModoMedidasProducto>(
    productoExistente?.modoMedidas ?? "FIJA",
  );
  const [geometria, setGeometria] = React.useState<"2D" | "3D">(() =>
    productoExistente &&
    getDimensionesRequeridas(productoExistente).includes("PROFUNDIDAD")
      ? "3D"
      : "2D",
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
  const [activo, setActivo] = React.useState(
    productoExistente?.activo ?? false,
  );
  // Producto por unidad sin medida (merchandising comprado: taza, remera). Se
  // persiste como modoMedidas FIJA + medidas vacías; el motor cotiza por unidad
  // y la estampa la maneja la personalización.
  // Ver docs/productos-comprados-merchandising-diseno.md
  const [sinMedida, setSinMedida] = React.useState<boolean>(() =>
    productoExistente
      ? getDimensionesRequeridas(productoExistente).length === 0
      : false,
  );

  // "Sin medida" solo aplica a productos por unidad; si cambia a m²/ml, se apaga.
  React.useEffect(() => {
    if (unidadComercial !== "unidad" && sinMedida) {
      setSinMedida(false);
      if (medidas.length === 0) {
        setMedidas([nuevaMedidaPredefinida(0)]);
      }
    }
  }, [medidas.length, unidadComercial, sinMedida]);

  // Estado de step 5 — Precio
  const [precioPersistido, setPrecioPersistido] =
    React.useState<TabPrecioConfig>(
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
            categoria.subcategorias.some(
              (subcategoria) => subcategoria.codigo === current,
            ),
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
  const valPrecio = validarPrecio(precioConfig);

  const validaciones: Record<StepId, ValidacionStep> = {
    identidad: valIdentidad,
    rutas: valRutas,
    "config-pasos": valConfigPasos,
    precio: valPrecio,
  };

  // Navegación entre steps
  const irAStep = (id: StepId) => {
    setStepActivo(id);
    if (productoExistente) {
      router.replace(
        `/productos-servicios/${productoExistente.id}/wizard?step=${id}`,
        {
          scroll: false,
        },
      );
    }
  };

  const indiceActual = STEPS.findIndex((s) => s.id === stepActivo);
  const stepAnterior = indiceActual > 0 ? STEPS[indiceActual - 1] : null;
  const stepSiguiente =
    indiceActual < STEPS.length - 1 ? STEPS[indiceActual + 1] : null;

  // ── Step 1: guardar identidad (crea o actualiza) ──────────────────
  const guardarIdentidad = async (avanzar: boolean) => {
    if (valIdentidad.errores.length > 0) {
      toast.error(valIdentidad.errores[0]);
      return;
    }
    const modoMedidasEfectivo = sinMedida ? "FIJA" : modoMedidas;
    const medidasNormalizadas = sinMedida
      ? []
      : normalizarMedidasPorModo(modoMedidas, medidas, geometria === "3D");
    const medidaDefault = medidasNormalizadas.find(
      (medida) => medida.esDefault,
    );
    if (!sinMedida && modoMedidas === "FIJA" && !medidaDefault) {
      toast.error("Agregá al menos una medida predefinida.");
      return;
    }
    if (
      !sinMedida &&
      geometria === "3D" &&
      modoMedidas !== "LIBRE" &&
      medidasNormalizadas.some(
        (medida) => !medida.profundidadMm || medida.profundidadMm <= 0,
      )
    ) {
      toast.error("Completá la profundidad de cada medida 3D.");
      return;
    }
    const dimensionesRequeridas: DimensionProducto[] = sinMedida
      ? []
      : geometria === "3D"
        ? ["ANCHO", "ALTO", "PROFUNDIDAD"]
        : ["ANCHO", "ALTO"];
    setGuardandoStep(true);
    try {
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (productoExistente?.atributosComercialesJson as Record<
            string,
            unknown
          > | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidasEfectivo,
        dimensionesRequeridas,
        medidaDefaultAnchoMm: medidaDefault?.anchoMm,
        medidaDefaultAltoMm: medidaDefault?.altoMm,
        medidaDefaultProfundidadMm: medidaDefault?.profundidadMm,
        medidasPredefinidasJson: medidasNormalizadas,
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
      };
      if (modo === "crear") {
        const creado = (await crearProducto(payload)) as { id: string };
        toast.success(
          "Borrador creado · completá las rutas antes de publicarlo",
        );
        router.push(
          avanzar
            ? `/productos-servicios/${creado.id}?tab=produccion&vista=rutas`
            : `/productos-servicios/${creado.id}?tab=identidad`,
        );
        router.refresh();
      } else if (productoExistente) {
        await actualizarProducto(productoExistente.id, {
          ...payload,
          activo,
          expectedUpdatedAt: productoExistente.updatedAt,
        });
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
      : normalizarMedidasPorModo(modoMedidas, medidas, geometria === "3D");
    const medidaDefault = medidasNormalizadas.find(
      (medida) => medida.esDefault,
    );
    const dimensionesRequeridas: DimensionProducto[] = sinMedida
      ? []
      : geometria === "3D"
        ? ["ANCHO", "ALTO", "PROFUNDIDAD"]
        : ["ANCHO", "ALTO"];
    setGuardandoStep(true);
    try {
      await actualizarProducto(productoExistente.id, {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (productoExistente?.atributosComercialesJson as Record<
            string,
            unknown
          > | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidasEfectivo,
        dimensionesRequeridas,
        medidaDefaultAnchoMm: medidaDefault?.anchoMm,
        medidaDefaultAltoMm: medidaDefault?.altoMm,
        medidaDefaultProfundidadMm: medidaDefault?.profundidadMm,
        medidasPredefinidasJson: medidasNormalizadas,
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
        activo,
        expectedUpdatedAt: productoExistente.updatedAt,
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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link
            href={
              productoExistente
                ? `/productos-servicios/${productoExistente.id}`
                : "/productos-servicios"
            }
            className={styles.back}
          >
            <ArrowLeftIcon className="mr-1 size-4" />
            {productoExistente ? "Salir del wizard" : "Volver al catálogo"}
          </Link>
          <span className={styles.eyebrow}>Catálogo de productos</span>
          <h1>
            {modo === "crear"
              ? "Nuevo producto"
              : `Editar: ${productoExistente?.nombre}`}
          </h1>
          <p>
            Construí la ficha comercial y productiva en un recorrido guiado.
          </p>
        </div>
        {productoExistente && (
          <Badge variant={productoExistente.activo ? "default" : "secondary"}>
            {productoExistente.activo ? "Activo" : "Inactivo"}
          </Badge>
        )}
      </header>

      <div className={styles.workspace}>
        {/* Sidebar de progreso */}
        <aside className={styles.sidebar}>
          <Card className={styles.progressCard}>
            <CardHeader className={styles.progressHeader}>
              <CardTitle>Progreso</CardTitle>
              <CardDescription>
                {modo === "crear"
                  ? "Empezá creando el producto en el step 1."
                  : "Tocá un step para saltar."}
              </CardDescription>
            </CardHeader>
            <CardContent className={styles.progressBody}>
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
                    className={styles.stepButton}
                    data-active={isActive || undefined}
                    data-complete={ok || undefined}
                    data-disabled={!disponible || undefined}
                  >
                    <div className={styles.stepRow}>
                      <div
                        className={styles.stepNumber}
                        data-complete={ok || undefined}
                        data-error={val.errores.length > 0 || undefined}
                      >
                        {ok ? <CheckIcon className="size-3" /> : idx + 1}
                      </div>
                      <div className={styles.stepText}>
                        <div>
                          <Icon />
                          {step.nombre}
                        </div>
                        <small>{step.descripcion}</small>
                      </div>
                      {val.errores.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-4 px-1 text-[10px]"
                        >
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
        <div className={styles.content}>
          {stepActivo === "identidad" && (
            <StepIdentidad
              modo={modo}
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
              geometria={geometria}
              setGeometria={setGeometria}
              sinMedida={sinMedida}
              setSinMedida={setSinMedida}
              medidas={medidas}
              setMedidas={setMedidas}
              activo={activo}
              setActivo={setActivo}
              productoExistente={productoExistente}
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
            <StepConfigPasos
              producto={productoExistente}
              validacion={valConfigPasos}
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
            <Card className={styles.blockedCard}>
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Necesitás crear primero el producto en el step
                &quot;Identidad&quot;.
              </CardContent>
            </Card>
          )}

          {/* Navegación inferior */}
          <footer className={styles.navigation}>
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
                  className={styles.primaryAction}
                  onClick={() => guardarIdentidad(true)}
                  disabled={guardandoStep || valIdentidad.errores.length > 0}
                >
                  {guardandoStep
                    ? "Guardando..."
                    : modo === "crear"
                      ? "Crear borrador y continuar"
                      : "Continuar"}
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            ) : (
              <Button
                className={styles.primaryAction}
                onClick={() => stepSiguiente && irAStep(stepSiguiente.id)}
                disabled={!stepSiguiente}
              >
                {stepSiguiente?.nombre ?? "Listo"}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            )}
          </footer>
        </div>
      </div>
    </main>
  );
}

// ─── Step 1: Identidad + Comercial ─────────────────────────────────

interface StepIdentidadProps {
  modo: "crear" | "editar";
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
  geometria: "2D" | "3D";
  setGeometria: (v: "2D" | "3D") => void;
  sinMedida: boolean;
  setSinMedida: (v: boolean) => void;
  medidas: MedidaPredefinidaProducto[];
  setMedidas: (v: MedidaPredefinidaProducto[]) => void;
  activo: boolean;
  setActivo: (v: boolean) => void;
  productoExistente?: ProductoDetalle;
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
      <Card className={styles.identityCard}>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
          <CardDescription>
            Cómo se llama el producto en el catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              value={props.nombre}
              onChange={(e) => props.setNombre(e.target.value)}
              placeholder="Tarjetas de Visita Premium 300gr"
              aria-invalid={!props.nombre.trim()}
              aria-describedby={
                !props.nombre.trim() ? "nombre-error" : undefined
              }
            />
            {!props.nombre.trim() && (
              <p id="nombre-error" className={styles.fieldError}>
                Ingresá el nombre del producto.
              </p>
            )}
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
                props.setSubcategoriaComercialCodigo(
                  value || "producto_a_medida",
                )
              }
              options={subcategoriaOptions}
            />
            <p className="text-muted-foreground text-xs">
              Se usa para reportes y para definir las especificaciones visibles
              en propuestas.
            </p>
          </div>
          {props.modo === "editar" && (
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="activo">Publicado</Label>
                <p className="text-muted-foreground text-xs">
                  Al publicar, el backend verificará que el producto esté listo
                  para cotizar.
                </p>
              </div>
              <Switch
                id="activo"
                checked={props.activo}
                onCheckedChange={props.setActivo}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={styles.commercialCard}>
        <CardHeader>
          <CardTitle>Comercial y medidas</CardTitle>
          <CardDescription>
            Definí cómo se vende el producto y qué datos deberá completar el
            comercial al cotizarlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <LabelConTooltip
              label="Unidad de venta"
              htmlFor="unidad"
              tooltip={
                getLabel(unidadComercialLabels, props.unidadComercial)
                  .descripcion
              }
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
                label="¿El producto se define por medidas?"
                htmlFor="sinMedida"
                tooltip="Indicá si el producto necesita dimensiones para calcular su precio, materiales o producción."
              />
              <HumanSelect
                value={props.sinMedida ? "sin" : "con"}
                onValueChange={(v) => {
                  const nextSinMedida = v === "sin";
                  props.setSinMedida(nextSinMedida);
                  if (!nextSinMedida && props.medidas.length === 0) {
                    props.setMedidas([nuevaMedidaPredefinida(0)]);
                  }
                }}
                options={[
                  {
                    value: "con",
                    label: "Sí, utiliza medidas",
                    description:
                      "El producto tiene una medida física (ej. tarjeta 90×50 mm).",
                  },
                  {
                    value: "sin",
                    label: "No utiliza medidas",
                    description:
                      "Merchandising comprado: taza, remera, lapicera. Se cotiza por unidad.",
                  },
                ]}
                id="sinMedida"
              />
            </div>
          )}
          {!props.sinMedida && (
            <div className="space-y-2">
              <Label>Geometría del producto</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={props.geometria === "2D" ? "default" : "outline"}
                  onClick={() => props.setGeometria("2D")}
                >
                  2D · Ancho y alto
                </Button>
                <Button
                  type="button"
                  variant={props.geometria === "3D" ? "default" : "outline"}
                  onClick={() => props.setGeometria("3D")}
                >
                  3D · Ancho, alto y profundidad
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                El sheet solicitará exactamente estas dimensiones al cotizar.
              </p>
            </div>
          )}
          {!props.sinMedida && (
            <div className="space-y-2">
              <LabelConTooltip
                label="¿Cómo se define la medida?"
                htmlFor="modoMedidas"
                tooltip={
                  getLabel(modoMedidasLabels, props.modoMedidas).descripcion
                }
                ejemplo={getLabel(modoMedidasLabels, props.modoMedidas).ejemplo}
              />
              <HumanSelect
                value={props.modoMedidas}
                onValueChange={(v) => {
                  const nextModo = (v || "FIJA") as ModoMedidasProducto;
                  props.setModoMedidas(nextModo);
                  if (nextModo === "FIJA" && props.medidas.length === 0) {
                    props.setMedidas([nuevaMedidaPredefinida(0)]);
                  }
                }}
                options={MODOS_MEDIDAS.map((it) =>
                  optionFromLabel(it.value, modoMedidasLabels),
                )}
                id="modoMedidas"
              />
            </div>
          )}
          {!props.sinMedida &&
            modoMedidasUsaPredefinidas(props.modoMedidas) && (
              <MedidasPredefinidasWizard
                medidas={props.medidas}
                modo={props.modoMedidas}
                es3D={props.geometria === "3D"}
                onChange={props.setMedidas}
              />
            )}
        </CardContent>
      </Card>
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
  const [rutaAQuitar, setRutaAQuitar] = React.useState<{
    id: string;
    nombre: string;
  } | null>(null);

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

  const quitar = (rutaAltId: string, nombre: string) => {
    setRutaAQuitar({ id: rutaAltId, nombre });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rutas alternativas</CardTitle>
          <CardDescription>
            Cada ruta es un camino de producción reusable. La preferida es el
            default al cotizar; el comercial puede elegir otra alternativa.
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
                    ra.esPreferida
                      ? "border-primary bg-primary/5"
                      : "bg-muted/30",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      {ra.esPreferida && (
                        <StarIcon className="text-primary size-3" />
                      )}
                      {ra.nombre}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {ra.ruta.nombre} · v{ra.rutaVersion} ·{" "}
                      {ra.ruta.pasos.length} pasos
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
              <div className="text-sm font-medium">
                Agregar ruta del catálogo
              </div>
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

          {disponibles.length === 0 &&
            producto.rutasAlternativas.length === 0 && (
              <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                No hay rutas en el catálogo todavía.{" "}
                <Link
                  href="/productos-servicios/rutas/nueva"
                  className="text-primary underline"
                >
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

      <ConfirmacionDestructiva
        open={rutaAQuitar !== null}
        onOpenChange={(open) => {
          if (!open) setRutaAQuitar(null);
        }}
        titulo="Quitar ruta"
        descripcion={`¿Quitar ruta "${rutaAQuitar?.nombre ?? ""}"?`}
        nombreItem={rutaAQuitar?.nombre}
        requiereTipear={false}
        accionLabel="Quitar ruta"
        onConfirmar={async () => {
          if (!rutaAQuitar) return;
          try {
            await eliminarProductoRutaAlt(rutaAQuitar.id);
            toast.success("Ruta quitada");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
          setRutaAQuitar(null);
        }}
      />
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
            Para cada ruta alternativa, configurá la máquina, perfil y
            materiales de cada paso. El editor se abre en pantalla completa para
            no perder espacio.
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
                        {ra.esPreferida && (
                          <StarIcon className="text-primary size-3" />
                        )}
                        {ra.nombre}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {ra.ruta.nombre} · {configurados}/{totalPasos} pasos
                        configurados
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/productos-servicios/${producto.id}/rutas/${ra.id}`}
                    className={buttonVariants({
                      variant: completo ? "outline" : "default",
                      size: "sm",
                    })}
                  >
                    <CogIcon className="mr-2 size-3" />
                    {completo ? "Revisar" : "Configurar"}
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

// ─── Step 4: Precio + revisar ─────────────────────────────────────

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
  if (validacion.errores.length === 0 && validacion.warnings.length === 0)
    return null;
  return (
    <Card
      className={styles.validationCard}
      data-level={validacion.errores.length > 0 ? "error" : "warning"}
    >
      <CardContent className="pt-4 text-xs">
        {validacion.errores.map((e, idx) => (
          <div key={`e-${idx}`} className="flex items-start gap-1 text-red-700">
            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
            <span>{e}</span>
          </div>
        ))}
        {validacion.warnings.map((w, idx) => (
          <div
            key={`w-${idx}`}
            className="flex items-start gap-1 text-amber-700"
          >
            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
            <span>{w}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
