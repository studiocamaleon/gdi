"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CheckIcon,
  CircleAlertIcon,
  CogIcon,
  CopyIcon,
  Edit3Icon,
  FactoryIcon,
  FootprintsIcon,
  GitBranchIcon,
  PlusIcon,
  PackageCheckIcon,
  SaveIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { HumanSelect } from "@/components/ui/human-select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabPrecioCompleto } from "@/components/productos-servicios/tab-precio-completo";
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
  type LookupsConfigPaso,
  type ProductoReceta,
} from "@/lib/productos-servicios-api";
import { RecetaProductoTab } from "@/components/productos-servicios/receta-producto-tab";
import {
  getHerramientaMedidasArchivo,
  setHerramientaMedidasArchivo,
  getHerramientaEditorSello,
  setHerramientaEditorSello,
} from "@/lib/producto-herramientas";
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  MedidaPredefinidaProducto,
  MinimoComercialPolitica,
  MinimoComercialBase,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
  RutaListItem,
} from "@/lib/productos-servicios";
import {
  getMedidasPredefinidas,
  medidaLabel,
  normalizeMedidasDraft,
} from "@/lib/producto-medidas";
import {
  getPersonalizaciones,
  normalizePersonalizaciones,
  nuevaPersonalizacion,
  type PersonalizacionProducto,
} from "@/lib/producto-personalizaciones";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";
import styles from "./producto-workspace.module.css";

export type ProductoWorkspaceTab =
  | "identidad"
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
) {
  if (!modoMedidasUsaPredefinidas(modo)) return [];
  const normalizadas = normalizeMedidasDraft(medidas);
  if (modo !== "FIJA") return normalizadas;
  const defaultMedida =
    normalizadas.find((medida) => medida.esDefault) ?? normalizadas[0];
  return defaultMedida ? [{ ...defaultMedida, esDefault: true }] : [];
}

