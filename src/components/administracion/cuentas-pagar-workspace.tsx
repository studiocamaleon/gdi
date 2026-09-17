"use client";

import Link from "next/link";
import { Card, Tabs, SearchField, Checkbox, Chip } from "@heroui/react";
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  Clock3Icon,
  FileTextIcon,
  HandCoinsIcon,
  PlusIcon,
  SearchXIcon,
  UsersRoundIcon,
  WalletIcon,
  WalletCardsIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { ListMetric } from "@/components/design-system/list-metric";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import { fechaConDia } from "@/lib/fecha";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  diasHastaVencimiento,
  etiquetaVencimiento,
  tonoVencimiento,
  EGRESO_ESTADO_LABELS,
  TRAMOS_AGING,
  TRAMO_AGING_LABELS,
  type Egreso,
  type ResumenEgresos,
  type SaldoProveedor,
} from "@/lib/egresos";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./cuentas-pagar.module.css";

type Props = {
  resumen: ResumenEgresos | null;
  tab: "por-pagar" | "proveedores";
  onTab: (tab: "por-pagar" | "proveedores") => void;
  egresos: Egreso[];
  saldos: SaldoProveedor[] | null;
  texto: string;
  onTexto: (texto: string) => void;
  seleccion: Set<string>;
  onSeleccion: (seleccion: Set<string>) => void;
  seleccionados: Egreso[];
  seleccionPagable: boolean;
  totalSeleccion: number;
  puedeGestionar: boolean;
  cargando: boolean;
  error: string | null;
  onReintentar: () => void;
  hoy: string;
  endosar: boolean;
  onAlta: () => void;
  onPago: () => void;
  onDetalle: (egreso: Egreso) => void;
};

