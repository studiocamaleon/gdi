"use client";

import * as React from "react";
import {
  BadgeDollarSignIcon,
  CalendarClockIcon,
  CircleCheckBigIcon,
  CircleOffIcon,
  CopyIcon,
  Edit3Icon,
  HistoryIcon,
  PlusIcon,
  PowerIcon,
  ScanLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TagIcon,
  TicketPercentIcon,
  TimerIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import {
  Autocomplete,
  Card,
  Chip,
  Description as FieldDescription,
  Input,
  Label as FieldLabel,
  ListBox,
  Modal,
  SearchField,
  TextArea as Textarea,
} from "@heroui/react";
import { Header } from "react-aria-components/Header";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import { useDesignScope } from "@/components/design-system/appearance";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import {
  agruparOpciones,
  normalizarBusqueda,
} from "@/components/ui/select-buscable";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { listClientes } from "@/lib/clientes-api";
import {
  actualizarCupon,
  crearCupon,
  eliminarCupon,
  historialCupon,
  listarCupones,
  type Cupon,
  type CuponAlcanceTipo,
  type CuponHistorial,
  type CuponesListado,
} from "@/lib/cupones-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import {
  getCatalogoComercial,
  getProductos,
} from "@/lib/productos-servicios-api";
import s from "./cupones-view.module.css";

const PAGE_SIZE = 24;
const ALCANCE_LABEL: Record<CuponAlcanceTipo, string> = {
  ORDEN: "Toda la orden",
  CATEGORIA: "Categoría",
  SUBCATEGORIA: "Subcategoría",
  PRODUCTO: "Producto",
  CLIENTE: "Cliente",
};
const ESTADO_LABEL: Record<NonNullable<Cupon["estado"]>, string> = {
  VIGENTE: "Vigente",
  PAUSADO: "En pausa",
  VENCIDO: "Vencido",
  AGOTADO: "Sin usos",
  PROGRAMADO: "Programado",
};

type OpcionAlcance = { ref: string; nombre: string; grupo?: string };

async function opcionesDeAlcance(
  tipo: CuponAlcanceTipo,
): Promise<OpcionAlcance[]> {
  if (tipo === "CATEGORIA" || tipo === "SUBCATEGORIA") {
    const catalogo = await getCatalogoComercial();
    if (tipo === "CATEGORIA") {
      return catalogo.map((categoria) => ({
        ref: categoria.codigo,
        nombre: categoria.nombre,
      }));
    }
    return catalogo.flatMap((categoria) =>
      (categoria.subcategorias ?? []).map((subcategoria) => ({
        ref: subcategoria.codigo,
        nombre: subcategoria.nombre,
        grupo: categoria.nombre,
      })),
    );
  }
  if (tipo === "PRODUCTO") {
    const productos = await getProductos(true);
    return productos.map((producto) => ({
      ref: producto.id,
      nombre: producto.nombre,
    }));
  }
  if (tipo === "CLIENTE") {
    const todos: OpcionAlcance[] = [];
    let page = 1;
    let pages = 1;
    do {
      const response = await listClientes({ page, limit: 200 });
      todos.push(
        ...response.data.map((cliente) => ({
          ref: cliente.id,
          nombre: cliente.nombre,
        })),
      );
      pages = response.pages;
      page += 1;
    } while (page <= pages);
    return todos;
  }
  return [];
}

function valorLabel(cupon: Cupon, moneda: Moneda) {
  return cupon.tipo === "PORCENTAJE"
    ? `−${cupon.valor.toLocaleString("es-AR")}%`
    : `−${formatearMoneda(cupon.valor, moneda)}`;
}

