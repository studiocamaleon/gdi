"use client";

import * as React from "react";
import Link from "next/link";
import { Card, SearchField } from "@heroui/react";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  FileMinus2Icon,
  FilePlus2Icon,
  FileTextIcon,
  FilesIcon,
  PlusIcon,
  SearchXIcon,
  WalletIcon,
} from "lucide-react";
import {
  COMPROBANTE_TIPO_LABELS,
  estadoVisual,
  formatCuitODash,
  type Comprobante,
} from "@/lib/administracion";
import { formatearMoneda, formatearMonedaDoc, monedaDe } from "@/lib/moneda";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { ActionLink } from "@/components/design-system/action-link";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import { SegmentedControl } from "@/components/design-system/choice-controls";
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
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { ComprobanteEstado, ComprobanteLetra } from "./comprobante-ui";
import {
  etiquetaSaldoComprobante,
  fechaComprobante,
} from "@/lib/comprobantes-presentacion";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./comprobantes.module.css";

const ESTADOS = [
  ["todos", "Todos los estados"],
  ["borrador", "Borrador"],
  ["en_proceso", "Enviando"],
  ["por_verificar", "Por verificar"],
  ["emitido", "Sin CAE"],
  ["cae", "Con CAE"],
  ["rechazado", "Rechazado"],
  ["anulado", "Anulado"],
] as const;
const TIPOS = [
  { value: "todos", label: "Todos", icon: <FilesIcon /> },
  { value: "factura", label: "Facturas", icon: <FileTextIcon /> },
  {
    value: "nota_credito",
    label: "Notas de crédito",
    icon: <FileMinus2Icon />,
  },
  { value: "nota_debito", label: "Notas de débito", icon: <FilePlus2Icon /> },
];
function mesActual(fecha: string) {
  const hoy = new Date();
  return (
    fecha.slice(0, 7) ===
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  );
}
/** La conversión de las facturas USD a pesos conserva la cotización guardada. */
function totalEnPesos(c: Comprobante, campo: "total" | "saldoPendiente") {
  return c.moneda === "USD" && c.cotizacion
    ? c[campo] * c.cotizacion
    : c[campo];
}

