"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  BoxIcon,
  BoxesIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  CircleAlertIcon,
  CogIcon,
  CopyIcon,
  CopyPlusIcon,
  Edit3Icon,
  GitBranchIcon,
  IdCardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  PackageCheckIcon,
  RouteIcon,
  SaveIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { HumanSelect } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TabPrecioCompleto } from "@/components/productos-servicios/tab-precio-completo";
import { PricingCompuestoEditor } from "@/components/productos-servicios/pricing-compuesto-editor";
import {
  componenteRevisionAInput,
  componentesPricingKey,
  crearComponentesPricingPorRuta,
} from "@/components/productos-servicios/pricing-compuesto-helpers";
import { ProductoValidacionPanel } from "@/components/productos-servicios/producto-validacion-panel";
import {
  precioConfigKey,
  type TabPrecioConfig,
} from "@/components/productos-servicios/tab-precio-editor";
import {
  actualizarProducto,
  actualizarProductoRutaAlt,
  asociarCargoCotizacion,
  crearProductoRutaAlt,
  desasociarCargoCotizacion,
  duplicarProductoRutaAlt,
  eliminarProductoRutaAlt,
  getCatalogoComercial,
  guardarBorradorReceta,
  type EstadoDependenciaReceta,
  type EstadoPublicacionProducto,
  type EstadoRutaPublicacionReceta,
  type LookupsConfigPaso,
  type ProductoReceta,
} from "@/lib/productos-servicios-api";
import { RecetaProductoTab } from "@/components/productos-servicios/receta-producto-tab";
import { ModeloProductivoPreview } from "@/components/productos-servicios/modelo-productivo-preview";
import {
  getHerramientaMedidasArchivo,
  setHerramientaMedidasArchivo,
  getHerramientaEditorSello,
  setHerramientaEditorSello,
} from "@/lib/producto-herramientas";
import {
  getGeometriasComerciales,
  nuevaFuenteGeometria,
  setGeometriasComerciales,
  type ConfiguracionGeometriasComerciales,
  type ModoGeometriaComercial,
} from "@/lib/producto-geometrias";
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  DimensionProducto,
  EstructuraProducto,
  MedidaPredefinidaProducto,
  MinimoComercialPolitica,
  MinimoComercialBase,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
  RutaListItem,
} from "@/lib/productos-servicios";
import {
  getDimensionesRequeridas,
  getMedidasPredefinidas,
  medidaLabel,
  normalizeMedidasDraft,
} from "@/lib/producto-medidas";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";
import styles from "./producto-workspace.module.css";

export type ProductoWorkspaceTab =
  | "identidad"
  | "comercial"
  | "produccion"
  | "cargos"
  | "herramientas"
  | "pricing";

export type ProductoProduccionVista = "rutas" | "operaciones" | "bom";

interface Props {
  producto: ProductoDetalle;
  activeTab: ProductoWorkspaceTab;
  produccionVista?: ProductoProduccionVista;
  rutaAltId?: string;
  rutasDisponibles?: RutaListItem[];
  catalogoFamilias?: CatalogoFamilias;
  lookups?: LookupsConfigPaso;
  catalogoCargos?: CargoDirectoCatalogo[];
  recetas?: ProductoReceta[];
  estadoPublicacion?: EstadoPublicacionProducto;
  canManage: boolean;
}

interface ValidacionTab {
  estado: "ok" | "warning" | "error";
  label: string;
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

/** Plancha completa: sin dims propias — la pieza se deriva del pliego del
 *  paso de impresión al cotizar (área útil). El nombre lo pone cada empresa
 *  ("Plancha", "Hoja completa"). Ver docs/medida-plancha-area-util-diseno.md. */
function nuevaMedidaPlancha(index: number): MedidaPredefinidaProducto {
  return {
    id: `medida-${Date.now()}-${index}`,
    nombre: "Plancha completa",
    anchoMm: 0,
    altoMm: 0,
    esDefault: index === 0,
    tipo: "pliego_util",
  };
}

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

function MedidasPredefinidasEditor({
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
    <div className="field">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <label>
          {esMedidaFija ? "Medida del producto" : "Medidas disponibles"}
        </label>
        {!esMedidaFija && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onChange([...medidas, nuevaMedidaPredefinida(medidas.length)])
              }
            >
              <PlusIcon />
              Agregar medida
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onChange([...medidas, nuevaMedidaPlancha(medidas.length)])
              }
              disabled={medidas.some((medida) => medida.tipo === "pliego_util")}
              title="La pieza es toda el área útil del pliego: se calcula al cotizar con el papel y la máquina del paso de impresión"
            >
              <PlusIcon />
              Plancha completa
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {medidasVisibles.map((medida, index) => (
          <div
            key={medida.id}
            style={{
              display: "grid",
              gridTemplateColumns: es3D
                ? "1.25fr 0.7fr 0.7fr 0.7fr auto auto"
                : "1.4fr 0.8fr 0.8fr auto auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={medida.nombre}
              onChange={(event) =>
                updateMedida(medida.id, { nombre: event.target.value })
              }
              placeholder={medidaLabel({ ...medida, nombre: "" })}
              aria-label={`Nombre de medida ${index + 1}`}
            />
            {medida.tipo === "pliego_util" ? (
              // La plancha no declara dims: pieza = área útil del pliego,
              // resuelta al cotizar (papel activo − márgenes de la máquina).
              <span
                className="help"
                style={{ gridColumn: "span 2", margin: 0 }}
                title="Se recalcula sola si cambia el papel o la máquina del paso de impresión"
              >
                área útil del pliego · se resuelve al cotizar
              </span>
            ) : (
              <>
                <input
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
                <input
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
                  <input
                    type="number"
                    min="0"
                    value={
                      medida.profundidadMm ? medida.profundidadMm / 10 : ""
                    }
                    onChange={(event) =>
                      updateMedida(medida.id, {
                        profundidadMm: (Number(event.target.value) || 0) * 10,
                      })
                    }
                    placeholder="Profundidad cm"
                    aria-label={`Profundidad de medida ${index + 1}`}
                  />
                )}
              </>
            )}
            {!esMedidaFija ? (
              <>
                <button
                  type="button"
                  className={`icon-action medida-default-btn ${medida.esDefault ? "on" : ""}`}
                  onClick={() => setDefault(medida.id)}
                  aria-pressed={medida.esDefault}
                  title={
                    medida.esDefault
                      ? "Medida predeterminada"
                      : "Marcar como predeterminada"
                  }
                >
                  <StarIcon
                    size={13}
                    fill={medida.esDefault ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  className="icon-action danger"
                  onClick={() => removeMedida(medida.id)}
                  disabled={medidas.length <= 1}
                  title="Eliminar medida"
                >
                  <Trash2Icon size={13} />
                </button>
              </>
            ) : (
              <span style={{ gridColumn: "span 2" }} />
            )}
          </div>
        ))}
      </div>
      <span className="help">
        {esMedidaFija
          ? "Esta medida se aplicará automáticamente; el comercial no tendrá que elegirla ni ingresarla."
          : "La medida con estrella aparecerá seleccionada inicialmente al cotizar."}
      </span>
    </div>
  );
}

const TABS: Array<{
  id: ProductoWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "identidad", label: "Identidad", icon: IdCardIcon },
  { id: "comercial", label: "Comercial", icon: BriefcaseBusinessIcon },
  { id: "produccion", label: "Routing", icon: RouteIcon },
  { id: "herramientas", label: "Herramientas", icon: WrenchIcon },
  { id: "pricing", label: "Pricing", icon: BanknoteIcon },
];

function tabValidaciones(
  producto: ProductoDetalle,
  recetas: ProductoReceta[],
  estadoPublicacion?: EstadoPublicacionProducto,
): Record<ProductoWorkspaceTab, ValidacionTab> {
  const rutas = producto.rutasAlternativas;
  const sinRutas = rutas.length === 0;
  const sinPreferida = rutas.length > 0 && !rutas.some((r) => r.esPreferida);
  const pasosIncompletos = rutas.some(
    (r) => r.configPasos.length < r.ruta.pasos.length,
  );
  const precioConfig = producto.precioConfigJson as TabPrecioConfig | null;
  const dimensiones = getDimensionesRequeridas(producto);
  const medidas = getMedidasPredefinidas(producto);
  const comercialCompleto =
    dimensiones.length === 0
      ? producto.unidadComercial === "unidad"
      : producto.modoMedidas === "LIBRE" ||
        (medidas.length > 0 &&
          (!dimensiones.includes("PROFUNDIDAD") ||
            medidas.every(
              (medida) =>
                medida.profundidadMm != null && medida.profundidadMm > 0,
            )));
  const estadosPublicacion = estadoPublicacion?.rutas.map(
    (ruta) => ruta.estado,
  );
  const validacionPublicacion: ValidacionTab = estadosPublicacion?.includes(
    "BLOQUEADA",
  )
    ? { estado: "error", label: "Receta bloqueada" }
    : estadosPublicacion?.includes("DESACTUALIZADA")
      ? { estado: "warning", label: "Requiere publicar" }
      : estadosPublicacion?.includes("BORRADOR_INICIAL")
        ? { estado: "warning", label: "Borrador sin publicar" }
        : estadosPublicacion?.includes("SIN_RECETA")
          ? { estado: "warning", label: "Sin versión publicada" }
          : estadosPublicacion?.includes("VIGENTE_CON_BORRADOR")
            ? { estado: "warning", label: "Cambios en borrador" }
            : estadosPublicacion?.length
              ? { estado: "ok", label: "Publicada y vigente" }
              : recetas.length === 0
                ? { estado: "warning", label: "Sin versión publicada" }
                : recetas.some((item) =>
                      item.revisiones.some(
                        (revision) => revision.estado === "BORRADOR",
                      ),
                    )
                  ? { estado: "warning", label: "Cambios sin publicar" }
                  : { estado: "ok", label: "Publicada" };

  return {
    identidad:
      producto.codigo && producto.nombre
        ? { estado: "ok", label: "Completo" }
        : { estado: "error", label: "Faltan datos" },
    comercial: comercialCompleto
      ? { estado: "ok", label: "Completo" }
      : { estado: "error", label: "Falta configuración" },
    produccion: sinRutas
      ? { estado: "error", label: "Sin rutas" }
      : sinPreferida
        ? { estado: "warning", label: "Sin ruta preferida" }
        : pasosIncompletos
          ? { estado: "warning", label: "Pasos incompletos" }
          : validacionPublicacion,
    cargos: { estado: "ok", label: "Opcional" },
    herramientas: { estado: "ok", label: "Opcional" },
    pricing: precioConfig?.metodoCalculo
      ? { estado: "ok", label: "Completo" }
      : { estado: "error", label: "Falta método" },
  };
}