export function CuentasPagarWorkspace(p: Props) {
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const q = p.texto.trim().toLocaleLowerCase();
  const proveedores =
    p.saldos?.filter(
      (s) =>
        !q || `${s.nombre} ${s.cuit ?? ""}`.toLocaleLowerCase().includes(q),
    ) ?? [];
  const seleccionVisible = p.seleccionados.length;
  const cambiarSeleccion = (id: string, selected: boolean) => {
    const next = new Set(p.seleccion);
    if (selected) next.add(id);
    else next.delete(id);
    p.onSeleccion(next);
  };
  const vacio = (busqueda: boolean, proveedor = false) => (
    <Empty className={styles.empty}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {busqueda ? <SearchXIcon /> : <WalletIcon />}
        </EmptyMedia>
        <EmptyTitle>
          {busqueda
            ? "No encontramos coincidencias"
            : proveedor
              ? "No hay proveedores con saldo pendiente"
              : "No hay cuentas pendientes de pago"}
        </EmptyTitle>
        <EmptyDescription>
          {busqueda
            ? "Probá con otro nombre, descripción o número."
            : "Las facturas con vencimiento y saldo pendiente aparecerán acá. Los pagos de contado se consultan en Egresos."}
        </EmptyDescription>
      </EmptyHeader>
      {busqueda ? (
        <ActionButton variant="outline" onPress={() => p.onTexto("")}>
          Limpiar búsqueda
        </ActionButton>
      ) : (
        p.puedeGestionar && (
          <ActionButton variant="outline" onPress={p.onAlta}>
            <PlusIcon aria-hidden /> Registrar egreso
          </ActionButton>
        )
      )}
    </Empty>
  );

  return (
    <>
      <header className={listPage.header}>
        <div>
          <p className={styles.eyebrow}>Administración · Pagos</p>
          <h1>
            Cuentas por pagar<span className={styles.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Organizá los vencimientos y consultá cuánto queda por pagar a cada
            proveedor.
          </p>
        </div>
        <div className={styles.actions}>
          <ActionLink href="/administracion/egresos" variant="outline">
            Ver egresos <ArrowUpRightIcon aria-hidden />
          </ActionLink>
          {p.puedeGestionar && (
            <ActionButton onPress={p.onAlta}>
              <PlusIcon aria-hidden /> Registrar egreso
            </ActionButton>
          )}
        </div>
      </header>
      {p.resumen && (
        <div
          className={styles.metrics}
          aria-label="Resumen de cuentas por pagar"
        >
          <div className={styles.totalMetric}>
            <ListMetric
              label="Total por pagar"
              value={fmt(p.resumen.aPagar)}
              icon={WalletIcon}
              hint={`${p.resumen.egresosPendientes} ${p.resumen.egresosPendientes === 1 ? "egreso pendiente" : "egresos pendientes"}.`}
            />
          </div>
          <ListMetric
            label="Saldo vencido"
            value={fmt(p.resumen.vencido)}
            icon={Clock3Icon}
            tone={p.resumen.vencido > 0 ? "danger" : "neutral"}
            hint="Pagos que ya pasaron su vencimiento."
          />
          <ListMetric
            label="Próximos 7 días"
            value={fmt(p.resumen.estaSemana)}
            icon={CalendarClockIcon}
            hint="Incluye los vencimientos de hoy."
          />
          <ListMetric
            label="En las cuentas"
            value={fmt(p.resumen.cuentas)}
            icon={WalletCardsIcon}
            hint={
              p.resumen.cuentas < p.resumen.aPagar
                ? `Diferencia con lo pendiente: ${fmt(p.resumen.aPagar - p.resumen.cuentas)}.`
                : "El saldo actual cubre lo pendiente."
            }
          />
        </div>
      )}
      {p.endosar && (
        <Alert className={styles.notice}>
          <HandCoinsIcon />
          <AlertTitle>Endosar cheque desde cartera</AlertTitle>
          <AlertDescription>
            Seleccioná facturas del mismo proveedor y pulsá Pagar. El cheque
            quedará elegido en el formulario.
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        selectedKey={p.tab}
        onSelectionChange={(key) => p.onTab(key as Props["tab"])}
        className={styles.tabs}
      >
        <NavigationTabList
          className={styles.navigation}
          label="Consulta de cuentas por pagar"
          tone="graphite"
          variant="detailed"
          items={[
            {
              id: "por-pagar",
              label: "Por pagar",
              description: "Facturas y vencimientos",
              icon: <CalendarClockIcon />,
            },
            {
              id: "proveedores",
              label: "Proveedores",
              description: "Saldos y antigüedad",
              icon: <UsersRoundIcon />,
            },
          ]}
        />
        <Card className={styles.results} aria-busy={p.cargando}>
          <Card.Header className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>
              {p.tab === "proveedores" ? <UsersRoundIcon /> : <FileTextIcon />}
            </span>
            <div>
              <Card.Title>
                {p.tab === "proveedores"
                  ? "Saldo por proveedor"
                  : "Agenda de pagos"}
              </Card.Title>
              <Card.Description>
                {p.tab === "proveedores"
                  ? "Deuda agrupada según la fecha de vencimiento de cada egreso."
                  : "Los vencimientos más antiguos primero. Seleccioná egresos de un mismo proveedor para pagarlos juntos."}
              </Card.Description>
            </div>
          </Card.Header>
          <div className={styles.toolbar}>
            <SearchField
              aria-label={
                p.tab === "proveedores"
                  ? "Buscar proveedor o CUIT"
                  : "Buscar egresos"
              }
              value={p.texto}
              onChange={p.onTexto}
              className={styles.search}
            >
              <SearchField.Group
                className={`${listPage.searchGroup} ${focus.singleBorder}`}
              >
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={
                    p.tab === "proveedores"
                      ? "Buscar proveedor o CUIT…"
                      : "Descripción, beneficiario o número…"
                  }
                />
                <SearchField.ClearButton aria-label="Limpiar búsqueda" />
              </SearchField.Group>
            </SearchField>
            <span className={styles.count} role="status">
              {p.cargando || (p.tab === "proveedores" && !p.saldos && !p.error)
                ? "Cargando…"
                : p.tab === "proveedores"
                  ? `${proveedores.length} ${proveedores.length === 1 ? "proveedor" : "proveedores"}`
                  : `${p.egresos.length} ${p.egresos.length === 1 ? "egreso" : "egresos"}`}
            </span>
          </div>
          {p.tab === "por-pagar" &&
            seleccionVisible > 0 &&
            p.puedeGestionar && (
              <div
                className={styles.selection}
                role="region"
                aria-label="Egresos seleccionados"
              >
                <div>
                  <strong>
                    {seleccionVisible}{" "}
                    {seleccionVisible === 1
                      ? "egreso seleccionado"
                      : "egresos seleccionados"}{" "}
                    · {fmt(p.totalSeleccion)}
                  </strong>
                  <span>
                    {p.seleccionPagable
                      ? "Podés registrar un pago total o parcial."
                      : "Seleccioná egresos de un solo proveedor para registrar el pago."}
                  </span>
                </div>
                <div className={styles.actions}>
                  <ActionButton
                    variant="outline"
                    onPress={() => p.onSeleccion(new Set())}
                  >
                    Limpiar selección
                  </ActionButton>
                  <ActionButton
                    isDisabled={!p.seleccionPagable || p.cargando}
                    onPress={p.onPago}
                  >
                    <HandCoinsIcon aria-hidden /> Pagar{" "}
                    <ArrowUpRightIcon aria-hidden />
                  </ActionButton>
                </div>
              </div>
            )}
          {p.error ? (
            <Alert variant="destructive" className={styles.notice}>
              <AlertTitle>No pudimos actualizar esta consulta</AlertTitle>
              <AlertDescription>{p.error}</AlertDescription>
              <ActionButton variant="outline" onPress={p.onReintentar}>
                Reintentar
              </ActionButton>
            </Alert>
          ) : null}
          <Tabs.Panel id="por-pagar">
            {p.egresos.length === 0 ? (
              !p.error && (p.cargando ? <Carga /> : vacio(!!q))
            ) : (
              <Table
                className={styles.table}
                aria-label="Egresos pendientes por vencimiento"
              >
                <TableHeader>
                  <TableRow>
                    {p.puedeGestionar && (
                      <TableHead className={styles.checkCell}>
                        <span className="sr-only">Selección</span>
                      </TableHead>
                    )}
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Egreso</TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className={styles.number}>Total</TableHead>
                    <TableHead className={styles.number}>Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.egresos.map((e) => {
                    const dias = e.fechaVencimiento
                      ? diasHastaVencimiento(e.fechaVencimiento, p.hoy)
                      : null;
                    return (
                      <TableRow
                        key={e.id}
                        data-selected={p.seleccion.has(e.id) || undefined}
                        data-vencimiento={
                          dias == null ? "" : tonoVencimiento(dias)
                        }
                      >
                        {p.puedeGestionar && (
                          <TableCell className={styles.checkCell}>
                            <Checkbox
                              aria-label={`Seleccionar ${e.numero}`}
                              isSelected={p.seleccion.has(e.id)}
                              isDisabled={p.cargando}
                              onChange={(selected) =>
                                cambiarSeleccion(e.id, selected)
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
                        <TableCell className={styles.date}>
                          {fechaConDia(
                            e.fechaVencimiento ?? e.fechaCompetencia,
                          )}
                          {dias !== null && (
                            <span className={styles.due}>
                              <i aria-hidden />
                              {etiquetaVencimiento(dias)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={styles.descriptionCell}>
                          <button
                            className={styles.detailLink}
                            onClick={() => p.onDetalle(e)}
                          >
                            {e.descripcion}
                            <ArrowUpRightIcon aria-hidden />
                          </button>
                          <span className={styles.meta}>{e.numero}</span>
                        </TableCell>
                        <TableCell>{e.beneficiarioNombre}</TableCell>
                        <TableCell>
                          <span className={styles.category}>
                            {e.categoriaNombre}
                          </span>
                        </TableCell>
                        <TableCell className={styles.number}>
                          {formatearMoneda(e.total, monedaDe(e.moneda))}
                        </TableCell>
                        <TableCell
                          className={`${styles.number} ${styles.balance}`}
                        >
                          {formatearMoneda(e.saldo, monedaDe(e.moneda))}
                          {e.pagadoTotal > 0 && (
                            <span className={styles.meta}>
                              Pagado{" "}
                              {formatearMoneda(
                                e.pagadoTotal,
                                monedaDe(e.moneda),
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={
                              e.estado === "parcial" ? "warning" : "default"
                            }
                          >
                            {EGRESO_ESTADO_LABELS[e.estado]}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Tabs.Panel>
          <Tabs.Panel id="proveedores">
            {!p.saldos ? (
              !p.error && <Carga />
            ) : proveedores.length === 0 ? (
              vacio(!!q, true)
            ) : (
              <Table
                className={`${styles.table} ${styles.aging}`}
                aria-label="Saldos por proveedor y vencimiento"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    {TRAMOS_AGING.map((t) => (
                      <TableHead key={t} className={styles.number}>
                        {TRAMO_AGING_LABELS[t]}
                        {t !== "a_vencer" && t !== "d0_30" ? " días" : ""}
                      </TableHead>
                    ))}
                    <TableHead className={styles.number}>
                      Total por pagar
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proveedores.map((s) => (
                    <TableRow key={s.proveedorId ?? "sin"}>
                      <TableCell className={styles.descriptionCell}>
                        {s.proveedorId ? (
                          <Link
                            className={styles.detailLink}
                            href={`/crm/proveedores/${s.proveedorId}`}
                          >
                            {s.nombre}
                            <ArrowUpRightIcon aria-hidden />
                          </Link>
                        ) : (
                          <strong>{s.nombre}</strong>
                        )}
                        <span className={styles.meta}>
                          {s.cuit ? `CUIT ${s.cuit} · ` : ""}
                          {s.egresos} {s.egresos === 1 ? "egreso" : "egresos"}
                        </span>
                      </TableCell>
                      {TRAMOS_AGING.map((t) => (
                        <TableCell key={t} className={styles.number}>
                          <span
                            className={styles.agingCell}
                            data-tramo={t}
                            data-empty={!s.aging[t]}
                          >
                            {s.aging[t] > 0 ? fmt(s.aging[t]) : "—"}
                          </span>
                        </TableCell>
                      ))}
                      <TableCell
                        className={`${styles.number} ${styles.balance}`}
                      >
                        {fmt(s.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>
                      {q ? "Total de la búsqueda" : "Total general"}
                    </TableCell>
                    {TRAMOS_AGING.map((t) => (
                      <TableCell key={t} className={styles.number}>
                        {fmt(proveedores.reduce((s, f) => s + f.aging[t], 0))}
                      </TableCell>
                    ))}
                    <TableCell className={`${styles.number} ${styles.balance}`}>
                      {fmt(proveedores.reduce((s, f) => s + f.total, 0))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </Tabs.Panel>
          <Card.Footer className={styles.legend}>
            Los indicadores superiores muestran todos los pendientes. La
            búsqueda filtra el detalle de la pestaña activa.
          </Card.Footer>
        </Card>
      </Tabs>
    </>
  );
}

function Carga() {
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label="Cargando cuentas por pagar"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className={styles.skeleton} />
      ))}
    </div>
  );
}
