"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  CogIcon,
  GitBranchIcon,
  PlusIcon,
  ReceiptIcon,
  SaveIcon,
  StarIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HumanSelect } from "@/components/ui/human-select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PasosExtrasPanel } from "@/components/productos-servicios/pasos-extras-panel";
import { TabPrecioCompleto } from "@/components/productos-servicios/tab-precio-completo";
import { type TabPrecioConfig } from "@/components/productos-servicios/tab-precio-editor";
import {
  actualizarProducto,
  actualizarProductoRutaAlt,
  asociarCargoCotizacion,
  crearProductoRutaAlt,
  desasociarCargoCotizacion,
  eliminarProductoRutaAlt,
  getCatalogoComercial,
  type LookupsConfigPaso,
} from "@/lib/productos-servicios-api";
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  ProductoCategoriaComercial,
  ProductoDetalle,
  RutaListItem,
} from "@/lib/productos-servicios";
import {
  getLabel,
  modoActivacionLabels,
  modoCalculoCargoLabels,
} from "@/lib/labels-humanos";

export type ProductoWorkspaceTab = "identidad" | "rutas" | "pasos" | "cargos" | "pricing";

interface Props {
  producto: ProductoDetalle;
  activeTab: ProductoWorkspaceTab;
  rutaAltId?: string;
  rutasDisponibles?: RutaListItem[];
  catalogoFamilias?: CatalogoFamilias;
  lookups?: LookupsConfigPaso;
  catalogoCargos?: CargoDirectoCatalogo[];
}

interface ValidacionTab {
  estado: "ok" | "warning" | "error";
  label: string;
}

const TABS: Array<{
  id: ProductoWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "identidad", label: "Identidad", icon: TagIcon },
  { id: "rutas", label: "Rutas", icon: GitBranchIcon },
  { id: "pasos", label: "Configurar pasos", icon: CogIcon },
  { id: "cargos", label: "Cargos", icon: ReceiptIcon },
  { id: "pricing", label: "Pricing", icon: SaveIcon },
];

function tabValidaciones(producto: ProductoDetalle): Record<ProductoWorkspaceTab, ValidacionTab> {
  const rutas = producto.rutasAlternativas;
  const sinRutas = rutas.length === 0;
  const sinPreferida = rutas.length > 0 && !rutas.some((r) => r.esPreferida);
  const pasosIncompletos = rutas.some((r) => r.configPasos.length < r.ruta.pasos.length);
  const precioConfig = producto.precioConfigJson as TabPrecioConfig | null;

  return {
    identidad: producto.codigo && producto.nombre
      ? { estado: "ok", label: "Completo" }
      : { estado: "error", label: "Faltan datos" },
    rutas: sinRutas
      ? { estado: "error", label: "Sin rutas" }
      : sinPreferida
        ? { estado: "warning", label: "Sin preferida" }
        : { estado: "ok", label: "Completo" },
    pasos: sinRutas
      ? { estado: "error", label: "Sin rutas" }
      : pasosIncompletos
        ? { estado: "warning", label: "Incompleto" }
        : { estado: "ok", label: "Completo" },
    cargos: { estado: "ok", label: "Opcional" },
    pricing: precioConfig?.metodoCalculo
      ? { estado: "ok", label: "Completo" }
      : { estado: "error", label: "Falta método" },
  };
}

function EstadoBadge({ estado, label }: ValidacionTab) {
  if (estado === "ok") {
    return (
      <span className="status">
        <CheckIcon className="size-3" />
        {label}
      </span>
    );
  }
  if (estado === "warning") {
    return (
      <span className="status">
        {label}
      </span>
    );
  }
  return (
    <span className="status">
      {label}
    </span>
  );
}

