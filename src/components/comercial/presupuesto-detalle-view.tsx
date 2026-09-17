"use client";

import * as React from "react";

import Link from "next/link";
import { Card, Tabs, TextArea, Checkbox, Label } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import {
  DesignSystemProvider,
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { FormDialog } from "@/components/design-system/form-dialog";
import { SelectField } from "@/components/design-system/select-field";
import { ProductoCatalogoGlyph } from "./producto-catalogo-glyph";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./presupuesto-detalle-view.module.css";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowUpRight,
  ArrowRightLeft,
  Copy,
  Eye,
  CircleDollarSign,
  Gift,
  MessageSquareText,
  Clock3,
  CalendarIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  PackageIcon,
  SendIcon,
  StoreIcon,
  UserIcon,
} from "lucide-react";

import {
  convertirPresupuesto,
  enviarPresupuesto,
  getPresupuesto,
  presupuestoPdfUrl,
  presupuestoPublicPath,
  presupuestoPublicUrl,
  resolverAprobacionPresupuesto,
  resolverPresupuesto,
  type PresupuestoDetalle,
  type PresupuestoEstado,
} from "@/lib/presupuestos-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import type { MembershipRole } from "@/lib/auth";
import { nombreCanalVenta } from "@/lib/canales-venta";
import { fechaConDia } from "@/lib/fecha";

/** Ficha comercial: presentación y acciones según el estado del presupuesto. */
const ESTADO_META: Record<PresupuestoEstado, { label: string }> = {
  borrador: { label: "Borrador" },
  pendiente_aprobacion: { label: "Pendiente de aprobación" },
  enviado: { label: "Enviado" },
  aprobado: { label: "Aprobado" },
  rechazado: { label: "Rechazado" },
  vencido: { label: "Vencido" },
  convertido: { label: "Convertido en OT" },
};

/** Camino feliz del presupuesto. Rechazado/vencido se muestran aparte. */
const FLUJO: PresupuestoEstado[] = [
  "borrador",
  "enviado",
  "aprobado",
  "convertido",
];

const MOTIVOS_PERDIDA = [
  { v: "precio", l: "Precio" },
  { v: "plazo", l: "Plazo de entrega" },
  { v: "competencia", l: "Se fue con la competencia" },
  { v: "sin_respuesta", l: "Sin respuesta" },
  { v: "otro", l: "Otro" },
];

/** El canal se guarda como slug ("mostrador"); se muestra con su etiqueta. */
const canalLabel = (v: string | null) => nombreCanalVenta(v);

const fmtMoneda = (n: number, moneda: Moneda) =>
  formatearMoneda(n, moneda, { decimales: 0 });

type Tab = "productos" | "conversion" | "historial";

type PresupuestoDetalleViewProps = {
  inicial: PresupuestoDetalle;
  rol: MembershipRole;
};
export function PresupuestoDetalleView(props: PresupuestoDetalleViewProps) {
  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <PresupuestoDetalleContent {...props} />
    </DesignSystemProvider>
  );
}