export function ComprobantesView({
  initialComprobantes: data,
}: {
  initialComprobantes: Comprobante[];
}) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const permisoGestionar = usePuede("administracion.gestionar");
  const fiscalDisponible = useCapacidad("fiscal_argentina");
  const puedeGestionar = permisoGestionar && fiscalDisponible;
  const [q, setQ] = React.useState("");
  const [est, setEst] = React.useState("todos");
  const [tip, setTip] = React.useState("todos");
  const cumple = (c: Comprobante, estado: string) =>
    estado === "todos" || estadoVisual(c).clave === estado;
  const list = data.filter((c) => {
    if (!cumple(c, est) || (tip !== "todos" && c.tipo !== tip)) return false;
    const texto = [
      c.clienteNombre,
      c.numeroCompleto,
      c.clienteCuit ?? "",
      c.ordenNumero ?? "",
      ...c.ordenes.map((o) => o.numero),
      c.letra,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return texto.includes(q.trim().toLocaleLowerCase());
  });
  const facturado = data
    .filter((c) => c.estado === "emitido")
    .reduce(
      (sum, c) =>
        sum + (c.tipo === "nota_credito" ? -1 : 1) * totalEnPesos(c, "total"),
      0,
    );
  const pendiente = data
    .filter((c) => c.estado === "emitido" && c.tipo !== "nota_credito")
    .reduce((sum, c) => sum + totalEnPesos(c, "saldoPendiente"), 0);
  const delMes = data.filter(
    (c) => c.estado === "emitido" && mesActual(c.fecha),
  );
  const fmtResumen = (n: number) => formatearMoneda(n, monedaDe("ARS"));
  const limpiar = () => {
    setQ("");
    setEst("todos");
    setTip("todos");
  };

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>Administración · Documentos fiscales</p>
          <h1>
            Comprobantes<span className={s.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Facturas, notas de crédito y débito. Su estado fiscal y el saldo de
            cada documento.
          </p>
        </div>
        {puedeGestionar && (
          <ActionLink href="/administracion/comprobantes/nuevo">
            <PlusIcon aria-hidden />
            Nuevo comprobante
          </ActionLink>
        )}
      </header>
      <div className={s.metrics} aria-label="Resumen de comprobantes">
        <div className={s.totalMetric}>
          <ListMetric
            label="Monto facturado"
            value={fmtResumen(facturado)}
            icon={FileTextIcon}
            hint="Del listado · ARS, descontando notas de crédito."
          />
        </div>
        <ListMetric
          label="Saldo en comprobantes"
          value={fmtResumen(pendiente)}
          icon={WalletIcon}
          hint="Pendiente en documentos de este listado · ARS."
        />
        <ListMetric
          label="Facturas del mes"
          value={delMes.filter((c) => c.tipo === "factura").length}
          icon={CalendarDaysIcon}
          hint="Facturas emitidas durante el mes actual."
        />
        <ListMetric
          label="Notas de crédito del mes"
          value={delMes.filter((c) => c.tipo === "nota_credito").length}
          icon={FileMinus2Icon}
          hint="Correcciones emitidas durante el mes actual."
        />
      </div>
      <Card className={s.results}>
        <Card.Header className={s.sectionHeader}>
          <span className={s.sectionIcon}>
            <FilesIcon aria-hidden />
          </span>
          <div>
            <Card.Title>Registro de comprobantes</Card.Title>
            <Card.Description>
              Consultá cada documento y su autorización fiscal.
            </Card.Description>
          </div>
          <span className={s.count}>
            {list.length} de {data.length} comprobantes
          </span>
        </Card.Header>
        <div className={s.toolbar}>
          <SearchField
            aria-label="Buscar comprobante"
            value={q}
            onChange={setQ}
            className={s.search}
          >
            <SearchField.Group className={focus.singleBorder}>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Cliente, CUIT, comprobante u orden…" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <div className={s.stateFilter}>
            <SelectField
              aria-label="Estado fiscal"
              value={est}
              onChange={setEst}
              options={ESTADOS.map(([value, label]) => ({
                value,
                label: `${label} (${data.filter((c) => cumple(c, value)).length})`,
              }))}
            />
          </div>
        </div>
        <div className={s.typeFilters}>
          <SegmentedControl
            aria-label="Tipo de comprobante"
            value={tip}
            onChange={setTip}
            options={TIPOS}
          />
        </div>
        {list.length === 0 ? (
          <Empty className={s.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {data.length ? <SearchXIcon /> : <FileTextIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {data.length
                  ? "No encontramos comprobantes con estos filtros"
                  : "Todavía no hay comprobantes"}
              </EmptyTitle>
              <EmptyDescription>
                {data.length
                  ? "Probá otro cliente, número o estado fiscal."
                  : "Las facturas y notas que emitas aparecerán acá con su estado, CAE y saldo."}
              </EmptyDescription>
            </EmptyHeader>
            {data.length ? (
              <ActionButton variant="outline" onPress={limpiar}>
                Limpiar filtros
              </ActionButton>
            ) : (
              puedeGestionar && (
                <ActionLink href="/administracion/comprobantes/nuevo">
                  <PlusIcon />
                  Crear primer comprobante
                </ActionLink>
              )
            )}
          </Empty>
        ) : (
          <Table className={s.table}>
            <TableHeader>
              <TableRow>
                <TableHead>Comprobante</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className={s.number}>Importe</TableHead>
                <TableHead>Estado fiscal</TableHead>
                <TableHead className={s.number}>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => {
                const fmt = (n: number) =>
                  formatearMonedaDoc(n, monedaDe(c.moneda));
                return (
                  <TableRow key={c.id} data-state={c.estado}>
                    <TableCell>
                      <Link
                        className={s.documentLink}
                        href={`/administracion/comprobantes/${c.id}`}
                      >
                        <ComprobanteLetra comprobante={c} />
                        <span>
                          <strong>{c.numeroCompleto}</strong>
                          <small>
                            {COMPROBANTE_TIPO_LABELS[c.tipo]} {c.letra}
                          </small>
                        </span>
                        <ArrowUpRightIcon aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell className={s.clientCell}>
                      <strong>{c.clienteNombre}</strong>
                      <small>{formatCuitODash(c.clienteCuit)}</small>
                    </TableCell>
                    <TableCell>
                      <div className={s.orderLinks}>
                        {(c.ordenes.length
                          ? c.ordenes
                          : c.ordenId
                            ? [
                                {
                                  ordenId: c.ordenId,
                                  numero: c.ordenNumero ?? "Ver orden",
                                },
                              ]
                            : []
                        ).map((o) => (
                          <Link
                            key={o.ordenId}
                            href={`/produccion/ordenes/${o.ordenId}`}
                          >
                            {o.numero}
                            <ArrowUpRightIcon aria-hidden />
                          </Link>
                        ))}
                        {!c.ordenId && c.ordenes.length === 0 && (
                          <span className={s.muted}>Sin orden</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={s.date}>
                      {fechaComprobante(c.fecha)}
                    </TableCell>
                    <TableCell className={s.number}>
                      <strong>{fmt(c.total)}</strong>
                      <small>Neto {fmt(c.netoGravado)}</small>
                      <small>IVA {fmt(c.ivaTotal)}</small>
                      {c.moneda === "USD" && (
                        <small>TC {c.cotizacion ?? "—"}</small>
                      )}
                    </TableCell>
                    <TableCell>
                      <ComprobanteEstado comprobante={c} />
                    </TableCell>
                    <TableCell
                      className={`${s.number} ${s.balance}`}
                      data-pending={
                        c.estado === "emitido" &&
                        c.tipo !== "nota_credito" &&
                        c.saldoPendiente > 0
                      }
                    >
                      {etiquetaSaldoComprobante(c, fmt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className={s.caption}>
        El saldo de comprobantes corresponde a estos documentos. La deuda
        comercial completa se consulta en Cuentas por cobrar.
      </p>
    </section>
  );
}
