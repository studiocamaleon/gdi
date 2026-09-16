"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  InfoIcon,
  FileTextIcon,
  LayersIcon,
  UserRoundIcon,
  WalletIcon,
  Trash2Icon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  CONDICIONES_VENTA,
  CONDICION_VENTA_LABELS,
  letraComprobante,
  type Comprobante,
  type ComprobanteTipo,
  type ConfiguracionFiscal,
} from "@/lib/administracion";
import { crearComprobante } from "@/lib/administracion-api";
import {
  CONDICION_FISCAL_LABELS,
  formatCuit,
  type CondicionFiscal,
} from "@/lib/clientes";
import { formatearMonedaDoc, monedaDe } from "@/lib/moneda";
import { Card, Input } from "@heroui/react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./comprobante.module.css";

export type ClienteOpcion = {
  id: string;
  nombre: string;
  cuit: string;
  condicionFiscal: CondicionFiscal;
};

export type OrdenOpcion = {
  id: string;
  numero: string;
  clienteId: string | null;
  clienteNombre: string;
  itemsCount: number;
};

type ItemForm = {
  descripcion: string;
  cantidad: string;
  unit: string;
  alicuota: number;
};

const itemVacio = (): ItemForm => ({
  descripcion: "",
  cantidad: "1",
  unit: "",
  alicuota: 21,
});

