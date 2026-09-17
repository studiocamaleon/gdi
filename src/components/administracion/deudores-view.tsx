"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, SearchField } from "@heroui/react";
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpRightIcon,
  ChartNoAxesColumnIcon,
  Clock3Icon,
  SearchXIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";

import {
  TRAMOS_AGING,
  TRAMO_AGING_LABELS,
  formatCuitODash,
  type Aging,
  type FilaDeudor,
  type TramoAging,
} from "@/lib/administracion";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { ListMetric } from "@/components/design-system/list-metric";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./deudores-resumen.module.css";

const columnas: ColumnDef<FilaDeudor>[] = [
  { id: "cliente", accessorFn: (d) => `${d.nombre} ${d.cuit ?? ""}`, filterFn: "includesString" },
  { accessorKey: "total" },
  { accessorKey: "vencido" },
];
const redondear = (n: number) => Math.round(n * 100) / 100;
const sumarTramos = (filas: FilaDeudor[]) => Object.fromEntries(
  TRAMOS_AGING.map((t) => [t, redondear(filas.reduce((s, d) => s + d.aging[t], 0))]),
) as Aging;
const nombreTramo = (t: TramoAging) =>
  `${TRAMO_AGING_LABELS[t]}${t !== "a_vencer" && t !== "d0_30" ? " días" : ""}`;
