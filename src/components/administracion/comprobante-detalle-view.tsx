"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Modal, Tabs } from "@heroui/react";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  DownloadIcon,
  FileMinus2Icon,
  FileTextIcon,
  InfoIcon,
  LayersIcon,
  LinkIcon,
  PlusIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  COMPROBANTE_TIPO_LABELS,
  CONDICION_VENTA_LABELS,
  formatCuitODash,
  type ComprobanteDetalle,
  type CondicionVenta,
} from "@/lib/administracion";
import {
  cargarCae,
  emitirComprobante,
  consultarEmisionComprobante,
} from "@/lib/administracion-api";
import { formatearMonedaDoc, monedaDe } from "@/lib/moneda";
import {
  fechaComprobante,
  etiquetaSaldoComprobante,
} from "@/lib/comprobantes-presentacion";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComprobanteEstado, ComprobanteLetra } from "./comprobante-ui";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./comprobante.module.css";

export function ComprobanteDetalleView({
  comprobante,
}: {
  comprobante: ComprobanteDetalle;
}) {
  const router = useRouter();
  const c = comprobante;
  const fmt = (n: number) => formatearMonedaDoc(n, monedaDe(c.moneda));
  const [trabajando, setTrabajando] = React.useState(false);
  const [caeForm, setCaeForm] = React.useState<{
    cae: string;
    vto: string;
  } | null>(null);

  const fiscalDisponible = useCapacidad("fiscal_argentina");
  const puedeAnular = usePuede("administracion.anular");
  const envioAnteriorSinRegistro =
    c.estado === "borrador" && c.numero !== null && !c.emision;
  const pendiente = c.estado === "en_proceso" || c.estado === "por_verificar";
  const rechazado = c.estado === "rechazado";
  const emitido = c.estado === "emitido";
  const cobrado = c.cobrosImputados.reduce((s, i) => s + i.monto, 0);

  const emitir = async () => {
    setTrabajando(true);
    try {
      const r = await emitirComprobante(c.id);
      if (r.estado === "emitido")
        toast.success(
          `Comprobante ${r.numeroCompleto} registrado.${r.cae ? "" : " Falta cargar el CAE del portal de ARCA."}`,
        );
      else if (r.estado === "rechazado")
        toast.error("ARCA rechazó el comprobante. Revisá el detalle.");
      else
        toast.info(
          "El envío está pendiente de verificación. Consultá su resultado desde este detalle.",
        );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo emitir.",
      );
    } finally {
      setTrabajando(false);
    }
  };

  const consultar = async () => {
    setTrabajando(true);
    try {
      const resultado = await consultarEmisionComprobante(c.id);
      if (resultado.aplicada)
        toast.success("Resultado recuperado. El comprobante quedó registrado.");
      else toast.info(resultado.detalle ?? "Consulta terminada.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo consultar.",
      );
    } finally {
      setTrabajando(false);
    }
  };

  const guardarCae = async () => {
    if (!caeForm?.cae.trim() || !caeForm.vto) {
      toast.error("Cargá el CAE y su vencimiento.");
      return;
    }
    setTrabajando(true);
    try {
      await cargarCae(c.id, { cae: caeForm.cae, caeVencimiento: caeForm.vto });
      toast.success("CAE cargado.");
      setCaeForm(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el CAE.",
      );
    } finally {
      setTrabajando(false);
    }
  };

  const scope = useDesignScope();
  const theme = useDesignTheme();
  const puedeGestionar = usePuede("administracion.gestionar");
  const [tab, setTab] = React.useState("datos");
  const tabs = [
    {
      id: "datos",
      label: "Datos",
      description: "Receptor y documento",
      icon: <FileTextIcon />,
    },
    {
      id: "items",
      label: "Ítems",
      description: "Detalle de importes",
      icon: <LayersIcon />,
      count: c.items.length,
    },
    ...(emitido
      ? [
          {
            id: "cobros",
            label: "Cobros",
            description: "Pagos imputados",
            icon: <WalletIcon />,
            count: c.cobrosImputados.length,
          },
        ]
      : []),
  ];

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <Link className={s.crumb} href="/administracion/comprobantes">
        <ArrowLeftIcon aria-hidden />
        Comprobantes
      </Link>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>
            Administración · {COMPROBANTE_TIPO_LABELS[c.tipo]}
          </p>
          <div className={s.headingLine}>
            <h1>
              {c.numeroCompleto}
              <span className={s.dot}>.</span>
            </h1>
            <ComprobanteEstado comprobante={c} />
          </div>
          <p className={listPage.subtitle}>
            {c.clienteNombre} · {fechaComprobante(c.fecha)}
          </p>
        </div>
        <div className={s.actions}>
          {emitido && (
            <ActionLink
              variant="outline"
              href={`/administracion/comprobantes/${c.id}/factura`}
              prefetch={false}
            >
              <DownloadIcon aria-hidden />
              Ver factura / PDF
            </ActionLink>
          )}
          {emitido &&
            c.tipo === "factura" &&
            puedeAnular &&
            fiscalDisponible && (
              <ActionLink
                variant="outline"
                href={`/administracion/comprobantes/nuevo?origen=${c.id}`}
              >
                <FileMinus2Icon aria-hidden />
                Nota de crédito
              </ActionLink>
            )}
          {c.estado === "borrador" &&
            c.numero === null &&
            fiscalDisponible &&
            (c.tipo === "nota_credito" ? puedeAnular : puedeGestionar) && (
              <ActionButton
                onPress={() => void emitir()}
                isPending={trabajando}
                isDisabled={trabajando}
              >
                <ShieldCheckIcon aria-hidden />
                {trabajando ? "Emitiendo…" : "Emitir comprobante"}
              </ActionButton>
            )}
        </div>
      </header>
      {envioAnteriorSinRegistro && (
        <Alert className={s.notice}>
          <InfoIcon />
          <AlertTitle>Envío anterior por revisar</AlertTitle>
          <AlertDescription>
            Este borrador ya tiene un número fiscal, pero no tiene registro de
            envío. Verificá su situación en ARCA antes de volver a facturar.
          </AlertDescription>
        </Alert>
      )}
      {pendiente && (
        <Alert className={s.notice}>
          <InfoIcon />
          <AlertTitle>
            {c.estado === "en_proceso"
              ? "Envío en curso"
              : "Resultado por verificar"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {c.emision?.detalle ??
                "El comprobante tiene un envío pendiente. Consultá su resultado antes de volver a facturar."}
            </p>
            {(c.tipo === "nota_credito" ? puedeAnular : puedeGestionar) && (
              <ActionButton
                variant="outline"
                onPress={() => void consultar()}
                isPending={trabajando}
                isDisabled={trabajando}
              >
                Consultar resultado
              </ActionButton>
            )}
          </AlertDescription>
        </Alert>
      )}
      {!fiscalDisponible && (
        <Alert className={s.notice}>
          <InfoIcon />
          <AlertTitle>Historial de comprobantes</AlertTitle>
          <AlertDescription>
            El plan actual no permite nuevas emisiones. Podés revisar los
            documentos existentes y consultar los envíos pendientes.
          </AlertDescription>
        </Alert>
      )}
      <div className={s.grid}>
        <div className={s.main}>
          {rechazado && c.rechazo?.errores?.length ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>ARCA rechazó el comprobante</AlertTitle>
              <AlertDescription>
                {c.rechazo.errores.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => setTab(String(key))}
            className={s.tabs}
          >
            <NavigationTabList
              variant="detailed"
              tone="graphite"
              label="Detalle del comprobante"
              className={s.navigation}
              items={tabs}
            />
            <Tabs.Panel id="datos" className={s.panel}>
              <Card className={s.card}>
                <Card.Header className={s.cardHeader}>
                  <span className={s.sectionIcon}>
                    <UserRoundIcon aria-hidden />
                  </span>
                  <div>
                    <Card.Title>Receptor</Card.Title>
                    <Card.Description>
                      Datos guardados en este comprobante.
                    </Card.Description>
                  </div>
                </Card.Header>
                <Card.Content className={s.cardBody}>
                  <div className={s.receptor}>
                    <ComprobanteLetra comprobante={c} />
                    <div>
                      <strong>{c.clienteNombre}</strong>
                      <small>CUIT {formatCuitODash(c.clienteCuit)}</small>
                    </div>
                  </div>
                  <dl className={s.infoGrid}>
                    <div>
                      <dt>Fecha de emisión</dt>
                      <dd>{fechaComprobante(c.fecha)}</dd>
                    </div>
                    <div>
                      <dt>Punto de venta</dt>
                      <dd>{c.puntoVentaNumero}</dd>
                    </div>
                    <div>
                      <dt>Condición de venta</dt>
                      <dd>
                        {CONDICION_VENTA_LABELS[
                          (c.condicionVenta ?? "contado") as CondicionVenta
                        ] ?? c.condicionVenta}
                      </dd>
                    </div>
                    <div>
                      <dt>Vencimiento de pago</dt>
                      <dd>{fechaComprobante(c.vencimiento)}</dd>
                    </div>
                    <div>
                      <dt>Moneda</dt>
                      <dd>
                        {c.moneda}
                        {c.moneda === "USD"
                          ? ` · TC ${c.cotizacion ?? "—"}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Tipo de comprobante</dt>
                      <dd>
                        {COMPROBANTE_TIPO_LABELS[c.tipo]} {c.letra}
                      </dd>
                    </div>
                  </dl>
                  {c.leyenda && (
                    <Alert className={s.note}>
                      <FileTextIcon />
                      <AlertTitle>Leyenda del comprobante</AlertTitle>
                      <AlertDescription>{c.leyenda}</AlertDescription>
                    </Alert>
                  )}
                </Card.Content>
              </Card>
              {(c.ordenId || c.ordenes.length > 0 || c.comprobanteOrigenId) && (
                <Card className={s.card}>
                  <Card.Header className={s.cardHeader}>
                    <span className={s.sectionIcon}>
                      <LinkIcon aria-hidden />
                    </span>
                    <div>
                      <Card.Title>Documentos vinculados</Card.Title>
                      <Card.Description>
                        Accesos a las órdenes y al comprobante de origen.
                      </Card.Description>
                    </div>
                  </Card.Header>
                  <Card.Content className={s.linkList}>
                    {(c.ordenes.length
                      ? c.ordenes
                      : c.ordenId
                        ? [
                            {
                              ordenId: c.ordenId,
                              numero: c.ordenNumero ?? "Orden vinculada",
                            },
                          ]
                        : []
                    ).map((o) => (
                      <Link
                        key={o.ordenId}
                        href={`/produccion/ordenes/${o.ordenId}`}
                      >
                        <FileTextIcon aria-hidden />
                        <span>{o.numero}</span>
                        <ArrowUpRightIcon aria-hidden />
                      </Link>
                    ))}
                    {c.comprobanteOrigenId && (
                      <Link
                        href={`/administracion/comprobantes/${c.comprobanteOrigenId}`}
                      >
                        <FileMinus2Icon aria-hidden />
                        <span>Comprobante que corrige</span>
                        <ArrowUpRightIcon aria-hidden />
                      </Link>
                    )}
                  </Card.Content>
                </Card>
              )}
            </Tabs.Panel>
            <Tabs.Panel id="items" className={s.panel}>
              <Card className={s.card}>
                <Card.Header className={s.cardHeader}>
                  <span className={s.sectionIcon}>
                    <LayersIcon aria-hidden />
                  </span>
                  <div>
                    <Card.Title>Detalle de ítems</Card.Title>
                    <Card.Description>
                      {c.items.length} ítems · Importes en {c.moneda}.
                    </Card.Description>
                  </div>
                </Card.Header>
                <Table className={s.itemsTable}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className={s.number}>Cantidad</TableHead>
                      <TableHead className={s.number}>
                        Precio unitario
                      </TableHead>
                      <TableHead className={s.number}>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.items.map((it, i) => {
                      const bonif = it.bonificacionPct ?? 0;
                      return (
                        <TableRow key={i}>
                          <TableCell className={s.itemDescription}>
                            {it.descripcion}
                            {bonif > 0 && (
                              <small className={s.discount}>
                                Bonificación −
                                {(Math.round(bonif * 100) / 100).toLocaleString(
                                  "es-AR",
                                )}
                                %
                              </small>
                            )}
                          </TableCell>
                          <TableCell className={s.number}>
                            {it.cantidad}
                          </TableCell>
                          <TableCell className={s.number}>
                            {fmt(it.precioUnitarioSinIva)}
                          </TableCell>
                          <TableCell className={s.number}>
                            {fmt(
                              it.cantidad *
                                it.precioUnitarioSinIva *
                                (1 - bonif / 100),
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </Tabs.Panel>
            {emitido && (
              <Tabs.Panel id="cobros" className={s.panel}>
                <Card className={s.card}>
                  <Card.Header className={s.cardHeader}>
                    <span className={s.sectionIcon}>
                      <WalletIcon aria-hidden />
                    </span>
                    <div>
                      <Card.Title>Cobros imputados</Card.Title>
                      <Card.Description>
                        Pagos aplicados a este documento.
                      </Card.Description>
                    </div>
                  </Card.Header>
                  {c.cobrosImputados.length === 0 ? (
                    <Empty className={s.empty}>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <WalletIcon />
                        </EmptyMedia>
                        <EmptyTitle>Sin cobros imputados</EmptyTitle>
                        <EmptyDescription>
                          Todavía no se aplicaron pagos a este comprobante.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className={s.collections}>
                      {c.cobrosImputados.map((i) => (
                        <div key={i.id}>
                          <span className={s.sectionIcon}>
                            <WalletIcon aria-hidden />
                          </span>
                          <div>
                            <strong>{i.metodoNombre}</strong>
                            <small>
                              {fechaComprobante(i.fecha)} · {i.cuentaNombre}
                            </small>
                          </div>
                          <span className={s.collected}>{fmt(i.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Card.Footer className={s.balanceFooter}>
                    <span>
                      {c.tipo === "nota_credito"
                        ? "Estado de la nota de crédito"
                        : "Saldo del comprobante"}
                    </span>
                    <strong>{etiquetaSaldoComprobante(c, fmt)}</strong>
                  </Card.Footer>
                  {cobrado > 0 && (
                    <p className={s.collectionHint}>
                      Cobrado {fmt(cobrado)} de {fmt(c.total)}.
                    </p>
                  )}
                </Card>
              </Tabs.Panel>
            )}
          </Tabs>
        </div>
        <aside className={s.aside}>
          <Card className={`${s.card} ${s.summary}`}>
            <Card.Header className={s.summaryHeader}>
              <Card.Title>Resumen del comprobante</Card.Title>
              <FileTextIcon aria-hidden />
            </Card.Header>
            <Card.Content className={s.summaryBody}>
              <dl className={s.amounts}>
                <div>
                  <dt>Neto gravado</dt>
                  <dd>{fmt(c.netoGravado)}</dd>
                </div>
                {c.ivaPorAlicuota.length ? (
                  c.ivaPorAlicuota.map((iva) => (
                    <div key={iva.alicuota}>
                      <dt>IVA {iva.alicuota}%</dt>
                      <dd>{fmt(iva.monto)}</dd>
                    </div>
                  ))
                ) : (
                  <div>
                    <dt>IVA</dt>
                    <dd>{fmt(c.ivaTotal)}</dd>
                  </div>
                )}
                <div className={s.grandTotal}>
                  <dt>Total</dt>
                  <dd>{fmt(c.total)}</dd>
                </div>
              </dl>
              <p className={s.summaryHint}>Importes en {c.moneda}.</p>
            </Card.Content>
          </Card>
          {emitido && c.cae && (
            <Card className={s.card}>
              <Card.Header className={s.cardHeader}>
                <span className={s.sectionIcon}>
                  <ShieldCheckIcon aria-hidden />
                </span>
                <div>
                  <Card.Title>Autorización fiscal</Card.Title>
                  <Card.Description>
                    CAE registrado para este documento.
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content className={s.cardBody}>
                <dl className={s.authorization}>
                  <div>
                    <dt>CAE</dt>
                    <dd>{c.cae}</dd>
                  </div>
                  <div>
                    <dt>Vencimiento del CAE</dt>
                    <dd>{fechaComprobante(c.caeVencimiento)}</dd>
                  </div>
                </dl>
              </Card.Content>
            </Card>
          )}
          {emitido && !c.cae && (
            <Card className={s.card}>
              <Card.Header className={s.cardHeader}>
                <span className={s.sectionIcon}>
                  <ShieldCheckIcon aria-hidden />
                </span>
                <div>
                  <Card.Title>CAE pendiente</Card.Title>
                  <Card.Description>
                    El comprobante ya tiene su número.
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content className={s.cardBody}>
                <p className={s.muted}>
                  Cargá el CAE y su vencimiento obtenidos en ARCA para completar
                  el documento.
                </p>
                {puedeGestionar && (
                  <ActionButton
                    onPress={() => setCaeForm({ cae: "", vto: "" })}
                  >
                    <PlusIcon aria-hidden />
                    Cargar CAE
                  </ActionButton>
                )}
              </Card.Content>
            </Card>
          )}
          {c.estado === "borrador" && (
            <Alert className={s.note}>
              <InfoIcon />
              <AlertTitle>Listo para revisar</AlertTitle>
              <AlertDescription>
                El número correlativo se asigna al emitir. Luego se carga el CAE
                obtenido en ARCA.
              </AlertDescription>
            </Alert>
          )}
        </aside>
      </div>
      {caeForm && (
        <FormDialog
          isOpen
          onOpenChange={(open) => {
            if (!open && !trabajando) setCaeForm(null);
          }}
          isDismissable={!trabajando}
          title={
            <>
              <span className={s.eyebrow}>
                Comprobante · {c.numeroCompleto}
              </span>
              Cargar CAE<span className={s.dot}>.</span>
            </>
          }
          description="Ingresá la autorización y su vencimiento tal como figuran en ARCA."
          className={s.dialog}
        >
          <Modal.Body className={s.modalBody}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cmp-cae">CAE</FieldLabel>
                <Input
                  id="cmp-cae"
                  value={caeForm.cae}
                  onChange={(e) =>
                    setCaeForm({ ...caeForm, cae: e.target.value })
                  }
                  inputMode="numeric"
                  placeholder="Número de autorización"
                  disabled={trabajando}
                  className={focus.singleBorder}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cmp-cae-vto">
                  Vencimiento del CAE
                </FieldLabel>
                <Input
                  id="cmp-cae-vto"
                  type="date"
                  value={caeForm.vto}
                  onChange={(e) =>
                    setCaeForm({ ...caeForm, vto: e.target.value })
                  }
                  disabled={trabajando}
                  className={focus.singleBorder}
                />
              </Field>
            </FieldGroup>
          </Modal.Body>
          <Modal.Footer className={s.modalFooter}>
            <ActionButton
              variant="outline"
              isDisabled={trabajando}
              onPress={() => setCaeForm(null)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              onPress={() => void guardarCae()}
              isDisabled={trabajando}
              isPending={trabajando}
            >
              <CheckIcon />
              Guardar CAE
            </ActionButton>
          </Modal.Footer>
        </FormDialog>
      )}
    </section>
  );
}
