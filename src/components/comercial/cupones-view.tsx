"use client";

import * as React from "react";
import {
  CalendarClockIcon,
  CopyIcon,
  Edit3Icon,
  HistoryIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  TagIcon,
  TicketPercentIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { HumanSelect } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { SelectBuscable } from "@/components/ui/select-buscable";
import { TablePagination } from "@/components/ui/table-pagination";
import { Textarea } from "@/components/ui/textarea";
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
      nombre: `${producto.codigo} · ${producto.nombre}`,
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

function badgeDeEstado(estado: Cupon["estado"]) {
  if (estado === "VIGENTE") return "default" as const;
  if (estado === "VENCIDO" || estado === "AGOTADO")
    return "destructive" as const;
  return "secondary" as const;
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

  const metricas = listado.metricas;
  return (
    <section className={s.wrap}>
      <div className={s.inner}>
        <div className="page-head">
          <div className="title-block">
            <h1>Cupones</h1>
            <div className="sub">
              Reglas de descuento con vigencia, alcance, reservas e historial
              trazable.
            </div>
          </div>
          {puedeEditar ? (
            <Button onClick={() => setEditor("nuevo")}>
              <PlusIcon data-icon="inline-start" />
              Nuevo cupón
            </Button>
          ) : null}
        </div>

        <div className={s.metricas} aria-label="Resumen de cupones">
          <Metrica label="Vigentes" valor={metricas.vigentes} />
          <Metrica label="Por vencer" valor={metricas.porVencer} />
          <Metrica label="Agotados" valor={metricas.agotados} />
          <Metrica label="Usos este mes" valor={metricas.redencionesMes} />
          <Metrica
            label="Descontado este mes"
            valor={formatearMoneda(metricas.descontadoMes, moneda)}
          />
        </div>

        <div className={s.filtros}>
          <label className={s.buscar}>
            <span className="sr-only">Buscar cupones</span>
            <SearchIcon aria-hidden="true" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar código, descripción o alcance…"
            />
          </label>
          <HumanSelect
            value={estado}
            onValueChange={setEstado}
            placeholder="Todos los estados"
            options={[
              { value: "VIGENTE", label: "Vigentes" },
              { value: "PROGRAMADO", label: "Programados" },
              { value: "PAUSADO", label: "En pausa" },
              { value: "VENCIDO", label: "Vencidos" },
              { value: "AGOTADO", label: "Sin usos" },
            ]}
            triggerClassName={s.estadoFiltro}
          />
          {estado ? (
            <Button variant="ghost" onClick={() => setEstado("")}>
              Limpiar estado
            </Button>
          ) : null}
        </div>

        {error ? (
          <Empty className={s.errorCarga} role="alert">
            <EmptyHeader>
              <EmptyTitle>No pudimos cargar los cupones</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => void recargar()}>
                Reintentar
              </Button>
            </EmptyContent>
          </Empty>
        ) : listado.items.length === 0 ? (
          <Empty className={s.vacio}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TicketPercentIcon />
              </EmptyMedia>
              <EmptyTitle>
                {busqueda || estado
                  ? "No hay coincidencias"
                  : "Sin cupones todavía"}
              </EmptyTitle>
              <EmptyDescription>
                {busqueda || estado
                  ? "Probá con otra búsqueda o limpiá los filtros."
                  : puedeEditar
                    ? "Creá el primero para una campaña, un cliente frecuente o un sorteo."
                    : "Cuando un supervisor cree cupones, van a aparecer acá."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                          <Badge variant={badgeDeEstado(cupon.estado)}>
                            {cupon.estado ? ESTADO_LABEL[cupon.estado] : "—"}
                          </Badge>
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
                            onClick={() => void abrirHistorial(cupon)}
                          >
                            <HistoryIcon data-icon="inline-start" />
                            Historial
                          </Button>
                          {puedeEditar ? (
                            <span className={s.acts}>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditor(cupon)}
                                aria-label={`Editar ${cupon.codigo}`}
                              >
                                <Edit3Icon />
                              </Button>
                              {cupon.estado !== "VENCIDO" &&
                              cupon.estado !== "AGOTADO" ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => void toggleActivo(cupon)}
                                  aria-label={
                                    cupon.activo ? "Pausar" : "Reactivar"
                                  }
                                >
                                  <PowerIcon />
                                </Button>
                              ) : null}
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                onClick={() => setAEliminar(cupon)}
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
            <TablePagination
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

        <ConfirmacionDestructiva
          open={aEliminar != null}
          onOpenChange={(open) => {
            if (!open) setAEliminar(null);
          }}
          titulo="Eliminar cupón"
          descripcion="El código deja de existir. Los cupones con cualquier historial no pueden eliminarse."
          impacto={[
            "Si ya se usó o reservó, pausalo para conservar la trazabilidad.",
          ]}
          nombreItem={aEliminar?.codigo}
          requiereTipear={false}
          accionLabel="Eliminar cupón"
          onConfirmar={async () => {
            if (!aEliminar) return;
            await eliminarCupon(aEliminar.id);
            toast.success(`Cupón ${aEliminar.codigo} eliminado.`);
            setAEliminar(null);
            await recargar();
          }}
        />

        <Dialog open={qr != null} onOpenChange={(open) => !open && setQr(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>QR del cupón {qr?.codigo}</DialogTitle>
              <DialogDescription>
                El lector escribe el código plano; el QR puede imprimirse sin
                conexión.
              </DialogDescription>
            </DialogHeader>
            {qr ? (
              <div className={s.qrBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.dataUrl} alt={`QR ${qr.codigo}`} />
                <span className={s.codigoGrande}>{qr.codigo}</span>
              </div>
            ) : null}
            <DialogFooter>
              {qr ? (
                <a
                  href={qr.dataUrl}
                  download={`cupon-${qr.codigo}.png`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Descargar PNG
                </a>
              ) : null}
              <Button onClick={() => setQr(null)}>Listo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={historialId != null}
          onOpenChange={(open) => {
            if (!open) {
              setHistorialId(null);
              setHistorial(null);
            }
          }}
        >
          <DialogContent className={s.historialModal}>
            <DialogHeader>
              <DialogTitle>
                Historial de {historial?.cupon.codigo ?? "cupón"}
              </DialogTitle>
              <DialogDescription>
                Cambios administrativos, reservas, consumos y liberaciones.
              </DialogDescription>
            </DialogHeader>
            {historialCargando ? (
              <p className={s.muted}>Cargando historial…</p>
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
                          <Badge
                            variant={
                              redencion.estado === "LIBERADA"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {redencion.estado.toLocaleLowerCase("es-AR")}
                          </Badge>
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
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

function Metrica({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <article className={s.metrica}>
      <span>{label}</span>
      <strong>{valor}</strong>
    </article>
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={s.editorModal}>
        <DialogHeader>
          <DialogTitle>
            {editando ? `Editar ${codigo}` : "Nuevo cupón"}
          </DialogTitle>
          <DialogDescription>
            La API valida el alcance y calcula la distribución final del
            descuento.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className={s.formulario}>
          <div className={s.grid2}>
            <Field data-disabled={editando || undefined}>
              <FieldLabel htmlFor={`${prefijo}-codigo`}>Código</FieldLabel>
              <Input
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
              <HumanSelect
                id={`${prefijo}-tipo`}
                value={tipo}
                onValueChange={(value) =>
                  setTipo(value as "PORCENTAJE" | "MONTO")
                }
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
              <HumanSelect
                id={`${prefijo}-alcance`}
                value={alcanceTipo}
                onValueChange={(value) =>
                  setAlcanceTipo(value as CuponAlcanceTipo)
                }
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
                <SelectBuscable
                  value={alcanceRef}
                  onChange={setAlcanceRef}
                  opciones={opciones.map((opcion) => ({
                    value: opcion.ref,
                    label: opcion.nombre,
                    grupo: opcion.grupo ?? null,
                  }))}
                  disabled={cargandoOpciones || Boolean(errorOpciones)}
                  placeholder={
                    cargandoOpciones ? "Cargando…" : "Elegí una opción"
                  }
                  placeholderBusqueda="Buscar…"
                  vacio="Nada coincide con la búsqueda."
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={guardando} onClick={() => void guardar()}>
            {guardando
              ? "Guardando…"
              : editando
                ? "Guardar cambios"
                : "Crear cupón"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