function PresupuestoDetalleContent({
  inicial,
  rol,
}: PresupuestoDetalleViewProps) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const router = useRouter();
  const { fechaCorta, fechaHora } = useFecha();
  const fmtFecha = (iso: string | null) =>
    iso
      ? /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? fechaConDia(iso)
        : fechaCorta(iso)
      : "—";
  const fmtMomento = fechaHora;
  const [d, setD] = React.useState<PresupuestoDetalle>(inicial);
  const [tab, setTab] = React.useState<Tab>("productos");
  const [trabajando, setTrabajando] = React.useState(false);
  const accionEnCurso = React.useRef(false);
  const [aprobacionAbierta, setAprobacionAbierta] = React.useState(false);
  const [rechazoAbierto, setRechazoAbierto] = React.useState(false);
  const [devolucionAbierta, setDevolucionAbierta] = React.useState(false);
  const [motivo, setMotivo] = React.useState(MOTIVOS_PERDIDA[0].v);
  const [motivoDetalle, setMotivoDetalle] = React.useState("");
  const [notaDevolucion, setNotaDevolucion] = React.useState("");
  const [linkCopiado, setLinkCopiado] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState<Set<string>>(
    () =>
      new Set(
        inicial.items
          .filter((i) => !i.conversion)
          .map((i) => i.cotizacionItemId)
          .filter((x): x is string => x != null),
      ),
  );

  const puedeAprobar = rol === "administrador" || rol === "supervisor";
  const id = d.id;

  const cargar = React.useCallback(async () => {
    try {
      setD(await getPresupuesto(id));
    } catch {
      /* el polling no molesta con errores transitorios */
    }
  }, [id]);

  // La decisión del cliente llega por el link público desde OTRO navegador:
  // se refresca por polling. Pausa durante acciones o formularios abiertos
  // para no pisar lo que el usuario está escribiendo.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !trabajando &&
        !aprobacionAbierta &&
        !rechazoAbierto &&
        !devolucionAbierta
      ) {
        void cargar();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [
    cargar,
    trabajando,
    aprobacionAbierta,
    rechazoAbierto,
    devolucionAbierta,
  ]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    if (accionEnCurso.current) return;
    accionEnCurso.current = true;
    setTrabajando(true);
    try {
      await fn();
      toast.success(ok);
      await cargar();
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      accionEnCurso.current = false;
      setTrabajando(false);
    }
  };

  const copiarLink = () => {
    if (!d.publicToken) return;
    void navigator.clipboard.writeText(presupuestoPublicUrl(d.publicToken));
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
    toast.success("Link copiado. El cliente puede aprobar desde ahí.");
  };

  const itemsConvertibles = d.items.filter(
    (i) => i.cotizacionItemId != null && !i.conversion,
  );
  const parcial = seleccion.size < itemsConvertibles.length;

  // Convertir lleva DERECHO a la orden, con ?convertida=1: allá se abre el
  // aviso de que quedó en borrador. Antes esto era sólo un toast acá y era
  // fácil creer que la orden ya estaba emitida y dejarla parada sin querer.
  //
  // No usa accion() porque ése recarga el presupuesto y hace router.refresh()
  // al terminar: dos requests sobre una vista que estamos abandonando. En el
  // camino feliz `trabajando` queda en true a propósito, para que no se pueda
  // apretar dos veces mientras navega.
  const convertir = async () => {
    setTrabajando(true);
    try {
      const res = await convertirPresupuesto(
        id,
        parcial ? { itemIds: [...seleccion] } : {},
      );
      toast.success(`Presupuesto convertido en ${res.ordenNumero}.`);
      router.push(`/produccion/ordenes/${res.ordenId}?convertida=1`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo convertir el presupuesto.",
      );
      setTrabajando(false);
    }
  };

  const meta = ESTADO_META[d.estado];
  const idxActual = FLUJO.indexOf(d.estado);
  const fueraDelFlujo = idxActual < 0;

  return (
    <section
      {...scope}
      className={`${themeClass} ${s.page}`}
      aria-label="Detalle de presupuesto"
    >
      <header className={s.header}>
        <div>
          <nav className={s.breadcrumb} aria-label="Ubicación">
            <Link href="/comercial/presupuestos">
              <ArrowLeftIcon aria-hidden /> Presupuestos
            </Link>
            <span aria-hidden>/</span>
            <span>Detalle comercial</span>
          </nav>
          <div className={s.titleRow}>
            <h1>
              {d.numero ?? "Borrador"}
              <span className={s.titleDot}>.</span>
            </h1>
            <span className={s.status} data-estado={d.estado}>
              <span aria-hidden />
              {meta.label}
            </span>
          </div>
          <p className={s.subtitle}>
            {d.cliente?.nombre ?? "Sin cliente"} · Emitido{" "}
            {fmtFecha(d.fechaEmision)}
          </p>
          {d.estado === "enviado" && d.primeraVistaEl && (
            <p className={s.seen}>
              <Eye aria-hidden />
              Visto por el cliente · {fmtMomento(d.primeraVistaEl)}
            </p>
          )}
        </div>
        <div className={s.headerActions}>
          <ActionLink
            variant="outline"
            href={presupuestoPdfUrl(id)}
            prefetch={false}
            target="_blank"
            rel="noreferrer"
          >
            <FileTextIcon aria-hidden />
            PDF
          </ActionLink>
          {d.publicToken && (
            <>
              <ActionButton variant="outline" onPress={copiarLink}>
                {linkCopiado ? <CheckIcon aria-hidden /> : <Copy aria-hidden />}
                {linkCopiado ? "Copiado" : "Copiar link"}
              </ActionButton>
              <ActionLink
                variant="outline"
                href={presupuestoPublicPath(d.publicToken)}
                prefetch={false}
                target="_blank"
                rel="noreferrer"
              >
                Ver como cliente
                <ExternalLinkIcon aria-hidden />
              </ActionLink>
            </>
          )}
        </div>
      </header>

      <ol className={s.flow} aria-label="Ciclo del presupuesto">
        {(fueraDelFlujo ? [d.estado] : FLUJO).map((estado, i) => {
          const actual = fueraDelFlujo || i === idxActual;
          const pasado = !fueraDelFlujo && i < idxActual;
          return (
            <li
              key={estado}
              className={s.flowStep}
              data-current={actual || undefined}
              data-complete={pasado || undefined}
              aria-current={actual ? "step" : undefined}
            >
              <span className={s.stepNumber}>
                {fueraDelFlujo ? (
                  <FileTextIcon aria-hidden />
                ) : pasado ? (
                  <CheckIcon aria-hidden />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>{ESTADO_META[estado].label}</span>
              {!fueraDelFlujo && i < FLUJO.length - 1 && (
                <span className={s.stepLine} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <dl className={s.fields}>
        <Campo label="Cliente" icon={<UserIcon />}>
          {d.cliente?.nombre ?? "Sin cliente"}
        </Campo>
        <Campo label="Campaña" icon={<FolderIcon />}>
          {d.proyectoCampana ? (
            <Link href={`/comercial/campanas/${d.proyectoCampana.id}`}>
              {d.proyectoCampana.codigo} · {d.proyectoCampana.nombre}
              <ArrowUpRight aria-hidden />
            </Link>
          ) : (
            "Sin campaña"
          )}
        </Campo>
        <Campo label="Vendedor" icon={<UserIcon />}>
          {d.vendedor?.nombre ?? "—"}
        </Campo>
        <Campo label="Canal de venta" icon={<StoreIcon />}>
          {canalLabel(d.canalVenta)}
        </Campo>
        <Campo
          label="Válido hasta"
          icon={<CalendarIcon />}
          hint={
            d.fechaEntrega
              ? `Entrega estimada ${fmtFecha(d.fechaEntrega)}`
              : undefined
          }
        >
          {fmtFecha(d.fechaValidez)}
        </Campo>
      </dl>

      <AccionesEstado
        d={d}
        puedeAprobar={puedeAprobar}
        trabajando={trabajando}
        onEnviar={() =>
          void accion(
            () => enviarPresupuesto(id),
            "Presupuesto enviado — copiá el link y compartilo.",
          )
        }
        onAprobar={() =>
          void accion(
            () => resolverAprobacionPresupuesto(id, { decision: "aprobar" }),
            "Aprobado y enviado al cliente.",
          )
        }
        onAbrirDevolucion={() => setDevolucionAbierta(true)}
        onAbrirRechazo={() => setRechazoAbierto(true)}
        onRegistrarAprobacion={() => setAprobacionAbierta(true)}
        onConvertir={() => void convertir()}
        parcial={parcial}
        seleccionadas={seleccion.size}
        disponibles={itemsConvertibles.length}
      />

      <div className={s.workspace}>
        <Tabs
          className={s.tabs}
          selectedKey={tab}
          onSelectionChange={(key) => setTab(key as Tab)}
        >
          <NavigationTabList
            label="Secciones del presupuesto"
            tone="graphite"
            variant="detailed"
            items={[
              {
                id: "productos",
                label: "Productos",
                description: "Detalle y especificaciones",
                icon: <PackageIcon aria-hidden />,
                count: d.items.length,
              },
              {
                id: "conversion",
                label: "Conversión",
                description: "De presupuesto a orden",
                icon: <ArrowRightLeft aria-hidden />,
              },
              {
                id: "historial",
                label: "Historial",
                description: "Actividad y seguimiento",
                icon: <HistoryIcon aria-hidden />,
                count: d.eventos.length,
              },
            ]}
          />
          <Tabs.Panel id="productos" className={s.tabPanel}>
            <TabProductos d={d} />
          </Tabs.Panel>
          <Tabs.Panel id="conversion" className={s.tabPanel}>
            <TabConversion
              d={d}
              seleccion={seleccion}
              setSeleccion={setSeleccion}
            />
          </Tabs.Panel>
          <Tabs.Panel id="historial" className={s.tabPanel}>
            <TabHistorial d={d} />
          </Tabs.Panel>
        </Tabs>
        <ResumenFinanciero d={d} />
      </div>

      <FormDialog
        isOpen={aprobacionAbierta}
        onOpenChange={setAprobacionAbierta}
        isDismissable={!trabajando}
        title="Registrar aprobación"
        description="Confirmá que el cliente aceptó este presupuesto por otro canal. La aprobación quedará registrada con tu usuario y la fecha."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void accion(async () => {
              await resolverPresupuesto(id, { resultado: "aprobado" });
              setAprobacionAbierta(false);
            }, "Aprobación del cliente registrada.");
          }}
        >
          <div className={s.formBody}>
            <p>
              <strong>{d.numero}</strong> quedará aprobado y podrás convertirlo
              en una orden de trabajo.
            </p>
          </div>
          <div className={s.formActions}>
            <ActionButton
              variant="outline"
              autoFocus
              isDisabled={trabajando}
              onPress={() => setAprobacionAbierta(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              isPending={trabajando}
              isDisabled={trabajando}
            >
              <CheckIcon /> Confirmar aprobación
            </ActionButton>
          </div>
        </form>
      </FormDialog>
      <FormDialog
        isOpen={devolucionAbierta}
        onOpenChange={setDevolucionAbierta}
        isDismissable={!trabajando}
        title="Devolver al vendedor"
        description="Se le avisa para que lo corrija y lo vuelva a mandar."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void accion(async () => {
              await resolverAprobacionPresupuesto(id, {
                decision: "devolver",
                comentario: notaDevolucion || undefined,
              });
              setDevolucionAbierta(false);
              setNotaDevolucion("");
            }, "Devuelto al vendedor.");
          }}
        >
          <div className={s.formBody}>
            <label className={s.formField}>
              <span>Qué hay que corregir</span>
              <TextArea
                className={`${s.textarea} ${focus.singleBorder}`}
                placeholder="Indicá los cambios necesarios…"
                value={notaDevolucion}
                onChange={(e) => setNotaDevolucion(e.target.value)}
              />
            </label>
          </div>
          <div className={s.formActions}>
            <ActionButton
              variant="outline"
              isDisabled={trabajando}
              onPress={() => setDevolucionAbierta(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isDisabled={trabajando}>
              Devolver
            </ActionButton>
          </div>
        </form>
      </FormDialog>
      <FormDialog
        isOpen={rechazoAbierto}
        onOpenChange={setRechazoAbierto}
        isDismissable={!trabajando}
        title="Registrar rechazo"
        description="El motivo queda registrado para el seguimiento comercial y los reportes de pérdida."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void accion(async () => {
              await resolverPresupuesto(id, {
                resultado: "rechazado",
                motivoPerdida: motivo,
                motivoPerdidaDetalle: motivoDetalle || undefined,
              });
              setRechazoAbierto(false);
              setMotivoDetalle("");
            }, "Rechazo registrado.");
          }}
        >
          <div className={s.formBody}>
            <div className={s.formField}>
              <span>Motivo del rechazo</span>
              <SelectField
                aria-label="Motivo del rechazo"
                value={motivo}
                onChange={setMotivo}
                options={MOTIVOS_PERDIDA.map((m) => ({
                  value: m.v,
                  label: m.l,
                }))}
              />
            </div>
            <label className={s.formField}>
              <span>
                Detalle <small>Opcional</small>
              </span>
              <TextArea
                className={`${s.textarea} ${focus.singleBorder}`}
                placeholder="Agregá contexto sobre la decisión del cliente…"
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
              />
            </label>
          </div>
          <div className={s.formActions}>
            <ActionButton
              variant="outline"
              isDisabled={trabajando}
              onPress={() => setRechazoAbierto(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              variant="danger"
              isDisabled={trabajando}
            >
              Registrar rechazo
            </ActionButton>
          </div>
        </form>
      </FormDialog>
    </section>
  );
}

function Campo({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={s.field}>
      <dt>
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd>{children}</dd>
      {hint && <dd className={s.fieldHint}>{hint}</dd>}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  count,
}: {
  icon: typeof PackageIcon;
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <header className={s.sectionHeading}>
      <span className={s.sectionIcon}>
        <Icon aria-hidden />
      </span>
      <div>
        <h2>
          {title}
          {count != null && <span className={s.count}>{count}</span>}
        </h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

/** Acción PRINCIPAL según el estado; el resto queda secundario. */
function AccionesEstado({
  d,
  puedeAprobar,
  trabajando,
  onEnviar,
  onAprobar,
  onAbrirDevolucion,
  onAbrirRechazo,
  onRegistrarAprobacion,
  onConvertir,
  parcial,
  seleccionadas,
  disponibles,
}: {
  d: PresupuestoDetalle;
  puedeAprobar: boolean;
  trabajando: boolean;
  onEnviar: () => void;
  onAprobar: () => void;
  onAbrirDevolucion: () => void;
  onAbrirRechazo: () => void;
  onRegistrarAprobacion: () => void;
  onConvertir: () => void;
  parcial: boolean;
  seleccionadas: number;
  disponibles: number;
}) {
  if (d.estado === "convertido") {
    return (
      <div className={s.actionBar} data-tone="success">
        <div>
          <div className={s.actionTitle}>
            Convertido en {d.ordenesConvertidas.length || 1} orden
            {d.ordenesConvertidas.length === 1 ? "" : "es"}
          </div>
          <div className={s.actionDescription}>
            Todos los productos del presupuesto ya pasaron a producción.
          </div>
        </div>
        <div className={s.actionButtons}>
          {d.ordenesConvertidas.map((orden) => (
            <ActionLink key={orden.id} href={`/produccion/ordenes/${orden.id}`}>
              Ver {orden.numero}
            </ActionLink>
          ))}
        </div>
      </div>
    );
  }

  if (d.estado === "borrador") {
    return (
      <div className={s.actionBar}>
        <div>
          <div className={s.actionTitle}>Listo para enviar</div>
          <div className={s.actionDescription}>
            Al enviarlo se genera el link para que el cliente lo apruebe.
          </div>
        </div>
        <ActionButton type="button" isDisabled={trabajando} onPress={onEnviar}>
          <SendIcon /> Enviar al cliente
        </ActionButton>
      </div>
    );
  }

  if (d.estado === "pendiente_aprobacion") {
    return (
      <div className={s.actionBar} data-tone="warning">
        <div>
          <div className={s.actionTitle}>Necesita aprobación interna</div>
          <div className={s.actionDescription}>
            {d.aprobacionMotivos.length
              ? d.aprobacionMotivos.map((m) => m.detalle).join(" · ")
              : "Supera los umbrales configurados."}
          </div>
        </div>
        {puedeAprobar ? (
          <div className={s.actionButtons}>
            <ActionButton
              type="button"
              variant="outline"
              isDisabled={trabajando}
              onPress={onAbrirDevolucion}
            >
              Devolver
            </ActionButton>
            <ActionButton
              type="button"
              isDisabled={trabajando}
              onPress={onAprobar}
            >
              <CheckIcon /> Aprobar y enviar
            </ActionButton>
          </div>
        ) : (
          <span className={s.actionDescription}>
            Lo tiene que resolver un administrador.
          </span>
        )}
      </div>
    );
  }

  if (d.estado === "enviado") {
    return (
      <div className={s.actionBar}>
        <div>
          <div className={s.actionTitle}>Esperando la decisión del cliente</div>
          <div className={s.actionDescription}>
            {d.primeraVistaEl
              ? "Ya lo vio. Podés registrar la respuesta si te contestó por otro canal."
              : "Todavía no lo abrió. Compartile el link."}
          </div>
        </div>
        <div className={s.actionButtons}>
          <ActionButton
            type="button"
            variant="outline"
            isDisabled={trabajando}
            onPress={onAbrirRechazo}
          >
            Registrar rechazo
          </ActionButton>
          <ActionButton
            type="button"
            isDisabled={trabajando}
            onPress={onRegistrarAprobacion}
          >
            <CheckIcon /> Registrar aprobación
          </ActionButton>
        </div>
      </div>
    );
  }

  if (d.estado === "aprobado") {
    return (
      <div className={s.actionBar} data-tone="success">
        <div>
          <div className={s.actionTitle}>Aprobado por el cliente</div>
          <div className={s.actionDescription}>
            {parcial
              ? `Se convertirán ${seleccionadas} de ${disponibles} productos pendientes (elegilos en la pestaña Conversión).`
              : "Se convertirán todos los productos pendientes en una orden de trabajo."}
          </div>
        </div>
        <ActionButton
          type="button"
          isDisabled={trabajando || seleccionadas === 0}
          onPress={onConvertir}
        >
          Convertir en orden
        </ActionButton>
      </div>
    );
  }

  return null;
}

function TabProductos({ d }: { d: PresupuestoDetalle }) {
  const { moneda } = useConfigRegional();
  return (
    <div className={s.panelStack}>
      <SectionHeading
        icon={PackageIcon}
        title="Productos del presupuesto"
        description="Cantidades, especificaciones y valores acordados."
        count={d.items.length}
      />
      {d.items.length === 0 && (
        <Card className={s.empty}>
          Este presupuesto todavía no tiene productos.
        </Card>
      )}
      {d.items.map((item, idx) => (
        <Card key={item.cotizacionItemId ?? idx} className={s.product}>
          <div className={s.productHead}>
            <span className={s.productGlyph} aria-hidden>
              <ProductoCatalogoGlyph
                cobro={
                  item.cantidadUnidad === "m²"
                    ? "Por m²"
                    : item.cantidadUnidad === "ml"
                      ? "Por metro lineal"
                      : "Por unidad"
                }
              />
            </span>
            <div className={s.productIdentity}>
              <span className={s.eyebrow}>
                Producto {String(idx + 1).padStart(2, "0")}
              </span>
              <h3>{item.nombre}</h3>
            </div>
            <div className={s.quantity}>
              <span>Cantidad</span>
              <strong>
                {item.cantidad.toLocaleString("es-AR")}{" "}
                <small>{item.cantidadUnidad}</small>
              </strong>
            </div>
          </div>
          {item.specs.length > 0 && (
            <dl className={s.specs}>
              {item.specs.map((spec, specIdx) => (
                <div key={`${spec.etiqueta}-${specIdx}`}>
                  <dt>{spec.etiqueta}</dt>
                  <dd>{spec.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.adicionales.length > 0 && (
            <div className={s.optionals}>
              <span className={s.eyebrow}>Adicionales</span>
              <ul>
                {item.adicionales.map((adicional, aIdx) => (
                  <li key={`${adicional}-${aIdx}`}>
                    <CheckIcon aria-hidden />
                    {adicional}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={s.productAmounts}>
            <div>
              <span>Subtotal</span>
              {item.descuentoMonto ? (
                <>
                  <del>
                    {fmtMoneda(item.subtotal + item.descuentoMonto, moneda)}
                  </del>
                  <strong>
                    {fmtMoneda(item.subtotal, moneda)}{" "}
                    <small className={s.discount}>
                      −
                      {(item.descuentoPct ?? 0).toLocaleString("es-AR", {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </small>
                  </strong>
                </>
              ) : (
                <strong>{fmtMoneda(item.subtotal, moneda)}</strong>
              )}
            </div>
            <div className={s.productTotal}>
              <span>Total con impuestos</span>
              <strong>{fmtMoneda(item.total, moneda)}</strong>
            </div>
          </div>
        </Card>
      ))}
      {d.observaciones && (
        <Card className={s.note}>
          <h3>
            <MessageSquareText aria-hidden />
            Observaciones
          </h3>
          <p>{d.observaciones}</p>
        </Card>
      )}
    </div>
  );
}

function ResumenFinanciero({ d }: { d: PresupuestoDetalle }) {
  const { moneda } = useConfigRegional();
  return (
    <aside
      className={s.summary}
      aria-label="Resumen financiero del presupuesto"
    >
      <Card className={s.summaryCard}>
        <header className={s.summaryHeading}>
          <span>
            <CircleDollarSign aria-hidden />
          </span>
          <div>
            <p className={s.eyebrow}>Valor de la propuesta</p>
            <h2>Resumen financiero</h2>
          </div>
        </header>
        <p className={s.summaryCount}>
          {d.items.length} {d.items.length === 1 ? "producto" : "productos"} ·
          Presupuesto
        </p>
        {d.tipoCambio?.tasa != null && (
          <p className={s.summaryCount}>
            Tipo de cambio guardado: 1 USD ={" "}
            {d.tipoCambio.tasa.toLocaleString(moneda.locale)}{" "}
            {d.tipoCambio.monedaDestino}
            <br />
            {d.tipoCambio.referencia} ·{" "}
            {new Date(d.tipoCambio.capturadoEn).toLocaleString(moneda.locale)}
          </p>
        )}
        <dl className={s.amounts}>
          <div>
            <dt>
              Subtotal
              <small>
                {d.descuentoTotal > 0
                  ? `Con descuento −${fmtMoneda(d.descuentoTotal, moneda)}`
                  : "Sin impuestos"}
              </small>
            </dt>
            <dd>{fmtMoneda(d.subtotal, moneda)}</dd>
          </div>
          <div>
            <dt>
              Impuestos
              <small>
                {d.impuestos > 0 ? "IVA incluido" : "Sin impuestos"}
              </small>
            </dt>
            <dd>{fmtMoneda(d.impuestos, moneda)}</dd>
          </div>
          <div>
            <dt>
              Cargos directos
              {d.cargosDirectos === 0 && <small>Sin cargos</small>}
            </dt>
            <dd>{fmtMoneda(d.cargosDirectos, moneda)}</dd>
          </div>
        </dl>
        <div className={s.summaryTotal}>
          <span>Total con impuestos</span>
          <strong>{fmtMoneda(d.total, moneda)}</strong>
          {Boolean(d.senaSugeridaPct) && (
            <p>
              Seña sugerida <b>{d.senaSugeridaPct}%</b>
            </p>
          )}
        </div>
      </Card>
      {(d.fidelizacion.puntosEstimados > 0 ||
        d.fidelizacion.canjePuntos > 0) && (
        <Card className={s.note}>
          <h3>
            <Gift aria-hidden />
            Fidelización
          </h3>
          <p>
            {d.fidelizacion.canjePuntos > 0
              ? `${d.fidelizacion.canjePuntos} puntos · −${fmtMoneda(d.fidelizacion.canjeMonto, moneda)} reservados para este presupuesto.`
              : `Esta compra estima ${d.fidelizacion.puntosEstimados} puntos. Se acreditan al completar, pagar y retirar el trabajo.`}
          </p>
        </Card>
      )}
    </aside>
  );
}

function TabConversion({
  d,
  seleccion,
  setSeleccion,
}: {
  d: PresupuestoDetalle;
  seleccion: Set<string>;
  setSeleccion: (s: Set<string>) => void;
}) {
  const { moneda } = useConfigRegional();
  const convertibles = d.items.filter((i) => i.cotizacionItemId != null);
  const pendientes = convertibles.filter((i) => !i.conversion);
  const disponible = d.estado === "aprobado";
  const toggle = (id: string) => {
    const next = new Set(seleccion);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeleccion(next);
  };
  const totalSel = convertibles
    .filter((i) => i.cotizacionItemId && seleccion.has(i.cotizacionItemId))
    .reduce((sum, i) => sum + i.total, 0);
  return (
    <div className={s.panelStack}>
      <SectionHeading
        icon={ArrowRightLeft}
        title="Preparar la orden"
        description={
          disponible
            ? "Elegí los productos que querés enviar a producción. Los ya convertidos quedan identificados."
            : "La conversión estará disponible cuando el cliente apruebe el presupuesto."
        }
      />
      <Card className={s.conversion}>
        {convertibles.length === 0 ? (
          <div className={s.empty}>
            Este presupuesto no tiene ítems convertibles.
          </div>
        ) : (
          convertibles.map((item) => {
            const itemId = item.cotizacionItemId!;
            const yaConvertido = item.conversion != null;
            const on = yaConvertido || seleccion.has(itemId);
            return (
              <Checkbox
                key={itemId}
                isSelected={on}
                isDisabled={!disponible || yaConvertido}
                onChange={() => toggle(itemId)}
                className={s.conversionRow}
              >
                <Checkbox.Content className={s.conversionContent}>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className={s.conversionName}>
                    {item.nombre}
                    {item.conversion && (
                      <small>Convertido en {item.conversion.numero}</small>
                    )}
                  </Label>
                  <span className={s.conversionQty}>
                    {item.cantidad.toLocaleString("es-AR")}{" "}
                    {item.cantidadUnidad}
                  </span>
                  <span className={s.conversionTotal}>
                    {fmtMoneda(item.total, moneda)}
                  </span>
                </Checkbox.Content>
              </Checkbox>
            );
          })
        )}
        {convertibles.length > 0 && (
          <div className={s.conversionFoot}>
            <span>
              {seleccion.size} de {pendientes.length} productos pendientes
            </span>
            <strong>{fmtMoneda(totalSel, moneda)}</strong>
          </div>
        )}
      </Card>
    </div>
  );
}

function TabHistorial({ d }: { d: PresupuestoDetalle }) {
  const { fechaHora: fmtMomento } = useFecha();
  return (
    <div className={s.panelStack}>
      <SectionHeading
        icon={HistoryIcon}
        title="Historial del presupuesto"
        description="Cada cambio, con su fecha y la persona que lo realizó."
        count={d.eventos.length}
      />
      <Card className={s.history}>
        {d.eventos.length === 0 ? (
          <div className={s.empty}>Sin eventos todavía.</div>
        ) : (
          <ol className={s.timeline}>
            {d.eventos.map((e, i) => (
              <li key={`${e.fecha}-${i}`}>
                <span className={s.eventIcon}>
                  <Clock3 aria-hidden />
                </span>
                <div>
                  <time dateTime={e.fecha}>{fmtMomento(e.fecha)}</time>
                  <p>{e.descripcion}</p>
                  {(e.usuario || e.origen) && (
                    <span className={s.eventAuthor}>
                      {[e.usuario, e.origen].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
