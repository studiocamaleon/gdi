"use client";
import { useState } from "react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { useInventoryPage } from "@/components/inventario/use-stock-page";
import Link from "next/link";
import { Chip, Checkbox, Tabs } from "@heroui/react";
import {
  Boxes,
  ClipboardList,
  RefreshCw,
  Truck,
  Plus,
  Users,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SelectField } from "@/components/design-system/select-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { usePuede } from "@/components/navigation/permisos-provider";
import { stockUnitLabel } from "@/components/inventario/stock-conversion-fields";
import {
  getCatalogoCompras,
  getCompras,
  getNecesidadesCompra,
  nombreVarianteCompra,
  numeroCompra,
  type NecesidadCompra,
  type OfertaCompra,
} from "@/lib/compras-api";
import { CompraForm } from "./compra-form";
import { CompraDetalle, estadosCompra } from "./compra-detalle";
import { OfertaForm } from "./oferta-form";
import layout from "@/components/design-system/list-page.module.css";
import styles from "./compras.module.css";
const num = (value: string | number) =>
  Number(value).toLocaleString("es-AR", { maximumFractionDigits: 8 });
const fecha = (value: string | null) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "Por confirmar";
function Vacio({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
async function cargarPanel(
  {
    tab,
    page,
    estado,
    costos,
  }: { tab: string; page: number; estado: string; costos: boolean },
  signal?: AbortSignal,
) {
  const [catalogo, necesidades, compras] = await Promise.all([
    costos ? getCatalogoCompras(signal) : null,
    tab === "necesidades" ? getNecesidadesCompra(page, signal) : null,
    tab === "compras" ? getCompras(page, estado, signal) : null,
  ]);
  return { catalogo, necesidades, compras };
}
export function ComprasPanel() {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const costos = usePuede("finanzas.ver_margenes");
  const canManage = usePuede("inventario.gestionar") && costos;
  const [tab, setTab] = useState("necesidades");
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("");
  const consulta = useInventoryPage(cargarPanel, { tab, page, estado, costos });
  const catalogo = consulta.result?.catalogo ?? null;
  const necesidades = consulta.result?.necesidades ?? null;
  const compras = consulta.result?.compras ?? null;
  const error = consulta.error;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nueva, setNueva] = useState<NecesidadCompra[] | null>(null);
  const [oferta, setOferta] = useState<OfertaCompra | null | undefined>(
    undefined,
  );
  const [detalle, setDetalle] = useState<string | null>(null);
  const actualizar = () => {
    setSelected(new Set());
    consulta.refresh();
  };
  const elegidas =
    necesidades?.data.filter(
      (n) =>
        selected.has(n.id) &&
        !n.revisar &&
        Number(n.porCubrir) > 0 &&
        catalogo?.variantes.some((v) => v.id === n.varianteId),
    ) ?? [];
  const cambiarPagina = (value: number) => {
    setSelected(new Set());
    setPage(value);
  };
  const data = tab === "necesidades" ? necesidades : compras;
  const ofertas =
    catalogo?.variantes.flatMap((v) =>
      v.ofertasCompra.map((o) => ({ ...o, nombre: nombreVarianteCompra(v) })),
    ) ?? [];
  return (
    <main {...scope} className={`${theme} ${layout.page}`}>
      <header className={layout.header}>
        <div>
          <h1>
            Compras y abastecimiento<span aria-hidden="true">.</span>
          </h1>
          <p className={layout.subtitle}>
            De los materiales pendientes a su llegada al depósito.
          </p>
        </div>
        <div className={styles.actions}>
          <ActionButton variant="outline" onPress={actualizar}>
            <RefreshCw />
            Actualizar
          </ActionButton>
          {canManage && (
            <ActionButton isDisabled={!catalogo} onPress={() => setNueva([])}>
              <Plus />
              Nueva compra
            </ActionButton>
          )}
        </div>
      </header>
      <div className={styles.pageBody}>
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(String(key));
            setPage(1);
            setSelected(new Set());
          }}
        >
          <NavigationTabList
            label="Vistas de abastecimiento"
            variant="detailed"
            tone="graphite"
            items={[
              {
                id: "necesidades",
                label: "Necesidades",
                description: "Materiales de las OTs",
                icon: <Boxes />,
              },
              ...(costos
                ? [
                    {
                      id: "compras",
                      label: "Órdenes de compra",
                      description: "Pedidos y recepciones",
                      icon: <ClipboardList />,
                    },
                    {
                      id: "ofertas",
                      label: "Proveedores y ofertas",
                      description: "Precios, presentaciones y plazos",
                      icon: <Users />,
                    },
                  ]
                : []),
            ]}
          />
        </Tabs>
        {error && (
          <p role="alert" className={styles.warning}>
            {error}
          </p>
        )}
        <section
          className={layout.results}
          aria-label={
            tab === "necesidades"
              ? "Necesidades de compra"
              : tab === "compras"
                ? "Órdenes de compra"
                : "Ofertas de proveedores"
          }
        >
          <div className={styles.toolbar}>
            <div>
              <strong>
                {tab === "necesidades"
                  ? "Materiales de OTs con control activo"
                  : tab === "compras"
                    ? "Pedidos registrados"
                    : "Alternativas para comprar materiales"}
              </strong>
              <span className={styles.secondary}>
                {tab === "necesidades"
                  ? "Seleccioná los faltantes que querés comprar. Podés reunir necesidades de varias OT en un pedido."
                  : tab === "compras"
                    ? "Recibir suma stock. La factura y el pago se registran por separado."
                    : "El plazo de cada material hereda el del proveedor cuando no tiene uno específico."}
              </span>
            </div>
            {tab === "necesidades" && canManage && (
              <ActionButton
                isDisabled={!elegidas.length || !catalogo}
                onPress={() => setNueva(elegidas)}
              >
                <Truck />
                Preparar compra ({elegidas.length})
              </ActionButton>
            )}
            {tab === "compras" && (
              <SelectField
                aria-label="Estado de compra"
                value={estado}
                options={[
                  { value: "", label: "Todos los estados" },
                  ...Object.entries(estadosCompra).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                onChange={(v) => {
                  setEstado(v);
                  setPage(1);
                }}
              />
            )}
            {tab === "ofertas" && canManage && (
              <ActionButton
                variant="outline"
                isDisabled={!catalogo}
                onPress={() => setOferta(null)}
              >
                <Plus />
                Agregar oferta
              </ActionButton>
            )}
          </div>
          {tab === "necesidades" &&
            (!necesidades ? (
              !error && (
                <p role="status" className={styles.body}>
                  Consultando necesidades…
                </p>
              )
            ) : !necesidades.data.length ? (
              <Vacio
                title="Todavía no hay necesidades de materiales"
                description="Con el control de reservas activo, las nuevas OTs incorporan sus materiales al emitir. Las órdenes anteriores pueden incorporarse desde su pestaña Materiales. Configurá el modo de reserva en Stock → Reservas por OT."
              />
            ) : (
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    {canManage && <TableHead>Elegir</TableHead>}
                    <TableHead>Material / OT</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Libre para reservar</TableHead>
                    <TableHead>En compra / borrador</TableHead>
                    <TableHead>Sin cobertura</TableHead>
                    <TableHead>Proveedor sugerido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {necesidades.data.map((n) => (
                    <TableRow key={n.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={`Comprar ${n.nombre} para ${n.orden.numero}`}
                            isSelected={selected.has(n.id)}
                            isDisabled={
                              n.revisar ||
                              Number(n.porCubrir) <= 0 ||
                              !catalogo?.variantes.some(
                                (v) => v.id === n.varianteId,
                              )
                            }
                            onChange={(checked) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(n.id);
                                else next.delete(n.id);
                                return next;
                              })
                            }
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </TableCell>
                      )}
                      <TableCell className={styles.material}>
                        <strong>{n.nombre}</strong>
                        <Link
                          className={styles.link}
                          href={`/produccion/ordenes/${n.orden.id}`}
                        >
                          {n.orden.numero}
                        </Link>
                        {n.revisar && <Chip>Revisar en la OT</Chip>}
                      </TableCell>
                      <TableCell>
                        {num(n.pendiente)} {stockUnitLabel(n.unidad)}
                      </TableCell>
                      <TableCell>
                        {num(n.libre)}
                        <span className={styles.secondary}>
                          Compartido, aún sin asignar
                        </span>
                      </TableCell>
                      <TableCell>
                        {num(n.enCompra)}
                        {n.compras.map((c) => (
                          <span className={styles.secondary} key={c.ordenId}>
                            {costos ? (
                              <ActionButton
                                variant="ghost"
                                onPress={() => setDetalle(c.ordenId)}
                              >
                                {numeroCompra(c.numero)}
                              </ActionButton>
                            ) : (
                              numeroCompra(c.numero)
                            )}{" "}
                            ·{" "}
                            {c.estado === "BORRADOR"
                              ? "Borrador"
                              : `${fecha(c.fecha)} ${c.confirmada ? "confirmada" : "estimada"}`}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell>
                        {n.revisar ? "Por revisar" : num(n.porCubrir)}
                      </TableCell>
                      <TableCell>
                        {n.proveedor ? (
                          <>
                            <Link
                              className={styles.link}
                              href={`/proveedores/${n.proveedor.id}`}
                            >
                              {n.proveedor.nombre}
                            </Link>
                            <span className={styles.secondary}>
                              {n.proveedor.reposicionDias == null
                                ? "Plazo sin confirmar"
                                : `${n.proveedor.reposicionDias} días ${n.proveedor.reposicionTipo === "HABILES" ? "de lunes a viernes" : "corridos"}`}
                            </span>
                          </>
                        ) : (
                          "Sin proveedor preferido"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
          {tab === "compras" &&
            (!compras ? (
              !error && (
                <p role="status" className={styles.body}>
                  Consultando compras…
                </p>
              )
            ) : !compras.data.length ? (
              <Vacio
                title="Sin compras en esta vista"
                description="Prepará una compra para reponer stock o seleccioná necesidades de varias OTs."
              />
            ) : (
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compra / proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Materiales</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Llegada</TableHead>
                    <TableHead>Total neto</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.data.map((c) => {
                    const pendientes = c.lineas.filter(
                      (l) => Number(l.cantidad) > Number(l.recibida),
                    );
                    const fechas = pendientes.map(
                      (l) => l.fechaConfirmada ?? l.fechaEstimada,
                    );
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <strong>{numeroCompra(c.numero)}</strong>
                          <span className={styles.secondary}>
                            {c.proveedorNombre}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip>{estadosCompra[c.estado]}</Chip>
                        </TableCell>
                        <TableCell>
                          {c.lineas.length}{" "}
                          {c.lineas.length === 1 ? "material" : "materiales"}
                        </TableCell>
                        <TableCell>
                          {c.ubicacion.almacen.nombre}
                          <span className={styles.secondary}>
                            {c.ubicacion.nombre}
                          </span>
                        </TableCell>
                        <TableCell>
                          {["CANCELADA", "CERRADA", "RECIBIDA"].includes(
                            c.estado,
                          )
                            ? "—"
                            : fechas.some((f) => !f)
                              ? "Por confirmar"
                              : fecha([...fechas].sort().at(-1) ?? null)}
                          <span className={styles.secondary}>
                            {c.estado === "BORRADOR"
                              ? "Pedido sin registrar"
                              : ""}
                          </span>
                        </TableCell>
                        <TableCell className={styles.amount}>
                          {c.moneda}{" "}
                          {num(
                            c.lineas.reduce(
                              (s, l) =>
                                s + Number(l.cantidad) * Number(l.precio),
                              0,
                            ),
                          )}
                        </TableCell>
                        <TableCell>
                          <ActionButton
                            variant="outline"
                            onPress={() => setDetalle(c.id)}
                          >
                            Abrir compra
                          </ActionButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
          {tab === "ofertas" &&
            (!catalogo ? (
              !error && (
                <p role="status" className={styles.body}>
                  Consultando ofertas…
                </p>
              )
            ) : !ofertas.length ? (
              <Vacio
                title="Agregá alternativas de proveedores"
                description="Definí la presentación, el precio y el plazo de cada material. El proveedor preferido actual se conserva."
              />
            ) : (
              <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Presentación</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Reposición</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofertas.map((o) => {
                    const prov = catalogo.proveedores.find(
                      (p) => p.id === o.proveedorId,
                    );
                    return (
                      <TableRow key={o.id}>
                        <TableCell className={styles.material}>
                          <strong>{o.nombre}</strong>
                          <span className={styles.secondary}>
                            {o.codigoProveedor}
                          </span>
                        </TableCell>
                        <TableCell>
                          {prov?.nombre ?? "Proveedor inhabilitado"}
                          {!o.activo && (
                            <span className={styles.secondary}>
                              Oferta inhabilitada
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          1 {stockUnitLabel(o.unidadCompra)} ={" "}
                          {num(o.factorStock)} {stockUnitLabel(o.unidadStock)}
                          <span className={styles.secondary}>
                            Mínimo {num(o.minimo)}
                            {o.multiplo
                              ? ` · múltiplos de ${num(o.multiplo)}`
                              : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          {o.precio == null
                            ? "A confirmar"
                            : `${o.moneda} ${num(o.precio)}`}
                        </TableCell>
                        <TableCell>
                          {o.reposicionDias ??
                            prov?.reposicionDias ??
                            "Sin confirmar"}
                          <span className={styles.secondary}>
                            {o.reposicionDias == null
                              ? "Hereda del proveedor"
                              : o.reposicionTipo === "HABILES"
                                ? "Lunes a viernes"
                                : "Días corridos"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {o.vigenteHasta
                            ? fecha(o.vigenteHasta)
                            : "Sin fecha límite"}
                        </TableCell>
                        <TableCell>
                          {canManage && prov && (
                            <ActionButton
                              variant="outline"
                              onPress={() => setOferta(o)}
                            >
                              Editar
                            </ActionButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
          {tab !== "ofertas" && data && (
            <footer className={styles.pager}>
              <span>
                {data.total} registros · página {page}
              </span>
              <div className={styles.actions}>
                <ActionButton
                  variant="outline"
                  isDisabled={page === 1}
                  onPress={() => cambiarPagina(page - 1)}
                >
                  Anterior
                </ActionButton>
                <ActionButton
                  variant="outline"
                  isDisabled={page * data.pageSize >= data.total}
                  onPress={() => cambiarPagina(page + 1)}
                >
                  Siguiente
                </ActionButton>
              </div>
            </footer>
          )}
        </section>
      </div>
      {nueva && catalogo && (
        <CompraForm
          catalogo={catalogo}
          necesidades={nueva}
          onClose={() => setNueva(null)}
          onSaved={(id) => {
            setNueva(null);
            setDetalle(id);
            setTab("compras");
            actualizar();
          }}
        />
      )}
      {oferta !== undefined && catalogo && (
        <OfertaForm
          catalogo={catalogo}
          oferta={oferta ?? undefined}
          onClose={() => setOferta(undefined)}
          onSaved={() => {
            setOferta(undefined);
            actualizar();
          }}
        />
      )}
      {detalle && catalogo && (
        <CompraDetalle
          key={detalle}
          id={detalle}
          catalogo={catalogo}
          canManage={canManage}
          onClose={() => setDetalle(null)}
          onChanged={actualizar}
        />
      )}
    </main>
  );
}
