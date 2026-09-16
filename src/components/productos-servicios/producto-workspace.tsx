"use client";

import {
  ProductoVisualProvider,
  ProductoEdicion,
  NativeButton,
  ChoiceButton,
  Textarea,
  MedidaInput,
} from "./producto-ui";
import { Tabs as HeroTabs, Dropdown, Separator } from "@heroui/react";
import { RouterProvider } from "react-aria-components";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import listStyles from "@/components/design-system/list-page.module.css";
import { PiezasArchivosProducto } from "./piezas-archivos-producto";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  BoxIcon,
  BoxesIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  CircleAlertIcon,
  CogIcon,
  CopyIcon,
  Edit3Icon,
  GitBranchIcon,
  IdCardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  PackageCheckIcon,
  RouteIcon,
  StarIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "./producto-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "./producto-ui";
import { Button } from "./producto-ui";
import { ConfirmacionDestructiva } from "./producto-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./producto-ui";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { HumanSelect } from "./producto-ui";
import { Input } from "./producto-ui";
import { Switch } from "./producto-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./producto-ui";
import { NestingsGuardadosProducto } from "./nestings-guardados-producto";
import { ToggleGroup, ToggleGroupItem } from "./producto-ui";
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
import brand from "@/components/crm/contactos-workspace.module.css";
import { ProductoCatalogoGlyph } from "@/components/comercial/producto-catalogo-glyph";

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
    <div className={[styles.field].join(" ")}>
      <div
        className={styles.measureHeading}
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
            <NativeButton
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                onChange([...medidas, nuevaMedidaPredefinida(medidas.length)])
              }
            >
              <PlusIcon />
              Agregar medida
            </NativeButton>
            <NativeButton
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
            </NativeButton>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {medidasVisibles.map((medida, index) => (
          <div
            key={medida.id}
            className={styles.measureRow}
            data-depth={es3D || undefined}
          >
            <Input
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
                className={[styles.help].join(" ")}
                style={{ gridColumn: "span 2", margin: 0 }}
                title="Se recalcula sola si cambia el papel o la máquina del paso de impresión"
              >
                área útil del pliego · se resuelve al cotizar
              </span>
            ) : (
              <>
                <MedidaInput
                  label="Ancho (cm)"
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
                <MedidaInput
                  label="Alto (cm)"
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
                  <MedidaInput
                    label="Profundidad (cm)"
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
                <ChoiceButton
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
                </ChoiceButton>
                <NativeButton
                  type="button"
                  className="icon-action danger"
                  onClick={() => removeMedida(medida.id)}
                  disabled={medidas.length <= 1}
                  title="Eliminar medida"
                >
                  <Trash2Icon size={13} />
                </NativeButton>
              </>
            ) : (
              <span style={{ gridColumn: "span 2" }} />
            )}
          </div>
        ))}
      </div>
      <span className={[styles.help].join(" ")}>
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
  { id: "produccion", label: "Producción", icon: RouteIcon },
  { id: "herramientas", label: "Herramientas", icon: WrenchIcon },
  { id: "pricing", label: "Precio", icon: BanknoteIcon },
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

  const scope = useDesignScope();
  const theme = useDesignTheme();

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
    <ProductoVisualProvider>
      <main
        data-producto-ficha
        data-visual="brand"
        {...scope}
        className={`${theme} ${listStyles.page} ${styles.page}`}
      >
        <div className={styles.shell}>
          <Link href="/productos-servicios" className={styles.back}>
            <ArrowLeftIcon className="size-4" />
            Volver al catálogo
          </Link>
          <header className={styles.header}>
            <span className={styles.headerIcon} aria-hidden="true">
              <ProductoCatalogoGlyph
                subcategoriaCodigo={producto.subcategoriaComercial?.codigo}
                categoriaCodigo={
                  producto.subcategoriaComercial?.categoria?.codigo
                }
                compuesto={producto.esCompuesto}
                cobro={producto.unidadComercial}
              />
            </span>
            <div className={styles.headerBody}>
              <span className={styles.eyebrow}>Costos · Ficha de producto</span>
              <div className={styles.titleRow}>
                <h1>
                  {producto.nombre}
                  <span className={brand.titleDot}>.</span>
                </h1>
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
                  Configurá su identidad, producción y precio antes de
                  publicarlo.
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

          <RouterProvider navigate={(href) => router.push(href)}>
            <HeroTabs
              selectedKey={activeTab}
              variant="secondary"
              className={styles.workspace}
            >
              <HeroTabs.List
                className={styles.tabs}
                aria-label="Secciones del producto"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <HeroTabs.Tab
                      key={tab.id}
                      id={tab.id}
                      className={styles.tab}
                      data-active={activeTab === tab.id || undefined}
                      href={tabHref(tab.id)}
                    >
                      <span className={styles.tabIcon}>
                        <Icon className="size-4" />
                      </span>
                      <span className={styles.tabLabel}>{tab.label}</span>
                      <EstadoBadge {...validaciones[tab.id]} />
                    </HeroTabs.Tab>
                  );
                })}
              </HeroTabs.List>

              <HeroTabs.Panel id={activeTab} className={styles.tabContent}>
                <ProductoEdicion disabled={!canManage}>
                  {activeTab === "identidad" && (
                    <IdentidadTab producto={producto} seccion="identidad" />
                  )}
                  {activeTab === "comercial" && (
                    <>
                      <NestingsGuardadosProducto
                        productoId={producto.id}
                        rutaAlternativaId={
                          producto.rutasAlternativas.find((r) => r.esPreferida)
                            ?.id ?? producto.rutasAlternativas[0]?.id
                        }
                      />
                      <IdentidadTab producto={producto} seccion="comercial" />
                    </>
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
                </ProductoEdicion>
              </HeroTabs.Panel>
            </HeroTabs>
          </RouterProvider>
        </div>
      </main>
    </ProductoVisualProvider>
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
                | "unidad"
                | "m2"
                | "metro_lineal",
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
    <div className={[styles.formGrid].join(" ")}>
      {seccion === "identidad" ? (
        <Card
          className={[styles.section].join(" ")}
          style={{ gridColumn: "1 / -1" }}
        >
          <div className={[styles.sectionHead].join(" ")}>
            <div className={[styles.sectionCopy].join(" ")}>
              <h2>Identidad</h2>
              <div className={[styles.help].join(" ")}>
                Cómo se llama y se reconoce el producto en el catálogo.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={[styles.field].join(" ")}>
              <label>
                Nombre <span className={[styles.required].join(" ")}>*</span>
              </label>
              <Input
                aria-label="Nombre del producto"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
              />
            </div>
            <div className={[styles.field].join(" ")}>
              <label>Descripción</label>
              <Textarea
                aria-label="Descripción del producto"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
              />
            </div>
            <div className={[styles.field].join(" ")}>
              <label>Estructura del producto</label>
              <div
                className={styles.structureChoiceGrid}
                role="radiogroup"
                aria-label="Estructura del producto"
              >
                <NativeButton
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
                </NativeButton>
                <NativeButton
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
                </NativeButton>
              </div>
            </div>
            <div className={styles.classificationGrid}>
              <div className={[styles.field].join(" ")}>
                <label>Categoría comercial</label>
                <HumanSelect
                  placeholder="Elegir categoría"
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
              <div className={[styles.field].join(" ")}>
                <label>Subcategoría</label>
                <HumanSelect
                  placeholder="Elegir subcategoría"
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
              <Switch
                aria-label="Publicado"
                checked={activo}
                onCheckedChange={() => setActivo((current) => !current)}
              />
            </div>
          </div>
        </Card>
      ) : null}

      {seccion === "comercial" ? (
        <>
          <Card className={[styles.section, "col-span-full"].join(" ")}>
            <div className={[styles.sectionHead].join(" ")}>
              <div className={[styles.sectionCopy].join(" ")}>
                <h2>Comercial y medidas</h2>
                <div className={[styles.help].join(" ")}>
                  Definí cómo se vende el producto y qué datos deberá completar
                  el comercial al cotizarlo.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className={[styles.field].join(" ")}>
                <label>Unidad de venta</label>
                <div
                  className={[styles.segmented].join(" ")}
                  style={{ width: "100%" }}
                >
                  <ChoiceButton
                    type="button"
                    className={unidadComercial === "unidad" ? "on" : ""}
                    onClick={() => setUnidadComercial("unidad")}
                    style={{ flex: 1 }}
                  >
                    Por unidad
                  </ChoiceButton>
                  <ChoiceButton
                    type="button"
                    className={unidadComercial === "m2" ? "on" : ""}
                    onClick={() => setUnidadComercial("m2")}
                    style={{ flex: 1 }}
                  >
                    Por m²
                  </ChoiceButton>
                  <ChoiceButton
                    type="button"
                    className={unidadComercial === "metro_lineal" ? "on" : ""}
                    onClick={() => setUnidadComercial("metro_lineal")}
                    style={{ flex: 1 }}
                  >
                    Por metro lineal
                  </ChoiceButton>
                </div>
              </div>
              {unidadComercial === "unidad" && (
                <div className={[styles.field].join(" ")}>
                  <label>¿El producto se define por medidas?</label>
                  <div
                    className={[styles.segmented].join(" ")}
                    style={{ width: "100%" }}
                  >
                    <ChoiceButton
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
                    </ChoiceButton>
                    <ChoiceButton
                      type="button"
                      className={sinMedida ? "on" : ""}
                      onClick={() => setSinMedida(true)}
                      style={{ flex: 1 }}
                    >
                      No utiliza medidas
                    </ChoiceButton>
                  </div>
                  <div className={[styles.help].join(" ")}>
                    Elegí «No utiliza medidas» cuando la cantidad de unidades
                    sea suficiente para cotizar el producto.
                  </div>
                </div>
              )}
              {!sinMedida && (
                <div className={[styles.field].join(" ")}>
                  <label>Geometría del producto</label>
                  <div
                    className={[styles.segmented].join(" ")}
                    style={{ width: "100%" }}
                  >
                    <ChoiceButton
                      type="button"
                      className={geometria === "2D" ? "on" : ""}
                      onClick={() => setGeometria("2D")}
                      style={{ flex: 1 }}
                    >
                      2D · Ancho y alto
                    </ChoiceButton>
                    <ChoiceButton
                      type="button"
                      className={geometria === "3D" ? "on" : ""}
                      onClick={() => setGeometria("3D")}
                      style={{ flex: 1 }}
                    >
                      3D · Ancho, alto y profundidad
                    </ChoiceButton>
                  </div>
                  <div className={[styles.help].join(" ")}>
                    El sheet solicitará exactamente estas dimensiones cuando el
                    comercial deba definir una medida.
                  </div>
                </div>
              )}
              {(estructuraProducto === "COMPUESTO" || !sinMedida) && (
                <div className={[styles.field].join(" ")}>
                  <label>Forma que puede recibir el producto</label>
                  <div
                    className={[styles.segmented].join(" ")}
                    style={{ width: "100%" }}
                  >
                    {(
                      [
                        ["RECTANGULAR", "Rectangular"],
                        ["VECTORIAL", "Forma vectorial"],
                        ["AMBAS", "Ambas"],
                      ] as Array<[ModoGeometriaComercial, string]>
                    ).map(([modo, label]) => (
                      <ChoiceButton
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
                      </ChoiceButton>
                    ))}
                  </div>
                  <div className={[styles.help].join(" ")}>
                    La forma pertenece al producto; la ruta define después qué
                    máquina y qué motor pueden fabricarla.
                  </div>
                  {geometriasComerciales.modo !== "RECTANGULAR" ? (
                    <div className={styles.geometrySources}>
                      <PiezasArchivosProducto
                        productoId={producto.id}
                        fuentes={geometriasComerciales.fuentes}
                        onChange={(fuentes) =>
                          setGeometriasComercialesEstado((actual) => ({
                            ...actual,
                            fuentes,
                          }))
                        }
                      />
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
                <div className={[styles.field].join(" ")}>
                  <label>¿Cómo se define la medida?</label>
                  <div
                    className={[styles.segmented].join(" ")}
                    style={{ width: "100%" }}
                  >
                    <ChoiceButton
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
                    </ChoiceButton>
                    <ChoiceButton
                      type="button"
                      className={modoMedidas === "LIBRE" ? "on" : ""}
                      onClick={() => setModoMedidas("LIBRE")}
                      style={{ flex: 1 }}
                    >
                      Medida libre
                    </ChoiceButton>
                    <ChoiceButton
                      type="button"
                      className={modoMedidas === "COMERCIAL_ELIGE" ? "on" : ""}
                      onClick={() => setModoMedidas("COMERCIAL_ELIGE")}
                      style={{ flex: 1 }}
                    >
                      Medidas predefinidas
                    </ChoiceButton>
                    <ChoiceButton
                      type="button"
                      className={modoMedidas === "MIXTA" ? "on" : ""}
                      onClick={() => setModoMedidas("MIXTA")}
                      style={{ flex: 1 }}
                    >
                      Predefinida o personalizada
                    </ChoiceButton>
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
              <div className={[styles.field].join(" ")}>
                <label>Mínimo comercial</label>
                <div
                  className={[styles.segmented].join(" ")}
                  style={{ width: "100%" }}
                >
                  <ChoiceButton
                    type="button"
                    className={minimoComercialPolitica === "NONE" ? "on" : ""}
                    onClick={() => setMinimoComercialPolitica("NONE")}
                    style={{ flex: 1 }}
                  >
                    Sin mínimo
                  </ChoiceButton>
                  <ChoiceButton
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
                  </ChoiceButton>
                  <ChoiceButton
                    type="button"
                    className={
                      minimoComercialPolitica === "BLOQUEAR" ? "on" : ""
                    }
                    onClick={() => setMinimoComercialPolitica("BLOQUEAR")}
                    style={{ flex: 1 }}
                  >
                    Bloquear
                  </ChoiceButton>
                </div>
                <span className={[styles.help].join(" ")}>
                  Advertir cobra el mínimo solo en precio; la producción
                  conserva la cantidad real.
                </span>
              </div>
              {minimoComercialPolitica !== "NONE" && (
                <>
                  <div className={[styles.field].join(" ")}>
                    <label>Base del mínimo</label>
                    <div
                      className={[styles.segmented].join(" ")}
                      style={{ width: "100%" }}
                    >
                      <ChoiceButton
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
                      </ChoiceButton>
                      <ChoiceButton
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
                      </ChoiceButton>
                    </div>
                    <span className={[styles.help].join(" ")}>
                      Pliegos impresos se calcula después del nesting de
                      impresión por hoja.
                    </span>
                  </div>
                  <div className={[styles.field].join(" ")}>
                    <label>Cantidad mínima</label>
                    <div className={[styles.inputUnit].join(" ")}>
                      <Input
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
          </Card>
        </>
      ) : null}

      {(dirty || guardando) && (
        <div className={[styles.saveFooter].join(" ")}>
          <div className={[styles.saveCopy].join(" ")}>
            {seccion === "identidad"
              ? "Hay cambios sin guardar en identidad."
              : "Hay cambios sin guardar en la configuración comercial."}
          </div>
          <NativeButton
            type="button"
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
          >
            <ArrowUpRightIcon />
            {guardando ? "Guardando..." : "Guardar cambios"}
          </NativeButton>
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
  const [estadoPublicacionOpen, setEstadoPublicacionOpen] =
    React.useState(false);
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
    const href = hrefEditorParaNodo(nodoSeleccionado);
    if (href) router.push(href);
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
              <strong>Flujos de producción</strong>
              <small>
                {producto.estructuraProducto === "COMPUESTO"
                  ? "Nodos simples, nodos compuestos y componentes forman un único recorrido."
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
                <Button
                  variant="outline"
                  type="button"
                  className={styles.productionEditRoute}
                  onClick={() => abrirEditorRuta("ruta")}
                >
                  <CogIcon />
                  Editar ruta
                </Button>
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
                      : "Completá la configuración pendiente; la publicación se actualiza automáticamente."}
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
  const scope = useDesignScope();
  const theme = useDesignTheme();
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
                <h2>Flujos de producción</h2>
                <p>
                  Elegí la ruta que querés consultar o creá una alternativa.
                </p>
              </div>
            </div>
            <div className={styles.productionRoutesSelectorActions}>
              <Button
                variant="default"
                className={styles.productionAddRoute}
                type="button"
                onClick={abrirNuevaVia}
              >
                <PlusIcon />
                Ruta de producción
              </Button>
              {rutaSeleccionada ? (
                <Dropdown>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={styles.productionRouteMenuTrigger}
                    aria-label={`Acciones de ${rutaSeleccionada.nombre}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>

                  <Dropdown.Popover
                    {...scope}
                    className={`${theme} ${styles.productionRouteMenu}`}
                    placement="bottom end"
                  >
                    <Dropdown.Menu aria-label="Acciones de la ruta">
                      <Dropdown.Section>
                        <Dropdown.Item
                          onAction={() =>
                            iniciarEdicionNombre(
                              rutaSeleccionada.id,
                              rutaSeleccionada.nombre,
                            )
                          }
                        >
                          <Edit3Icon />
                          Renombrar ruta
                        </Dropdown.Item>
                        <Dropdown.Item
                          isDisabled={duplicandoRutaId === rutaSeleccionada.id}
                          onAction={() =>
                            duplicarRuta(
                              rutaSeleccionada.id,
                              rutaSeleccionada.nombre,
                            )
                          }
                        >
                          <CopyIcon />
                          Duplicar ruta
                        </Dropdown.Item>
                        {!rutaSeleccionada.esPreferida ? (
                          <Dropdown.Item
                            onAction={() =>
                              marcarPreferida(rutaSeleccionada.id)
                            }
                          >
                            <StarIcon />
                            Marcar como preferida
                          </Dropdown.Item>
                        ) : null}
                      </Dropdown.Section>
                      <Separator />
                      <Dropdown.Section>
                        <Dropdown.Item
                          variant="danger"
                          onAction={() =>
                            quitarRuta(
                              rutaSeleccionada.id,
                              rutaSeleccionada.nombre,
                            )
                          }
                        >
                          <Trash2Icon />
                          Quitar del producto
                        </Dropdown.Item>
                      </Dropdown.Section>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null}
            </div>
          </div>

          {producto.rutasAlternativas.length > 0 ? (
            <div className={styles.productionRouteTabsScroller}>
              <TabsList
                variant="line"
                className={styles.productionRouteTabsList}
                aria-label="Flujos de producción"
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
              Todavía no hay flujos de producción configurados.
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
                      | "duplicar"
                      | "catalogo"
                      | undefined;
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
    <Card className={[styles.section].join(" ")}>
      <div className={[styles.sectionHead].join(" ")}>
        <div className={[styles.sectionCopy].join(" ")}>
          <h2>Cargos globales del producto (legado)</h2>
          <div className={[styles.help].join(" ")}>
            Compatibilidad con configuraciones anteriores. Los costos nuevos se
            asocian dentro del paso correspondiente; los gastos generales se
            agregan en la orden.
          </div>
        </div>
        <NativeButton
          className="btn btn-primary"
          type="button"
          onClick={asociar}
          disabled={guardando || !cargoSeleccionado}
        >
          <PlusIcon className="size-4" />
          {guardando ? "Asociando..." : "Asociar cargo"}
        </NativeButton>
      </div>

      {producto.cargosDirectosCotizacion.length === 0 ? (
        <div className={[styles.empty].join(" ")}>
          <div className={[styles.itemTitle].join(" ")}>
            Sin cargos asociados
          </div>
          <div className={[styles.help].join(" ")}>
            Este producto no tiene cargos directos a nivel cotización. Asociá
            uno del catálogo si necesitás ofrecer extras al comercial.
          </div>
        </div>
      ) : (
        <div className={[styles.cargoGrid].join(" ")}>
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
              <Card className={[styles.cargoCard].join(" ")} key={cargo.id}>
                <div className={[styles.cargoMain].join(" ")}>
                  <div className={[styles.itemTitle].join(" ")}>
                    {cargo.cargoDirectoCatalogo.nombre}
                  </div>
                  {cargo.cargoDirectoCatalogo.descripcion ? (
                    <div className={[styles.help].join(" ")}>
                      {cargo.cargoDirectoCatalogo.descripcion}
                    </div>
                  ) : null}
                  <div className={[styles.chips].join(" ")}>
                    <span className={[styles.tag, styles.muted].join(" ")}>
                      {calc.label}
                    </span>
                    <span
                      className={
                        cargo.modoActivacion === "OBLIGATORIO"
                          ? "tag ok"
                          : "tag muted"
                      }
                    >
                      <span className={[styles.dot].join(" ")} />
                      {activacion.label}
                    </span>
                  </div>
                </div>
                <NativeButton
                  className="icon-btn"
                  type="button"
                  title="Quitar cargo"
                  onClick={() =>
                    quitar(cargo.id, cargo.cargoDirectoCatalogo.nombre)
                  }
                >
                  <Trash2Icon className="size-4" />
                </NativeButton>
              </Card>
            );
          })}
        </div>
      )}

      <div className={[styles.addPanel].join(" ")}>
        <div className={[styles.addTitle].join(" ")}>
          Asociar cargo del catálogo
        </div>
        {disponibles.length === 0 ? (
          <div className={[styles.empty, styles.small].join(" ")}>
            <div className={[styles.itemTitle].join(" ")}>
              No hay cargos disponibles
            </div>
            <div className={[styles.help].join(" ")}>
              Todos los cargos activos ya están asociados o todavía no hay
              cargos creados en el catálogo.
            </div>
            <Link href="/productos-servicios/cargos-directos" className="btn">
              Administrar catálogo <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className={[styles.addGrid].join(" ")}>
            <div className={[styles.field].join(" ")}>
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
            <div className={[styles.field].join(" ")}>
              <label>¿Cuándo se aplica?</label>
              <div
                className={[styles.segmented].join(" ")}
                style={{ width: "100%" }}
              >
                {MODOS_CARGO.map((modo) => {
                  const label = getLabel(modoActivacionLabels, modo);
                  return (
                    <ChoiceButton
                      key={modo}
                      type="button"
                      className={modoActivacion === modo ? "on" : ""}
                      onClick={() => setModoActivacion(modo)}
                      style={{ flex: 1 }}
                      title={label.descripcion}
                    >
                      {label.label}
                    </ChoiceButton>
                  );
                })}
              </div>
              <span className={[styles.help].join(" ")}>
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
    </Card>
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
    <div className={styles.toolRow}>
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{titulo}</div>
        <div
          style={{ fontSize: 11.5, color: "var(--muted-text)", marginTop: 2 }}
        >
          {descripcion}
        </div>
      </div>
      <Switch
        aria-label={titulo}
        checked={enabled}
        onCheckedChange={onToggle}
      />
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
    <div className={[styles.formGrid].join(" ")}>
      <Card className={[styles.section].join(" ")}>
        <div className={[styles.sectionHead].join(" ")}>
          <div className={[styles.sectionCopy].join(" ")}>
            <h2>Herramientas del producto</h2>
            <div className={[styles.help].join(" ")}>
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
      </Card>
      {(dirty || guardando) && (
        <div className={[styles.saveFooter].join(" ")}>
          <div className={[styles.saveCopy].join(" ")}>
            Hay cambios sin guardar en herramientas.
          </div>
          <NativeButton
            type="button"
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando}
          >
            <ArrowUpRightIcon />
            {guardando ? "Guardando..." : "Guardar cambios"}
          </NativeButton>
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
    <Card
      className={[styles.section, "border-amber-200", "bg-amber-50"].join(" ")}
    >
      <CardContent className="flex items-center gap-2 pt-6 text-sm text-amber-800">
        <CircleAlertIcon className="size-4" />
        {title}
      </CardContent>
    </Card>
  );
}
