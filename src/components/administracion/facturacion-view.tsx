"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Checkbox, Chip, SearchField } from "@heroui/react";
import {
  ArrowUpRightIcon,
  CheckCheckIcon,
  FileStackIcon,
  FilesIcon,
  InfoIcon,
  ListChecksIcon,
  ReceiptTextIcon,
  SearchXIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type {
  OrdenFacturable,
  ResultadoLoteFacturacion,
} from "@/lib/administracion";
import { facturarLote } from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import { formatearMoneda } from "@/lib/moneda";
import { fechaComprobante } from "@/lib/comprobantes-presentacion";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { ListMetric } from "@/components/design-system/list-metric";
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
import { FacturacionResultado } from "./facturacion-resultado";
import {
  FacturacionConfirmacion,
  type LotePorConfirmar,
} from "./facturacion-confirmacion";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./facturacion.module.css";

/** Conserva la emisión por orden o agrupada y el resultado parcial del lote. */
export function FacturacionView({
  initialOrdenes,
}: {
  initialOrdenes: OrdenFacturable[];
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const puedeGestionar = usePuede("administracion.gestionar");
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(() => new Set());
  const [modo, setModo] = React.useState<"por_orden" | "agrupada">("por_orden");
  const [facturando, setFacturando] = React.useState(false);
  const [confirmacion, setConfirmacion] =
    React.useState<LotePorConfirmar | null>(null);
  const emisionEnCurso = React.useRef(false);
  const [resultado, setResultado] =
    React.useState<ResultadoLoteFacturacion | null>(null);

  const data = initialOrdenes;
  const rows = React.useMemo(
    () =>
      data.filter(
        (o) =>
          !q ||
          `${o.numero} ${o.clienteNombre ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [data, q],
  );

  const seleccionadas = data.filter((o) => sel.has(o.ordenId));
  const totalSel = seleccionadas.reduce((s, o) => s + o.saldoSinFacturar, 0);
  const clientesSel = new Set(seleccionadas.map((o) => o.clienteId ?? "CF"));
  const puedeAgrupar = seleccionadas.length > 1 && clientesSel.size === 1;
  const totalPendiente = data.reduce((s, o) => s + o.saldoSinFacturar, 0);
  const todasVisiblesSeleccionadas =
    rows.length > 0 && rows.every((o) => sel.has(o.ordenId));
  const algunaVisibleSeleccionada = rows.some((o) => sel.has(o.ordenId));

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleTodasVisibles = () =>
    setSel((prev) => {
      const next = new Set(prev);
      if (todasVisiblesSeleccionadas) {
        rows.forEach((o) => next.delete(o.ordenId));
      } else {
        rows.forEach((o) => next.add(o.ordenId));
      }
      return next;
    });

  const prepararEmision = () => {
    if (!puedeGestionar || seleccionadas.length === 0 || emisionEnCurso.current)
      return;
    setConfirmacion({
      ordenes: seleccionadas.map(
        ({ ordenId, numero, clienteNombre, saldoSinFacturar }) => ({
          ordenId,
          numero,
          clienteNombre,
          saldoSinFacturar,
        }),
      ),
      modo: puedeAgrupar ? modo : "por_orden",
    });
  };

  const cancelarEmision = () => {
    if (!emisionEnCurso.current) setConfirmacion(null);
  };

  const facturar = async () => {
    if (
      !puedeGestionar ||
      !confirmacion?.ordenes.length ||
      emisionEnCurso.current
    )
      return;
    const modoFinal = confirmacion.modo;
    emisionEnCurso.current = true;
    setFacturando(true);
    try {
      const res = await facturarLote({
        ordenIds: confirmacion.ordenes.map((o) => o.ordenId),
        modo: modoFinal,
      });
      setConfirmacion(null);
      setResultado(res);
      const ok = res.resultados.filter((r) => r.ok).length;
      const fail = res.resultados.length - ok;
      if (fail === 0) {
        toast.success(
          modoFinal === "agrupada"
            ? `Factura agrupada emitida para ${ok} órdenes.`
            : `${ok} factura${ok === 1 ? "" : "s"} emitida${ok === 1 ? "" : "s"}.`,
        );
      } else {
        toast.error(
          `${fail} de ${res.resultados.length} no se pudieron facturar.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo facturar.");
    } finally {
      emisionEnCurso.current = false;
      setFacturando(false);
    }
  };

  const cerrarResultado = () => {
    setResultado(null);
    setSel(new Set());
    router.refresh();
  };

  const modoFinal = puedeAgrupar ? modo : "por_orden";
  const cantidadFacturas = modoFinal === "agrupada" ? 1 : seleccionadas.length;
  const ocultas = seleccionadas.filter(
    (o) => !rows.some((r) => r.ordenId === o.ordenId),
  ).length;
  const cantidadClientes = new Set(data.map((o) => o.clienteId ?? "CF")).size;

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>Administración · Emisión de facturas</p>
          <h1>
            Facturación<span className={s.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            De la orden al comprobante. Facturá trabajos finalizados, de forma
            individual o en lote.
          </p>
        </div>
        <ActionLink variant="outline" href="/administracion/comprobantes">
          Ver comprobantes <ArrowUpRightIcon aria-hidden />
        </ActionLink>
      </header>

      <div className={s.metrics} aria-label="Resumen de facturación">
        <div className={s.totalMetric}>
          <ListMetric
            label="Importe sin facturar"
            value={fmt(totalPendiente)}
            hint="Total pendiente de facturación, con IVA."
            icon={ReceiptTextIcon}
          />
        </div>
        <ListMetric
          label="Órdenes pendientes"
          value={data.length}
          hint="Finalizadas o entregadas con importe sin facturar."
          icon={ListChecksIcon}
        />
        <ListMetric
          label="Clientes"
          value={cantidadClientes}
          hint="Clientes de las órdenes pendientes de facturación."
          icon={UsersRoundIcon}
        />
      </div>

      <div className={s.workspace} data-readonly={!puedeGestionar || undefined}>
        <div className={s.main}>
          <Card className={s.card}>
            <Card.Header className={s.cardHeader}>
              <span className={s.sectionIcon}>
                <FilesIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Órdenes para facturar</Card.Title>
                <Card.Description>
                  El importe sin facturar es independiente de lo cobrado.
                </Card.Description>
              </div>
            </Card.Header>
            <div className={s.toolbar}>
              <SearchField
                aria-label="Buscar orden o cliente"
                value={q}
                onChange={setQ}
                className={s.search}
              >
                <SearchField.Group className={focus.singleBorder}>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Número de orden o cliente…" />
                  <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                </SearchField.Group>
              </SearchField>
              <span className={s.count}>
                {rows.length} de {data.length} órdenes
              </span>
            </div>
            {rows.length > 0 ? (
              <Table
                className={s.table}
                aria-label="Órdenes pendientes de facturación"
              >
                <TableHeader>
                  <TableRow>
                    {puedeGestionar && (
                      <TableHead className={s.checkCell}>
                        <Checkbox
                          aria-label="Seleccionar todas las órdenes visibles"
                          isSelected={todasVisiblesSeleccionadas}
                          isIndeterminate={
                            algunaVisibleSeleccionada &&
                            !todasVisiblesSeleccionadas
                          }
                          isDisabled={facturando}
                          onChange={toggleTodasVisibles}
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </TableHead>
                    )}
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Finalizada</TableHead>
                    <TableHead className={s.number}>Total</TableHead>
                    <TableHead className={s.number}>Facturado</TableHead>
                    <TableHead className={s.number}>Cobrado</TableHead>
                    <TableHead className={s.number}>Sin facturar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow
                      key={o.ordenId}
                      data-selected={sel.has(o.ordenId) || undefined}
                      onClick={() => {
                        if (puedeGestionar && !facturando) toggle(o.ordenId);
                      }}
                    >
                      {puedeGestionar && (
                        <TableCell
                          className={s.checkCell}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            aria-label={`Seleccionar ${o.numero}`}
                            isSelected={sel.has(o.ordenId)}
                            isDisabled={facturando}
                            onChange={() => toggle(o.ordenId)}
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </TableCell>
                      )}
                      <TableCell>
                        <Link
                          className={s.orderLink}
                          href={`/produccion/ordenes/${o.ordenId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.numero}
                          <ArrowUpRightIcon aria-hidden />
                        </Link>
                        <Chip size="sm" variant="soft" className={s.status}>
                          {o.estado === "entregada"
                            ? "Entregada"
                            : o.estado === "finalizada"
                              ? "Finalizada"
                              : o.estado}
                        </Chip>
                      </TableCell>
                      <TableCell className={s.client}>
                        {o.clienteNombre ?? "Mostrador / sin cliente"}
                      </TableCell>
                      <TableCell className={s.date}>
                        {fechaComprobante(o.fechaFinalizada)}
                      </TableCell>
                      <TableCell className={s.number}>{fmt(o.total)}</TableCell>
                      <TableCell className={s.number}>
                        {o.facturado > 0 ? fmt(o.facturado) : "—"}
                      </TableCell>
                      <TableCell className={`${s.number} ${s.collected}`}>
                        {o.cobrado > 0 ? fmt(o.cobrado) : "—"}
                      </TableCell>
                      <TableCell className={`${s.number} ${s.pending}`}>
                        {fmt(o.saldoSinFacturar)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className={s.empty}>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {data.length ? <SearchXIcon /> : <CheckCheckIcon />}
                  </EmptyMedia>
                  <EmptyTitle>
                    {data.length
                      ? "No encontramos órdenes con esa búsqueda"
                      : "La facturación está al día"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {data.length
                      ? "Probá otro número de orden o nombre de cliente."
                      : "Acá aparecen las órdenes finalizadas o entregadas que todavía tienen importe sin facturar."}
                  </EmptyDescription>
                </EmptyHeader>
                {q && (
                  <ActionButton variant="outline" onPress={() => setQ("")}>
                    Limpiar búsqueda
                  </ActionButton>
                )}
              </Empty>
            )}
          </Card>
          <p className={s.caption}>
            <InfoIcon aria-hidden />
            Una orden puede estar cobrada y seguir sin facturar. Para consultar
            la deuda del cliente, usá{" "}
            <Link href="/administracion/deudores">
              Cuentas por cobrar <ArrowUpRightIcon aria-hidden />
            </Link>
            .
          </p>
        </div>

        {puedeGestionar && (
          <aside className={s.aside} aria-label="Preparar facturación">
            <Card className={s.card}>
              <Card.Header className={s.selectionHeader}>
                <span className={s.sectionIcon}>
                  <ReceiptTextIcon aria-hidden />
                </span>
                <div>
                  <Card.Title>Preparar facturación</Card.Title>
                  <Card.Description>Selección de órdenes</Card.Description>
                </div>
              </Card.Header>
              <Card.Content className={s.selectionBody}>
                {seleccionadas.length === 0 ? (
                  <div className={s.selectionEmpty}>
                    <span className={s.selectionMark}>
                      <ListChecksIcon aria-hidden />
                    </span>
                    <strong>Elegí las órdenes</strong>
                    <p>
                      Marcalas en la tabla para ver el importe y definir cómo
                      facturarlas.
                    </p>
                    <small>
                      Si son del mismo cliente, podés reunirlas en una sola
                      factura.
                    </small>
                  </div>
                ) : (
                  <>
                    <div className={s.selectedHeading}>
                      <span>
                        {seleccionadas.length}{" "}
                        {seleccionadas.length === 1
                          ? "orden seleccionada"
                          : "órdenes seleccionadas"}
                      </span>
                      <ActionButton
                        variant="ghost"
                        isIconOnly
                        aria-label="Limpiar selección"
                        onPress={() => setSel(new Set())}
                        isDisabled={facturando}
                      >
                        <XIcon aria-hidden />
                      </ActionButton>
                    </div>
                    <ul
                      className={s.selectedOrders}
                      aria-label="Órdenes seleccionadas"
                    >
                      {seleccionadas.map((o) => (
                        <li key={o.ordenId}>
                          <span>
                            <strong>{o.numero}</strong>
                            <small>
                              {o.clienteNombre ?? "Mostrador / sin cliente"}
                            </small>
                          </span>
                          <span>{fmt(o.saldoSinFacturar)}</span>
                        </li>
                      ))}
                    </ul>
                    {ocultas > 0 && (
                      <p className={s.selectionHint}>
                        {ocultas}{" "}
                        {ocultas === 1
                          ? "orden seleccionada no coincide"
                          : "órdenes seleccionadas no coinciden"}{" "}
                        con la búsqueda actual.
                      </p>
                    )}
                    <div className={s.mode}>
                      <span className={s.eyebrow}>Cómo facturar</span>
                      {puedeAgrupar ? (
                        <SegmentedControl
                          aria-label="Modo de facturación"
                          tone="graphite"
                          value={modo}
                          onChange={(v) =>
                            setModo(v as "por_orden" | "agrupada")
                          }
                          isDisabled={facturando}
                          options={[
                            {
                              value: "por_orden",
                              label: "Por orden",
                              icon: <FilesIcon />,
                            },
                            {
                              value: "agrupada",
                              label: "Agrupada",
                              icon: <FileStackIcon />,
                            },
                          ]}
                        />
                      ) : (
                        <strong>Una factura por orden</strong>
                      )}
                      <p>
                        {modoFinal === "agrupada"
                          ? "Una sola factura para el mismo cliente, con un renglón por orden."
                          : seleccionadas.length > 1 && !puedeAgrupar
                            ? "Las órdenes son de clientes distintos. Se emite una factura para cada orden."
                            : "Cada orden tendrá su propio comprobante por el importe que falta facturar."}
                      </p>
                    </div>
                    <dl className={s.selectionTotal}>
                      <div>
                        <dt>Facturas a emitir</dt>
                        <dd>{cantidadFacturas}</dd>
                      </div>
                      <div>
                        <dt>Total a facturar</dt>
                        <dd>{fmt(totalSel)}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </Card.Content>
              {seleccionadas.length > 0 && (
                <Card.Footer className={s.selectionFooter}>
                  <ActionButton
                    onPress={prepararEmision}
                    isPending={facturando}
                    isDisabled={facturando}
                  >
                    <ReceiptTextIcon aria-hidden />
                    {facturando
                      ? "Emitiendo…"
                      : cantidadFacturas === 1
                        ? "Emitir factura"
                        : `Emitir ${cantidadFacturas} facturas`}
                    <ArrowUpRightIcon aria-hidden />
                  </ActionButton>
                  <p aria-live="polite">
                    {facturando
                      ? "Procesando el lote. El resultado se mostrará al terminar."
                      : "Revisá el resumen y confirmá antes de emitir."}
                  </p>
                </Card.Footer>
              )}
            </Card>
          </aside>
        )}
      </div>
      {confirmacion && puedeGestionar && (
        <FacturacionConfirmacion
          lote={confirmacion}
          enviando={facturando}
          onCancelar={cancelarEmision}
          onConfirmar={() => void facturar()}
        />
      )}
      {resultado && (
        <FacturacionResultado resultado={resultado} onClose={cerrarResultado} />
      )}
    </section>
  );
}