export function ComprobanteEmisionView({
  config,
  clientes,
  ordenes,
  origen,
}: {
  config: ConfiguracionFiscal;
  clientes: ClienteOpcion[];
  ordenes: OrdenOpcion[];
  origen: Comprobante | null;
}) {
  const router = useRouter();
  const activos = config.puntosVenta.filter((p) => p.activo);

  const [tipo, setTipo] = React.useState<ComprobanteTipo>(
    origen ? "nota_credito" : "factura",
  );
  const [clienteId, setClienteId] = React.useState(
    origen ? "" : (clientes[0]?.id ?? ""),
  );
  const [puntoVentaId, setPuntoVentaId] = React.useState(activos[0]?.id ?? "");
  const [fecha, setFecha] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [ordenId, setOrdenId] = React.useState("");
  const [items, setItems] = React.useState<ItemForm[]>([itemVacio()]);
  const [moneda, setMoneda] = React.useState<"ARS" | "USD">("ARS");
  const [cotizacion, setCotizacion] = React.useState("");
  // Los montos de esta pantalla son DEL comprobante: siguen a su selector
  // ARS/USD, no a la moneda del tenant.
  const fmt = (n: number) => formatearMonedaDoc(n, monedaDe(moneda));
  const [condicionVenta, setCondicionVenta] = React.useState("contado");
  const [guardando, setGuardando] = React.useState(false);
  const [desdeOrden, setDesdeOrden] = React.useState(false);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const receptor = cliente?.condicionFiscal ?? "consumidor_final";
  const r = letraComprobante(
    config.condicionFiscal,
    receptor,
    config.leyendaFacturaA,
  );

  // La A exige CUIT del receptor: sin él ARCA rechaza la emisión.
  const faltaCuit = r.letra === "A" && !cliente?.cuit;

  const setItem = (i: number, campo: keyof ItemForm, valor: string | number) =>
    setItems((prev) =>
      prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)),
    );

  const base = items.reduce(
    (s, it) => s + (Number(it.cantidad) || 0) * (Number(it.unit) || 0),
    0,
  );
  // Espeja totales-comprobante.ts: en A el IVA se suma, en B ya está
  // incluido en el precio, y C/E no llevan.
  const ivaPorAlicuota = new Map<number, number>();
  for (const it of items) {
    const b = (Number(it.cantidad) || 0) * (Number(it.unit) || 0);
    if (r.letra === "A") {
      ivaPorAlicuota.set(
        it.alicuota,
        (ivaPorAlicuota.get(it.alicuota) ?? 0) + (b * it.alicuota) / 100,
      );
    } else if (r.letra === "B") {
      const neto = it.alicuota > 0 ? b / (1 + it.alicuota / 100) : b;
      ivaPorAlicuota.set(
        it.alicuota,
        (ivaPorAlicuota.get(it.alicuota) ?? 0) + (b - neto),
      );
    }
  }
  const ivaTotal =
    r.letra === "A" || r.letra === "B"
      ? [...ivaPorAlicuota.values()].reduce((a, b) => a + b, 0)
      : 0;
  const neto = r.letra === "B" ? base - ivaTotal : base;
  const total = r.letra === "A" ? base + ivaTotal : base;

  const submit = async () => {
    if (!puntoVentaId) {
      toast.error("Agregá un punto de venta en Datos fiscales.");
      return;
    }
    if (faltaCuit) {
      toast.error(
        "Una Factura A necesita el CUIT del receptor. Cargalo en la ficha del cliente.",
      );
      return;
    }
    if (!desdeOrden && items.every((it) => !it.descripcion.trim())) {
      toast.error("Cargá al menos un ítem.");
      return;
    }
    setGuardando(true);
    try {
      const creado = await crearComprobante({
        tipo,
        puntoVentaId,
        clienteId: clienteId || undefined,
        ordenId: desdeOrden && ordenId ? ordenId : undefined,
        fecha,
        items:
          desdeOrden && ordenId
            ? undefined
            : items
                .filter((it) => it.descripcion.trim())
                .map((it) => ({
                  descripcion: it.descripcion,
                  cantidad: Number(it.cantidad) || 0,
                  precioUnitarioSinIva: Number(it.unit) || 0,
                  alicuotaIva: it.alicuota,
                })),
        moneda,
        cotizacion: moneda === "USD" ? Number(cotizacion) : undefined,
        condicionVenta,
        comprobanteOrigenId: origen?.id,
      });
      toast.success("Borrador creado. Revisalo y emitilo.");
      router.push(`/administracion/comprobantes/${creado.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear el comprobante.",
      );
      setGuardando(false);
    }
  };

  const scope = useDesignScope();
  const theme = useDesignTheme();

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <Link className={s.crumb} href="/administracion/comprobantes">
        <ArrowLeftIcon aria-hidden />
        Comprobantes
      </Link>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>Administración · Documentos fiscales</p>
          <h1>
            Nuevo comprobante<span className={s.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Prepará el borrador y revisá sus datos antes de emitir.
          </p>
        </div>
        <div className={s.actions}>
          <ActionLink variant="outline" href="/administracion/comprobantes">
            Cancelar
          </ActionLink>
          <ActionButton
            onPress={() => void submit()}
            isPending={guardando}
            isDisabled={guardando || faltaCuit}
          >
            <FileTextIcon aria-hidden />
            {guardando ? "Creando…" : "Crear borrador"}
          </ActionButton>
        </div>
      </header>
      <div className={s.grid}>
        <div className={s.main}>
          <Card className={s.card}>
            <Card.Header className={s.cardHeader}>
              <span className={s.sectionIcon}>
                <UserRoundIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Receptor y datos fiscales</Card.Title>
                <Card.Description>
                  La letra se determina por la condición fiscal del emisor y del
                  receptor.
                </Card.Description>
              </div>
            </Card.Header>
            <Card.Content className={s.cardBody}>
              {origen && (
                <Alert className={s.note}>
                  <InfoIcon />
                  <AlertTitle>Corrección de {origen.numeroCompleto}</AlertTitle>
                  <AlertDescription>{origen.clienteNombre}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cmp-cliente">Cliente</FieldLabel>
                  <SelectField
                    id="cmp-cliente"
                    aria-label="Cliente del comprobante"
                    value={clienteId}
                    onChange={setClienteId}
                    disabled={guardando}
                    options={[
                      { value: "", label: "Consumidor Final" },
                      ...clientes.map((c) => ({
                        value: c.id,
                        label: `${c.nombre} · ${CONDICION_FISCAL_LABELS[c.condicionFiscal]}`,
                      })),
                    ]}
                  />
                </Field>
              </FieldGroup>
              <div className={s.fiscalIdentity}>
                <span className={s.fiscalLetter}>{r.letra}</span>
                <div>
                  <strong>{r.motivo}</strong>
                  <p>
                    {config.razonSocial} ·{" "}
                    {CONDICION_FISCAL_LABELS[config.condicionFiscal]} · CUIT{" "}
                    {formatCuit(config.cuit)}
                  </p>
                </div>
              </div>
              {faltaCuit && (
                <Alert variant="destructive">
                  <InfoIcon />
                  <AlertTitle>Falta el CUIT del receptor</AlertTitle>
                  <AlertDescription>
                    Una Factura A necesita el CUIT del cliente. Completalo en su
                    ficha para continuar.
                  </AlertDescription>
                </Alert>
              )}
              <FieldGroup className={s.formGrid}>
                <Field>
                  <FieldLabel htmlFor="cmp-pv">Punto de venta</FieldLabel>
                  <SelectField
                    id="cmp-pv"
                    aria-label="Punto de venta"
                    value={puntoVentaId}
                    onChange={setPuntoVentaId}
                    disabled={guardando}
                    options={activos.map((p) => ({
                      value: p.id,
                      label: `${p.numeroFormateado} · ${p.nombre}`,
                    }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmp-fecha">Fecha</FieldLabel>
                  <Input
                    id="cmp-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    disabled={guardando}
                    className={focus.singleBorder}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmp-tipo">Tipo</FieldLabel>
                  <SelectField
                    id="cmp-tipo"
                    aria-label="Tipo de comprobante"
                    value={tipo}
                    onChange={(v) => setTipo(v as ComprobanteTipo)}
                    disabled={guardando || !!origen}
                    options={[
                      { value: "factura", label: "Factura" },
                      { value: "nota_credito", label: "Nota de crédito" },
                      { value: "nota_debito", label: "Nota de débito" },
                    ]}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cmp-condicion">
                    Condición de venta
                  </FieldLabel>
                  <SelectField
                    id="cmp-condicion"
                    aria-label="Condición de venta"
                    value={condicionVenta}
                    onChange={setCondicionVenta}
                    disabled={guardando}
                    options={CONDICIONES_VENTA.map((v) => ({
                      value: v,
                      label: CONDICION_VENTA_LABELS[v],
                    }))}
                  />
                </Field>
              </FieldGroup>
            </Card.Content>
          </Card>
          <Card className={s.card}>
            <Card.Header className={s.cardHeader}>
              <span className={s.sectionIcon}>
                <LayersIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Ítems del comprobante</Card.Title>
                <Card.Description>
                  Cargalos manualmente o tomalos de una orden existente.
                </Card.Description>
              </div>
            </Card.Header>
            <Card.Content className={s.cardBody}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cmp-orden">Orden de trabajo</FieldLabel>
                  <SelectField
                    id="cmp-orden"
                    aria-label="Orden de trabajo"
                    value={desdeOrden ? ordenId : ""}
                    disabled={guardando}
                    onChange={(v) => {
                      setOrdenId(v);
                      setDesdeOrden(!!v);
                      const o = ordenes.find((x) => x.id === v);
                      if (o?.clienteId) setClienteId(o.clienteId);
                    }}
                    options={[
                      {
                        value: "",
                        label: "Sin orden · cargar ítems manualmente",
                      },
                      ...ordenes.map((o) => ({
                        value: o.id,
                        label: `${o.numero} · ${o.clienteNombre}`,
                      })),
                    ]}
                  />
                  <FieldDescription>
                    {desdeOrden
                      ? `${ordenes.find((o) => o.id === ordenId)?.itemsCount ?? 0} ítems de la orden`
                      : `${items.filter((i) => i.descripcion.trim()).length} ítems cargados`}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              {desdeOrden ? (
                <Alert className={s.note}>
                  <InfoIcon />
                  <AlertTitle>Ítems vinculados a la OT</AlertTitle>
                  <AlertDescription>
                    Los productos y sus importes se completan desde la orden al
                    crear el borrador. Podrás revisarlos antes de emitir.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className={s.itemEditor}>
                    {items.map((it, i) => (
                      <fieldset
                        key={i}
                        className={s.editItem}
                        disabled={guardando}
                      >
                        <legend>Ítem {i + 1}</legend>
                        <div className={s.removeItem}>
                          <ActionButton
                            variant="ghost"
                            tone="neutral"
                            isIconOnly
                            title="Quitar ítem"
                            aria-label={`Quitar ítem ${i + 1}`}
                            isDisabled={guardando}
                            onPress={() =>
                              setItems((p) => p.filter((_, j) => j !== i))
                            }
                          >
                            <Trash2Icon />
                          </ActionButton>
                        </div>
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor={`cmp-desc-${i}`}>
                              Descripción
                            </FieldLabel>
                            <Input
                              id={`cmp-desc-${i}`}
                              value={it.descripcion}
                              onChange={(e) =>
                                setItem(i, "descripcion", e.target.value)
                              }
                              placeholder="Descripción del ítem"
                              className={focus.singleBorder}
                            />
                          </Field>
                          <div className={s.itemNumbers}>
                            <Field>
                              <FieldLabel htmlFor={`cmp-qty-${i}`}>
                                Cantidad
                              </FieldLabel>
                              <Input
                                id={`cmp-qty-${i}`}
                                type="number"
                                step="any"
                                value={it.cantidad}
                                onChange={(e) =>
                                  setItem(i, "cantidad", e.target.value)
                                }
                                className={focus.singleBorder}
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`cmp-unit-${i}`}>
                                Precio unitario
                              </FieldLabel>
                              <Input
                                id={`cmp-unit-${i}`}
                                type="number"
                                step="any"
                                inputMode="decimal"
                                value={it.unit}
                                onChange={(e) =>
                                  setItem(i, "unit", e.target.value)
                                }
                                placeholder="0"
                                className={focus.singleBorder}
                              />
                            </Field>
                            <div className={s.itemSubtotal}>
                              <span>Subtotal</span>
                              <strong>
                                {fmt(
                                  (Number(it.cantidad) || 0) *
                                    (Number(it.unit) || 0),
                                )}
                              </strong>
                            </div>
                          </div>
                        </FieldGroup>
                      </fieldset>
                    ))}
                  </div>
                  <ActionButton
                    variant="outline"
                    isDisabled={guardando}
                    onPress={() => setItems((p) => [...p, itemVacio()])}
                  >
                    <PlusIcon aria-hidden />
                    Agregar ítem
                  </ActionButton>
                </>
              )}
            </Card.Content>
          </Card>
        </div>
        <aside className={s.aside}>
          <Card className={`${s.card} ${s.summary}`}>
            <Card.Header className={s.summaryHeader}>
              <Card.Title>Resumen del borrador</Card.Title>
              <span className={s.summaryLetter}>{r.letra}</span>
            </Card.Header>
            <Card.Content className={s.summaryBody}>
              {desdeOrden ? (
                <p className={s.summaryPending}>
                  Los importes se completarán al crear el borrador desde la
                  orden seleccionada.
                </p>
              ) : (
                <dl className={s.amounts}>
                  <div>
                    <dt>Neto gravado</dt>
                    <dd>{fmt(neto)}</dd>
                  </div>
                  {r.letra === "A" ? (
                    [...ivaPorAlicuota.entries()]
                      .sort((a, b) => a[0] - b[0])
                      .map(([ali, monto]) => (
                        <div key={ali}>
                          <dt>IVA {ali}%</dt>
                          <dd>{fmt(monto)}</dd>
                        </div>
                      ))
                  ) : r.letra === "B" ? (
                    <div>
                      <dt>IVA incluido</dt>
                      <dd>{fmt(ivaTotal)}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt>IVA</dt>
                      <dd>{r.exenta ? "Exento" : "No corresponde"}</dd>
                    </div>
                  )}
                  <div className={s.grandTotal}>
                    <dt>Total</dt>
                    <dd>{fmt(total)}</dd>
                  </div>
                </dl>
              )}
              <p className={s.summaryHint}>Importes en {moneda}.</p>
            </Card.Content>
          </Card>
          <Card className={s.card}>
            <Card.Header className={s.cardHeader}>
              <span className={s.sectionIcon}>
                <WalletIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Moneda</Card.Title>
                <Card.Description>Moneda de este comprobante.</Card.Description>
              </div>
            </Card.Header>
            <Card.Content className={s.cardBody}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cmp-moneda">Moneda</FieldLabel>
                  <SelectField
                    id="cmp-moneda"
                    aria-label="Moneda del comprobante"
                    value={moneda}
                    onChange={(v) => setMoneda(v as "ARS" | "USD")}
                    disabled={guardando}
                    options={[
                      { value: "ARS", label: "ARS · Pesos argentinos" },
                      { value: "USD", label: "USD · Dólares estadounidenses" },
                    ]}
                  />
                </Field>
                {moneda === "USD" && (
                  <Field>
                    <FieldLabel htmlFor="cmp-tc">Tipo de cambio</FieldLabel>
                    <Input
                      id="cmp-tc"
                      type="number"
                      step="any"
                      value={cotizacion}
                      onChange={(e) => setCotizacion(e.target.value)}
                      placeholder="Ej. 1245"
                      disabled={guardando}
                      className={focus.singleBorder}
                    />
                  </Field>
                )}
              </FieldGroup>
            </Card.Content>
          </Card>
          <Alert className={s.note}>
            <ShieldCheckIcon />
            <AlertTitle>Primero, el borrador</AlertTitle>
            <AlertDescription>
              El número correlativo se asigna recién al emitirlo, después de
              revisar sus datos.
            </AlertDescription>
          </Alert>
        </aside>
      </div>
    </section>
  );
}