function fechaCalendario(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function CuponesView({
  initial,
  puedeEditar,
  errorInicial,
}: {
  initial: CuponesListado;
  puedeEditar: boolean;
  errorInicial: string | null;
}) {
  const { moneda } = useConfigRegional();
  const { fechaHora } = useFecha();
  const [listado, setListado] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(errorInicial);
  const [cargando, setCargando] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [editor, setEditor] = React.useState<Cupon | "nuevo" | null>(null);
  const [aEliminar, setAEliminar] = React.useState<Cupon | null>(null);
  const [qr, setQr] = React.useState<{
    codigo: string;
    dataUrl: string;
  } | null>(null);
  const [historialId, setHistorialId] = React.useState<string | null>(null);
  const [historial, setHistorial] = React.useState<CuponHistorial | null>(null);
  const [historialError, setHistorialError] = React.useState<string | null>(
    null,
  );
  const [historialCargando, setHistorialCargando] = React.useState(false);

  const cargar = React.useCallback(
    async (pagina: number, texto: string, filtroEstado: string) => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await listarCupones({
          busqueda: texto.trim() || undefined,
          estado: (filtroEstado || undefined) as Cupon["estado"],
          skip: (pagina - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setListado(resultado);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar los cupones.",
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const recargar = React.useCallback(
    () => cargar(page, busqueda, estado),
    [busqueda, cargar, estado, page],
  );

  const primeraBusqueda = React.useRef(true);
  React.useEffect(() => {
    if (primeraBusqueda.current) {
      primeraBusqueda.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setPage(1);
      void cargar(1, busqueda, estado);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busqueda, estado, cargar]);

  const [qrs, setQrs] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    let activo = true;
    void (async () => {
      const { toDataURL } = await import("qrcode");
      const pares = await Promise.all(
        listado.items.map(async (cupon) => {
          try {
            return [
              cupon.id,
              await toDataURL(cupon.codigo, { margin: 0, width: 120 }),
            ] as const;
          } catch {
            return [cupon.id, ""] as const;
          }
        }),
      );
      if (activo)
        setQrs(Object.fromEntries(pares.filter(([, value]) => value)));
    })();
    return () => {
      activo = false;
    };
  }, [listado.items]);

  const abrirQr = async (cupon: Cupon) => {
    try {
      const { toDataURL } = await import("qrcode");
      setQr({
        codigo: cupon.codigo,
        dataUrl: await toDataURL(cupon.codigo, { margin: 2, width: 480 }),
      });
    } catch {
      toast.error("No se pudo generar el QR.");
    }
  };

  const abrirHistorial = async (cupon: Cupon) => {
    setHistorialId(cupon.id);
    setHistorial(null);
    setHistorialError(null);
    setHistorialCargando(true);
    try {
      setHistorial(await historialCupon(cupon.id));
    } catch (cause) {
      setHistorialError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el historial.",
      );
    } finally {
      setHistorialCargando(false);
    }
  };

  const toggleActivo = async (cupon: Cupon) => {
    try {
      await actualizarCupon(cupon.id, {
        version: cupon.version,
        activo: !cupon.activo,
      });
      toast.success(
        cupon.activo
          ? `${cupon.codigo} pausado.`
          : `${cupon.codigo} reactivado.`,
      );
      await recargar();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "No se pudo actualizar.",
      );
      await recargar();
    }
  };

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success(`Código ${codigo} copiado.`);
    } catch {
      toast.error("El navegador no dejó copiar. Seleccionalo a mano.");
    }
  };

  const scope = useDesignScope();
  const metricas = listado.metricas;
  return (
    <section {...scope} className={`${theme.theme} ${listPage.page} ${s.wrap}`}>
      <div className={s.inner}>
        <header className={listPage.header}>
          <div>
            <h1>Cupones</h1>
            <p className={listPage.subtitle}>
              Reglas de descuento con vigencia, alcance, reservas e historial
              trazable.
            </p>
          </div>
          {puedeEditar ? (
            <Button onPress={() => setEditor("nuevo")}>
              <PlusIcon size={16} aria-hidden />
              Nuevo cupón
            </Button>
          ) : null}
        </header>

        <div className={s.metricas} aria-label="Resumen de cupones">
          <ListMetric
            label="Vigentes"
            value={metricas.vigentes}
            icon={CircleCheckBigIcon}
            tone="brand"
            hint="Disponibles para aplicar"
          />
          <ListMetric
            label="Por vencer"
            value={metricas.porVencer}
            icon={TimerIcon}
            hint="Próximos a finalizar"
          />
          <ListMetric
            label="Agotados"
            value={metricas.agotados}
            icon={CircleOffIcon}
            hint="Sin usos disponibles"
          />
          <ListMetric
            label="Usos este mes"
            value={metricas.redencionesMes}
            icon={ScanLineIcon}
            hint="Canjes registrados"
          />
          <ListMetric
            label="Descontado este mes"
            value={formatearMoneda(metricas.descontadoMes, moneda)}
            icon={BadgeDollarSignIcon}
            hint="Descuentos aplicados"
          />
        </div>

        <Card className={s.filtros}>
          <SearchField
            aria-label="Buscar cupones"
            value={busqueda}
            onChange={setBusqueda}
            className={s.buscar}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar código, descripción o alcance…" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <SelectField
            aria-label="Estado de los cupones"
            value={estado}
            onChange={setEstado}
            options={[
              { value: "", label: "Todos los estados" },
              { value: "VIGENTE", label: "Vigentes" },
              { value: "PROGRAMADO", label: "Programados" },
              { value: "PAUSADO", label: "En pausa" },
              { value: "VENCIDO", label: "Vencidos" },
              { value: "AGOTADO", label: "Sin usos" },
            ]}
            className={s.estadoFiltro}
          />
          {estado ? (
            <Button variant="ghost" onPress={() => setEstado("")}>
              Limpiar estado
            </Button>
          ) : null}
          <span className={s.resultados} role="status">
            {listado.total} {listado.total === 1 ? "cupón" : "cupones"}
          </span>
        </Card>

        {error ? (
          <Card className={`${listPage.empty} ${s.vacio}`} role="alert">
            <TicketPercentIcon size={24} aria-hidden />
            <strong>No pudimos cargar los cupones</strong>
            <p>{error}</p>
            <Button variant="outline" onPress={() => void recargar()}>
              Reintentar
            </Button>
          </Card>
        ) : listado.items.length === 0 ? (
          <Card className={`${listPage.empty} ${s.vacio}`}>
            <TicketPercentIcon size={28} aria-hidden />
            <strong>
              {busqueda || estado
                ? "No hay coincidencias"
                : "Sin cupones todavía"}
            </strong>
            <p>
              {busqueda || estado
                ? "Probá con otra búsqueda o limpiá los filtros."
                : puedeEditar
                  ? "Creá el primero para una campaña, un cliente frecuente o un sorteo."
                  : "Cuando un supervisor cree cupones, van a aparecer acá."}
            </p>
          </Card>
        ) : (
          <>
            <div className={s.grid} aria-busy={cargando}>
              {listado.items.map((cupon) => {
                const agotado = cupon.estado === "AGOTADO";
                const anulado =
                  cupon.estado === "AGOTADO" || cupon.estado === "VENCIDO";
                const usoPct =
                  cupon.usoMax != null && cupon.usoMax > 0
                    ? Math.min(100, (cupon.usoCount / cupon.usoMax) * 100)
                    : 0;
                return (
                  <article
                    key={cupon.id}
                    className={`${s.tk}${anulado ? ` ${s.anulado}` : ""}`}
                  >
                    <div className={s.paper}>
                      <div className={s.body}>
                        <div className={s.top}>
                          <button
                            type="button"
                            className={s.codigo}
                            onClick={() => void copiarCodigo(cupon.codigo)}
                            title="Copiar código"
                          >
                            <span>{cupon.codigo}</span>
                            <CopyIcon />
                          </button>
                          <span className={s.spacer} />
                          <span
                            className={s.estado}
                            data-estado={cupon.estado ?? ""}
                          >
                            {cupon.estado ? ESTADO_LABEL[cupon.estado] : "—"}
                          </span>
                        </div>

                        <div className={s.valor}>
                          <b>{valorLabel(cupon, moneda)}</b>
                          <span>
                            {cupon.tipo === "PORCENTAJE"
                              ? "sobre el neto"
                              : "de descuento"}
                          </span>
                        </div>
                        {cupon.descripcion ? (
                          <div className={s.desc}>{cupon.descripcion}</div>
                        ) : null}

                        <span className={s.alcance}>
                          <TagIcon />
                          <span className={s.path}>
                            <b>{ALCANCE_LABEL[cupon.alcanceTipo]}</b>
                            {cupon.alcanceTipo !== "ORDEN"
                              ? ` · ${cupon.alcanceNombre ?? "—"}`
                              : ""}
                            {cupon.montoMinimo != null
                              ? ` · desde ${formatearMoneda(cupon.montoMinimo, moneda)}`
                              : ""}
                          </span>
                        </span>

                        <div className={s.ventana}>
                          <CalendarClockIcon />
                          <span>
                            {cupon.vigenciaDesde
                              ? fechaCalendario(cupon.vigenciaDesde)
                              : "Desde ahora"}
                            {" → "}
                            {cupon.vigenciaHasta
                              ? fechaCalendario(cupon.vigenciaHasta)
                              : "Sin vencimiento"}
                          </span>
                        </div>

                        <div className={s.meta}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => void abrirHistorial(cupon)}
                          >
                            <HistoryIcon data-icon="inline-start" />
                            Historial
                          </Button>
                          {puedeEditar ? (
                            <span className={s.acts}>
                              <Button
                                variant="ghost"
                                isIconOnly
                                onPress={() => setEditor(cupon)}
                                aria-label={`Editar ${cupon.codigo}`}
                              >
                                <Edit3Icon />
                              </Button>
                              {cupon.estado !== "VENCIDO" &&
                              cupon.estado !== "AGOTADO" ? (
                                <Button
                                  variant="ghost"
                                  isIconOnly
                                  onPress={() => void toggleActivo(cupon)}
                                  aria-label={
                                    cupon.activo ? "Pausar" : "Reactivar"
                                  }
                                >
                                  <PowerIcon />
                                </Button>
                              ) : null}
                              <Button
                                variant="danger-soft"
                                isIconOnly
                                onPress={() => setAEliminar(cupon)}
                                aria-label={`Eliminar ${cupon.codigo}`}
                              >
                                <Trash2Icon />
                              </Button>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className={s.stub}>
                        {qrs[cupon.id] ? (
                          <button
                            type="button"
                            className={s.qr}
                            onClick={() => void abrirQr(cupon)}
                            aria-label={`Ver QR de ${cupon.codigo}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrs[cupon.id]} alt="" />
                          </button>
                        ) : (
                          <span className={s.qrVacio} />
                        )}
                        <span className={s.usos}>
                          {cupon.usoMax == null
                            ? cupon.usoCount
                            : `${cupon.usoCount} / ${cupon.usoMax}`}
                        </span>
                        {cupon.usoMax != null ? (
                          <span
                            className={`${s.usoBarra}${agotado ? ` ${s.lleno}` : ""}`}
                          >
                            <i style={{ width: `${usoPct}%` }} />
                          </span>
                        ) : null}
                        <span className={s.cap}>
                          {cupon.usoMax == null ? "usos · libre" : "usos"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <CuponesPagination
              total={listado.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={(next) => {
                setPage(next);
                void cargar(next, busqueda, estado);
              }}
            />
          </>
        )}

        {editor ? (
          <CuponModal
            cupon={editor === "nuevo" ? null : editor}
            onClose={() => setEditor(null)}
            onGuardado={async (guardado, nuevo) => {
              setEditor(null);
              toast.success(
                nuevo
                  ? `Cupón ${guardado.codigo} creado.`
                  : `Cupón ${guardado.codigo} actualizado.`,
              );
              setPage(1);
              await cargar(1, busqueda, estado);
            }}
            onRecargar={recargar}
          />
        ) : null}

        <EliminarCuponDialog
          open={aEliminar != null}
          onOpenChange={(open) => {
            if (!open) setAEliminar(null);
          }}
          codigo={aEliminar?.codigo}
          onConfirmar={async () => {
            if (!aEliminar) return;
            await eliminarCupon(aEliminar.id);
            toast.success(`Cupón ${aEliminar.codigo} eliminado.`);
            setAEliminar(null);
            await recargar();
          }}
        />

        <FormDialog
          isOpen={qr != null}
          onOpenChange={(open) => !open && setQr(null)}
          title={`QR del cupón ${qr?.codigo ?? ""}`}
          description="El lector escribe el código plano; el QR puede imprimirse sin conexión."
        >
          <Modal.Body className={s.modalBody}>
            {qr ? (
              <div className={s.qrBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.dataUrl} alt={`QR ${qr.codigo}`} />
                <span className={s.codigoGrande}>{qr.codigo}</span>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer className={s.modalFooter}>
            {qr ? (
              <ActionLink
                href={qr.dataUrl}
                download={`cupon-${qr.codigo}.png`}
                variant="outline"
              >
                Descargar PNG
              </ActionLink>
            ) : null}
            <Button onPress={() => setQr(null)}>Listo</Button>
          </Modal.Footer>
        </FormDialog>

        <FormDialog
          isOpen={historialId != null}
          title={`Historial de ${historial?.cupon.codigo ?? "cupón"}`}
          description="Cambios administrativos, reservas, consumos y liberaciones."
          onOpenChange={(open) => {
            if (!open) {
              setHistorialId(null);
              setHistorial(null);
            }
          }}
        >
          <Modal.Body className={s.modalBody}>
            {historialCargando ? (
              <div
                className={s.cargandoHistorial}
                role="status"
                aria-label="Cargando historial"
              >
                <GdiSpinner size={32} />
              </div>
            ) : historialError ? (
              <p className={s.errorTexto} role="alert">
                {historialError}
              </p>
            ) : historial ? (
              <div className={s.historialColumnas}>
                <section>
                  <h3>Usos y reservas</h3>
                  {historial.redenciones.length === 0 ? (
                    <p className={s.muted}>
                      Todavía no tiene usos ni reservas.
                    </p>
                  ) : (
                    <ul className={s.timeline}>
                      {historial.redenciones.map((redencion) => (
                        <li key={redencion.id}>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={
                              redencion.estado === "LIBERADA"
                                ? "default"
                                : "success"
                            }
                            className={s.historialEstado}
                          >
                            {redencion.estado.toLocaleLowerCase("es-AR")}
                          </Chip>
                          <strong>
                            {formatearMoneda(redencion.montoAplicado, moneda)}
                          </strong>
                          <span>
                            {redencion.presupuesto?.numero ??
                              redencion.orden?.numero ??
                              "Operación directa"}
                            {` · ${fechaHora(redencion.fecha)}`}
                          </span>
                          {redencion.liberadaMotivo ? (
                            <small>{redencion.liberadaMotivo}</small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3>Cambios</h3>
                  <ul className={s.timeline}>
                    {historial.eventos.map((evento) => (
                      <li key={evento.id}>
                        <strong>{evento.descripcion}</strong>
                        <span>
                          {evento.actor} · {fechaHora(evento.fecha)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </Modal.Body>
        </FormDialog>
      </div>
    </section>
  );
}

/** Conserva la búsqueda por palabras y los grupos del selector anterior. */
function CuponAlcanceSelector({
  id,
  label,
  value,
  onChange,
  opciones,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  opciones: OpcionAlcance[];
  disabled: boolean;
  placeholder: string;
}) {
  const scope = useDesignScope();
  const grupos = agruparOpciones(
    opciones.map((opcion) => ({
      value: opcion.ref,
      label: opcion.nombre,
      grupo: opcion.grupo,
    })),
  );
  return (
    <Autocomplete
      aria-label={label}
      value={value || null}
      onChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      isDisabled={disabled}
      placeholder={placeholder}
      allowsEmptyCollection
      fullWidth
    >
      <Autocomplete.Trigger
        id={id}
        aria-label={label}
        className={`${focus.singleBorder} ${s.alcanceTrigger}`}
      >
        <Autocomplete.Value>
          {({ isPlaceholder, defaultChildren }) =>
            isPlaceholder
              ? defaultChildren
              : opciones.find((opcion) => opcion.ref === value)?.nombre
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover {...scope} className={theme.theme}>
        <Autocomplete.Filter
          filter={(text, query) =>
            normalizarBusqueda(query)
              .split(/\s+/)
              .every((term) => normalizarBusqueda(text).includes(term))
          }
        >
          {opciones.length >= 7 && (
            <SearchField
              aria-label={`Buscar ${label.toLocaleLowerCase("es-AR")}`}
              className={s.alcanceBuscar}
            >
              <SearchField.Group className={focus.singleBorder}>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar…" />
                <SearchField.ClearButton aria-label="Limpiar búsqueda" />
              </SearchField.Group>
            </SearchField>
          )}
          <ListBox
            renderEmptyState={() => (
              <p className={s.alcanceVacio}>Nada coincide con la búsqueda.</p>
            )}
          >
            {grupos.map((grupo, index) => (
              <ListBox.Section
                key={grupo.titulo ?? index}
                aria-label={grupo.titulo ?? label}
              >
                {grupo.titulo && (
                  <Header className={s.alcanceGrupo}>{grupo.titulo}</Header>
                )}
                {grupo.opciones.map((opcion) => (
                  <ListBox.Item
                    key={opcion.value}
                    id={opcion.value}
                    textValue={`${opcion.label} ${opcion.grupo ?? ""}`}
                  >
                    {opcion.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function CuponesPagination({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav className={listPage.pager} aria-label="Páginas de cupones">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{" "}
        {total}
      </span>
      <div className={s.pagerActions}>
        <Button
          variant="outline"
          isIconOnly
          isDisabled={page <= 1}
          onPress={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon size={16} />
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          isIconOnly
          isDisabled={page >= pages}
          onPress={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon size={16} />
        </Button>
      </div>
    </nav>
  );
}

function EliminarCuponDialog({
  open,
  onOpenChange,
  codigo,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo?: string;
  onConfirmar: () => Promise<void>;
}) {
  const [ejecutando, setEjecutando] = React.useState(false);
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable={!ejecutando}
      title={`Eliminar cupón${codigo ? ` ${codigo}` : ""}`}
      description="El código deja de existir. Los cupones con cualquier historial no pueden eliminarse."
    >
      <Modal.Body className={s.modalBody}>
        <p className={s.avisoEliminar}>
          Si ya se usó o reservó, pausalo para conservar la trazabilidad.
        </p>
      </Modal.Body>
      <Modal.Footer className={s.modalFooter}>
        <Button
          variant="outline"
          isDisabled={ejecutando}
          onPress={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          isDisabled={ejecutando}
          onPress={async () => {
            if (ejecutando) return;
            setEjecutando(true);
            try {
              await onConfirmar();
            } catch (cause) {
              toast.error(
                cause instanceof Error
                  ? cause.message
                  : "No se pudo eliminar el cupón.",
              );
            } finally {
              setEjecutando(false);
            }
          }}
        >
          {ejecutando ? "Eliminando…" : "Eliminar cupón"}
        </Button>
      </Modal.Footer>
    </FormDialog>
  );
}

function CuponModal({
  cupon,
  onClose,
  onGuardado,
  onRecargar,
}: {
  cupon: Cupon | null;
  onClose: () => void;
  onGuardado: (cupon: Cupon, esNuevo: boolean) => Promise<void>;
  onRecargar: () => Promise<void>;
}) {
  const editando = cupon != null;
  const prefijo = React.useId();
  const [codigo, setCodigo] = React.useState(cupon?.codigo ?? "");
  const [descripcion, setDescripcion] = React.useState(
    cupon?.descripcion ?? "",
  );
  const [tipo, setTipo] = React.useState<"PORCENTAJE" | "MONTO">(
    cupon?.tipo ?? "PORCENTAJE",
  );
  const [valor, setValor] = React.useState(String(cupon?.valor ?? 10));
  const [alcanceTipo, setAlcanceTipo] = React.useState<CuponAlcanceTipo>(
    cupon?.alcanceTipo ?? "ORDEN",
  );
  const [alcanceRef, setAlcanceRef] = React.useState(cupon?.alcanceRef ?? "");
  const [opciones, setOpciones] = React.useState<OpcionAlcance[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = React.useState(false);
  const [errorOpciones, setErrorOpciones] = React.useState<string | null>(null);
  const [montoMinimo, setMontoMinimo] = React.useState(
    cupon?.montoMinimo != null ? String(cupon.montoMinimo) : "",
  );
  const [vigenciaDesde, setVigenciaDesde] = React.useState(
    cupon?.vigenciaDesde ?? "",
  );
  const [vigenciaHasta, setVigenciaHasta] = React.useState(
    cupon?.vigenciaHasta ?? "",
  );
  const [usoMax, setUsoMax] = React.useState(
    cupon?.usoMax != null ? String(cupon.usoMax) : "",
  );
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    if (alcanceTipo === "ORDEN") {
      setOpciones([]);
      setErrorOpciones(null);
      return;
    }
    let activo = true;
    setCargandoOpciones(true);
    setErrorOpciones(null);
    opcionesDeAlcance(alcanceTipo)
      .then((lista) => {
        if (!activo) return;
        setOpciones(lista);
        setAlcanceRef((actual) =>
          lista.some((opcion) => opcion.ref === actual) ? actual : "",
        );
      })
      .catch((cause) => {
        if (!activo) return;
        setOpciones([]);
        setErrorOpciones(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar las opciones.",
        );
      })
      .finally(() => activo && setCargandoOpciones(false));
    return () => {
      activo = false;
    };
  }, [alcanceTipo]);

  const guardar = async () => {
    const numeroValor = Number(valor);
    if (!editando && !codigo.trim())
      return toast.error("Poné el código del cupón.");
    if (!(numeroValor > 0))
      return toast.error("El valor debe ser mayor que cero.");
    if (tipo === "PORCENTAJE" && numeroValor > 100) {
      return toast.error("El porcentaje no puede superar el 100%.");
    }
    if (alcanceTipo !== "ORDEN" && !alcanceRef) {
      return toast.error("Elegí a qué aplica el cupón.");
    }
    if (vigenciaDesde && vigenciaHasta && vigenciaDesde > vigenciaHasta) {
      return toast.error(
        "La fecha de inicio no puede ser posterior al vencimiento.",
      );
    }
    let confirmarUsoMaxMenor = false;
    if (editando && usoMax && Number(usoMax) < cupon.usoCount) {
      confirmarUsoMaxMenor = window.confirm(
        `El cupón ya registra ${cupon.usoCount} usos. ¿Querés guardar un límite de ${usoMax} y dejarlo agotado?`,
      );
      if (!confirmarUsoMaxMenor) return;
    }

    setGuardando(true);
    try {
      const comunes = {
        tipo,
        valor: numeroValor,
        alcanceTipo,
        alcanceRef: alcanceTipo === "ORDEN" ? undefined : alcanceRef,
      };
      const guardado = editando
        ? await actualizarCupon(cupon.id, {
            ...comunes,
            version: cupon.version,
            descripcion: descripcion.trim() || null,
            alcanceRef: alcanceTipo === "ORDEN" ? null : alcanceRef,
            montoMinimo: montoMinimo ? Number(montoMinimo) : null,
            vigenciaDesde: vigenciaDesde || null,
            vigenciaHasta: vigenciaHasta || null,
            usoMax: usoMax ? Number(usoMax) : null,
            confirmarUsoMaxMenor,
          })
        : await crearCupon({
            codigo: codigo.trim(),
            ...comunes,
            descripcion: descripcion.trim() || undefined,
            montoMinimo: montoMinimo ? Number(montoMinimo) : undefined,
            vigenciaDesde: vigenciaDesde || undefined,
            vigenciaHasta: vigenciaHasta || undefined,
            usoMax: usoMax ? Number(usoMax) : undefined,
          });
      await onGuardado(guardado, !editando);
    } catch (cause) {
      const mensaje =
        cause instanceof Error
          ? cause.message
          : `No se pudo ${editando ? "actualizar" : "crear"} el cupón.`;
      toast.error(mensaje);
      if (mensaje.includes("modificado por otra persona")) {
        onClose();
        await onRecargar();
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={editando ? `Editar ${codigo}` : "Nuevo cupón"}
      description="Configurá el descuento, a quién aplica y su vigencia."
    >
      <Modal.Body className={s.modalBody}>
        <FieldGroup className={s.formulario}>
          <div className={s.grid2}>
            <Field data-disabled={editando || undefined}>
              <FieldLabel htmlFor={`${prefijo}-codigo`}>Código</FieldLabel>
              <Input
                className={focus.singleBorder}
                id={`${prefijo}-codigo`}
                autoFocus={!editando}
                value={codigo}
                disabled={editando}
                maxLength={40}
                placeholder="SORTEO2026"
                onChange={(event) =>
                  setCodigo(event.target.value.toUpperCase())
                }
              />
              {editando ? (
                <FieldDescription>
                  No se cambia porque puede haber QRs impresos.
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-tipo`}>Tipo</FieldLabel>
              <SelectField
                id={`${prefijo}-tipo`}
                aria-label="Tipo de descuento"
                value={tipo}
                onChange={(value) => setTipo(value as "PORCENTAJE" | "MONTO")}
                options={[
                  { value: "PORCENTAJE", label: "Porcentaje (%)" },
                  { value: "MONTO", label: "Monto fijo" },
                ]}
              />
            </Field>
          </div>

          <div className={s.grid2}>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-valor`}>
                {tipo === "PORCENTAJE" ? "Porcentaje" : "Monto neto"}
              </FieldLabel>
              <Input
                className={focus.singleBorder}
                id={`${prefijo}-valor`}
                type="number"
                min="0.01"
                max={tipo === "PORCENTAJE" ? "100" : undefined}
                step="0.01"
                value={valor}
                onChange={(event) => setValor(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-usos`}>Usos máximos</FieldLabel>
              <Input
                className={focus.singleBorder}
                id={`${prefijo}-usos`}
                type="number"
                min="1"
                step="1"
                placeholder="Ilimitado"
                value={usoMax}
                onChange={(event) => setUsoMax(event.target.value)}
              />
              <FieldDescription>
                Dejalo vacío para no limitarlo.
              </FieldDescription>
            </Field>
          </div>

          <div className={s.grid2}>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-alcance`}>Alcance</FieldLabel>
              <SelectField
                id={`${prefijo}-alcance`}
                aria-label="Alcance"
                value={alcanceTipo}
                onChange={(value) => setAlcanceTipo(value as CuponAlcanceTipo)}
                options={Object.entries(ALCANCE_LABEL).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Field>
            {alcanceTipo !== "ORDEN" ? (
              <Field data-invalid={Boolean(errorOpciones) || undefined}>
                <FieldLabel htmlFor={`${prefijo}-referencia`}>
                  {ALCANCE_LABEL[alcanceTipo]}
                </FieldLabel>
                <CuponAlcanceSelector
                  id={`${prefijo}-referencia`}
                  label={ALCANCE_LABEL[alcanceTipo]}
                  value={alcanceRef}
                  onChange={setAlcanceRef}
                  opciones={opciones}
                  disabled={cargandoOpciones || Boolean(errorOpciones)}
                  placeholder={
                    cargandoOpciones ? "Cargando…" : "Elegí una opción"
                  }
                />
                {errorOpciones ? (
                  <FieldError>{errorOpciones}</FieldError>
                ) : null}
              </Field>
            ) : null}
          </div>

          <div className={s.grid2}>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-desde`}>
                Vigente desde
              </FieldLabel>
              <Input
                className={focus.singleBorder}
                id={`${prefijo}-desde`}
                type="date"
                value={vigenciaDesde}
                onChange={(event) => setVigenciaDesde(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${prefijo}-hasta`}>
                Vigente hasta
              </FieldLabel>
              <Input
                className={focus.singleBorder}
                id={`${prefijo}-hasta`}
                type="date"
                min={vigenciaDesde || undefined}
                value={vigenciaHasta}
                onChange={(event) => setVigenciaHasta(event.target.value)}
              />
              <FieldDescription>
                Incluye el día completo en la zona del negocio.
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor={`${prefijo}-minimo`}>
              Compra mínima neta
            </FieldLabel>
            <Input
              className={focus.singleBorder}
              id={`${prefijo}-minimo`}
              type="number"
              min="0"
              step="0.01"
              placeholder="Sin mínimo"
              value={montoMinimo}
              onChange={(event) => setMontoMinimo(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`${prefijo}-descripcion`}>
              Descripción
            </FieldLabel>
            <Textarea
              className={focus.singleBorder}
              id={`${prefijo}-descripcion`}
              rows={2}
              maxLength={300}
              placeholder="Campaña aniversario"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </Field>

          <div className={s.resumenRegla}>
            <strong>Vista previa de la regla</strong>
            <span>
              {tipo === "PORCENTAJE" ? `${valor || 0}%` : `$ ${valor || 0}`} ·{" "}
              {ALCANCE_LABEL[alcanceTipo]}
              {usoMax ? ` · hasta ${usoMax} usos` : " · usos ilimitados"}
            </span>
          </div>
        </FieldGroup>
      </Modal.Body>

      <Modal.Footer className={s.modalFooter}>
        <Button variant="outline" onPress={onClose}>
          Cancelar
        </Button>
        <Button isDisabled={guardando} onPress={() => void guardar()}>
          {guardando
            ? "Guardando…"
            : editando
              ? "Guardar cambios"
              : "Crear cupón"}
        </Button>
      </Modal.Footer>
    </FormDialog>
  );
}