function EstadoBadge({ estado, label }: ValidacionTab) {
  const Icon =
    estado === "ok"
      ? CheckIcon
      : estado === "warning"
        ? CircleAlertIcon
        : CircleAlertIcon;
  return (
    <span
      className={styles.tabStatus}
      data-state={estado}
      title={label}
      aria-label={label}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function ProductoWorkspace({
  producto,
  activeTab,
  produccionVista = "rutas",
  rutaAltId,
  rutasDisponibles = [],
  catalogoFamilias,
  catalogoCargos = [],
  recetas = [],
  estadoPublicacion,
  canManage,
}: Props) {
  const router = useRouter();
  const validaciones = React.useMemo(
    () => tabValidaciones(producto, recetas, estadoPublicacion),
    [producto, recetas, estadoPublicacion],
  );

  const irATab = (tab: ProductoWorkspaceTab) => {
    router.push(tabHref(tab));
  };

  const tabHref = (tab: ProductoWorkspaceTab) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "produccion" && produccionVista === "operaciones") {
      const selectedRuta =
        rutaAltId ??
        producto.rutasAlternativas.find((r) => r.esPreferida)?.id ??
        producto.rutasAlternativas[0]?.id;
      params.set("vista", produccionVista);
      if (selectedRuta) params.set("rutaAltId", selectedRuta);
    } else if (tab === "produccion") {
      params.set("vista", produccionVista);
    }
    return `/productos-servicios/${producto.id}?${params.toString()}`;
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/productos-servicios" className={styles.back}>
          <ArrowLeftIcon className="size-4" />
          Volver al catálogo
        </Link>
        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <TagIcon />
          </span>
          <div className={styles.headerBody}>
            <span className={styles.eyebrow}>Ficha de producto</span>
            <div className={styles.titleRow}>
              <h1>{producto.nombre}</h1>
              <span
                className={styles.productStatus}
                data-active={producto.activo || undefined}
              >
                <span />
                {producto.activo ? "Publicado" : "Borrador"}
              </span>
            </div>
            {producto.descripcion ? (
              <p className={styles.description}>{producto.descripcion}</p>
            ) : (
              <p className={styles.description}>
                Configurá su identidad, producción y precio antes de publicarlo.
              </p>
            )}
          </div>
          <ProductoValidacionPanel
            productoId={producto.id}
            variante="compacta"
          />
        </header>
        {!canManage ? (
          <Alert className="mb-4">
            <CircleAlertIcon />
            <AlertTitle>Modo de solo lectura</AlertTitle>
            <AlertDescription>
              Podés consultar toda la configuración, pero necesitás el permiso
              de gestión de costos para modificarla.
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => irATab(value as ProductoWorkspaceTab)}
        >
          <nav className={styles.tabs} aria-label="Secciones del producto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={styles.tab}
                  data-active={activeTab === tab.id || undefined}
                  href={tabHref(tab.id)}
                >
                  <span className={styles.tabIcon}>
                    <Icon className="size-4" />
                  </span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                  <EstadoBadge {...validaciones[tab.id]} />
                </Link>
              );
            })}
          </nav>

          <TabsContent value={activeTab}>
            <fieldset disabled={!canManage} className="contents">
              {activeTab === "identidad" && (
                <IdentidadTab producto={producto} seccion="identidad" />
              )}
              {activeTab === "comercial" && (
                <IdentidadTab producto={producto} seccion="comercial" />
              )}
              {activeTab === "produccion" && (
                <ProduccionTab
                  producto={producto}
                  vista={produccionVista}
                  rutaAltId={rutaAltId}
                  rutasDisponibles={rutasDisponibles}
                  catalogoFamilias={catalogoFamilias}
                  recetas={recetas}
                  estadoPublicacion={estadoPublicacion}
                  canManage={canManage}
                />
              )}
              {activeTab === "cargos" && (
                <CargosTab
                  producto={producto}
                  catalogoCargos={catalogoCargos}
                />
              )}
              {activeTab === "herramientas" && (
                <HerramientasTab producto={producto} />
              )}
              {activeTab === "pricing" && (
                <PricingTab producto={producto} recetas={recetas} />
              )}
            </fieldset>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function IdentidadTab({
  producto,
  seccion,
}: {
  producto: ProductoDetalle;
  seccion: "identidad" | "comercial";
}) {
  const router = useRouter();
  const identidadInicial = React.useMemo(
    () => ({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      estructuraProducto:
        producto.estructuraProducto ??
        (producto.esCompuesto ? "COMPUESTO" : "SIMPLE"),
      subcategoriaComercialCodigo:
        producto.subcategoriaComercial?.codigo ?? "producto_a_medida",
      unidadComercial: producto.unidadComercial,
      modoMedidas: producto.modoMedidas,
      dimensionesRequeridas: getDimensionesRequeridas(producto),
      minimoComercialPolitica: producto.minimoComercialPolitica ?? "NONE",
      minimoComercialCantidad: producto.minimoComercialCantidad ?? "",
      minimoComercialBase: producto.minimoComercialBase ?? "cantidad_comercial",
      medidas: getMedidasPredefinidas(producto),
      sinMedida: getDimensionesRequeridas(producto).length === 0,
      geometriasComerciales: getGeometriasComerciales(
        producto.atributosComercialesJson,
      ),
      activo: producto.activo,
    }),
    [producto],
  );
  const [identidadPersistida, setIdentidadPersistida] =
    React.useState(identidadInicial);
  const [nombre, setNombre] = React.useState(producto.nombre);
  const [descripcion, setDescripcion] = React.useState(
    producto.descripcion ?? "",
  );
  const [estructuraProducto, setEstructuraProducto] =
    React.useState<EstructuraProducto>(
      producto.estructuraProducto ??
        (producto.esCompuesto ? "COMPUESTO" : "SIMPLE"),
    );
  const [catalogoComercial, setCatalogoComercial] = React.useState<
    ProductoCategoriaComercial[]
  >([]);
  const [subcategoriaComercialCodigo, setSubcategoriaComercialCodigo] =
    React.useState(
      producto.subcategoriaComercial?.codigo ?? "producto_a_medida",
    );
  const [unidadComercial, setUnidadComercial] = React.useState(
    producto.unidadComercial,
  );
  const [modoMedidas, setModoMedidas] = React.useState<ModoMedidasProducto>(
    producto.modoMedidas,
  );
  const [geometria, setGeometria] = React.useState<"2D" | "3D">(() =>
    getDimensionesRequeridas(producto).includes("PROFUNDIDAD") ? "3D" : "2D",
  );
  const [minimoComercialPolitica, setMinimoComercialPolitica] =
    React.useState<MinimoComercialPolitica>(
      producto.minimoComercialPolitica ?? "NONE",
    );
  const [minimoComercialCantidad, setMinimoComercialCantidad] = React.useState(
    producto.minimoComercialCantidad ?? "",
  );
  const [minimoComercialBase, setMinimoComercialBase] =
    React.useState<MinimoComercialBase>(
      producto.minimoComercialBase ?? "cantidad_comercial",
    );
  const [medidas, setMedidas] = React.useState<MedidaPredefinidaProducto[]>(
    () => getMedidasPredefinidas(producto),
  );
  const [activo, setActivo] = React.useState(producto.activo);
  // Producto por unidad sin medida (merchandising: taza, remera). Se persiste
  // como FIJA + medidas vacías. Ver docs/productos-comprados-merchandising-diseno.md
  const [sinMedida, setSinMedida] = React.useState<boolean>(
    () => getDimensionesRequeridas(producto).length === 0,
  );
  const [geometriasComerciales, setGeometriasComercialesEstado] =
    React.useState<ConfiguracionGeometriasComerciales>(() =>
      getGeometriasComerciales(producto.atributosComercialesJson),
    );
  React.useEffect(() => {
    if (unidadComercial !== "unidad" && sinMedida) {
      setSinMedida(false);
      if (medidas.length === 0) {
        setMedidas([nuevaMedidaPredefinida(0)]);
      }
    }
  }, [medidas.length, unidadComercial, sinMedida]);
  const [guardando, setGuardando] = React.useState(false);

  const identidadActual = React.useMemo(
    () => ({
      nombre,
      descripcion,
      estructuraProducto,
      subcategoriaComercialCodigo,
      unidadComercial,
      modoMedidas: sinMedida ? "FIJA" : modoMedidas,
      dimensionesRequeridas: sinMedida
        ? ([] as DimensionProducto[])
        : geometria === "3D"
          ? (["ANCHO", "ALTO", "PROFUNDIDAD"] as DimensionProducto[])
          : (["ANCHO", "ALTO"] as DimensionProducto[]),
      minimoComercialPolitica,
      minimoComercialCantidad:
        minimoComercialPolitica === "NONE" ? "" : minimoComercialCantidad,
      minimoComercialBase:
        minimoComercialPolitica === "NONE"
          ? "cantidad_comercial"
          : minimoComercialBase,
      medidas: sinMedida
        ? []
        : normalizarMedidasPorModo(modoMedidas, medidas, geometria === "3D"),
      sinMedida,
      geometriasComerciales,
      activo,
    }),
    [
      activo,
      descripcion,
      estructuraProducto,
      medidas,
      geometria,
      geometriasComerciales,
      sinMedida,
      minimoComercialCantidad,
      minimoComercialBase,
      minimoComercialPolitica,
      modoMedidas,
      nombre,
      subcategoriaComercialCodigo,
      unidadComercial,
    ],
  );
  const identidadPersistidaNormalizada = React.useMemo(
    () => ({
      ...identidadPersistida,
      medidas: normalizarMedidasPorModo(
        identidadPersistida.modoMedidas,
        identidadPersistida.medidas,
        identidadPersistida.dimensionesRequeridas.includes("PROFUNDIDAD"),
      ),
    }),
    [identidadPersistida],
  );
  const dirty = React.useMemo(() => {
    const campos =
      seccion === "identidad"
        ? ([
            "nombre",
            "descripcion",
            "estructuraProducto",
            "subcategoriaComercialCodigo",
            "activo",
          ] as const)
        : ([
            "unidadComercial",
            "modoMedidas",
            "dimensionesRequeridas",
            "minimoComercialPolitica",
            "minimoComercialCantidad",
            "minimoComercialBase",
            "medidas",
            "sinMedida",
            "geometriasComerciales",
          ] as const);
    return campos.some(
      (campo) =>
        JSON.stringify(identidadActual[campo]) !==
        JSON.stringify(identidadPersistidaNormalizada[campo]),
    );
  }, [identidadActual, identidadPersistidaNormalizada, seccion]);

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

  const categoriaSeleccionada = catalogoComercial.find((categoria) =>
    categoria.subcategorias.some(
      (subcategoria) => subcategoria.codigo === subcategoriaComercialCodigo,
    ),
  );
  const categoriaOptions = catalogoComercial.map((categoria) => ({
    value: categoria.codigo,
    label: categoria.nombre,
  }));
  const subcategoriaOptions =
    categoriaSeleccionada?.subcategorias.map((subcategoria) => ({
      value: subcategoria.codigo,
      label: subcategoria.nombre,
    })) ?? [];
  const minimoUnidadLabel =
    minimoComercialBase === "pliegos_impresos"
      ? "pliegos"
      : unidadComercial === "m2"
        ? "m²"
        : unidadComercial === "metro_lineal"
          ? "ml"
          : "u.";

  const guardar = async () => {
    if (seccion === "identidad" && !nombre.trim()) {
      toast.error("Falta nombre");
      return;
    }
    const modoMedidasEfectivo = sinMedida ? "FIJA" : modoMedidas;
    const medidasNormalizadas = sinMedida
      ? []
      : normalizarMedidasPorModo(modoMedidas, medidas, geometria === "3D");
    const medidaDefault = medidasNormalizadas.find(
      (medida) => medida.esDefault,
    );
    if (
      seccion === "comercial" &&
      !sinMedida &&
      modoMedidas === "FIJA" &&
      !medidaDefault
    ) {
      toast.error("Agregá al menos una medida predefinida.");
      return;
    }
    if (
      !sinMedida &&
      seccion === "comercial" &&
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
    if (
      seccion === "comercial" &&
      geometriasComerciales.modo === "VECTORIAL" &&
      geometriasComerciales.fuentes.length === 0
    ) {
      toast.error("Agregá al menos una fuente para la geometría vectorial.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        expectedUpdatedAt: producto.updatedAt,
        ...(seccion === "identidad"
          ? {
              nombre,
              descripcion: descripcion || undefined,
              estructuraProducto,
              subcategoriaComercialCodigo,
              activo,
            }
          : {
              unidadComercial: unidadComercial as
                "unidad" | "m2" | "metro_lineal",
              modoMedidas: modoMedidasEfectivo,
              dimensionesRequeridas,
              minimoComercialPolitica,
              minimoComercialCantidad:
                minimoComercialPolitica === "NONE"
                  ? null
                  : Number(minimoComercialCantidad) || null,
              minimoComercialBase:
                minimoComercialPolitica === "NONE"
                  ? "cantidad_comercial"
                  : minimoComercialBase,
              medidaDefaultAnchoMm: medidaDefault?.anchoMm ?? null,
              medidaDefaultAltoMm: medidaDefault?.altoMm ?? null,
              medidaDefaultProfundidadMm: medidaDefault?.profundidadMm ?? null,
              medidasPredefinidasJson: medidasNormalizadas,
              atributosComercialesJson: setGeometriasComerciales(
                producto.atributosComercialesJson,
                geometriasComerciales,
              ),
            }),
      });
      setIdentidadPersistida({
        nombre,
        descripcion,
        estructuraProducto,
        subcategoriaComercialCodigo,
        unidadComercial,
        modoMedidas: modoMedidasEfectivo,
        dimensionesRequeridas,
        minimoComercialPolitica,
        minimoComercialCantidad:
          minimoComercialPolitica === "NONE" ? "" : minimoComercialCantidad,
        minimoComercialBase:
          minimoComercialPolitica === "NONE"
            ? "cantidad_comercial"
            : minimoComercialBase,
        medidas: medidasNormalizadas,
        sinMedida,
        geometriasComerciales,
        activo,
      });
      toast.success(
        seccion === "identidad"
          ? "Identidad guardada"
          : "Configuración comercial guardada",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="wiz-cols">
      {seccion === "identidad" ? (
        <div className="wiz-section" style={{ gridColumn: "1 / -1" }}>
          <div className="wiz-section-head">
            <div className="body">
              <h2>Identidad</h2>
              <div className="helptext">
                Cómo se llama y se reconoce el producto en el catálogo.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label>
                Nombre <span className="req">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Estructura del producto</label>
              <div
                className={styles.structureChoiceGrid}
                role="radiogroup"
                aria-label="Estructura del producto"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={estructuraProducto === "SIMPLE"}
                  data-active={estructuraProducto === "SIMPLE"}
                  onClick={() => setEstructuraProducto("SIMPLE")}
                >
                  <span className={styles.structureChoiceIcon}>
                    <BoxIcon />
                  </span>
                  <span>
                    <strong>Producto simple</strong>
                    <small>Se fabrica con pasos propios.</small>
                  </span>
                  <span className={styles.structureChoiceMark}>
                    {estructuraProducto === "SIMPLE" ? <CheckIcon /> : null}
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={estructuraProducto === "COMPUESTO"}
                  data-active={estructuraProducto === "COMPUESTO"}
                  onClick={() => setEstructuraProducto("COMPUESTO")}
                >
                  <span className={styles.structureChoiceIcon}>
                    <BoxesIcon />
                  </span>
                  <span>
                    <strong>Producto compuesto</strong>
                    <small>
                      Combina componentes fabricados y pasos propios.
                    </small>
                  </span>
                  <span className={styles.structureChoiceMark}>
                    {estructuraProducto === "COMPUESTO" ? <CheckIcon /> : null}
                  </span>
                </button>
              </div>
            </div>
            <div className={styles.classificationGrid}>
              <div className="field">
                <label>Categoría comercial</label>
                <HumanSelect
                  value={categoriaSeleccionada?.codigo ?? ""}
                  onValueChange={(value) => {
                    const categoria = catalogoComercial.find(
                      (item) => item.codigo === value,
                    );
                    const primeraSubcategoria = categoria?.subcategorias[0];
                    if (primeraSubcategoria) {
                      setSubcategoriaComercialCodigo(
                        primeraSubcategoria.codigo,
                      );
                    }
                  }}
                  options={categoriaOptions}
                />
              </div>
              <div className="field">
                <label>Subcategoría</label>
                <HumanSelect
                  value={subcategoriaComercialCodigo}
                  onValueChange={(value) =>
                    setSubcategoriaComercialCodigo(
                      value ||
                        categoriaSeleccionada?.subcategorias[0]?.codigo ||
                        "producto_a_medida",
                    )
                  }
                  options={subcategoriaOptions}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 6,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 13 }}>Publicado</div>
              <button
                type="button"
                className={`toggle ${activo ? "on" : ""}`}
                onClick={() => setActivo((current) => !current)}
                aria-pressed={activo}
              >
                <span className="switch" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {seccion === "comercial" ? (
        <>
          <div className="wiz-section col-span-full">
            <div className="wiz-section-head">
              <div className="body">
                <h2>Comercial y medidas</h2>
                <div className="helptext">
                  Definí cómo se vende el producto y qué datos deberá completar
                  el comercial al cotizarlo.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Unidad de venta</label>
                <div className="segmented" style={{ width: "100%" }}>
                  <button
                    type="button"
                    className={unidadComercial === "unidad" ? "on" : ""}
                    onClick={() => setUnidadComercial("unidad")}
                    style={{ flex: 1 }}
                  >
                    Por unidad
                  </button>
                  <button
                    type="button"
                    className={unidadComercial === "m2" ? "on" : ""}
                    onClick={() => setUnidadComercial("m2")}
                    style={{ flex: 1 }}
                  >
                    Por m²
                  </button>
                  <button
                    type="button"
                    className={unidadComercial === "metro_lineal" ? "on" : ""}
                    onClick={() => setUnidadComercial("metro_lineal")}
                    style={{ flex: 1 }}
                  >
                    Por metro lineal
                  </button>
                </div>
              </div>
              {unidadComercial === "unidad" && (
                <div className="field">
                  <label>¿El producto se define por medidas?</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    <button
                      type="button"
                      className={!sinMedida ? "on" : ""}
                      onClick={() => {
                        setSinMedida(false);
                        if (medidas.length === 0) {
                          setMedidas([nuevaMedidaPredefinida(0)]);
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Sí, utiliza medidas
                    </button>
                    <button
                      type="button"
                      className={sinMedida ? "on" : ""}
                      onClick={() => setSinMedida(true)}
                      style={{ flex: 1 }}
                    >
                      No utiliza medidas
                    </button>
                  </div>
                  <div className="helptext">
                    Elegí «No utiliza medidas» cuando la cantidad de unidades
                    sea suficiente para cotizar el producto.
                  </div>
                </div>
              )}
              {!sinMedida && (
                <div className="field">
                  <label>Geometría del producto</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    <button
                      type="button"
                      className={geometria === "2D" ? "on" : ""}
                      onClick={() => setGeometria("2D")}
                      style={{ flex: 1 }}
                    >
                      2D · Ancho y alto
                    </button>
                    <button
                      type="button"
                      className={geometria === "3D" ? "on" : ""}
                      onClick={() => setGeometria("3D")}
                      style={{ flex: 1 }}
                    >
                      3D · Ancho, alto y profundidad
                    </button>
                  </div>
                  <div className="helptext">
                    El sheet solicitará exactamente estas dimensiones cuando el
                    comercial deba definir una medida.
                  </div>
                </div>
              )}
              {(estructuraProducto === "COMPUESTO" || !sinMedida) && (
                <div className="field">
                  <label>Forma que puede recibir el producto</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    {(
                      [
                        ["RECTANGULAR", "Rectangular"],
                        ["VECTORIAL", "Forma vectorial"],
                        ["AMBAS", "Ambas"],
                      ] as Array<[ModoGeometriaComercial, string]>
                    ).map(([modo, label]) => (
                      <button
                        type="button"
                        className={
                          geometriasComerciales.modo === modo ? "on" : ""
                        }
                        onClick={() =>
                          setGeometriasComercialesEstado((actual) => ({
                            version: 1,
                            modo,
                            permitirCotizacionManual:
                              actual.permitirCotizacionManual,
                            fuentes:
                              modo === "RECTANGULAR"
                                ? []
                                : actual.fuentes.length
                                  ? actual.fuentes
                                  : [nuevaFuenteGeometria([])],
                          }))
                        }
                        style={{ flex: 1 }}
                        key={modo}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="helptext">
                    La forma pertenece al producto; la ruta define después qué
                    máquina y qué motor pueden fabricarla.
                  </div>
                  {geometriasComerciales.modo !== "RECTANGULAR" ? (
                    <div className={styles.geometrySources}>
                      <div className={styles.geometrySourcesHead}>
                        <div>
                          <strong>Fuentes geométricas</strong>
                          <span>
                            Nombrá los diseños que luego podrán compartir los
                            componentes.
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setGeometriasComercialesEstado((actual) => ({
                              ...actual,
                              fuentes: [
                                ...actual.fuentes,
                                nuevaFuenteGeometria(actual.fuentes),
                              ],
                            }))
                          }
                        >
                          <PlusIcon data-icon="inline-start" />
                          Agregar fuente
                        </Button>
                      </div>
                      {geometriasComerciales.fuentes.map((fuente, index) => (
                        <div
                          className={styles.geometrySourceRow}
                          key={fuente.id}
                        >
                          <span className={styles.geometrySourceIndex}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Input
                            aria-label={`Nombre de la fuente ${index + 1}`}
                            value={fuente.nombre}
                            maxLength={120}
                            onChange={(event) =>
                              setGeometriasComercialesEstado((actual) => ({
                                ...actual,
                                fuentes: actual.fuentes.map((item) =>
                                  item.id === fuente.id
                                    ? { ...item, nombre: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                          <label className={styles.geometryRequired}>
                            <Switch
                              checked={fuente.requerida}
                              onCheckedChange={(requerida) =>
                                setGeometriasComercialesEstado((actual) => ({
                                  ...actual,
                                  fuentes: actual.fuentes.map((item) =>
                                    item.id === fuente.id
                                      ? { ...item, requerida }
                                      : item,
                                  ),
                                }))
                              }
                            />
                            Obligatoria
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Eliminar ${fuente.nombre}`}
                            disabled={
                              geometriasComerciales.modo === "VECTORIAL" &&
                              geometriasComerciales.fuentes.length === 1
                            }
                            onClick={() =>
                              setGeometriasComercialesEstado((actual) => ({
                                ...actual,
                                fuentes: actual.fuentes.filter(
                                  (item) => item.id !== fuente.id,
                                ),
                              }))
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))}
                      <label className={styles.geometryRequired}>
                        <Switch
                          checked={
                            geometriasComerciales.permitirCotizacionManual
                          }
                          onCheckedChange={(permitirCotizacionManual) =>
                            setGeometriasComercialesEstado((actual) => ({
                              ...actual,
                              permitirCotizacionManual,
                            }))
                          }
                        />
                        Permitir estimación manual por placas
                      </label>
                    </div>
                  ) : null}
                </div>
              )}
              {!sinMedida && (
                <div className="field">
                  <label>¿Cómo se define la medida?</label>
                  <div className="segmented" style={{ width: "100%" }}>
                    <button
                      type="button"
                      className={modoMedidas === "FIJA" ? "on" : ""}
                      onClick={() => {
                        setModoMedidas("FIJA");
                        if (medidas.length === 0) {
                          setMedidas([nuevaMedidaPredefinida(0)]);
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Medida fija
                    </button>
                    <button
                      type="button"
                      className={modoMedidas === "LIBRE" ? "on" : ""}
                      onClick={() => setModoMedidas("LIBRE")}
                      style={{ flex: 1 }}
                    >
                      Medida libre
                    </button>
                    <button
                      type="button"
                      className={modoMedidas === "COMERCIAL_ELIGE" ? "on" : ""}
                      onClick={() => setModoMedidas("COMERCIAL_ELIGE")}
                      style={{ flex: 1 }}
                    >
                      Medidas predefinidas
                    </button>
                    <button
                      type="button"
                      className={modoMedidas === "MIXTA" ? "on" : ""}
                      onClick={() => setModoMedidas("MIXTA")}
                      style={{ flex: 1 }}
                    >
                      Predefinida o personalizada
                    </button>
                  </div>
                </div>
              )}
              {!sinMedida && modoMedidasUsaPredefinidas(modoMedidas) && (
                <MedidasPredefinidasEditor
                  medidas={medidas}
                  modo={modoMedidas}
                  es3D={geometria === "3D"}
                  onChange={setMedidas}
                />
              )}
              <div className="field">
                <label>Mínimo comercial</label>
                <div className="segmented" style={{ width: "100%" }}>
                  <button
                    type="button"
                    className={minimoComercialPolitica === "NONE" ? "on" : ""}
                    onClick={() => setMinimoComercialPolitica("NONE")}
                    style={{ flex: 1 }}
                  >
                    Sin mínimo
                  </button>
                  <button
                    type="button"
                    className={
                      minimoComercialPolitica === "ADVERTIR_FACTURAR_MINIMO"
                        ? "on"
                        : ""
                    }
                    onClick={() =>
                      setMinimoComercialPolitica("ADVERTIR_FACTURAR_MINIMO")
                    }
                    style={{ flex: 1 }}
                  >
                    Advertir
                  </button>
                  <button
                    type="button"
                    className={
                      minimoComercialPolitica === "BLOQUEAR" ? "on" : ""
                    }
                    onClick={() => setMinimoComercialPolitica("BLOQUEAR")}
                    style={{ flex: 1 }}
                  >
                    Bloquear
                  </button>
                </div>
                <span className="help">
                  Advertir cobra el mínimo solo en precio; la producción
                  conserva la cantidad real.
                </span>
              </div>
              {minimoComercialPolitica !== "NONE" && (
                <>
                  <div className="field">
                    <label>Base del mínimo</label>
                    <div className="segmented" style={{ width: "100%" }}>
                      <button
                        type="button"
                        className={
                          minimoComercialBase === "cantidad_comercial"
                            ? "on"
                            : ""
                        }
                        onClick={() =>
                          setMinimoComercialBase("cantidad_comercial")
                        }
                        style={{ flex: 1 }}
                      >
                        Cantidad comercial
                      </button>
                      <button
                        type="button"
                        className={
                          minimoComercialBase === "pliegos_impresos" ? "on" : ""
                        }
                        onClick={() =>
                          setMinimoComercialBase("pliegos_impresos")
                        }
                        style={{ flex: 1 }}
                      >
                        Pliegos impresos
                      </button>
                    </div>
                    <span className="help">
                      Pliegos impresos se calcula después del nesting de
                      impresión por hoja.
                    </span>
                  </div>
                  <div className="field">
                    <label>Cantidad mínima</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={minimoComercialCantidad}
                        onChange={(event) =>
                          setMinimoComercialCantidad(event.target.value)
                        }
                        placeholder={
                          minimoComercialBase === "pliegos_impresos"
                            ? "3"
                            : unidadComercial === "unidad"
                              ? "100"
                              : "1"
                        }
                      />
                      <span>{minimoUnidadLabel}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}

      {(dirty || guardando) && (
        <div className="save-sticky-footer">
          <div className="pricing-sticky-footer-copy">
            {seccion === "identidad"
              ? "Hay cambios sin guardar en identidad."
              : "Hay cambios sin guardar en la configuración comercial."}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
          >
            <SaveIcon className="mr-2 size-4" />
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </div>
  );
}

function presentacionEstadoRuta(estado: EstadoRutaPublicacionReceta) {
  switch (estado) {
    case "VIGENTE":
      return { label: "Vigente", tono: "published" };
    case "VIGENTE_CON_BORRADOR":
      return { label: "Vigente con borrador", tono: "draft" };
    case "DESACTUALIZADA":
      return { label: "Requiere publicación", tono: "outdated" };
    case "BLOQUEADA":
      return { label: "Bloqueada", tono: "blocked" };
    case "BORRADOR_INICIAL":
      return { label: "Borrador inicial", tono: "draft" };
    default:
      return { label: "Sin receta", tono: "empty" };
  }
}

function presentacionEstadoDependencia(estado: EstadoDependenciaReceta) {
  switch (estado) {
    case "VIGENTE":
      return "Vigente";
    case "ACTUALIZACION_DISPONIBLE":
      return "Actualización disponible";
    case "AMBIGUA":
      return "Ruta ambigua";
    default:
      return "Sin publicación";
  }
}

function ProduccionTab({
  producto,
  rutaAltId,
  rutasDisponibles,
  catalogoFamilias,
  recetas,
  estadoPublicacion,
  canManage,
}: {
  producto: ProductoDetalle;
  vista: ProductoProduccionVista;
  rutaAltId?: string;
  rutasDisponibles: RutaListItem[];
  catalogoFamilias?: CatalogoFamilias;
  recetas: ProductoReceta[];
  estadoPublicacion?: EstadoPublicacionProducto;
  canManage: boolean;
}) {
  const router = useRouter();
  const [confirmarRevisionOpen, setConfirmarRevisionOpen] =
    React.useState(false);
  const [preparandoRevision, setPreparandoRevision] = React.useState(false);
  const [estadoPublicacionOpen, setEstadoPublicacionOpen] =
    React.useState(false);
  const [nodoEditorPendiente, setNodoEditorPendiente] = React.useState("ruta");
  const rutaSeleccionada =
    producto.rutasAlternativas.find((ruta) => ruta.id === rutaAltId) ??
    producto.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
    producto.rutasAlternativas[0];
  const cambiarRuta = (rutaId: string) => {
    const params = new URLSearchParams({
      tab: "produccion",
      vista: "operaciones",
      rutaAltId: rutaId,
    });
    router.push(`/productos-servicios/${producto.id}?${params.toString()}`);
  };
  const recetaSeleccionada = recetas.find(
    (receta) => receta.rutaAlternativa.id === rutaSeleccionada?.id,
  );
  const borrador = recetaSeleccionada?.revisiones.find(
    (revision) => revision.estado === "BORRADOR",
  );
  const publicada = recetaSeleccionada?.revisionPublicada;
  const diagnosticoRuta = estadoPublicacion?.rutas.find(
    (item) => item.ruta.id === rutaSeleccionada?.id,
  );
  const presentacionPublicacion = presentacionEstadoRuta(
    diagnosticoRuta?.estado ??
      (borrador
        ? publicada
          ? "VIGENTE_CON_BORRADOR"
          : "BORRADOR_INICIAL"
        : publicada
          ? "VIGENTE"
          : "SIN_RECETA"),
  );
  const editorHref = rutaSeleccionada
    ? `/productos-servicios/${producto.id}/rutas/${rutaSeleccionada.id}`
    : null;

  const hrefEditorParaNodo = (nodoSeleccionado = "ruta") => {
    if (!editorHref) return null;
    const params = new URLSearchParams({ nodo: nodoSeleccionado });
    return `${editorHref}?${params.toString()}`;
  };

  const abrirEditorRuta = (nodoSeleccionado = "ruta") => {
    if (!editorHref) return;
    setNodoEditorPendiente(nodoSeleccionado);
    if (borrador) {
      router.push(hrefEditorParaNodo(nodoSeleccionado) ?? editorHref);
      return;
    }
    setConfirmarRevisionOpen(true);
  };

  const prepararRevisionYEditar = async () => {
    if (!rutaSeleccionada || !editorHref) return;
    setPreparandoRevision(true);
    try {
      await guardarBorradorReceta(producto.id, {
        rutaAlternativaId: rutaSeleccionada.id,
        cambios: publicada
          ? `Revisión del modelo productivo V${publicada.numero + 1}`
          : "Definición inicial del modelo productivo",
      });
      const siguienteVersion = publicada ? publicada.numero + 1 : 1;
      toast.success(`El borrador V${siguienteVersion} está listo para editar.`);
      setConfirmarRevisionOpen(false);
      router.push(hrefEditorParaNodo(nodoEditorPendiente) ?? editorHref);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la nueva revisión.",
      );
    } finally {
      setPreparandoRevision(false);
    }
  };

  return (
    <div className={styles.productionUnified}>
      <RutasTab
        producto={producto}
        rutasDisponibles={rutasDisponibles}
        rutaSeleccionadaId={rutaSeleccionada?.id}
        onRutaChange={cambiarRuta}
      >
        <section className={styles.productionUnifiedSection}>
          <div className={styles.productionUnifiedSectionHead}>
            <div className={styles.productionUnifiedSectionCopy}>
              <strong>Workflow</strong>
              <small>
                {producto.estructuraProducto === "COMPUESTO"
                  ? "Pasos, etapas y componentes forman un único recorrido."
                  : "Pasos operativos y dependencias de esta ruta de producción."}
              </small>
            </div>
            {rutaSeleccionada ? (
              <div className={styles.productionRouteHeadActions}>
                <span
                  className={styles.productionVersionStatus}
                  data-state={presentacionPublicacion.tono}
                >
                  <PackageCheckIcon />
                  {presentacionPublicacion.label}
                  {publicada
                    ? ` · V${publicada.numero}`
                    : borrador
                      ? ` · V${borrador.numero}`
                      : ""}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.publicationStatusTrigger}
                  onClick={() => setEstadoPublicacionOpen(true)}
                >
                  <GitBranchIcon data-icon="inline-start" />
                  Estado y dependencias
                </Button>
                <button
                  type="button"
                  className={styles.productionEditRoute}
                  onClick={() => abrirEditorRuta("ruta")}
                >
                  <CogIcon />
                  Editar ruta
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.productionUnifiedSectionBody}>
            {rutaSeleccionada ? (
              <ModeloProductivoPreview
                ruta={rutaSeleccionada}
                revision={(borrador ?? publicada) || undefined}
                catalogoFamilias={catalogoFamilias}
                editorHref={`/productos-servicios/${producto.id}/rutas/${rutaSeleccionada.id}`}
                onOpenEditor={abrirEditorRuta}
              />
            ) : (
              <SectionMissing title="No hay una ruta de producción para visualizar." />
            )}
          </div>
        </section>
      </RutasTab>

      <section className={styles.productionUnifiedSection}>
        <div
          className={`${styles.productionUnifiedSectionBody} ${styles.productionBomBody}`}
        >
          <RecetaProductoTab
            producto={producto}
            recetas={recetas}
            canManage={canManage}
            rutaAlternativaId={rutaSeleccionada?.id}
            projectionOnly
          />
        </div>
      </section>

      <Dialog
        open={estadoPublicacionOpen}
        onOpenChange={setEstadoPublicacionOpen}
      >
        <DialogContent className={styles.publicationStatusDialog}>
          <DialogHeader>
            <span className={styles.prepareRevisionEyebrow}>
              PUBLICACIÓN · {rutaSeleccionada?.nombre ?? "RUTA"}
            </span>
            <DialogTitle>Estado y dependencias de la receta</DialogTitle>
            <DialogDescription>
              Muestra qué versión puede usar hoy la cotización y qué productos
              dependen de ella.
            </DialogDescription>
          </DialogHeader>

          {diagnosticoRuta ? (
            <div className={styles.publicationStatusContent}>
              <div
                className={styles.publicationStatusSummary}
                data-state={presentacionPublicacion.tono}
              >
                <div>
                  <strong>{presentacionPublicacion.label}</strong>
                  <small>
                    {diagnosticoRuta.cotizableConReceta
                      ? `La cotización puede usar la V${diagnosticoRuta.revisionPublicada?.version}.`
                      : "Esta ruta no puede cotizar con su receta hasta publicar o resolver el bloqueo."}
                  </small>
                </div>
                <Badge variant="outline">
                  {diagnosticoRuta.revisionPublicada
                    ? `Publicada V${diagnosticoRuta.revisionPublicada.version}`
                    : "Sin publicación"}
                </Badge>
                {diagnosticoRuta.borrador ? (
                  <Badge variant="outline">
                    Borrador V{diagnosticoRuta.borrador.numero}
                  </Badge>
                ) : null}
              </div>

              {diagnosticoRuta.motivos.length > 0 ? (
                <section className={styles.publicationStatusSection}>
                  <div className={styles.publicationStatusSectionHead}>
                    <strong>Qué requiere atención</strong>
                    <span>{diagnosticoRuta.motivos.length}</span>
                  </div>
                  <div className={styles.publicationReasonList}>
                    {diagnosticoRuta.motivos.map((motivo) => (
                      <div
                        key={`${motivo.codigo}-${motivo.titulo}`}
                        className={styles.publicationReason}
                      >
                        <CircleAlertIcon />
                        <div>
                          <strong>{motivo.titulo}</strong>
                          <small>{motivo.detalle}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.publicationStatusSection}>
                <div className={styles.publicationStatusSectionHead}>
                  <strong>Componentes de esta receta</strong>
                  <span>{diagnosticoRuta.dependencias.length}</span>
                </div>
                {diagnosticoRuta.dependencias.length > 0 ? (
                  <div className={styles.publicationDependencyList}>
                    {diagnosticoRuta.dependencias.map((dependencia) => (
                      <div
                        key={dependencia.ocurrencia.id}
                        className={styles.publicationDependency}
                      >
                        <div className={styles.publicationDependencyName}>
                          <strong>{dependencia.ocurrencia.nombre}</strong>
                          <small>
                            {dependencia.rutaCongelada?.nombre ??
                              "Ruta de origen no disponible"}
                          </small>
                        </div>
                        <div className={styles.publicationVersions}>
                          <span>
                            Congelada V{dependencia.revisionCongelada.version}
                          </span>
                          <span aria-hidden="true">→</span>
                          <span>
                            {dependencia.revisionDisponible
                              ? `Disponible V${dependencia.revisionDisponible.version}`
                              : "Sin versión disponible"}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={styles.publicationDependencyBadge}
                          data-state={dependencia.estado.toLowerCase()}
                        >
                          {presentacionEstadoDependencia(dependencia.estado)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.publicationStatusEmpty}>
                    Esta receta no contiene componentes fabricados.
                  </p>
                )}
              </section>

              <section className={styles.publicationStatusSection}>
                <div className={styles.publicationStatusSectionHead}>
                  <strong>Productos que usan esta receta</strong>
                  <span>{estadoPublicacion?.usadoPor.length ?? 0}</span>
                </div>
                {estadoPublicacion?.usadoPor.length ? (
                  <div className={styles.publicationParentList}>
                    {estadoPublicacion.usadoPor.map((uso) => (
                      <Link
                        key={uso.revisionPublicadaPadre.id}
                        href={`/productos-servicios/${uso.productoPadre.id}?tab=produccion&vista=operaciones&rutaAltId=${uso.rutaPadre.id}`}
                        className={styles.publicationParent}
                      >
                        <div>
                          <strong>{uso.productoPadre.nombre}</strong>
                          <small>
                            {uso.rutaPadre.nombre} · Publicada V
                            {uso.revisionPublicadaPadre.version}
                          </small>
                        </div>
                        <span>
                          {uso.ocurrencias.some(
                            (item) => item.estado !== "VIGENTE",
                          )
                            ? "Requiere actualización"
                            : "Vigente"}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.publicationStatusEmpty}>
                    Ningún producto publicado usa esta receta como componente.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <p className={styles.publicationStatusEmpty}>
              No hay diagnóstico disponible para esta ruta.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEstadoPublicacionOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmarRevisionOpen}
        onOpenChange={(open) => {
          if (!preparandoRevision) setConfirmarRevisionOpen(open);
        }}
      >
        <DialogContent className={styles.prepareRevisionDialog}>
          <DialogHeader>
            <span className={styles.prepareRevisionEyebrow}>
              ROUTING · NUEVA REVISIÓN
            </span>
            <DialogTitle>
              {publicada
                ? `Crear borrador V${publicada.numero + 1} para editar`
                : "Crear el primer borrador para editar"}
            </DialogTitle>
            <DialogDescription>
              {publicada
                ? `La V${publicada.numero} está publicada y no se modificará. El editor trabajará sobre una copia versionada.`
                : "La configuración se guardará como borrador antes de abrir el editor de la ruta."}
            </DialogDescription>
          </DialogHeader>

          <Alert className={styles.prepareRevisionNotice}>
            <CopyPlusIcon />
            <AlertTitle>
              {publicada
                ? `La V${publicada.numero} seguirá activa`
                : "La ruta todavía no tiene una versión"}
            </AlertTitle>
            <AlertDescription>
              {publicada
                ? `Se copiarán sus pasos, componentes, dependencias y documentos al borrador V${publicada.numero + 1}.`
                : "Se conservarán los pasos actuales y se creará la base versionada del modelo productivo."}
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={preparandoRevision}
              onClick={() => setConfirmarRevisionOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={preparandoRevision}
              onClick={() => void prepararRevisionYEditar()}
            >
              <CopyPlusIcon data-icon="inline-start" />
              {preparandoRevision
                ? "Preparando…"
                : publicada
                  ? `Crear V${publicada.numero + 1} y editar`
                  : "Crear borrador y editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RutasTab({
  producto,
  rutasDisponibles,
  rutaSeleccionadaId,
  onRutaChange,
  children,
}: {
  producto: ProductoDetalle;
  rutasDisponibles: RutaListItem[];
  rutaSeleccionadaId?: string;
  onRutaChange: (rutaId: string) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [agregando, setAgregando] = React.useState(false);
  const [nuevaViaOpen, setNuevaViaOpen] = React.useState(false);
  const [modoNuevaVia, setModoNuevaVia] = React.useState<
    "duplicar" | "catalogo"
  >("duplicar");
  const [viaOrigenId, setViaOrigenId] = React.useState("");
  const [rutaEditandoId, setRutaEditandoId] = React.useState<string | null>(
    null,
  );
  const [nombreEditado, setNombreEditado] = React.useState("");
  const [guardandoNombreId, setGuardandoNombreId] = React.useState<
    string | null
  >(null);
  const [duplicandoRutaId, setDuplicandoRutaId] = React.useState<string | null>(
    null,
  );
  const [nuevaRutaId, setNuevaRutaId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [rutaAQuitar, setRutaAQuitar] = React.useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const yaUsadas = new Set(producto.rutasAlternativas.map((ra) => ra.ruta.id));
  const rutasParaAgregar = rutasDisponibles.filter(
    (ruta) => !yaUsadas.has(ruta.id),
  );
  const rutaSeleccionada =
    producto.rutasAlternativas.find((ruta) => ruta.id === rutaSeleccionadaId) ??
    producto.rutasAlternativas[0];

  const abrirNuevaVia = () => {
    const viaOrigen =
      producto.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
      producto.rutasAlternativas[0];
    const rutaCatalogo = rutasParaAgregar[0];
    const modoInicial = viaOrigen ? "duplicar" : "catalogo";

    setModoNuevaVia(modoInicial);
    setViaOrigenId(viaOrigen?.id ?? "");
    setNuevaRutaId(rutaCatalogo?.id ?? "");
    setNuevoNombre(
      viaOrigen
        ? `${viaOrigen.nombre} alternativa`
        : (rutaCatalogo?.nombre ?? ""),
    );
    setNuevaViaOpen(true);
  };

  const cambiarModoNuevaVia = (modo: "duplicar" | "catalogo") => {
    setModoNuevaVia(modo);
    if (modo === "duplicar") {
      const viaOrigen =
        producto.rutasAlternativas.find((ruta) => ruta.id === viaOrigenId) ??
        producto.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
        producto.rutasAlternativas[0];
      setViaOrigenId(viaOrigen?.id ?? "");
      setNuevoNombre(
        viaOrigen ? `${viaOrigen.nombre} alternativa` : "Nueva ruta",
      );
      return;
    }

    const rutaCatalogo =
      rutasParaAgregar.find((ruta) => ruta.id === nuevaRutaId) ??
      rutasParaAgregar[0];
    setNuevaRutaId(rutaCatalogo?.id ?? "");
    setNuevoNombre(rutaCatalogo?.nombre ?? "");
  };

  const crearNuevaVia = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      toast.error("Ingresá un nombre para la ruta de producción");
      return;
    }

    if (modoNuevaVia === "duplicar" && !viaOrigenId) {
      toast.error("Elegí la ruta que querés tomar como punto de partida");
      return;
    }

    if (modoNuevaVia === "catalogo" && !nuevaRutaId) {
      toast.error("Elegí una ruta del catálogo");
      return;
    }

    setAgregando(true);
    try {
      const nuevaVia =
        modoNuevaVia === "duplicar"
          ? await duplicarProductoRutaAlt(viaOrigenId, { nombre })
          : await crearProductoRutaAlt(producto.id, {
              rutaId: nuevaRutaId,
              rutaVersion:
                rutasDisponibles.find((item) => item.id === nuevaRutaId)
                  ?.versionActual ?? 1,
              nombre,
              esPreferida: producto.rutasAlternativas.length === 0,
              orden: producto.rutasAlternativas.length,
            });

      toast.success(`Ruta de producción "${nombre}" creada`);
      setNuevaViaOpen(false);
      setViaOrigenId("");
      setNuevaRutaId("");
      setNuevoNombre("");
      router.push(`/productos-servicios/${producto.id}/rutas/${nuevaVia.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error creando la ruta de producción",
      );
    } finally {
      setAgregando(false);
    }
  };

  const marcarPreferida = async (rutaAltId: string) => {
    try {
      await actualizarProductoRutaAlt(rutaAltId, { esPreferida: true });
      toast.success("Ruta marcada como preferida");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const iniciarEdicionNombre = (rutaAltId: string, nombre: string) => {
    setRutaEditandoId(rutaAltId);
    setNombreEditado(nombre);
  };

  const guardarNombreRuta = async (rutaAltId: string) => {
    const nombre = nombreEditado.trim();
    if (!nombre) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    setGuardandoNombreId(rutaAltId);
    try {
      await actualizarProductoRutaAlt(rutaAltId, { nombre });
      toast.success("Nombre de ruta actualizado");
      setRutaEditandoId(null);
      setNombreEditado("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error actualizando ruta",
      );
    } finally {
      setGuardandoNombreId(null);
    }
  };

  const duplicarRuta = async (rutaAltId: string, nombre: string) => {
    setDuplicandoRutaId(rutaAltId);
    try {
      await duplicarProductoRutaAlt(rutaAltId, { nombre: `${nombre} copia` });
      toast.success("Ruta duplicada");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error duplicando la ruta",
      );
    } finally {
      setDuplicandoRutaId(null);
    }
  };

  const quitarRuta = (rutaAltId: string, nombre: string) => {
    setRutaAQuitar({ id: rutaAltId, nombre });
  };

  return (
    <>
      <Tabs
        value={rutaSeleccionada?.id ?? ""}
        onValueChange={onRutaChange}
        className={styles.productionRoutesTabs}
      >
        <section className={styles.productionRoutesSelector}>
          <div className={styles.productionRoutesSelectorHead}>
            <div className={styles.productionRoutesSelectorTitle}>
              <div>
                <h2>Rutas de producción</h2>
                <p>
                  Elegí la ruta que querés consultar o creá una alternativa.
                </p>
              </div>
            </div>
            <div className={styles.productionRoutesSelectorActions}>
              <button
                className={styles.productionAddRoute}
                type="button"
                onClick={abrirNuevaVia}
              >
                <PlusIcon />
                Ruta de producción
              </button>
              {rutaSeleccionada ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={styles.productionRouteMenuTrigger}
                    aria-label={`Acciones de ${rutaSeleccionada.nombre}`}
                  >
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={styles.productionRouteMenu}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() =>
                          iniciarEdicionNombre(
                            rutaSeleccionada.id,
                            rutaSeleccionada.nombre,
                          )
                        }
                      >
                        <Edit3Icon />
                        Renombrar ruta
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={duplicandoRutaId === rutaSeleccionada.id}
                        onClick={() =>
                          duplicarRuta(
                            rutaSeleccionada.id,
                            rutaSeleccionada.nombre,
                          )
                        }
                      >
                        <CopyIcon />
                        Duplicar ruta
                      </DropdownMenuItem>
                      {!rutaSeleccionada.esPreferida ? (
                        <DropdownMenuItem
                          onClick={() => marcarPreferida(rutaSeleccionada.id)}
                        >
                          <StarIcon />
                          Marcar como preferida
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          quitarRuta(
                            rutaSeleccionada.id,
                            rutaSeleccionada.nombre,
                          )
                        }
                      >
                        <Trash2Icon />
                        Quitar del producto
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          {producto.rutasAlternativas.length > 0 ? (
            <div className={styles.productionRouteTabsScroller}>
              <TabsList
                variant="line"
                className={styles.productionRouteTabsList}
                aria-label="Rutas de producción"
              >
                {producto.rutasAlternativas.map((ruta) => (
                  <TabsTrigger
                    key={ruta.id}
                    value={ruta.id}
                    className={styles.productionRouteTab}
                  >
                    <GitBranchIcon />
                    <span>{ruta.nombre}</span>
                    {ruta.esPreferida ? <i>Preferida</i> : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ) : (
            <div className={styles.productionRoutesEmpty}>
              Todavía no hay rutas de producción configuradas.
            </div>
          )}
        </section>

        {rutaSeleccionada ? (
          <TabsContent
            value={rutaSeleccionada.id}
            className={styles.productionRouteTabContent}
          >
            {children}
          </TabsContent>
        ) : (
          children
        )}
      </Tabs>

      <Dialog
        open={rutaEditandoId !== null}
        onOpenChange={(open) => {
          if (!open && guardandoNombreId === null) {
            setRutaEditandoId(null);
            setNombreEditado("");
          }
        }}
      >
        <DialogContent className="gp-modal" overlayClassName="gp-modal-overlay">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (rutaEditandoId) guardarNombreRuta(rutaEditandoId);
            }}
          >
            <DialogHeader>
              <DialogTitle>Renombrar ruta de producción</DialogTitle>
              <DialogDescription>
                Este nombre identifica la alternativa dentro de este producto.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nombre-ruta-produccion">
                  Nombre de la ruta
                </FieldLabel>
                <Input
                  id="nombre-ruta-produccion"
                  value={nombreEditado}
                  onChange={(event) => setNombreEditado(event.target.value)}
                  autoFocus
                  disabled={guardandoNombreId !== null}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={guardandoNombreId !== null}
                onClick={() => {
                  setRutaEditandoId(null);
                  setNombreEditado("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={guardandoNombreId !== null}
                loadingText="Guardando…"
                disabled={!nombreEditado.trim()}
              >
                Guardar nombre
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={nuevaViaOpen}
        onOpenChange={(open) => {
          if (!agregando) setNuevaViaOpen(open);
        }}
      >
        <DialogContent
          className="gp-modal gp-modal-wide"
          overlayClassName="gp-modal-overlay"
        >
          <form onSubmit={crearNuevaVia}>
            <DialogHeader>
              <DialogTitle>Nueva ruta de producción</DialogTitle>
              <DialogDescription>
                Creá una alternativa a partir de una ruta existente o vinculá
                otra ruta reutilizable del catálogo.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field>
                <FieldLabel>Cómo querés comenzar</FieldLabel>
                <ToggleGroup
                  multiple={false}
                  value={[modoNuevaVia]}
                  onValueChange={(values) => {
                    const modo = values.at(-1) as
                      "duplicar" | "catalogo" | undefined;
                    if (modo) cambiarModoNuevaVia(modo);
                  }}
                  variant="outline"
                  spacing={8}
                  className={styles.newRouteModeGroup}
                  aria-label="Origen de la nueva ruta de producción"
                >
                  <ToggleGroupItem
                    value="duplicar"
                    disabled={producto.rutasAlternativas.length === 0}
                    className={styles.newRouteMode}
                  >
                    <CopyIcon />
                    <span>
                      <strong>Partir de una ruta actual</strong>
                      <small>
                        Copia la configuración de sus pasos como punto de
                        partida.
                      </small>
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="catalogo"
                    disabled={rutasParaAgregar.length === 0}
                    className={styles.newRouteMode}
                  >
                    <GitBranchIcon />
                    <span>
                      <strong>Usar otra ruta del catálogo</strong>
                      <small>
                        {rutasParaAgregar.length > 0
                          ? "Comienza con la estructura reusable de otra ruta."
                          : "No hay otra ruta reusable disponible."}
                      </small>
                    </span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {modoNuevaVia === "duplicar" ? (
                <Field>
                  <FieldLabel>Ruta de origen</FieldLabel>
                  <HumanSelect
                    value={viaOrigenId}
                    onValueChange={(value) => {
                      const id = value || "";
                      const via = producto.rutasAlternativas.find(
                        (item) => item.id === id,
                      );
                      setViaOrigenId(id);
                      if (via) setNuevoNombre(`${via.nombre} alternativa`);
                    }}
                    options={producto.rutasAlternativas.map((ruta) => ({
                      value: ruta.id,
                      label: ruta.nombre,
                      code: ruta.esPreferida ? "Preferida" : undefined,
                      description: `${ruta.ruta.nombre} · v${ruta.rutaVersion}`,
                    }))}
                    placeholder="Elegí una ruta..."
                  />
                  <FieldDescription>
                    La nueva ruta tendrá su propia configuración y podrás
                    adaptarla sin alterar la original.
                  </FieldDescription>
                </Field>
              ) : rutasParaAgregar.length > 0 ? (
                <Field>
                  <FieldLabel>Ruta reutilizable</FieldLabel>
                  <HumanSelect
                    value={nuevaRutaId}
                    onValueChange={(value) => {
                      const id = value || "";
                      const ruta = rutasParaAgregar.find(
                        (item) => item.id === id,
                      );
                      setNuevaRutaId(id);
                      if (ruta) setNuevoNombre(ruta.nombre);
                    }}
                    options={rutasParaAgregar.map((ruta) => ({
                      value: ruta.id,
                      label: ruta.nombre,
                      code: ruta.codigo,
                      description: `v${ruta.versionActual} · ${ruta.pasos.length} pasos`,
                    }))}
                    placeholder="Elegí una ruta..."
                  />
                </Field>
              ) : (
                <Alert>
                  <CircleAlertIcon />
                  <AlertTitle>No hay otras rutas disponibles</AlertTitle>
                  <AlertDescription>
                    Todas las rutas del catálogo ya están vinculadas. Podés
                    partir de una ruta actual o crear una nueva ruta reusable en
                    el catálogo de rutas.
                  </AlertDescription>
                </Alert>
              )}

              <Field>
                <FieldLabel htmlFor="nombre-nueva-via">
                  Nombre de la ruta
                </FieldLabel>
                <Input
                  id="nombre-nueva-via"
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  placeholder="Ej. Producción interna, Producción tercerizada"
                  autoFocus
                  disabled={agregando}
                />
                <FieldDescription>
                  Es el nombre que se verá al elegir cómo fabricar este
                  producto.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={agregando}
                onClick={() => setNuevaViaOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={agregando}
                loadingText="Creando ruta…"
                disabled={
                  !nuevoNombre.trim() ||
                  (modoNuevaVia === "duplicar" && !viaOrigenId) ||
                  (modoNuevaVia === "catalogo" && !nuevaRutaId)
                }
              >
                <PlusIcon data-icon="inline-start" />
                Crear ruta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmacionDestructiva
        open={rutaAQuitar !== null}
        onOpenChange={(open) => {
          if (!open) setRutaAQuitar(null);
        }}
        titulo="Quitar ruta de producción"
        descripcion={`¿Quitar la ruta "${rutaAQuitar?.nombre ?? ""}" de este producto?`}
        nombreItem={rutaAQuitar?.nombre}
        requiereTipear={false}
        accionLabel="Quitar ruta"
        onConfirmar={async () => {
          if (!rutaAQuitar) return;
          try {
            await eliminarProductoRutaAlt(rutaAQuitar.id);
            toast.success("Ruta quitada del producto");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
          setRutaAQuitar(null);
        }}
      />
    </>
  );
}

const MODOS_CARGO = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"] as const;

function CargosTab({
  producto,
  catalogoCargos,
}: {
  producto: ProductoDetalle;
  catalogoCargos: CargoDirectoCatalogo[];
}) {
  const router = useRouter();
  const [cargoSeleccionado, setCargoSeleccionado] = React.useState("");
  const [modoActivacion, setModoActivacion] =
    React.useState<(typeof MODOS_CARGO)[number]>("OPCIONAL");
  const [guardando, setGuardando] = React.useState(false);
  const [cargoAQuitar, setCargoAQuitar] = React.useState<{
    id: string;
    nombre: string;
  } | null>(null);

  const yaAsociados = new Set(
    producto.cargosDirectosCotizacion.map(
      (cargo) => cargo.cargoDirectoCatalogo.codigo,
    ),
  );
  const disponibles = catalogoCargos.filter(
    (cargo) => cargo.activo && !yaAsociados.has(cargo.codigo),
  );

  const asociar = async () => {
    if (!cargoSeleccionado) {
      toast.error("Elegí un cargo del catálogo");
      return;
    }
    setGuardando(true);
    try {
      await asociarCargoCotizacion(producto.id, {
        cargoDirectoCatalogoId: cargoSeleccionado,
        modoActivacion,
      });
      toast.success("Cargo asociado al producto");
      setCargoSeleccionado("");
      setModoActivacion("OPCIONAL");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error asociando cargo");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = (id: string, nombre: string) => {
    setCargoAQuitar({ id, nombre });
  };

  return (
    <div className="wiz-section">
      <div className="wiz-section-head">
        <div className="body">
          <h2>Cargos globales del producto (legado)</h2>
          <div className="helptext">
            Compatibilidad con configuraciones anteriores. Los costos nuevos se
            asocian dentro del paso correspondiente; los gastos generales se
            agregan en la orden.
          </div>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={asociar}
          disabled={guardando || !cargoSeleccionado}
        >
          <PlusIcon className="size-4" />
          {guardando ? "Asociando..." : "Asociar cargo"}
        </button>
      </div>

      {producto.cargosDirectosCotizacion.length === 0 ? (
        <div className="section-empty">
          <div className="ttl">Sin cargos asociados</div>
          <div className="sub">
            Este producto no tiene cargos directos a nivel cotización. Asociá
            uno del catálogo si necesitás ofrecer extras al comercial.
          </div>
        </div>
      ) : (
        <div className="cargo-grid">
          {producto.cargosDirectosCotizacion.map((cargo) => {
            const calc = getLabel(
              modoCalculoCargoLabels,
              cargo.cargoDirectoCatalogo.modoCalculo,
            );
            const activacion = getLabel(
              modoActivacionLabels,
              cargo.modoActivacion,
            );
            return (
              <div className="cargo-card" key={cargo.id}>
                <div className="cargo-card-main">
                  <div className="ttl">{cargo.cargoDirectoCatalogo.nombre}</div>
                  {cargo.cargoDirectoCatalogo.descripcion ? (
                    <div className="desc">
                      {cargo.cargoDirectoCatalogo.descripcion}
                    </div>
                  ) : null}
                  <div className="chips">
                    <span className="tag muted">{calc.label}</span>
                    <span
                      className={
                        cargo.modoActivacion === "OBLIGATORIO"
                          ? "tag ok"
                          : "tag muted"
                      }
                    >
                      <span className="d" />
                      {activacion.label}
                    </span>
                  </div>
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  title="Quitar cargo"
                  onClick={() =>
                    quitar(cargo.id, cargo.cargoDirectoCatalogo.nombre)
                  }
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="inline-add-panel">
        <div className="inline-add-title">Asociar cargo del catálogo</div>
        {disponibles.length === 0 ? (
          <div className="section-empty small">
            <div className="ttl">No hay cargos disponibles</div>
            <div className="sub">
              Todos los cargos activos ya están asociados o todavía no hay
              cargos creados en el catálogo.
            </div>
            <Link href="/productos-servicios/cargos-directos" className="btn">
              Administrar catálogo <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="inline-add-grid">
            <div className="field">
              <label>Cargo del catálogo</label>
              <HumanSelect
                value={cargoSeleccionado}
                onValueChange={(value) => setCargoSeleccionado(value ?? "")}
                options={disponibles.map((cargo) => {
                  const calc = getLabel(
                    modoCalculoCargoLabels,
                    cargo.modoCalculo,
                  );
                  return {
                    value: cargo.id,
                    label: cargo.nombre,
                    code: cargo.codigo,
                    description: calc.label,
                  };
                })}
                placeholder="Elegí cargo..."
              />
            </div>
            <div className="field">
              <label>¿Cuándo se aplica?</label>
              <div className="segmented" style={{ width: "100%" }}>
                {MODOS_CARGO.map((modo) => {
                  const label = getLabel(modoActivacionLabels, modo);
                  return (
                    <button
                      key={modo}
                      type="button"
                      className={modoActivacion === modo ? "on" : ""}
                      onClick={() => setModoActivacion(modo)}
                      style={{ flex: 1 }}
                      title={label.descripcion}
                    >
                      {label.label}
                    </button>
                  );
                })}
              </div>
              <span className="help">
                {getLabel(modoActivacionLabels, modoActivacion).descripcion}
              </span>
            </div>
          </div>
        )}
      </div>

      <ConfirmacionDestructiva
        open={cargoAQuitar !== null}
        onOpenChange={(open) => {
          if (!open) setCargoAQuitar(null);
        }}
        titulo="Quitar cargo"
        descripcion={`¿Quitar el cargo "${cargoAQuitar?.nombre ?? ""}" de este producto?`}
        nombreItem={cargoAQuitar?.nombre}
        requiereTipear={false}
        accionLabel="Quitar cargo"
        onConfirmar={async () => {
          if (!cargoAQuitar) return;
          try {
            await desasociarCargoCotizacion(cargoAQuitar.id);
            toast.success("Cargo desasociado");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
          setCargoAQuitar(null);
        }}
      />
    </div>
  );
}

function HerramientaToggle({
  titulo,
  descripcion,
  enabled,
  onToggle,
}: {
  titulo: string;
  descripcion: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingTop: 14,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{titulo}</div>
        <div
          style={{ fontSize: 11.5, color: "var(--muted-text)", marginTop: 2 }}
        >
          {descripcion}
        </div>
      </div>
      <button
        type="button"
        className={`toggle ${enabled ? "on" : ""}`}
        onClick={onToggle}
        aria-pressed={enabled}
      >
        <span className="switch" />
      </button>
    </div>
  );
}

function HerramientasTab({ producto }: { producto: ProductoDetalle }) {
  const router = useRouter();
  const inicial = React.useMemo(
    () => ({
      medidasDesdeArchivo: getHerramientaMedidasArchivo(
        producto.atributosComercialesJson,
      ).enabled,
      editorSello: getHerramientaEditorSello(producto.atributosComercialesJson)
        .enabled,
    }),
    [producto],
  );
  const [medidasDesdeArchivo, setMedidasDesdeArchivo] = React.useState(
    inicial.medidasDesdeArchivo,
  );
  const [editorSello, setEditorSello] = React.useState(inicial.editorSello);
  const [persistido, setPersistido] = React.useState(inicial);
  const [guardando, setGuardando] = React.useState(false);
  const dirty =
    medidasDesdeArchivo !== persistido.medidasDesdeArchivo ||
    editorSello !== persistido.editorSello;

  const guardar = async () => {
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        atributosComercialesJson: setHerramientaEditorSello(
          setHerramientaMedidasArchivo(
            producto.atributosComercialesJson as Record<string, unknown> | null,
            medidasDesdeArchivo,
          ),
          editorSello,
        ),
      });
      setPersistido({ medidasDesdeArchivo, editorSello });
      toast.success("Herramientas guardadas");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="wiz-cols">
      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Herramientas del producto</h2>
            <div className="helptext">
              Funciones opcionales que se habilitan al cotizar este producto.
              Iremos sumando más con el tiempo.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <HerramientaToggle
            titulo="Leer medidas desde PDF"
            descripcion="Al cotizar, permite adjuntar planos PDF y autocompletar las medidas de cada pieza leyendo el tamaño de cada página. Ideal para planos CAD."
            enabled={medidasDesdeArchivo}
            onToggle={() => setMedidasDesdeArchivo((current) => !current)}
          />
          <HerramientaToggle
            titulo="Editor de sello"
            descripcion="Al cotizar, habilita el botón “Diseñar sello”: el comercial carga el texto por línea según el cuerpo elegido, elige tipografía y genera los archivos de grabado (EPS positivo y negativo)."
            enabled={editorSello}
            onToggle={() => setEditorSello((current) => !current)}
          />
        </div>
      </div>
      {(dirty || guardando) && (
        <div className="save-sticky-footer">
          <div className="pricing-sticky-footer-copy">
            Hay cambios sin guardar en herramientas.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
          >
            <SaveIcon className="mr-2 size-4" />
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </div>
  );
}

function PricingTab({
  producto,
  recetas,
}: {
  producto: ProductoDetalle;
  recetas: ProductoReceta[];
}) {
  const router = useRouter();
  const [precioPersistido, setPrecioPersistido] =
    React.useState<TabPrecioConfig>(
      () =>
        (producto.precioConfigJson as TabPrecioConfig | null) ?? {
          metodoCalculo: "por_margen",
          detalle: { marginPct: 40, minimumMarginPct: 25 },
        },
    );
  const [precioConfig, setPrecioConfig] = React.useState<TabPrecioConfig>(
    () =>
      (producto.precioConfigJson as TabPrecioConfig | null) ?? {
        metodoCalculo: "por_margen",
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
  );
  const [componentesPersistidos, setComponentesPersistidos] = React.useState(
    () => crearComponentesPricingPorRuta(recetas),
  );
  const [componentesPorRuta, setComponentesPorRuta] = React.useState(() =>
    crearComponentesPricingPorRuta(recetas),
  );
  const [guardando, setGuardando] = React.useState(false);
  const precioProductoDirty = React.useMemo(
    () => precioConfigKey(precioConfig) !== precioConfigKey(precioPersistido),
    [precioConfig, precioPersistido],
  );
  const componentesDirty = React.useMemo(
    () =>
      componentesPricingKey(componentesPorRuta) !==
      componentesPricingKey(componentesPersistidos),
    [componentesPersistidos, componentesPorRuta],
  );
  const precioDirty = precioProductoDirty || componentesDirty;

  const guardar = async () => {
    setGuardando(true);
    try {
      const rutasDirty = Object.keys(componentesPorRuta).filter(
        (rutaAlternativaId) =>
          componentesPricingKey({
            [rutaAlternativaId]: componentesPorRuta[rutaAlternativaId] ?? [],
          }) !==
          componentesPricingKey({
            [rutaAlternativaId]:
              componentesPersistidos[rutaAlternativaId] ?? [],
          }),
      );

      for (const rutaAlternativaId of rutasDirty) {
        const receta = recetas.find(
          (item) => item.rutaAlternativa.id === rutaAlternativaId,
        );
        if (!receta) {
          throw new Error("No se encontró la receta de la ruta seleccionada.");
        }
        const borrador = receta.revisiones.find(
          (revision) => revision.estado === "BORRADOR",
        );
        const guardada = await guardarBorradorReceta(producto.id, {
          rutaAlternativaId,
          expectedUpdatedAt: borrador?.updatedAt,
          cambios: "Políticas de pricing por componente actualizadas",
          componentes: componentesPorRuta[rutaAlternativaId] ?? [],
        });
        const componentesGuardados = guardada.componentes.map(
          componenteRevisionAInput,
        );
        setComponentesPersistidos((current) => ({
          ...current,
          [rutaAlternativaId]: componentesGuardados,
        }));
        setComponentesPorRuta((current) => ({
          ...current,
          [rutaAlternativaId]: componentesGuardados,
        }));
      }

      if (precioProductoDirty) {
        await actualizarProducto(producto.id, {
          precioConfigJson: precioConfig as unknown as Record<string, unknown>,
        });
        setPrecioPersistido(precioConfig);
      }
      router.refresh();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <TabPrecioCompleto
        productoId={producto.id}
        precioConfig={precioConfig}
        onChangePrecioConfig={setPrecioConfig}
        unidadComercial={producto.unidadComercial}
        precioDirty={precioDirty}
        guardandoPrecio={guardando}
        onGuardarPrecio={guardar}
        pricingCompuestoSection={
          producto.estructuraProducto === "COMPUESTO" ? (
            <PricingCompuestoEditor
              producto={producto}
              precioConfig={precioConfig}
              onChangePrecioConfig={setPrecioConfig}
              recetas={recetas}
              componentesPorRuta={componentesPorRuta}
              onChangeComponentesPorRuta={setComponentesPorRuta}
              hayCambiosComponentes={componentesDirty}
            />
          ) : undefined
        }
      />
    </div>
  );
}

function SectionMissing({ title }: { title: string }) {
  return (
    <Card className="wiz-section border-amber-200 bg-amber-50">
      <CardContent className="flex items-center gap-2 pt-6 text-sm text-amber-800">
        <CircleAlertIcon className="size-4" />
        {title}
      </CardContent>
    </Card>
  );
}
