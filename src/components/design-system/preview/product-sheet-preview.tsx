"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Drawer, Input, Tabs } from "@heroui/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  LayoutPanelLeft,
  List,
  LoaderCircle,
  Moon,
  Package,
  Plus,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { ActionButton as Button } from "../action-button";
import { DesignSystemProvider, useDesignScope } from "../appearance";
import { NavigationTabList } from "../navigation-tab-list";
import { SegmentedControl } from "../choice-controls";
import theme from "../theme.module.css";
import focus from "../field-focus.module.css";
import styles from "./product-sheet-preview.module.css";
import {
  ConfigurationFields,
  FileFields,
  ProductionFields,
  SheetSelect,
  type DraftChange,
} from "./product-sheet-fields";
import {
  initialSheetDraft,
  sampleMoney,
  sampleQuote,
  sheetProducts,
  type QuoteState,
  type SampleProduct,
  type SheetDraft,
  type SheetLook,
  type SheetSection,
} from "./product-sheet-fixtures";

const looks = [
  {
    id: "H1" as const,
    name: "Continuo",
    description:
      "Un recorrido vertical con bloques bien separados y el total siempre a mano.",
    detail: "Panel de 720 px · Todos los bloques visibles",
    icon: List,
  },
  {
    id: "H2" as const,
    name: "Por secciones",
    description:
      "Un espacio más amplio, con pestañas para trabajar y un resumen lateral persistente.",
    detail: "Panel de 1.040 px · Pestañas y resumen lateral",
    icon: LayoutPanelLeft,
  },
];
const quoteLabels: Record<QuoteState, string> = {
  listo: "Precio disponible",
  calculando: "Calculando",
  pendiente: "Datos pendientes",
  error: "Error de cálculo",
};