export function ProductoWorkspace({
  producto,
  activeTab,
  rutaAltId,
  rutasDisponibles = [],
  catalogoFamilias,
  catalogoCargos = [],
}: Props) {
  const router = useRouter();
  const validaciones = React.useMemo(() => tabValidaciones(producto), [producto]);

  const irATab = (tab: ProductoWorkspaceTab) => {
    router.push(tabHref(tab));
  };

  const tabHref = (tab: ProductoWorkspaceTab) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "pasos") {
      const selectedRuta =
        rutaAltId ??
        producto.rutasAlternativas.find((r) => r.esPreferida)?.id ??
        producto.rutasAlternativas[0]?.id;
      if (selectedRuta) params.set("rutaAltId", selectedRuta);
    }
    return `/productos-servicios/${producto.id}?${params.toString()}`;
  };

  return (
    <div className="content">
      <div className="wizard-page">
        <Link href="/productos-servicios" className="back-link">
          <ArrowLeftIcon className="size-4" />
          Volver al catálogo
        </Link>
        <div className="detail-head">
          <div className="title-block">
            <h1 style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              {producto.nombre}
              <span className={producto.activo ? "tag ok" : "tag muted"}>
                <span className="d" />
                {producto.activo ? "Activo" : "Inactivo"}
              </span>
            </h1>
            <div className="meta">
              <span className="code">{producto.codigo}</span>
            </div>
            {producto.descripcion ? (
              <div style={{ fontSize: 13, color: "var(--muted-text)", marginTop: 6 }}>
                {producto.descripcion}
              </div>
            ) : null}
          </div>
        </div>

        <div className="wiz-status">
          <span className="ok-dot"><CheckIcon className="size-3" /></span>
          <div><strong>Producto válido. </strong>Listo para cotizar.</div>
          <span className="refresh" title="Revalidar">↻</span>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => irATab(value as ProductoWorkspaceTab)}>
          <div className="wiz-tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`wiz-tab ${activeTab === tab.id ? "active" : ""} ${tab.id === "cargos" ? "optional" : ""}`}
                  href={tabHref(tab.id)}
                >
                  <span className="ico"><Icon className="size-4" /></span>
                  <span className="lbl">{tab.label}</span>
                  <EstadoBadge {...validaciones[tab.id]} />
                </Link>
              );
            })}
          </div>

        <TabsContent value={activeTab}>
          {activeTab === "identidad" && <IdentidadTab producto={producto} />}
          {activeTab === "rutas" && (
            <RutasTab
              producto={producto}
              rutasDisponibles={rutasDisponibles}
              catalogoFamilias={catalogoFamilias}
            />
          )}
          {activeTab === "pasos" && (
            <PasosTab
              producto={producto}
              rutaAltId={rutaAltId}
              catalogoFamilias={catalogoFamilias}
            />
          )}
          {activeTab === "cargos" && (
            <CargosTab
              producto={producto}
              catalogoCargos={catalogoCargos}
            />
          )}
          {activeTab === "pricing" && <PricingTab producto={producto} />}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function IdentidadTab({ producto }: { producto: ProductoDetalle }) {
  const router = useRouter();
  const [nombre, setNombre] = React.useState(producto.nombre);
  const [descripcion, setDescripcion] = React.useState(producto.descripcion ?? "");
  const [catalogoComercial, setCatalogoComercial] = React.useState<ProductoCategoriaComercial[]>([]);
  const [subcategoriaComercialCodigo, setSubcategoriaComercialCodigo] = React.useState(
    producto.subcategoriaComercial?.codigo ?? "producto_a_medida",
  );
  const [unidadComercial, setUnidadComercial] = React.useState(producto.unidadComercial);
  const [modoMedidas, setModoMedidas] = React.useState(producto.modoMedidas);
  const [anchoDefault, setAnchoDefault] = React.useState(String(producto.medidaDefaultAnchoMm ?? ""));
  const [altoDefault, setAltoDefault] = React.useState(String(producto.medidaDefaultAltoMm ?? ""));
  const [activo, setActivo] = React.useState(producto.activo);
  const [guardando, setGuardando] = React.useState(false);

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

  const subcategoriaOptions = catalogoComercial.flatMap((categoria) =>
    categoria.subcategorias.map((subcategoria) => ({
      value: subcategoria.codigo,
      label: `${categoria.nombre} · ${subcategoria.nombre}`,
    })),
  );

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.error("Falta nombre");
      return;
    }
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (producto.atributosComercialesJson as Record<string, unknown> | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas: modoMedidas as "FIJA" | "LIBRE" | "COMERCIAL_ELIGE",
        medidaDefaultAnchoMm: anchoDefault ? Number(anchoDefault) : null,
        medidaDefaultAltoMm: altoDefault ? Number(altoDefault) : null,
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
            <div className="helptext">Cómo se llama y se reconoce el producto en el catálogo.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>Código</label>
            <input type="text" className="locked" value={producto.codigo} readOnly />
            <span className="help">El código no se puede modificar.</span>
          </div>
          <div className="field">
            <label>Nombre <span className="req">*</span></label>
            <input type="text" value={nombre} onChange={(event) => setNombre(event.target.value)} />
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
            <span className="help">Agrupa reportes y define specs visibles en propuestas.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid var(--hairline)" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>Activo</div>
              <div style={{ fontSize: 11.5, color: "var(--muted-text)" }}>
                Si está inactivo no aparece en el cotizador.
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
            <div className="helptext">Cómo se cobra y cómo se manejan las medidas al cotizar.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>¿Cómo se cobra?</label>
            <div className="segmented" style={{ width: "100%" }}>
              <button type="button" className={unidadComercial === "unidad" ? "on" : ""} onClick={() => setUnidadComercial("unidad")} style={{ flex: 1 }}>Por unidad</button>
              <button type="button" className={unidadComercial === "m2" ? "on" : ""} onClick={() => setUnidadComercial("m2")} style={{ flex: 1 }}>Por m²</button>
              <button type="button" className={unidadComercial === "metro_lineal" ? "on" : ""} onClick={() => setUnidadComercial("metro_lineal")} style={{ flex: 1 }}>Por metro lineal</button>
            </div>
          </div>
          <div className="field">
            <label>Manejo de medidas</label>
            <div className="segmented" style={{ width: "100%" }}>
              <button type="button" className={modoMedidas === "FIJA" ? "on" : ""} onClick={() => setModoMedidas("FIJA")} style={{ flex: 1 }}>Medida fija del producto</button>
              <button type="button" className={modoMedidas !== "FIJA" ? "on" : ""} onClick={() => setModoMedidas("LIBRE")} style={{ flex: 1 }}>El comercial ingresa</button>
            </div>
          </div>
          {modoMedidas !== "LIBRE" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Ancho default <span className="hint">mm</span></label>
                <input
                  type="number"
                  value={anchoDefault}
                  onChange={(event) => setAnchoDefault(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Alto default <span className="hint">mm</span></label>
                <input
                  type="number"
                  value={altoDefault}
                  onChange={(event) => setAltoDefault(event.target.value)}
                />
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
              <SaveIcon className="mr-2 size-4" />
              {guardando ? "Guardando..." : "Guardar identidad"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RutasTab({
  producto,
  rutasDisponibles,
  catalogoFamilias,
}: {
  producto: ProductoDetalle;
  rutasDisponibles: RutaListItem[];
  catalogoFamilias?: CatalogoFamilias;
}) {
  const router = useRouter();
  const [agregando, setAgregando] = React.useState(false);
  const [nuevaRutaId, setNuevaRutaId] = React.useState("");
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const yaUsadas = new Set(producto.rutasAlternativas.map((ra) => ra.ruta.id));
  const rutasParaAgregar = rutasDisponibles.filter((ruta) => !yaUsadas.has(ruta.id));

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

  const quitarRuta = async (rutaAltId: string, nombre: string) => {
    if (!confirm(`¿Quitar la ruta "${nombre}" de este producto?`)) return;
    try {
      await eliminarProductoRutaAlt(rutaAltId);
      toast.success("Ruta quitada del producto");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <>
      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Rutas alternativas</h2>
            <div className="helptext">
              Asociá/quitá rutas reusables a este producto. La ruta preferida es la default al cotizar.
            </div>
          </div>
          <button className="btn btn-primary" type="button" onClick={agregarRuta} disabled={agregando || !nuevaRutaId || !nuevoNombre.trim()}>
            <PlusIcon className="size-4" />
            Agregar ruta
          </button>
        </div>

        {producto.rutasAlternativas.map((ra) => (
          <div className="route-tab" key={ra.id}>
            <span className="star">{ra.esPreferida ? "★" : "☆"}</span>
            <div className="body">
              <div className="ttl">
                {ra.nombre}
                {ra.esPreferida ? <span className="tag ok"><span className="d" />Preferida</span> : null}
              </div>
              <div className="sub" style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 2 }}>
                {ra.ruta.codigo}
              </div>
              <div className="sub" style={{ marginTop: 8 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Ruta:</strong> {ra.ruta.nombre} · v{ra.rutaVersion}
                <span style={{ margin: "0 6px" }}>·</span>
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Pasos:</strong> {ra.ruta.pasos.length} ·{" "}
                <span style={{ color: "var(--ok)" }}>Configurados {ra.configPasos.length}/{ra.ruta.pasos.length}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignSelf: "flex-end" }}>
              <Link className="btn btn-primary" href={`/productos-servicios/${producto.id}/rutas/${ra.id}`}>
                <CogIcon className="size-4" />
                Configurar pasos
              </Link>
              {!ra.esPreferida ? (
                <button className="icon-btn" type="button" title="Marcar preferida" onClick={() => marcarPreferida(ra.id)}>
                  <StarIcon className="size-4" />
                </button>
              ) : null}
              <button className="icon-btn" type="button" title="Quitar ruta" onClick={() => quitarRuta(ra.id, ra.nombre)}>
                <Trash2Icon className="size-4" />
              </button>
            </div>
          </div>
        ))}

        {producto.rutasAlternativas.length === 0 ? (
          <div className="section-empty">
            <div className="ttl">Sin rutas asociadas</div>
            <div className="sub">Agregá una ruta reusable para poder configurar pasos y cotizar este producto.</div>
          </div>
        ) : null}

        {rutasParaAgregar.length > 0 ? (
          <div style={{ marginTop: 16, padding: 16, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)" }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 12 }}>Agregar nueva ruta alternativa</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

      <div className="wiz-section">
        <div className="wiz-section-head">
          <div className="body">
            <h2>Pasos extras inline <span style={{ color: "var(--muted-text)", fontWeight: 400, fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "nowrap" }}>(G-F3)</span></h2>
            <div className="helptext">
              Pasos puntuales que solo este producto necesita y no forman parte de la ruta reusable. Útil para casos únicos.
            </div>
          </div>
        </div>
        {catalogoFamilias ? (
          <PasosExtrasPanel
            productoId={producto.id}
            pasosExtras={producto.pasosExtras}
            catalogoFamilias={catalogoFamilias}
          />
        ) : (
          <SectionMissing title="No se pudo cargar el catálogo de familias para pasos extras." />
        )}
      </div>
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
    params.set("tab", "pasos");
    params.set("rutaAltId", value);
    router.push(`/productos-servicios/${producto.id}?${params.toString()}`);
  };

  return (
    <>
      <div className="ruta-selector">
        <div style={{ flex: 1 }}>
          <div className="lbl">Ruta a configurar</div>
          <div className="help">Cada alternativa mantiene su propia configuración de pasos.</div>
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
              <h2>Configurar pasos: {producto.nombre} → {rutaSeleccionada.nombre}</h2>
              <div className="helptext">
                Para cada paso configurás la máquina, perfil, modos y slots de materiales. Los pasos OPCIONALES no se ejecutan a menos que el comercial los active.
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

          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "16px 18px" }}>
            <div style={{ fontSize: 12.5, color: "var(--muted-text)", marginBottom: 12 }}>
              {rutaSeleccionada.ruta.pasos.length} pasos · click en cualquiera para editarlo
            </div>
            <div className="graph">
              {rutaSeleccionada.ruta.pasos.map((paso, index) => {
                const config = rutaSeleccionada.configPasos.find((item) => item.rutaPasoId === paso.id);
                const familia = catalogoFamilias?.familias.find((item) => item.codigo === paso.familiaCodigo);
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
                    <div className="ttl">{familia?.nombre ?? paso.familiaCodigo}</div>
                    <div className="sub">{machine}</div>
                  </Link>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--muted-text)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
                {rutaSeleccionada.configPasos.length}/{rutaSeleccionada.ruta.pasos.length} pasos configurados
              </div>
              <Link className="btn" href={`/productos-servicios/${producto.id}/rutas/${rutaSeleccionada.id}`}>
                Editar pasos enfocado <span aria-hidden="true">→</span>
              </Link>
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
  const [modoActivacion, setModoActivacion] = React.useState<(typeof MODOS_CARGO)[number]>("OPCIONAL");
  const [guardando, setGuardando] = React.useState(false);

  const yaAsociados = new Set(
    producto.cargosDirectosCotizacion.map((cargo) => cargo.cargoDirectoCatalogo.codigo),
  );
  const disponibles = catalogoCargos.filter((cargo) => cargo.activo && !yaAsociados.has(cargo.codigo));

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

  const quitar = async (id: string, nombre: string) => {
    if (!confirm(`¿Quitar el cargo "${nombre}" de este producto?`)) return;
    try {
      await desasociarCargoCotizacion(id);
      toast.success("Cargo desasociado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="wiz-section">
      <div className="wiz-section-head">
        <div className="body">
          <h2>Cargos directos del producto</h2>
          <div className="helptext">
            Cargos a nivel cotización (ej: viático, recargo urgencia). Se ofrecen al comercial al cotizar este producto.
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
            Este producto no tiene cargos directos a nivel cotización. Asociá uno del catálogo si necesitás ofrecer extras al comercial.
          </div>
        </div>
      ) : (
        <div className="cargo-grid">
          {producto.cargosDirectosCotizacion.map((cargo) => {
            const calc = getLabel(modoCalculoCargoLabels, cargo.cargoDirectoCatalogo.modoCalculo);
            const activacion = getLabel(modoActivacionLabels, cargo.modoActivacion);
            return (
              <div className="cargo-card" key={cargo.id}>
                <div className="cargo-card-main">
                  <div className="ttl">{cargo.cargoDirectoCatalogo.nombre}</div>
                  <div className="sub">{cargo.cargoDirectoCatalogo.codigo}</div>
                  {cargo.cargoDirectoCatalogo.descripcion ? (
                    <div className="desc">{cargo.cargoDirectoCatalogo.descripcion}</div>
                  ) : null}
                  <div className="chips">
                    <span className="tag muted">{calc.label}</span>
                    <span className={cargo.modoActivacion === "OBLIGATORIO" ? "tag ok" : "tag muted"}>
                      <span className="d" />
                      {activacion.label}
                    </span>
                  </div>
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  title="Quitar cargo"
                  onClick={() => quitar(cargo.id, cargo.cargoDirectoCatalogo.nombre)}
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
              Todos los cargos activos ya están asociados o todavía no hay cargos creados en el catálogo.
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
                  const calc = getLabel(modoCalculoCargoLabels, cargo.modoCalculo);
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
              <span className="help">{getLabel(modoActivacionLabels, modoActivacion).descripcion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PricingTab({ producto }: { producto: ProductoDetalle }) {
  const router = useRouter();
  const [precioConfig, setPrecioConfig] = React.useState<TabPrecioConfig>(
    () =>
      (producto.precioConfigJson as TabPrecioConfig | null) ?? {
        metodoCalculo: "por_margen",
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
  );
  const [guardando, setGuardando] = React.useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await actualizarProducto(producto.id, {
        precioConfigJson: precioConfig as unknown as Record<string, unknown>,
      });
      toast.success("Pricing guardado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <TabPrecioCompleto
        productoId={producto.id}
        precioConfig={precioConfig}
        onChangePrecioConfig={setPrecioConfig}
        unidadComercial={producto.unidadComercial}
      />
      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando}>
          <SaveIcon className="mr-2 size-4" />
          {guardando ? "Guardando..." : "Guardar pricing"}
        </Button>
      </div>
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
