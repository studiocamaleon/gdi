"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip, Input, Tabs } from "@heroui/react";
import {
  Calendar,
  Clock,
  Factory,
  Moon,
  Package,
  PackageCheck,
  Sun,
  User,
  X,
} from "lucide-react";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import { OrdenWorkspace } from "./orden-workspace";
import {
  FieldCard,
  OrdenSegmented,
  OrdenTabs,
  type OrdenTab,
} from "./orden-ficha-presentacion";
import { CanalVentaSelector } from "./canal-venta-selector";
import { OrdenProductosTable } from "./orden-productos-table";
import { ResumenBar, OrdenSaveActions } from "./orden-resumen-financiero";
import { OrdenDatosSections } from "./orden-datos-sections";
import fechasStyles from "./propuesta-fechas.module.css";
import { OrdenFinancialActions } from "./orden-financial-actions";
import { CampanaSelectorOrden } from "./campana-selector-orden";
import { ClienteLista } from "./cliente-selector-orden";
import { OrdenSummaryDetails } from "./orden-summary-details";
import workspace from "./orden-workspace.module.css";
import { productosDiseno } from "./__fixtures__/orden-diseno";

/** Misma composición y componentes que la ficha; los cambios sólo viven en memoria. */
export function OrdenDesignPreview() {
  const [campana, setCampana] = useState("camp-lanzamiento");
  const [cliente, setCliente] = useState("demo-norte");
  const clientesDemo = [
    {
      id: "demo-norte",
      nombre: "Estudio Norte",
      razonSocial: "",
      email: "contacto@example.com",
    },
    {
      id: "demo-sur",
      nombre: "Taller Sur",
      razonSocial: "",
      email: "taller@example.com",
    },
  ];
  const [dark, setDark] = useState(false);
  const [items, setItems] = useState<typeof productosDiseno>([]);
  const [openIds, setOpenIds] = useState(new Set<string>());
  const [tab, setTab] = useState<OrdenTab>("datos");
  const [tipo, setTipo] = useState<"orden" | "presupuesto">("orden");
  const [canal, setCanal] = useState("email");
  const [sinComprobante, setSinComprobante] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <DesignSystemProvider appearance={dark ? "dark" : "light"}>
      <div
        data-ui="heroui"
        data-appearance={dark ? "dark" : "light"}
        className={`${theme.theme} flex h-dvh min-h-0 flex-col`}
      >
        <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-5 py-2 text-xs text-muted-foreground">
          <span>
            Catálogo de diseño · Orden de trabajo · Datos de demostración
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dev/diseno/sheets"
              className="inline-flex items-center px-2 text-foreground underline-offset-4 hover:underline"
            >
              Explorar sheets
            </Link>
            <Link
              href="/dev/diseno/botones"
              className="inline-flex items-center px-2 text-foreground underline-offset-4 hover:underline"
            >
              Explorar botones
            </Link>
            <Link
              href="/dev/diseno/componentes"
              className="inline-flex items-center px-2 text-foreground underline-offset-4 hover:underline"
            >
              Explorar componentes
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setItems(items.length ? [] : productosDiseno)}
            >
              {items.length ? "Ver estado vacío" : "Cargar ejemplo"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={() => setDark((v) => !v)}
              aria-label={dark ? "Ver tema claro" : "Ver tema oscuro"}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
        <main
          className={`${workspace.page} flex min-h-0 flex-1 flex-col bg-background`}
        >
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => setTab(String(key) as OrdenTab)}
            className={workspace.tabs}
          >
            <OrdenWorkspace
              activeSection={tab}
              onShowData={() => setTab("datos")}
              navigation={
                <OrdenTabs
                  count={items.length}
                  clientePendiente={!cliente}
                  verMargenes
                />
              }
              summary={
                <OrdenSummaryDetails
                  cliente={clientesDemo.find((c) => c.id === cliente)?.nombre}
                  campana={
                    campana === "camp-lanzamiento"
                      ? "Lanzamiento de marca"
                      : campana === "camp-papeleria"
                        ? "Papelería institucional"
                        : undefined
                  }
                  fecha="24/09/2026"
                  vendedor="Equipo comercial"
                  onShowData={() => setTab("datos")}
                >
                  <OrdenFinancialActions
                    empty={items.length === 0}
                    sinComprobante={sinComprobante}
                    onToggleTratamientoFiscal={() =>
                      setSinComprobante((v) => !v)
                    }
                    onAgregarCargo={() =>
                      setNotice(
                        "Los cargos se gestionan en la ficha operativa.",
                      )
                    }
                    onDescuentoOrden={() =>
                      setNotice(
                        "Los descuentos se gestionan en la ficha operativa.",
                      )
                    }
                    onCuponOrden={() =>
                      setNotice(
                        "Los cupones se gestionan en la ficha operativa.",
                      )
                    }
                  />
                  <ResumenBar
                    layout="sidebar"
                    items={items}
                    cargosOrden={[]}
                    sinComprobante={sinComprobante}
                  />
                </OrdenSummaryDetails>
              }
              header={
                <>
                  <div className={workspace.identity}>
                    <p className={workspace.breadcrumb}>
                      Comercial / Órdenes de trabajo
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className={workspace.title}>
                        {tipo === "orden"
                          ? "Nueva orden de trabajo"
                          : "Nueva propuesta"}
                      </h1>
                      <Chip size="sm" variant="soft" color="accent">
                        Pendiente
                      </Chip>
                    </div>
                    <p className={workspace.description}>
                      Papelería de marca · Cliente de demostración
                    </p>
                  </div>
                  <OrdenSaveActions
                    tipo={tipo}
                    clienteSeleccionado={Boolean(cliente)}
                    empty={items.length === 0}
                    onGuardarBorrador={() =>
                      setNotice("Vista de demostración: no se guardan órdenes.")
                    }
                    onEmitirPresupuesto={() =>
                      setNotice(
                        "Vista de demostración: no se emiten presupuestos.",
                      )
                    }
                    onEmitir={() =>
                      setNotice("Vista de demostración: no se emiten órdenes.")
                    }
                  />
                </>
              }
              sidebar={
                <OrdenDatosSections
                  tipo={<OrdenSegmented value={tipo} onChange={setTipo} />}
                  vendedor={
                    <FieldCard label="Vendedor" icon={<User />}>
                      <div className="flex items-center gap-2 text-sm">
                        <IdentityAvatar name="Equipo comercial" initials="EC" />
                        <span>Equipo comercial</span>
                      </div>
                    </FieldCard>
                  }
                  cliente={
                    <FieldCard label="Cliente" icon={<User />}>
                      <ClienteLista
                        value={cliente}
                        onChange={setCliente}
                        options={clientesDemo}
                      />
                    </FieldCard>
                  }
                  campana={
                    <FieldCard label="Campaña" icon={<Package />}>
                      <CampanaSelectorOrden
                        value={campana}
                        onChange={setCampana}
                        options={[
                          {
                            id: "camp-lanzamiento",
                            nombre: "Lanzamiento de marca",
                          },
                          {
                            id: "camp-papeleria",
                            nombre: "Papelería institucional",
                          },
                        ]}
                      />
                    </FieldCard>
                  }
                  canalVenta={
                    <CanalVentaSelector
                      id="preview-canal"
                      value={canal}
                      onChange={setCanal}
                    />
                  }
                  entrega={
                    <>
                      <FieldCard label="Entrega prevista" icon={<Calendar />}>
                        <Input
                          type="date"
                          aria-label="Entrega prevista"
                          defaultValue="2026-09-24"
                          className="w-full"
                        />
                      </FieldCard>
                      <FieldCard label="Producción estimada" icon={<Factory />}>
                        <div className={fechasStyles.valorConsulta}>
                          {items.length
                            ? "23/09/2026"
                            : "Sin estimación completa"}
                        </div>
                      </FieldCard>
                      <FieldCard
                        label="Entrega sugerida"
                        icon={<PackageCheck />}
                      >
                        <div className={fechasStyles.valorConsulta}>
                          {items.length
                            ? "24/09/2026"
                            : "Sin estimación completa"}
                        </div>
                      </FieldCard>
                      <FieldCard label="Margen de producción" icon={<Clock />}>
                        <div className={fechasStyles.valorConsulta}>
                          1 día hábil
                        </div>
                      </FieldCard>
                    </>
                  }
                />
              }
            >
              {tab === "productos" ? (
                <OrdenProductosTable
                  items={items}
                  sinComprobante={sinComprobante}
                  expandedIds={openIds}
                  onToggle={(id) =>
                    setOpenIds((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  recotizandoIds={new Set()}
                  onAdd={() => {
                    setItems(productosDiseno);
                    setNotice("Productos de demostración cargados.");
                  }}
                  onPrint={() =>
                    setNotice(
                      "El centro de impresión está disponible en la ficha operativa.",
                    )
                  }
                  getTomo={() => ({ id: null, nombre: null })}
                  rowRef={() => {}}
                  getActions={(item) => ({
                    onRemove: () =>
                      setItems((current) =>
                        current.filter((p) => p.id !== item.id),
                      ),
                  })}
                  renderDetail={(item) => (
                    <div className="grid gap-5 p-6 sm:grid-cols-3">
                      {Object.entries(item.especificaciones).map(
                        ([key, value]) => (
                          <FieldCard key={key} label={key} icon={<Package />}>
                            <p>{value}</p>
                          </FieldCard>
                        ),
                      )}
                    </div>
                  )}
                />
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-8">
                  <h2 className="text-lg font-semibold">
                    {tab === "produccion"
                      ? "Producción"
                      : tab === "pagos"
                        ? "Pagos"
                        : tab === "costos"
                          ? "Costos"
                          : tab === "historial"
                            ? "Historial"
                            : "Archivos"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    El catálogo muestra la navegación. Los datos y las acciones
                    de esta sección se consultan en una orden real.
                  </p>
                </div>
              )}
            </OrdenWorkspace>
          </Tabs>
          {notice && (
            <div
              role="status"
              className="mt-3 flex items-center justify-between rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent-soft-foreground"
            >
              {notice}
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Cerrar aviso"
                onPress={() => setNotice("")}
              >
                <X />
              </Button>
            </div>
          )}
        </main>
      </div>
    </DesignSystemProvider>
  );
}