function MedidasPredefinidasEditor({
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
        <label>Medidas disponibles</label>
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
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {medidas.map((medida, index) => (
          <div
            key={medida.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.8fr 0.8fr auto auto",
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
                  value={medida.anchoMm || ""}
                  onChange={(event) =>
                    updateMedida(medida.id, {
                      anchoMm: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="Ancho mm"
                  aria-label={`Ancho de medida ${index + 1}`}
                />
                <input
                  type="number"
                  min="0"
                  value={medida.altoMm || ""}
                  onChange={(event) =>
                    updateMedida(medida.id, {
                      altoMm: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="Alto mm"
                  aria-label={`Alto de medida ${index + 1}`}
                />
              </>
            )}
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
          </div>
        ))}
      </div>
      <span className="help">
        La medida con estrella se usa por defecto al cotizar y mantiene la
        compatibilidad con el motor.
      </span>
    </div>
  );
}

function PersonalizacionesEditor({
  personalizaciones,
  onChange,
}: {
  personalizaciones: PersonalizacionProducto[];
  onChange: (next: PersonalizacionProducto[]) => void;
}) {
  const update = (id: string, patch: Partial<PersonalizacionProducto>) =>
    onChange(
      personalizaciones.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  const remove = (id: string) =>
    onChange(personalizaciones.filter((p) => p.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {personalizaciones.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted-text)" }}>
          Todavía sin personalizaciones. Agregá una para que su medida maneje el
          costo del material/paso de decoración (ej. la impresión DTF).
        </div>
      ) : null}
      {personalizaciones.map((p, index) => (
        <div
          key={p.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-2)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              value={p.nombre}
              onChange={(event) => update(p.id, { nombre: event.target.value })}
              placeholder={`Personalización ${index + 1} (ej. Impresión DTF, Frente)`}
              style={{ flex: 1 }}
              aria-label={`Nombre de la personalización ${index + 1}`}
            />
            <button
              type="button"
              className="icon-action danger"
              onClick={() => remove(p.id)}
              title="Eliminar personalización"
            >
              <Trash2Icon size={13} />
            </button>
          </div>
          <div className="field">
            <label>Medida</label>
            <div className="segmented" style={{ width: "100%" }}>
              <button
                type="button"
                className={p.modoMedida === "FIJA" ? "on" : ""}
                onClick={() => update(p.id, { modoMedida: "FIJA" })}
                style={{ flex: 1 }}
              >
                Predefinida
              </button>
              <button
                type="button"
                className={p.modoMedida === "CLIENTE" ? "on" : ""}
                onClick={() => update(p.id, { modoMedida: "CLIENTE" })}
                style={{ flex: 1 }}
              >
                La ingresa el cliente
              </button>
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div className="field">
              <label>
                {p.modoMedida === "FIJA" ? "Ancho (mm)" : "Ancho sugerido (mm)"}
              </label>
              <input
                type="number"
                min="0"
                value={p.anchoMm || ""}
                onChange={(event) =>
                  update(p.id, { anchoMm: Number(event.target.value) || 0 })
                }
                placeholder="Ancho mm"
              />
            </div>
            <div className="field">
              <label>
                {p.modoMedida === "FIJA" ? "Alto (mm)" : "Alto sugerido (mm)"}
              </label>
              <input
                type="number"
                min="0"
                value={p.altoMm || ""}
                onChange={(event) =>
                  update(p.id, { altoMm: Number(event.target.value) || 0 })
                }
                placeholder="Alto mm"
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>Obligatoria</div>
              <div style={{ fontSize: 11.5, color: "var(--muted-text)" }}>
                Si está apagada, el comercial la activa al cotizar (opcional).
              </div>
            </div>
            <button
              type="button"
              className={`toggle ${p.obligatoria ? "on" : ""}`}
              onClick={() => update(p.id, { obligatoria: !p.obligatoria })}
              aria-pressed={p.obligatoria}
            >
              <span className="switch" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() =>
          onChange([
            ...personalizaciones,
            nuevaPersonalizacion(personalizaciones.length),
          ])
        }
      >
        <PlusIcon />
        Agregar personalización
      </button>
    </div>
  );
}

const TABS: Array<{
  id: ProductoWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "identidad", label: "Identidad", icon: TagIcon },
  { id: "produccion", label: "Producción", icon: FactoryIcon },
  { id: "herramientas", label: "Herramientas", icon: WrenchIcon },
  { id: "pricing", label: "Pricing", icon: BanknoteIcon },
];

function tabValidaciones(
  producto: ProductoDetalle,
  recetas: ProductoReceta[],
): Record<ProductoWorkspaceTab, ValidacionTab> {
  const rutas = producto.rutasAlternativas;
  const sinRutas = rutas.length === 0;
  const sinPreferida = rutas.length > 0 && !rutas.some((r) => r.esPreferida);
  const pasosIncompletos = rutas.some(
    (r) => r.configPasos.length < r.ruta.pasos.length,
  );
  const precioConfig = producto.precioConfigJson as TabPrecioConfig | null;

  return {
    identidad:
      producto.codigo && producto.nombre
        ? { estado: "ok", label: "Completo" }
        : { estado: "error", label: "Faltan datos" },
    produccion: sinRutas
      ? { estado: "error", label: "Sin rutas" }
      : sinPreferida
        ? { estado: "warning", label: "Sin ruta preferida" }
        : pasosIncompletos
          ? { estado: "warning", label: "Pasos incompletos" }
          : recetas.length === 0
            ? { estado: "warning", label: "Sin versión publicada" }
            : recetas.some((item) =>
                  item.revisiones.some(
                    (revision) => revision.estado === "BORRADOR",
                  ),
                )
              ? { estado: "warning", label: "Cambios sin publicar" }
              : { estado: "ok", label: "Publicada" },
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
  canManage,
}: Props) {
  const router = useRouter();
  const validaciones = React.useMemo(
    () => tabValidaciones(producto, recetas),
    [producto, recetas],
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
            <div className={styles.meta}>
              {producto.subcategoriaComercial?.nombre ? (
                <span>{producto.subcategoriaComercial.nombre}</span>
              ) : null}
              <span>
                {producto.unidadComercial === "m2"
                  ? "Venta por metro cuadrado"
                  : producto.unidadComercial === "metro_lineal"
                    ? "Venta por metro lineal"
                    : "Venta por unidad"}
              </span>
            </div>
          </div>
        </header>

        <div className={styles.validation}>
          <ProductoValidacionPanel productoId={producto.id} />
        </div>
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
                <IdentidadTab producto={producto} />
              )}
              {activeTab === "produccion" && (
                <ProduccionTab
                  producto={producto}
                  vista={produccionVista}
                  rutaAltId={rutaAltId}
                  rutasDisponibles={rutasDisponibles}
                  catalogoFamilias={catalogoFamilias}
                  recetas={recetas}
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
              {activeTab === "pricing" && <PricingTab producto={producto} />}
            </fieldset>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function IdentidadTab({ producto }: { producto: ProductoDetalle }) {
  const router = useRouter();
  const identidadInicial = React.useMemo(
    () => ({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      subcategoriaComercialCodigo:
        producto.subcategoriaComercial?.codigo ?? "producto_a_medida",
      unidadComercial: producto.unidadComercial,
      modoMedidas: producto.modoMedidas,
      minimoComercialPolitica: producto.minimoComercialPolitica ?? "NONE",
      minimoComercialCantidad: producto.minimoComercialCantidad ?? "",
      minimoComercialBase: producto.minimoComercialBase ?? "cantidad_comercial",
      medidas: getMedidasPredefinidas(producto),
      sinMedida:
        (producto.modoMedidas ?? "FIJA") === "FIJA" &&
        getMedidasPredefinidas(producto).length === 0,
      personalizaciones: getPersonalizaciones(producto.personalizacionesJson),
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
  const [personalizaciones, setPersonalizaciones] = React.useState<
    PersonalizacionProducto[]
  >(() => getPersonalizaciones(producto.personalizacionesJson));
  const [activo, setActivo] = React.useState(producto.activo);
  // Producto por unidad sin medida (merchandising: taza, remera). Se persiste
  // como FIJA + medidas vacías. Ver docs/productos-comprados-merchandising-diseno.md
  const [sinMedida, setSinMedida] = React.useState<boolean>(
    () =>
      (producto.modoMedidas ?? "FIJA") === "FIJA" &&
      getMedidasPredefinidas(producto).length === 0,
  );
  React.useEffect(() => {
    if (unidadComercial !== "unidad" && sinMedida) setSinMedida(false);
  }, [unidadComercial, sinMedida]);
  const [guardando, setGuardando] = React.useState(false);

  const identidadActual = React.useMemo(
    () => ({
      nombre,
      descripcion,
      subcategoriaComercialCodigo,
      unidadComercial,
      modoMedidas: sinMedida ? "FIJA" : modoMedidas,
      minimoComercialPolitica,
      minimoComercialCantidad:
        minimoComercialPolitica === "NONE" ? "" : minimoComercialCantidad,
      minimoComercialBase:
        minimoComercialPolitica === "NONE"
          ? "cantidad_comercial"
          : minimoComercialBase,
      medidas: sinMedida ? [] : normalizarMedidasPorModo(modoMedidas, medidas),
      sinMedida,
      personalizaciones: normalizePersonalizaciones(personalizaciones),
      activo,
    }),
    [
      activo,
      descripcion,
      medidas,
      sinMedida,
      personalizaciones,
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
      ),
      personalizaciones: normalizePersonalizaciones(
        identidadPersistida.personalizaciones,
      ),
    }),
    [identidadPersistida],
  );
  const dirty = React.useMemo(
    () =>
      JSON.stringify(identidadActual) !==
      JSON.stringify(identidadPersistidaNormalizada),
    [identidadActual, identidadPersistidaNormalizada],
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

  const subcategoriaOptions = catalogoComercial.flatMap((categoria) =>
    categoria.subcategorias.map((subcategoria) => ({
      value: subcategoria.codigo,
      label: `${categoria.nombre} · ${subcategoria.nombre}`,
    })),
  );
  const minimoUnidadLabel =
    minimoComercialBase === "pliegos_impresos"
      ? "pliegos"
      : unidadComercial === "m2"
        ? "m²"
        : unidadComercial === "metro_lineal"
          ? "ml"
          : "u.";

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.error("Falta nombre");
      return;
    }
    const modoMedidasEfectivo = sinMedida ? "FIJA" : modoMedidas;
    const medidasNormalizadas = sinMedida
      ? []
      : normalizarMedidasPorModo(modoMedidas, medidas);
    const medidaDefault = medidasNormalizadas.find(
      (medida) => medida.esDefault,
    );
    if (!sinMedida && modoMedidas === "FIJA" && !medidaDefault) {
      toast.error("Agregá al menos una medida predefinida.");
      return;
    }
    const personalizacionesNormalizadas =
      normalizePersonalizaciones(personalizaciones);
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        expectedUpdatedAt: producto.updatedAt,
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidasEfectivo,
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
        medidasPredefinidasJson: medidasNormalizadas,
        personalizacionesJson:
          personalizacionesNormalizadas as unknown as Record<string, unknown>[],
        activo,
      });
      setIdentidadPersistida({
        nombre,
        descripcion,
        subcategoriaComercialCodigo,
        unidadComercial,
        modoMedidas: modoMedidasEfectivo,
        minimoComercialPolitica,
        minimoComercialCantidad:
          minimoComercialPolitica === "NONE" ? "" : minimoComercialCantidad,
        minimoComercialBase:
          minimoComercialPolitica === "NONE"
            ? "cantidad_comercial"
            : minimoComercialBase,
        medidas: medidasNormalizadas,
        sinMedida,
        personalizaciones: personalizacionesNormalizadas,
        activo,
      });
      toast.success("Identidad guardada");
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
            <label>Categoría comercial</label>
            <HumanSelect
              value={subcategoriaComercialCodigo}
              onValueChange={(value) =>
                setSubcategoriaComercialCodigo(value || "producto_a_medida")
              }
              options={subcategoriaOptions}
            />
            <span className="help">
              Agrupa reportes y define specs visibles en propuestas.
            </span>
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
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>Publicado</div>
              <div style={{ fontSize: 11.5, color: "var(--muted-text)" }}>
                Al publicar, el backend valida que esté listo para cotizar.
              </div>
            </div>
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

      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Comercial y medidas</h2>
            <div className="helptext">
              Cómo se cobra y cómo se manejan las medidas al cotizar.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>¿Cómo se cobra?</label>
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
              <label>¿El producto tiene medida?</label>
              <div className="segmented" style={{ width: "100%" }}>
                <button
                  type="button"
                  className={!sinMedida ? "on" : ""}
                  onClick={() => setSinMedida(false)}
                  style={{ flex: 1 }}
                >
                  Con medida
                </button>
                <button
                  type="button"
                  className={sinMedida ? "on" : ""}
                  onClick={() => setSinMedida(true)}
                  style={{ flex: 1 }}
                >
                  Sin medida (por unidad)
                </button>
              </div>
              <div className="helptext">
                Merchandising comprado (taza, remera, lapicera) va «sin medida»:
                se cotiza por unidad y la estampa la maneja la personalización.
              </div>
            </div>
          )}
          {!sinMedida && (
            <div className="field">
              <label>Manejo de medidas</label>
              <div className="segmented" style={{ width: "100%" }}>
                <button
                  type="button"
                  className={modoMedidas === "FIJA" ? "on" : ""}
                  onClick={() => setModoMedidas("FIJA")}
                  style={{ flex: 1 }}
                >
                  Fija
                </button>
                <button
                  type="button"
                  className={modoMedidas === "LIBRE" ? "on" : ""}
                  onClick={() => setModoMedidas("LIBRE")}
                  style={{ flex: 1 }}
                >
                  Libre
                </button>
                <button
                  type="button"
                  className={modoMedidas === "COMERCIAL_ELIGE" ? "on" : ""}
                  onClick={() => setModoMedidas("COMERCIAL_ELIGE")}
                  style={{ flex: 1 }}
                >
                  Comercial elige
                </button>
                <button
                  type="button"
                  className={modoMedidas === "MIXTA" ? "on" : ""}
                  onClick={() => setModoMedidas("MIXTA")}
                  style={{ flex: 1 }}
                >
                  Mixta
                </button>
              </div>
            </div>
          )}
          {!sinMedida && modoMedidasUsaPredefinidas(modoMedidas) && (
            <MedidasPredefinidasEditor
              medidas={medidas}
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
                className={minimoComercialPolitica === "BLOQUEAR" ? "on" : ""}
                onClick={() => setMinimoComercialPolitica("BLOQUEAR")}
                style={{ flex: 1 }}
              >
                Bloquear
              </button>
            </div>
            <span className="help">
              Advertir cobra el mínimo solo en precio; la producción conserva la
              cantidad real.
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
                      minimoComercialBase === "cantidad_comercial" ? "on" : ""
                    }
                    onClick={() => setMinimoComercialBase("cantidad_comercial")}
                    style={{ flex: 1 }}
                  >
                    Cantidad comercial
                  </button>
                  <button
                    type="button"
                    className={
                      minimoComercialBase === "pliegos_impresos" ? "on" : ""
                    }
                    onClick={() => setMinimoComercialBase("pliegos_impresos")}
                    style={{ flex: 1 }}
                  >
                    Pliegos impresos
                  </button>
                </div>
                <span className="help">
                  Pliegos impresos se calcula después del nesting de impresión
                  por hoja.
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

      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Personalizaciones</h2>
            <div className="helptext">
              Áreas de decoración con medida propia (ej. la impresión DTF de una
              taza o remera). La medida de cada personalización maneja el costo
              de su material y proceso, aparte de la medida del producto base.
              Luego, en <em>Pasos</em>, indicás qué paso alimenta cada
              personalización.
            </div>
          </div>
        </div>
        <PersonalizacionesEditor
          personalizaciones={personalizaciones}
          onChange={setPersonalizaciones}
        />
      </div>

      {(dirty || guardando) && (
        <div className="save-sticky-footer">
          <div className="pricing-sticky-footer-copy">
            Hay cambios sin guardar en identidad.
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

const PRODUCCION_VISTAS: Array<{
  id: ProductoProduccionVista;
  numero: string;
  label: string;
  descripcion: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "rutas",
    numero: "01",
    label: "Rutas y flujo",
    descripcion: "Elegí las vías posibles y su recorrido.",
    icon: GitBranchIcon,
  },
  {
    id: "operaciones",
    numero: "02",
    label: "Pasos y recursos",
    descripcion: "Configurá operaciones, máquinas y materiales.",
    icon: FootprintsIcon,
  },
  {
    id: "bom",
    numero: "03",
    label: "BOM y versiones",
    descripcion: "Revisá la composición y publicá el contrato.",
    icon: PackageCheckIcon,
  },
];

function ProduccionTab({
  producto,
  vista,
  rutaAltId,
  rutasDisponibles,
  catalogoFamilias,
  recetas,
  canManage,
}: {
  producto: ProductoDetalle;
  vista: ProductoProduccionVista;
  rutaAltId?: string;
  rutasDisponibles: RutaListItem[];
  catalogoFamilias?: CatalogoFamilias;
  recetas: ProductoReceta[];
  canManage: boolean;
}) {
  const rutaSeleccionada =
    producto.rutasAlternativas.find((ruta) => ruta.id === rutaAltId) ??
    producto.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
    producto.rutasAlternativas[0];
  const hrefVista = (destino: ProductoProduccionVista) => {
    const params = new URLSearchParams({ tab: "produccion", vista: destino });
    if (rutaSeleccionada?.id) params.set("rutaAltId", rutaSeleccionada.id);
    return `/productos-servicios/${producto.id}?${params.toString()}`;
  };

  return (
    <div className={styles.productionWorkspace}>
      <nav
        className={styles.productionNav}
        aria-label="Etapas de configuración productiva"
      >
        {PRODUCCION_VISTAS.map((item, index) => {
          const Icon = item.icon;
          const active = vista === item.id;
          return (
            <React.Fragment key={item.id}>
              <Link
                href={hrefVista(item.id)}
                className={styles.productionNavItem}
                data-active={active || undefined}
                aria-current={active ? "step" : undefined}
              >
                <span className={styles.productionNavNumber}>{item.numero}</span>
                <span className={styles.productionNavIcon}>
                  <Icon />
                </span>
                <span className={styles.productionNavCopy}>
                  <strong>{item.label}</strong>
                  <small>{item.descripcion}</small>
                </span>
              </Link>
              {index < PRODUCCION_VISTAS.length - 1 ? (
                <span className={styles.productionConnector} aria-hidden="true" />
              ) : null}
            </React.Fragment>
          );
        })}
      </nav>

      <div className={styles.productionContent}>
        {vista === "rutas" ? (
          <RutasTab
            producto={producto}
            rutasDisponibles={rutasDisponibles}
          />
        ) : null}
        {vista === "operaciones" ? (
          <PasosTab
            producto={producto}
            rutaAltId={rutaSeleccionada?.id}
            catalogoFamilias={catalogoFamilias}
          />
        ) : null}
        {vista === "bom" ? (
          <RecetaProductoTab
            producto={producto}
            recetas={recetas}
            canManage={canManage}
          />
        ) : null}
      </div>
    </div>
  );
}

function RutasTab({
  producto,
  rutasDisponibles,
}: {
  producto: ProductoDetalle;
  rutasDisponibles: RutaListItem[];
}) {
  const router = useRouter();
  const [agregando, setAgregando] = React.useState(false);
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

  const agregarRuta = async () => {
    if (!nuevaRutaId || !nuevoNombre.trim()) {
      toast.error("Faltan datos");
      return;
    }
    setAgregando(true);
    try {
      const ruta = rutasDisponibles.find((item) => item.id === nuevaRutaId);
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
      toast.error(err instanceof Error ? err.message : "Error agregando ruta");
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
      toast.error(err instanceof Error ? err.message : "Error duplicando ruta");
    } finally {
      setDuplicandoRutaId(null);
    }
  };

  const quitarRuta = (rutaAltId: string, nombre: string) => {
    setRutaAQuitar({ id: rutaAltId, nombre });
  };

  return (
    <>
      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Rutas alternativas</h2>
            <div className="helptext">
              Asociá/quitá rutas reusables a este producto. La ruta preferida es
              la default al cotizar.
            </div>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={agregarRuta}
            disabled={agregando || !nuevaRutaId || !nuevoNombre.trim()}
          >
            <PlusIcon className="size-4" />
            Agregar ruta
          </button>
        </div>

        {producto.rutasAlternativas.map((ra) => (
          <div className="route-tab" key={ra.id}>
            <span className="star">{ra.esPreferida ? "★" : "☆"}</span>
            <div className="body">
              <div className="ttl">
                {rutaEditandoId === ra.id ? (
                  <>
                    <input
                      type="text"
                      value={nombreEditado}
                      onChange={(event) => setNombreEditado(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") guardarNombreRuta(ra.id);
                        if (event.key === "Escape") {
                          setRutaEditandoId(null);
                          setNombreEditado("");
                        }
                      }}
                      autoFocus
                      className="route-name-input"
                      aria-label={`Nombre de la ruta ${ra.nombre}`}
                    />
                    <button
                      className="icon-btn"
                      type="button"
                      title="Guardar nombre"
                      disabled={guardandoNombreId === ra.id}
                      onClick={() => guardarNombreRuta(ra.id)}
                    >
                      <CheckIcon className="size-4" />
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      title="Cancelar"
                      onClick={() => {
                        setRutaEditandoId(null);
                        setNombreEditado("");
                      }}
                    >
                      <XIcon className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    {ra.nombre}
                    <button
                      className="icon-btn"
                      type="button"
                      title="Editar nombre"
                      onClick={() => iniciarEdicionNombre(ra.id, ra.nombre)}
                    >
                      <Edit3Icon className="size-4" />
                    </button>
                  </>
                )}
                {ra.esPreferida ? (
                  <span className="tag ok">
                    <span className="d" />
                    Preferida
                  </span>
                ) : null}
              </div>
              <div className="sub" style={{ marginTop: 8 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>
                  Ruta:
                </strong>{" "}
                {ra.ruta.nombre} · v{ra.rutaVersion}
                <span style={{ margin: "0 6px" }}>·</span>
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>
                  Pasos:
                </strong>{" "}
                {ra.ruta.pasos.length} ·{" "}
                <span style={{ color: "var(--ok)" }}>
                  Configurados {ra.configPasos.length}/{ra.ruta.pasos.length}
                </span>
              </div>
            </div>
            <div className="route-tab-actions">
              <Link
                className="btn btn-primary"
                href={`/productos-servicios/${producto.id}/rutas/${ra.id}`}
              >
                <CogIcon className="size-4" />
                Configurar pasos
              </Link>
              <button
                className="icon-btn"
                type="button"
                title="Duplicar ruta"
                disabled={duplicandoRutaId === ra.id}
                onClick={() => duplicarRuta(ra.id, ra.nombre)}
              >
                <CopyIcon className="size-4" />
              </button>
              {!ra.esPreferida ? (
                <button
                  className="icon-btn"
                  type="button"
                  title="Marcar preferida"
                  onClick={() => marcarPreferida(ra.id)}
                >
                  <StarIcon className="size-4" />
                </button>
              ) : null}
              <button
                className="icon-btn"
                type="button"
                title="Quitar ruta"
                onClick={() => quitarRuta(ra.id, ra.nombre)}
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          </div>
        ))}

        {producto.rutasAlternativas.length === 0 ? (
          <div className="section-empty">
            <div className="ttl">Sin rutas asociadas</div>
            <div className="sub">
              Agregá una ruta reusable para poder configurar pasos y cotizar
              este producto.
            </div>
          </div>
        ) : null}

        {rutasParaAgregar.length > 0 ? (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-2)",
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 12 }}>
              Agregar nueva ruta alternativa
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className="field">
                <label>Ruta del catálogo</label>
                <HumanSelect
                  value={nuevaRutaId}
                  onValueChange={(value) => setNuevaRutaId(value || "")}
                  options={rutasParaAgregar.map((ruta) => ({
                    value: ruta.id,
                    label: ruta.nombre,
                    code: ruta.codigo,
                    description: `v${ruta.versionActual} · ${ruta.pasos.length} pasos`,
                  }))}
                  placeholder="Elegí una ruta..."
                />
              </div>
              <div className="field">
                <label>Nombre humano</label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  placeholder="Standard / Vía láser / Vía offset"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmacionDestructiva
        open={rutaAQuitar !== null}
        onOpenChange={(open) => {
          if (!open) setRutaAQuitar(null);
        }}
        titulo="Quitar ruta"
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

function PasosTab({
  producto,
  rutaAltId,
  catalogoFamilias,
}: {
  producto: ProductoDetalle;
  rutaAltId?: string;
  catalogoFamilias?: CatalogoFamilias;
}) {
  const router = useRouter();
  const rutaSeleccionada =
    producto.rutasAlternativas.find((r) => r.id === rutaAltId) ??
    producto.rutasAlternativas.find((r) => r.esPreferida) ??
    producto.rutasAlternativas[0];

  if (producto.rutasAlternativas.length === 0) {
    return (
      <Card className="wiz-section">
        <CardHeader>
          <CardTitle>Sin rutas para configurar</CardTitle>
          <CardDescription>
            Primero asociá una ruta alternativa en la pestaña Rutas.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const cambiarRuta = (value: string) => {
    const params = new URLSearchParams();
    params.set("tab", "produccion");
    params.set("vista", "operaciones");
    params.set("rutaAltId", value);
    router.push(`/productos-servicios/${producto.id}?${params.toString()}`);
  };

  return (
    <>
      <div className="ruta-selector">
        <div style={{ flex: 1 }}>
          <div className="lbl">Ruta a configurar</div>
          <div className="help">
            Cada alternativa mantiene su propia configuración de pasos.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HumanSelect
            value={rutaSeleccionada?.id ?? ""}
            onValueChange={(v) => v && cambiarRuta(v)}
            options={producto.rutasAlternativas.map((r) => ({
              value: r.id,
              label: r.nombre,
              code: r.ruta.codigo,
              description: `${r.ruta.pasos.length} pasos · ${r.configPasos.length} configurados`,
            }))}
            triggerClassName="w-[280px]"
          />
        </div>
      </div>

      {rutaSeleccionada ? (
        <div className="wiz-section">
          <div className="wiz-section-head">
            <div className="body">
              <h2>{rutaSeleccionada.nombre}</h2>
              <div className="helptext">
                Para cada paso configurás la máquina, perfil, modos y slots de
                materiales. Los pasos OPCIONALES no se ejecutan a menos que el
                comercial los active.
              </div>
            </div>
            <Link
              href={`/productos-servicios/${producto.id}/rutas/${rutaSeleccionada.id}`}
              className="btn btn-primary"
            >
              <CogIcon className="size-4" />
              Abrir editor enfocado
            </Link>
          </div>

          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-2)",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                color: "var(--muted-text)",
                marginBottom: 12,
              }}
            >
              {rutaSeleccionada.ruta.pasos.length} pasos · click en cualquiera
              para editarlo
            </div>
            <div className="graph">
              {rutaSeleccionada.ruta.pasos.map((paso, index) => {
                const config = rutaSeleccionada.configPasos.find(
                  (item) => item.rutaPasoId === paso.id,
                );
                const familia = catalogoFamilias?.familias.find(
                  (item) => item.codigo === paso.familiaCodigo,
                );
                const machine =
                  config?.maquinaM1?.nombre ??
                  config?.centroCosto?.nombre ??
                  "Sin centro asignado";
                const optional = config?.modoActivacion === "OPCIONAL";
                return (
                  <Link
                    key={paso.id}
                    href={`/productos-servicios/${producto.id}/rutas/${rutaSeleccionada.id}`}
                    className={`gnode done ${optional ? "optional" : ""}`}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="dot">{index + 1}</div>
                    <div className="ttl">
                      {config?.nombreVisible?.trim() ||
                        familia?.nombre ||
                        paso.familiaCodigo}
                    </div>
                    <div className="sub">{machine}</div>
                  </Link>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted-text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--ok)",
                  }}
                />
                {rutaSeleccionada.configPasos.length}/
                {rutaSeleccionada.ruta.pasos.length} pasos configurados
              </div>
            </div>
          </div>
        </div>
      ) : (
        <SectionMissing title="No se pudieron cargar los datos para configurar pasos." />
      )}
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

function PricingTab({ producto }: { producto: ProductoDetalle }) {
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
  const [guardando, setGuardando] = React.useState(false);
  const precioDirty = React.useMemo(
    () => precioConfigKey(precioConfig) !== precioConfigKey(precioPersistido),
    [precioConfig, precioPersistido],
  );

  const guardar = async () => {
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
      });
      setPrecioPersistido(precioConfig);
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