export function ProductSheetPreview() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState<SheetLook>("H1");
  const [productId, setProductId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SheetDraft>>({});
  const [section, setSection] = useState<SheetSection>("configuracion");
  const [added, setAdded] = useState<string[]>([]);
  const [notice, setNotice] = useState(
    "Las muestras no consultan el catálogo real ni guardan órdenes.",
  );
  const product = sheetProducts.find((item) => item.id === productId) ?? null;
  const draft = product
    ? (drafts[product.id] ?? initialSheetDraft(product))
    : null;
  const launch = (nextLook: SheetLook, id: string | null = null) => {
    setLook(nextLook);
    setProductId(id);
    setSection("configuracion");
    setOpen(true);
  };
  const updateDraft: DraftChange = (update) => {
    if (!product) return;
    setDrafts((current) => ({
      ...current,
      [product.id]: update(current[product.id] ?? initialSheetDraft(product)),
    }));
  };
  return (
    <DesignSystemProvider appearance={dark ? "dark" : "light"}>
      <div
        data-ui="heroui"
        data-appearance={dark ? "dark" : "light"}
        className={`${theme.theme} min-h-screen bg-background text-foreground`}
      >
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <Link
              href="/dev/diseno/componentes"
              className="text-xl font-bold tracking-tight"
            >
              grafoprint.
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dev/diseno/componentes"
                className="text-xs text-muted-foreground"
              >
                Componentes aprobados
              </Link>
              <Link
                href="/dev/diseno/orden"
                className="text-xs text-muted-foreground"
              >
                Ver orden
              </Link>
              <Button
                variant="outline"
                isIconOnly
                aria-label={dark ? "Ver tema claro" : "Ver tema oscuro"}
                onPress={() => setDark((value) => !value)}
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-10 md:py-14">
          <p className="text-xs font-semibold tracking-widest text-accent-soft-foreground">
            GRAFOPRINT / SHEETS DE PRODUCTO
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Dos maneras de configurar un trabajo.
              </h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Compará el buscador y los formularios completos. Ambas
                propuestas usan los botones, pestañas y colores que ya elegimos.
              </p>
            </div>
            <span className={styles.softBadge}>
              H1 y H2 · Pendientes de elección
            </span>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {looks.map((option) => (
              <article
                key={option.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div
                  className={`${styles.miniature} ${option.id === "H2" ? styles.miniWide : ""}`}
                  aria-hidden="true"
                >
                  <div className={styles.miniPage}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.miniSheet}>
                    <div className={styles.miniHeader}>
                      <span />
                      <i />
                    </div>
                    <div className={styles.miniNav}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className={styles.miniBody}>
                      <div>
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      {option.id === "H2" && (
                        <aside>
                          <span />
                          <span />
                          <span />
                        </aside>
                      )}
                    </div>
                    <div className={styles.miniFooter}>
                      <span />
                      <b />
                    </div>
                  </div>
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <span className={styles.code}>{option.id}</span>
                    <h2 className="text-xl font-semibold">{option.name}</h2>
                  </div>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {option.detail}
                  </p>
                  <Button className="mt-5" onPress={() => launch(option.id)}>
                    <option.icon /> Abrir {option.id}
                    <ArrowRight />
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <section
            className="mt-12"
            aria-label="Tipos de producto para comparar"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Probá cada tipo de producto
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Entrá directamente a su configuración. Podés alternar H1 / H2
                  sin perder lo que cambiaste.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                11 casos · Mismos controles en ambas propuestas
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sheetProducts.map((item) => (
                <article
                  className="flex flex-col rounded-xl border border-border bg-surface p-5"
                  key={item.id}
                >
                  <p className="text-xs text-accent-soft-foreground">
                    {item.family}
                  </p>
                  <h3 className="mt-2 text-base font-semibold">{item.name}</h3>
                  <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {item.features.map((feature) => (
                      <span className={styles.neutralBadge} key={feature}>
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      aria-label={`Ver ${item.name} en H1`}
                      onPress={() => launch("H1", item.id)}
                    >
                      Ver H1
                    </Button>
                    <Button
                      variant="outline"
                      aria-label={`Ver ${item.name} en H2`}
                      onPress={() => launch("H2", item.id)}
                    >
                      Ver H2
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="text-sm font-semibold">
                Orden de muestra · {added.length}{" "}
                {added.length === 1 ? "producto" : "productos"}
              </p>
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {notice}
              </p>
            </div>
            {added.length > 0 && (
              <Button
                variant="outline"
                onPress={() => {
                  setAdded([]);
                  setNotice("La orden de muestra quedó vacía.");
                }}
              >
                Vaciar muestra
              </Button>
            )}
          </div>
        </main>
        <SheetSample
          open={open}
          onOpenChange={setOpen}
          look={look}
          onLookChange={setLook}
          product={product}
          draft={draft}
          onDraftChange={updateDraft}
          section={section}
          onSectionChange={setSection}
          onPick={(id) => {
            setProductId(id);
            setSection("configuracion");
          }}
          onBack={() => setProductId(null)}
          onAdd={() => {
            if (!product) return;
            setAdded((current) => [...current, product.name]);
            setNotice(
              `${product.name} agregado a esta muestra. No se guardó en una orden real.`,
            );
            setOpen(false);
          }}
        />
      </div>
    </DesignSystemProvider>
  );
}

function SheetSample({
  open,
  onOpenChange,
  look,
  onLookChange,
  product,
  draft,
  onDraftChange,
  section,
  onSectionChange,
  onPick,
  onBack,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  look: SheetLook;
  onLookChange: (value: SheetLook) => void;
  product: SampleProduct | null;
  draft: SheetDraft | null;
  onDraftChange: DraftChange;
  section: SheetSection;
  onSectionChange: (value: SheetSection) => void;
  onPick: (id: string) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const scope = useDesignScope();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const quote = product && draft ? sampleQuote(product, draft) : null;
  const props =
    product && draft ? { product, draft, onChange: onDraftChange } : null;
  const pick = (id: string) => {
    onPick(id);
    titleRef.current?.focus();
  };
  const blocked =
    !draft ||
    draft.quote !== "listo" ||
    (product?.special === "documentos" && draft.documents.length === 0);
  return (
    <Drawer>
      <Drawer.Backdrop
        {...scope}
        className={theme.theme}
        variant="opaque"
        isOpen={open}
        onOpenChange={onOpenChange}
      >
        <Drawer.Content placement="right">
          <Drawer.Dialog
            className={styles.dialog}
            data-look={look}
            aria-label={
              product
                ? `Configurar ${product.name} · ${look}`
                : `Agregar producto · ${look}`
            }
          >
            <div className={styles.compareBar}>
              <span>
                Muestra {look} · {look === "H1" ? "Continuo" : "Por secciones"}
              </span>
              <SegmentedControl
                aria-label="Diseño del sheet"
                value={look}
                onChange={(value) => onLookChange(value as SheetLook)}
                options={[
                  { value: "H1", label: "H1", icon: <List aria-hidden /> },
                  {
                    value: "H2",
                    label: "H2",
                    icon: <LayoutPanelLeft aria-hidden />,
                  },
                ]}
              />
            </div>
            <Drawer.Header className={styles.header}>
              <div className="flex min-w-0 items-start gap-3">
                {product && (
                  <Button
                    variant="outline"
                    isIconOnly
                    aria-label="Cambiar producto"
                    onPress={onBack}
                  >
                    <ArrowLeft />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs text-accent-soft-foreground">
                    {product?.family ?? "Catálogo de muestra"}
                  </p>
                  <Drawer.Heading
                    ref={titleRef}
                    tabIndex={-1}
                    className={styles.heading}
                  >
                    {product?.name ?? "Agregar producto"}
                  </Drawer.Heading>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {product?.description ??
                      "Buscá un producto para configurar sus cantidades, opciones y archivos."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  isIconOnly
                  aria-label="Cerrar muestra"
                  onPress={() => onOpenChange(false)}
                >
                  <X />
                </Button>
              </div>
            </Drawer.Header>
            {product && draft && props ? (
              <>
                <div className={styles.stateBar}>
                  <span>Estado de muestra</span>
                  <SheetSelect
                    label="Estado del cálculo"
                    value={quoteLabels[draft.quote]}
                    options={Object.values(quoteLabels)}
                    onChange={(value) =>
                      onDraftChange((current) => ({
                        ...current,
                        quote: (Object.keys(quoteLabels) as QuoteState[]).find(
                          (key) => quoteLabels[key] === value,
                        )!,
                      }))
                    }
                  />
                </div>
                {look === "H1" ? (
                  <Drawer.Body className={styles.body}>
                    <QuoteNotice
                      state={draft.quote}
                      onRetry={() =>
                        onDraftChange((current) => ({
                          ...current,
                          quote: "listo",
                        }))
                      }
                    />
                    <ConfigurationFields key={product.id} {...props} />
                    <div className="mt-4">
                      <ProductionFields {...props} />
                    </div>
                    <div className="mt-4">
                      <FileFields {...props} />
                    </div>
                    <div className="mt-4">
                      <QuoteSummary product={product} draft={draft} />
                    </div>
                  </Drawer.Body>
                ) : (
                  <Tabs
                    selectedKey={section}
                    onSelectionChange={(key) =>
                      onSectionChange(String(key) as SheetSection)
                    }
                    className={styles.tabs}
                  >
                    <div className={styles.tabsHeader}>
                      <NavigationTabList
                        label="Secciones del producto"
                        items={[
                          {
                            id: "configuracion",
                            label: "Configuración",
                            icon: <Settings2 />,
                          },
                          {
                            id: "produccion",
                            label: "Producción",
                            icon: <Package />,
                          },
                          {
                            id: "archivos",
                            label: "Archivos",
                            icon: <FileText />,
                            count: draft.files.length,
                          },
                        ]}
                      />
                    </div>
                    <div className={styles.workArea}>
                      <Tabs.Panel
                        key={section}
                        id={section}
                        className={styles.tabPanel}
                      >
                        <QuoteNotice
                          state={draft.quote}
                          onRetry={() =>
                            onDraftChange((current) => ({
                              ...current,
                              quote: "listo",
                            }))
                          }
                        />
                        {section === "configuracion" ? (
                          <ConfigurationFields key={product.id} {...props} />
                        ) : section === "produccion" ? (
                          <ProductionFields {...props} />
                        ) : (
                          <FileFields {...props} />
                        )}
                      </Tabs.Panel>
                      <aside
                        className={styles.summaryAside}
                        aria-label="Resumen del producto"
                      >
                        <QuoteSummary product={product} draft={draft} />
                      </aside>
                    </div>
                  </Tabs>
                )}
              </>
            ) : (
              <Drawer.Body className={styles.body}>
                <ProductPicker onPick={pick} />
              </Drawer.Body>
            )}
            <Drawer.Footer className={styles.footer}>
              {product && quote && draft ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      Total de muestra · Impuestos incluidos
                    </p>
                    <strong className="mt-1 block text-xl font-semibold tabular-nums">
                      {draft.quote === "listo" ? sampleMoney(quote.total) : "—"}
                    </strong>
                  </div>
                  <Button variant="outline" onPress={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    isDisabled={blocked}
                    isPending={draft.quote === "calculando"}
                    onPress={onAdd}
                  >
                    {draft.quote === "calculando" ? (
                      <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Plus />
                    )}
                    {draft.quote === "calculando"
                      ? "Calculando…"
                      : "Agregar a la muestra"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-xs text-muted-foreground">
                    11 productos ficticios para comparar los formularios.
                  </p>
                  <Button variant="outline" onPress={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                </>
              )}
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function ProductPicker({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todos");
  const groups = ["Todos", "Impresión", "Fabricación", "Servicios"];
  const filtered = sheetProducts.filter((product) => {
    const category = ["tarjetas", "lona", "talonario", "copiado"].includes(
      product.id,
    )
      ? "Impresión"
      : ["corte", "exhibidor", "sello", "cartel", "merch"].includes(product.id)
        ? "Fabricación"
        : "Servicios";
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return (
      (filter === "Todos" || category === filter) &&
      normalize(`${product.name} ${product.family}`).includes(normalize(query))
    );
  });
  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 z-1 size-4 text-muted-foreground" />
        <Input
          autoFocus
          aria-label="Buscar productos de muestra"
          placeholder="Buscar producto, familia o servicio…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${focus.singleBorder} w-full pl-9`}
        />
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Familias del catálogo"
      >
        {groups.map((group) => (
          <Button
            key={group}
            variant={filter === group ? "secondary" : "outline"}
            aria-pressed={filter === group}
            onPress={() => setFilter(group)}
          >
            {group}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Productos disponibles</span>
        <span role="status">{filtered.length} resultados</span>
      </div>
      <div className="space-y-2">
        {filtered.map((product) => (
          <Button
            key={product.id}
            variant="ghost"
            className={styles.productRow}
            onPress={() => onPick(product.id)}
          >
            <span className={styles.productIcon}>
              <Package size={19} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <strong className="block text-sm font-semibold">
                {product.name}
              </strong>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {product.family} · {product.unit}
              </span>
            </span>
            <ArrowRight size={16} />
          </Button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className={styles.empty}>
          <Search size={24} />
          <h3>No encontramos ese producto</h3>
          <p>Probá otra búsqueda o quitá el filtro de familia.</p>
          <Button
            variant="outline"
            onPress={() => {
              setQuery("");
              setFilter("Todos");
            }}
          >
            Limpiar búsqueda
          </Button>
        </div>
      )}
    </div>
  );
}

function QuoteNotice({
  state,
  onRetry,
}: {
  state: QuoteState;
  onRetry: () => void;
}) {
  if (state === "listo") return null;
  return (
    <div
      role={state === "error" ? "alert" : "status"}
      className={styles.quoteNotice}
      data-state={state}
    >
      {state === "calculando" ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" />
      ) : (
        <CircleAlert />
      )}
      <div>
        <strong>
          {state === "error"
            ? "No se pudo calcular el precio"
            : state === "pendiente"
              ? "Completá los datos del producto"
              : "Estamos calculando el trabajo"}
        </strong>
        <p>
          {state === "error"
            ? "Revisá la configuración o probá de nuevo. Los datos ingresados se conservan."
            : state === "pendiente"
              ? "Este estado muestra cómo se bloquea la confirmación cuando faltan medidas o archivos."
              : "El precio y la acción de agregar se habilitan cuando termina el cálculo."}
        </p>
      </div>
      <Button variant="outline" onPress={onRetry}>
        {state === "error" ? "Reintentar" : "Simular resultado"}
      </Button>
    </div>
  );
}

function QuoteSummary({
  product,
  draft,
}: {
  product: SampleProduct;
  draft: SheetDraft;
}) {
  const quote = sampleQuote(product, draft);
  return (
    <section className={styles.quoteSummary}>
      <div className="flex items-center justify-between gap-2">
        <h3>Resumen del producto</h3>
        {draft.quote === "listo" && (
          <Check size={16} className="text-success" />
        )}
      </div>
      <p className="mt-3 text-sm font-medium">{product.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {draft.quantity.toLocaleString("es-AR")} {product.unit} ·{" "}
        {draft.extras.length} adicionales
      </p>
      <dl className={styles.priceRows}>
        <div>
          <dt>Unitario de muestra</dt>
          <dd>{sampleMoney(product.price)}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{sampleMoney(quote.subtotal)}</dd>
        </div>
        <div>
          <dt>Adicionales</dt>
          <dd>{sampleMoney(quote.extras)}</dd>
        </div>
        <div>
          <dt>Impuestos de muestra</dt>
          <dd>{sampleMoney(quote.taxes)}</dd>
        </div>
      </dl>
      {draft.extras.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {draft.extras.map((extra) => (
            <span className={styles.softBadge} key={extra}>
              {extra}
            </span>
          ))}
        </div>
      )}
      <p className={styles.hint}>
        Importes ilustrativos para evaluar la interfaz. Los campos técnicos no
        ejecutan el motor de cotización.
      </p>
    </section>
  );
}