const porcentaje = (valor: number, total: number) => {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return pct > 0 && pct < 0.1 ? "<0,1%" : `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
};

export function DeudoresView({ initialFilas }: { initialFilas: FilaDeudor[] }) {
  const router = useRouter();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState("total");
  // TanStack necesita referencias estables para no recalcular y reiniciar su estado en cada render.
  const columnFilters = React.useMemo(() => q.trim() ? [{ id: "cliente", value: q.trim() }] : [], [q]);
  const sorting = React.useMemo(() => [{ id: sort === "overdue" ? "vencido" : "total", desc: true }], [sort]);
  const table = useReactTable({
    data: initialFilas,
    columns: columnas,
    getRowId: (d) => d.clienteId ?? "mostrador",
    state: { columnFilters, sorting },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const totalCol = React.useMemo(() => sumarTramos(initialFilas), [initialFilas]);
  const visibleCol = sumarTramos(rows.map((r) => r.original));
  const grand = redondear(initialFilas.reduce((s, d) => s + d.total, 0));
  const visibleTotal = redondear(rows.reduce((s, r) => s + r.original.total, 0));
  const vencido = redondear(totalCol.d0_30 + totalCol.d31_60 + totalCol.d61_90 + totalCol.d90_mas);
  const grave = redondear(totalCol.d61_90 + totalCol.d90_mas);
  const maxCol = React.useMemo(() => Object.fromEntries(
    TRAMOS_AGING.map((t) => [t, initialFilas.reduce((max, d) => Math.max(max, d.aging[t]), 0)]),
  ) as Aging, [initialFilas]);

  return (
    <section {...scope} data-visual="brand" className={`${theme} ${listPage.page} ${styles.page}`}>
      <header className={listPage.header}>
        <div>
          <p className={styles.eyebrow}>Administración · Cobranza</p>
          <h1>Cuentas por cobrar<span className={styles.dot}>.</span></h1>
          <p className={listPage.subtitle}>Lo que falta cobrar, cliente por cliente. Distinguí los próximos pagos de los que ya vencieron.</p>
        </div>
        <ActionLink href="/crm/clientes" variant="outline">
          <UsersRoundIcon aria-hidden /> Clientes <ArrowUpRightIcon aria-hidden />
        </ActionLink>
      </header>

      <div className={styles.metrics} aria-label="Resumen general de cobros">
        <div className={styles.totalMetric}>
          <ListMetric label="Total por cobrar" value={fmt(grand)} hint="Saldo pendiente de toda la cartera." icon={WalletIcon} />
        </div>
        <ListMetric label="Saldo vencido" value={fmt(vencido)}
          hint={grave > 0 ? `${fmt(grave)} con más de 60 días de atraso.` : "Pagos que ya pasaron su fecha de vencimiento."}
          icon={Clock3Icon} tone={vencido > 0 ? "danger" : "neutral"} />
        <ListMetric label="Cuentas con saldo" value={initialFilas.length}
          hint="Clientes y ventas de mostrador con pagos pendientes." icon={UsersRoundIcon} />
      </div>

      {initialFilas.length === 0 ? (
        <Card className={styles.results}>
          <Empty className={styles.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><WalletIcon /></EmptyMedia>
              <EmptyTitle>No hay cuentas pendientes de cobro</EmptyTitle>
              <EmptyDescription>
                Acá aparecerán las órdenes emitidas y los comprobantes históricos con saldo pendiente.
                Las órdenes sin vencimiento definido se mostrarán en «A vencer».
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <Card className={styles.results}>
          <Card.Header className={styles.sectionHeader}>
            <span className={styles.sectionIcon}><ChartNoAxesColumnIcon aria-hidden /></span>
            <div>
              <Card.Title className={styles.sectionTitle}>Antigüedad del saldo</Card.Title>
              <Card.Description className={styles.description}>La fecha de vencimiento determina el atraso, aunque la orden ya figure como cargo.</Card.Description>
            </div>
          </Card.Header>
          <div className={styles.distribution} aria-label="Distribución general por vencimiento">
            {TRAMOS_AGING.map((t) => (
              <div key={t} className={styles.bucket} data-tramo={t}>
                <span className={styles.bucketLabel}><i aria-hidden />{nombreTramo(t)}</span>
                <strong>{fmt(totalCol[t])}</strong>
                <div className={styles.track} aria-hidden>
                  <span style={{ width: `${grand > 0 ? (totalCol[t] / grand) * 100 : 0}%` }} />
                </div>
                <span className={styles.bucketHint}>{porcentaje(totalCol[t], grand)} del total</span>
              </div>
            ))}
          </div>
          <div className={styles.toolbar}>
            <SearchField aria-label="Buscar cliente o CUIT" value={q} onChange={setQ} className={styles.search}>
              <SearchField.Group className={`${listPage.searchGroup} ${focus.singleBorder}`}>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar cliente o CUIT…" />
                <SearchField.ClearButton aria-label="Limpiar búsqueda" />
              </SearchField.Group>
            </SearchField>
            <div className={styles.tools}>
              <span className={styles.count} role="status">{rows.length} de {initialFilas.length} {initialFilas.length === 1 ? "cuenta" : "cuentas"}</span>
              <SegmentedControl aria-label="Ordenar cuentas por cobrar" tone="graphite" value={sort} onChange={setSort}
                options={[
                  { value: "total", label: "Mayor saldo", icon: <ArrowDownWideNarrowIcon aria-hidden /> },
                  { value: "overdue", label: "Atraso +60 días", icon: <Clock3Icon aria-hidden /> },
                ]} />
            </div>
          </div>
          {rows.length === 0 ? (
            <Empty className={styles.empty}>
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
                <EmptyTitle>No encontramos cuentas con esa búsqueda</EmptyTitle>
                <EmptyDescription>Probá con otro nombre o CUIT.</EmptyDescription>
              </EmptyHeader>
              <ActionButton variant="outline" onPress={() => setQ("")}>Limpiar búsqueda</ActionButton>
            </Empty>
          ) : (
            <Table className={styles.table} aria-label="Cuentas por cobrar por cliente y vencimiento">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  {TRAMOS_AGING.map((t) => <TableHead key={t} className={styles.number}>{nombreTramo(t)}</TableHead>)}
                  <TableHead className={styles.number}>Total por cobrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, original: d }) => (
                  <TableRow key={id} data-navigable={!!d.clienteId}
                    onClick={(e) => {
                      if (d.clienteId && !(e.target as HTMLElement).closest("a, button"))
                        router.push(`/crm/clientes/${d.clienteId}/cuenta-corriente`);
                    }}>
                    <TableCell className={styles.client}>
                      {d.clienteId ? (
                        <Link href={`/crm/clientes/${d.clienteId}/cuenta-corriente`} prefetch={false} className={styles.clientLink}
                          aria-label={`Ver cuenta corriente de ${d.nombre}`}>
                          <span>{d.nombre}</span><ArrowUpRightIcon aria-hidden />
                        </Link>
                      ) : <strong className={styles.clientName}>{d.nombre}</strong>}
                      <span className={styles.clientMeta}>
                        {d.cuit ? `CUIT ${formatCuitODash(d.cuit)}` : d.clienteId ? "Sin CUIT" : "Sin cliente asignado"}
                        <span>Facturado {d.facturadoPct}%</span>
                      </span>
                    </TableCell>
                    {TRAMOS_AGING.map((t) => (
                      <TableCell key={t} className={styles.number}>
                        <span className={styles.heatCell} data-tramo={t} data-empty={d.aging[t] <= 0}
                          style={{ "--heat-opacity": `${maxCol[t] > 0 ? 5 + (d.aging[t] / maxCol[t]) * 20 : 0}%` } as React.CSSProperties}>
                          {d.aging[t] > 0 ? fmt(d.aging[t]) : "—"}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className={`${styles.number} ${styles.totalCell}`}>{fmt(d.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{q.trim() ? "Total de la búsqueda" : "Total general"}<span className={styles.footerCount}>{rows.length} {rows.length === 1 ? "cuenta" : "cuentas"}</span></TableCell>
                  {TRAMOS_AGING.map((t) => <TableCell key={t} className={styles.number}>{visibleCol[t] > 0 ? fmt(visibleCol[t]) : "—"}</TableCell>)}
                  <TableCell className={`${styles.number} ${styles.totalCell}`}>{fmt(visibleTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          <Card.Footer className={styles.legend}>
            <span className={styles.legendScale}><i aria-hidden />Más color, mayor importe dentro del mismo tramo.</span>
            <span>«A vencer» incluye órdenes sin fecha de vencimiento definida.</span>
          </Card.Footer>
        </Card>
      )}
    </section>
  );
}
