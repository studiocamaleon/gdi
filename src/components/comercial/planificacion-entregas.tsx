"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import * as React from "react";
import { ReprogramacionEntregas } from "./reprogramacion-entregas";
import {
  CalendarRangeIcon,
  Trash2Icon,
  RefreshCwIcon,
  CheckIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { apiRequest } from "@/lib/api";
import {
  regenerarEntregas,
  validarDistribucion,
  firmaEntregas,
  motivoBloqueoDistribucion,
  resumirDistribucion,
  nombreLoteEntrega,
  type ResumenDistribucion,
  type EntregaPlan,
  type VistaPlanEntrega,
} from "@/lib/planificacion-entregas";
import s from "./planificacion-entregas.module.css";
import type { EntregasPreviasProps } from "./use-entregas-previas";

const fecha = (v: string | null) =>
  v ? v.split("-").reverse().join("/") : "Sin estimación";
const estados: Record<string, string> = {
  VIABLE: "Fechas viables",
  SIN_MARGEN: "Sin margen",
  CONDICIONADA: "Requiere revisión",
  FUERA_DE_FECHA: "No cumple las fechas",
  SIN_ESTIMACION: "Faltan datos",
  DESPLAZA_TRABAJOS: "Afecta otros compromisos",
  SOLICITADA: "En espera",
  CALCULANDO: "Calculando",
  LISTA: "Calculada",
  FALLIDA: "No calculada",
  SUPERADA: "Reemplazada",
};

export function PlanificacionEntregas({
  itemId,
  nombre,
  cantidad,
  previa,
  distribucion,
  onGuardada,
  editable = true,
}: {
  itemId: string;
  nombre: string;
  cantidad: number;
  previa?: EntregasPreviasProps;
  distribucion?: ResumenDistribucion | null;
  onGuardada?: () => void;
  editable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!editable) setOpen(false);
  }, [editable]);
  const [vistaLocal, setVistaLocal] = React.useState<
    ResumenDistribucion | null | undefined
  >(undefined);
  React.useEffect(() => {
    setVistaLocal(undefined);
  }, [distribucion]);
  const puede = usePuede("comercial.gestionar");
  const resumen = previa
    ? previa.distribucion
    : vistaLocal !== undefined
      ? vistaLocal
      : distribucion;
  const finalizar = () => {
    setOpen(false);
    onGuardada?.();
  };
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) return null;
  return (
    <div className={s.previa}>
      {resumen?.entregas.length ? (
        <ResumenEntregas distribucion={resumen} />
      ) : null}
      {editable ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={s.trigger}
              />
            }
          >
            <CalendarRangeIcon />
            {resumen?.entregas.length || previa?.resumen
              ? "Editar distribución"
              : "Distribuir entregas"}
          </DialogTrigger>
          <DialogContent className={s.dialog}>
            <DialogHeader className={s.header}>
              <span className={s.eyebrow}>
                PRODUCCIÓN · PLANIFICACIÓN DE ENTREGAS
              </span>
              <DialogTitle className={s.title}>
                Un pedido, distintas entregas
              </DialogTitle>
              <DialogDescription>
                {nombre} · {cantidad.toLocaleString("es-AR")}{" "}
                {cantidad === 1 ? "unidad" : "unidades"}
              </DialogDescription>
            </DialogHeader>
            {open ? (
              previa ? (
                <EditorPrevio
                  previa={previa}
                  cantidad={cantidad}
                  puede={puede}
                  onGuardada={finalizar}
                />
              ) : (
                <EditorPlan
                  key={itemId}
                  path={`/ordenes-trabajo/items/${itemId}/planificacion-entregas`}
                  cantidad={cantidad}
                  puede={puede}
                  onGuardada={finalizar}
                  onEstado={(vista, entregas, editado) =>
                    setVistaLocal(
                      resumirDistribucion(vista.plan, entregas, editado),
                    )
                  }
                />
              )
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
      {previa?.resumen && !resumen?.elegida ? (
        <span className={s.previaResumen}>{previa.resumen}</span>
      ) : null}
    </div>
  );
}

function ResumenEntregas({
  distribucion,
}: {
  distribucion: ResumenDistribucion;
}) {
  const sugeridas = distribucion.entregas.some(
    (e) => !e.fechaSolicitada && e.fechaSugerida,
  );
  return (
    <>
      <div className={s.resumenScroll}>
        <table className={s.resumenTabla} aria-label="Distribución de entregas">
          <thead>
            <tr>
              <th>Entrega</th>
              <th>Unidades</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {distribucion.entregas.map((e, i) => (
              <tr key={e.clave}>
                <th scope="row">{nombreLoteEntrega(i)}</th>
                <td>{e.cantidad.toLocaleString("es-AR")}</td>
                <td>
                  {e.fechaSolicitada || e.fechaSugerida
                    ? fecha(e.fechaSolicitada || e.fechaSugerida)
                    : "A calcular"}
                  {!e.fechaSolicitada && e.fechaSugerida ? " *" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sugeridas ? (
        <span className={s.previaResumen}>
          * Fecha sugerida de la alternativa elegida.
        </span>
      ) : null}
    </>
  );
}

function EditorPrevio({
  previa,
  cantidad,
  puede,
  onGuardada,
}: {
  previa: EntregasPreviasProps;
  cantidad: number;
  puede: boolean;
  onGuardada: () => void;
}) {
  const preparar = React.useRef(previa.preparar);
  const [fuente, setFuente] = React.useState<{
    path: string;
    entregas?: EntregaPlan[];
    editadoInicial?: boolean;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [intento, setIntento] = React.useState(0);
  React.useEffect(() => {
    let vigente = true;
    void preparar
      .current()
      .then((p) => {
        if (vigente) setFuente(p);
      })
      .catch((e: unknown) => {
        if (vigente)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo preparar la distribución.",
          );
      });
    return () => {
      vigente = false;
    };
  }, [intento]);
  if (error)
    return (
      <div role="alert" className={s.body}>
        {error}{" "}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setIntento((i) => i + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  if (!fuente)
    return (
      <div className={s.body} role="status">
        <GdiSpinner className={s.loadingIcon} /> Preparando el producto para
        distribuir sus entregas…
      </div>
    );
  return (
    <EditorPlan
      path={fuente.path}
      cantidad={cantidad}
      puede={puede}
      iniciales={fuente.entregas}
      editadoInicial={fuente.editadoInicial}
      onEstado={previa.recibir}
      onGuardada={onGuardada}
      onEliminar={() => {
        previa.quitar();
        onGuardada();
      }}
      previa
    />
  );
}

export function EditorPlan({
  path,
  cantidad,
  puede,
  iniciales,
  editadoInicial = false,
  onEstado,
  previa = false,
  onGuardada,
  onEliminar,
}: {
  path: string;
  cantidad: number;
  puede: boolean;
  iniciales?: EntregaPlan[];
  editadoInicial?: boolean;
  onEstado?: EntregasPreviasProps["recibir"];
  previa?: boolean;
  onGuardada: () => void;
  onEliminar?: () => void;
}) {
  const { moneda, zonaHoraria } = useConfigRegional();
  const puedeReprogramar = usePuede("produccion.supervisar");
  const [seleccion, setSeleccion] = React.useState<{revision:string;id:string}|null>(null);
  const [exclusiones, setExclusiones] = React.useState<{revision:string;ids:string[]}|null>(null);
  const [aceptaCambio, setAceptaCambio] = React.useState<string|null>(null);
  const [vista, setVista] = React.useState<VistaPlanEntrega | null>(null);
  const [entregas, setEntregas] = React.useState<EntregaPlan[]>(
    () => iniciales ?? [],
  );
  const [numeroEntregas, setNumeroEntregas] = React.useState(() =>
    iniciales?.length ? String(iniciales.length) : "",
  );
  const cantidadEntregasId = React.useId();
  const limiteEntregas = Math.min(cantidad, 50);
  const numero = Number(numeroEntregas);
  const numeroValido =
    Number.isSafeInteger(numero) && numero >= 1 && numero <= limiteEntregas;
  const numeroPendiente = entregas.length > 0 && numero !== entregas.length;
  const [aceptacionRevision, setAceptacionRevision] = React.useState<
    string | null
  >(null);
  const ajusteId = React.useId();
  const motivoId = React.useId();
  const [cargando, setCargando] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [guardado, setGuardado] = React.useState(false);
  const mounted = React.useRef(true);
  const requestId = React.useRef(0);
  // Conserva la clave en un reintento de red de la misma solicitud.
  const intento = React.useRef<{ firma: string; key: string } | null>(null);
  const plan = vista?.plan;
  const calculando =
    plan?.estado === "SOLICITADA" || plan?.estado === "CALCULANDO";
  const invalid = validarDistribucion(cantidad, entregas);
  const editado =
    (!plan && editadoInicial) ||
    firmaEntregas(entregas) !== firmaEntregas(plan?.entregas ?? []);
  const estadoRef = React.useRef(onEstado);
  React.useEffect(() => {
    estadoRef.current = onEstado;
  });
  React.useEffect(() => {
    if (vista && !cargando)
      estadoRef.current?.(vista, entregas, editado, enviando, path);
  }, [vista, entregas, editado, cargando, enviando, path]);
  const seleccionId = seleccion && plan && seleccion.revision === plan.revisionId
    ? seleccion.id
    : plan?.alternativaElegidaId ?? "por-entrega";
  const alternativa = plan?.alternativas.find((a) => a.id === seleccionId);
  const excluidas = exclusiones && plan && exclusiones.revision === plan.revisionId
    ? exclusiones.ids
    : plan?.reprogramacion?.excluidas ?? [];
  const exclusionesEditadas = JSON.stringify([...excluidas].sort()) !== JSON.stringify([...(plan?.reprogramacion?.excluidas ?? [])].sort());
  const aceptaFechas = aceptaCambio === `${plan?.revisionId}:${seleccionId}` || (!!plan?.cambioEntregasAceptado && seleccionId === plan.alternativaElegidaId);
  const aceptaAjuste =
    aceptacionRevision === plan?.revisionId || !!plan?.ajusteNestingAceptado;
  const motivoBloqueo = alternativa?.reprogramacion && !puedeReprogramar ? "Necesitás permiso de supervisión para aplicar esta reprogramación." :
    exclusionesEditadas ? "Recalculá las opciones con los trabajos que dejaste habilitados." :
    alternativa?.reprogramacion?.entregasAfectadas.some(e=>e.cambiaEntrega) && !aceptaFechas ? "Aceptá los cambios de fecha indicados para poder aplicar esta opción." : motivoBloqueoDistribucion({
    calculando,
    editado: !!plan && editado,
    numeroPendiente,
    desactualizado: plan?.desactualizado,
    motivoDesactualizado: plan?.motivoDesactualizado,
    estado: alternativa?.estado,
    requiereAjuste: plan?.nesting?.estado === "REQUIERE_AJUSTE",
    aceptaAjuste,
  });
  const dinero = (v: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda.codigo,
      maximumFractionDigits: moneda.decimales,
    }).format(v);
  const recibir = React.useCallback(
    (v: VistaPlanEntrega, cargarFormulario: boolean) => {
      setVista(v);
      if (cargarFormulario && v.plan) {
        setEntregas(v.plan.entregas);
        setNumeroEntregas(String(v.plan.entregas.length));
      }
    },
    [],
  );
  React.useEffect(() => {
    mounted.current = true;
    let vigente = true;
    const controller = new AbortController();
    void apiRequest<VistaPlanEntrega>(path, { signal: controller.signal })
      .then((v) => {
        if (vigente) recibir(v, !iniciales);
      })
      .catch((e: unknown) => {
        if (vigente)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el plan.",
          );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
      mounted.current = false;
      controller.abort();
    };
  }, [path, recibir, iniciales]);
  React.useEffect(() => {
    if (!calculando) return;
    let activo = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      const id = requestId.current;
      try {
        const v = await apiRequest<VistaPlanEntrega>(path, {
          signal: controller.signal,
        });
        if (activo && id === requestId.current) recibir(v, false);
      } catch (e) {
        if (activo)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo actualizar el progreso.",
          );
      }
      if (activo) timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      activo = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [calculando, path, recibir]);

  async function solicitar() {
    if (invalid || enviando || !vista) return;
    requestId.current += 1;
    setEnviando(true);
    setError(null);
    setGuardado(false);
    estadoRef.current?.(vista, entregas, editado, true, path);
    const firma = `${plan?.version ?? 0}:${firmaEntregas(entregas)}`;
    if (intento.current?.firma !== firma)
      intento.current = { firma, key: crypto.randomUUID() };
    try {
      const v = await apiRequest<VistaPlanEntrega>(path, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: intento.current.key,
          expectedVersion: plan?.version ?? 0,
          entregas: entregas.map((e) => ({
            ...e,
            fechaSolicitada: e.fechaSolicitada || undefined,
          })),
        }),
      });
      estadoRef.current?.(v, v.plan?.entregas ?? entregas, false, false, path);
      if (mounted.current) {
        recibir(v, true);
        intento.current = null;
      }
    } catch (e) {
      estadoRef.current?.(vista, entregas, editado, false, path);
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo solicitar la planificación.",
        );
    } finally {
      if (mounted.current) setEnviando(false);
    }
  }
  async function buscarReprogramacion() {
    if (!plan || enviando || editado || numeroPendiente) return;
    setEnviando(true); setError(null);
    try {
      const v = await apiRequest<VistaPlanEntrega>(`${path}/reprogramar`, {method:"POST",body:JSON.stringify({
        expectedVersion:plan.version,revisionId:plan.revisionId,ordenesExcluidas:excluidas,
      })});
      if (mounted.current) { recibir(v,false); setSeleccion(null); setAceptaCambio(null); }
    } catch(e) { if(mounted.current) setError(e instanceof Error ? e.message : "No se pudieron calcular las opciones."); }
    finally { if(mounted.current) setEnviando(false); }
  }
  async function elegir() {
    if (!plan || !alternativa || !vista || motivoBloqueo || enviando) return;
    estadoRef.current?.(vista, entregas, editado, true, path);
    setEnviando(true);
    setError(null);
    try {
      const v = await apiRequest<VistaPlanEntrega>(`${path}/elegir`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: plan.version,
          revisionId: plan.revisionId,
          alternativaId: alternativa.id,
          aceptarAjusteNesting: aceptaAjuste,
          aceptarCambioEntregas: aceptaFechas,
        }),
      });
      estadoRef.current?.(v, entregas, editado, false, path);
      if (mounted.current) {
        recibir(v, false);
        setGuardado(true);
        onGuardada();
      }
    } catch (e) {
      estadoRef.current?.(vista, entregas, editado, false, path);
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo guardar la distribución.",
        );
    } finally {
      if (mounted.current) setEnviando(false);
    }
  }
  async function eliminar() {
    if (enviando || !puede) return;
    if (onEliminar) {
      onEliminar();
      return;
    }
    if (!vista) return;
    if (!plan) {
      estadoRef.current?.(vista, [], false, false, path);
      onGuardada();
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const v = await apiRequest<VistaPlanEntrega>(path, {
        method: "DELETE",
        body: JSON.stringify({
          planId: plan.id,
          expectedVersion: plan.version,
        }),
      });
      if (mounted.current) {
        estadoRef.current?.(v, [], false, false, path);
        onGuardada();
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo eliminar la distribución.",
        );
    } finally {
      if (mounted.current) setEnviando(false);
    }
  }
  function modificar(clave: string, cambio: Partial<EntregaPlan>) {
    setEntregas((all) =>
      all.map((e) => (e.clave === clave ? { ...e, ...cambio } : e)),
    );
    setGuardado(false);
  }
  function generar() {
    if (!numeroValido || !puede || cargando || enviando || calculando || !vista)
      return;
    setEntregas((actuales) => regenerarEntregas(cantidad, numero, actuales));
    setGuardado(false);
  }
  const bloqueado = !puede || cargando || enviando || calculando || !vista;
  return (
    <>
      <div className={s.body}>
        {error ? (
          <div role="alert" className={s.error}>
            {error}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  recibir(await apiRequest<VistaPlanEntrega>(path), true);
                  setError(null);
                } catch {
                  /* conserva el error y permite reintentar */
                }
              }}
            >
              Volver a cargar
            </Button>
          </div>
        ) : null}
        {cargando ? (
          <p role="status">
            <GdiSpinner className={s.loadingIcon} /> Cargando distribución…
          </p>
        ) : (
          <>
            <section className={s.section} aria-label="Entregas solicitadas">
              <div className={s.sectionHead}>
                <div>
                  <h3>¿Cuántas entregas necesitás?</h3>
                  <p>
                    Cada entrega se fabricará en una tanda propia. Ajustá las
                    unidades y fechas de cada una.
                  </p>
                </div>
              </div>
              <FieldGroup className={s.generation}>
                <div className={s.countRow}>
                  <Field
                    className={s.countField}
                    data-invalid={!!numeroEntregas && !numeroValido}
                    data-disabled={bloqueado}
                  >
                    <FieldLabel htmlFor={cantidadEntregasId}>
                      Cantidad de entregas
                    </FieldLabel>
                    <Input
                      id={cantidadEntregasId}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={limiteEntregas}
                      step={1}
                      value={numeroEntregas}
                      placeholder="Ingresá la cantidad"
                      disabled={bloqueado}
                      aria-invalid={!!numeroEntregas && !numeroValido}
                      onChange={(e) => {
                        setNumeroEntregas(e.target.value);
                        setGuardado(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!bloqueado && numeroValido) generar();
                        }
                      }}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={bloqueado || !numeroValido}
                    onClick={generar}
                  >
                    {entregas.length
                      ? "Redistribuir cantidades"
                      : "Generar entregas"}
                  </Button>
                </div>
                {!!numeroEntregas && !numeroValido ? (
                  <FieldError>
                    Ingresá entre 1 y {limiteEntregas} entregas.
                  </FieldError>
                ) : null}
                <p>
                  {numeroPendiente
                    ? "Aplicá la nueva cantidad con Redistribuir cantidades. Se conservan las fechas de las entregas que continúan."
                    : entregas.length
                      ? "Dejá una fecha vacía para que el sistema la sugiera. Podés ajustar las cantidades antes de calcular."
                      : `Las ${cantidad.toLocaleString("es-AR")} unidades se repartirán inicialmente en partes iguales.`}
                </p>
              </FieldGroup>
              {entregas.length > 0 ? (
                <>
                  <div className={s.requests}>
                    {entregas.map((e, i) => (
                      <div className={s.request} key={e.clave}>
                        <span className={s.ordinal}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <Label htmlFor={`cantidad-${e.clave}`}>
                            Unidades
                          </Label>
                          <Input
                            id={`cantidad-${e.clave}`}
                            type="number"
                            min={1}
                            max={cantidad}
                            step={1}
                            value={e.cantidad || ""}
                            disabled={bloqueado}
                            onChange={(v) =>
                              modificar(e.clave, {
                                cantidad: Number(v.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`fecha-${e.clave}`}>
                            Fecha solicitada{" "}
                            <span className={s.optional}>opcional</span>
                          </Label>
                          <Input
                            id={`fecha-${e.clave}`}
                            type="date"
                            value={e.fechaSolicitada ?? ""}
                            disabled={bloqueado}
                            onChange={(v) =>
                              modificar(e.clave, {
                                fechaSolicitada: v.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar entrega ${i + 1}`}
                          disabled={bloqueado || entregas.length === 1}
                          onClick={() => {
                            setEntregas((all) =>
                              all.filter((x) => x.clave !== e.clave),
                            );
                            setNumeroEntregas(String(entregas.length - 1));
                            setGuardado(false);
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className={s.formFooter}>
                    <span className={invalid ? s.invalid : s.total}>
                      {invalid ??
                        `${cantidad.toLocaleString("es-AR")} ${cantidad === 1 ? "unidad distribuida" : "unidades distribuidas"} en ${entregas.length} ${entregas.length === 1 ? "entrega" : "entregas"}`}
                    </span>
                    {puede ? (
                      <Button
                        type="button"
                        className={s.primary}
                        disabled={bloqueado || !!invalid || numeroPendiente}
                        onClick={() => void solicitar()}
                      >
                        <RefreshCwIcon />
                        {plan ? "Recalcular propuesta" : "Calcular propuesta"}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
            {calculando ? (
              <div role="status" className={s.notice}>
                <GdiSpinner className={s.loadingIcon} />
                <div>
                  <strong>
                    {plan?.estado === "SOLICITADA"
                      ? "Solicitud guardada. Esperando turno de cálculo…"
                      : `Calculando tiempos y materiales${plan?.cantidadCalculada ? ` para ${plan.cantidadCalculada} unidades` : ""}…`}
                  </strong>
                  <p>
                    Podés cerrar esta ventana y volver después. El nesting de
                    cada cantidad puede llevar varios minutos.
                  </p>
                </div>
              </div>
            ) : null}
            {plan?.error ? (
              <div role="alert" className={s.error}>
                {plan.error}
              </div>
            ) : null}
            {plan?.desactualizado || (plan && editado) ? (
              <div role="status" className={s.notice}>
                {editado
                  ? "Modificaste las entregas. Recalculá para comparar las nuevas fechas."
                  : plan?.motivoDesactualizado}
              </div>
            ) : null}
            {plan?.estado === "LISTA" && puedeReprogramar ? (
              <ReprogramacionEntregas plan={plan} seleccion={seleccionId}
                onSeleccion={id=>{setSeleccion({revision:plan.revisionId,id});setAceptaCambio(null);}}
                excluidas={excluidas} onExcluidas={ids=>setExclusiones({revision:plan.revisionId,ids})}
                buscar={()=>void buscarReprogramacion()} bloqueado={enviando || calculando || editado || numeroPendiente}
                acepta={aceptaFechas} onAcepta={v=>setAceptaCambio(v ? `${plan.revisionId}:${seleccionId}` : null)} zona={plan.zona ?? zonaHoraria}/>
            ) : null}
            {plan?.alternativas.length ? (
              <section
                className={s.section}
                aria-label="Fabricación por entrega"
              >
                <div className={s.sectionHead}>
                  <div>
                    <h3>Fabricación por entrega</h3>
                    <p>
                      {entregas.length} entregas · {entregas.length} tandas de
                      fabricación. El precio de venta de la OT se conserva.
                    </p>
                  </div>
                  <span className={s.revision}>Revisión {plan.revision}</span>
                </div>
                {alternativa ? (
                  <div className={s.result}>
                    <div className={s.planSummary}>
                      <strong>
                        {estados[alternativa.estado] ?? alternativa.estado}
                      </strong>
                      <span>
                        {typeof alternativa.costoAdicional === "number"
                          ? alternativa.costoAdicional > 0
                            ? `${dinero(alternativa.costoAdicional)} adicionales frente a fabricar todo junto`
                            : alternativa.costoAdicional < 0
                              ? `${dinero(-alternativa.costoAdicional)} menos que fabricar todo junto`
                              : "Sin costo adicional frente a fabricar todo junto"
                          : "Costo adicional pendiente de estimar"}
                      </span>
                    </div>
                    {alternativa.esperaCola ? (
                      <Alert>
                        <AlertTitle>
                          Se respeta el trabajo ya previsto
                        </AlertTitle>
                        <AlertDescription>
                          Las fechas se calcularon esperando a que se liberen
                          los recursos ocupados por otras órdenes.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {plan.nesting && plan.nesting.estado !== "SIN_NESTING" ? (
                      <Alert className={s.nestingNotice}>
                        <AlertTitle>
                          {plan.nesting.estado === "CONSERVADO"
                            ? "Se conservan los layouts originales"
                            : "Revisá el ajuste del nesting"}
                        </AlertTitle>
                        <AlertDescription>
                          <p>{plan.nesting.motivo}</p>
                          <p>
                            {plan.nesting.placasOriginales === null
                              ? "Sustratos originales sin verificar"
                              : `${plan.nesting.placasOriginales} pliegos / placas en el nesting original`}{" "}
                            · {plan.nesting.placasPlan} pliegos / placas entre todas las
                            tandas.
                          </p>
                          {plan.nesting.estado === "REQUIERE_AJUSTE" ? (
                            <Field
                              orientation="horizontal"
                              className={s.acceptance}
                            >
                              <Checkbox
                                id={ajusteId}
                                checked={aceptaAjuste}
                                disabled={
                                  enviando || !!plan.ajusteNestingAceptado
                                }
                                onCheckedChange={(checked) =>
                                  setAceptacionRevision(
                                    checked ? plan.revisionId : null,
                                  )
                                }
                              />
                              <FieldLabel htmlFor={ajusteId}>
                                Acepto ajustar los layouts para fabricar por
                                entrega, con el costo adicional indicado.
                              </FieldLabel>
                            </Field>
                          ) : null}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {alternativa.condiciones.length > 0 ? (
                      <div className={s.notice}>
                        <strong>
                          Fechas orientativas: hay datos por revisar
                        </strong>
                        <ul>
                          {alternativa.condiciones.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className={s.metrics}>
                      <span>
                        {alternativa.lotes.length} operaciones en{" "}
                        {entregas.length} tandas
                      </span>
                      {alternativa.placas !== null ? (
                        <span>{alternativa.placas} pliegos / placas</span>
                      ) : null}
                      <span>
                        {Math.round(alternativa.preparacionMin)} min de
                        preparación
                      </span>
                      {typeof alternativa.costo === "number" ? (
                        <strong>
                          Costo productivo {dinero(alternativa.costo)}
                        </strong>
                      ) : null}
                    </div>
                    <div className={s.tableScroll}>
                      <table className={s.table}>
                        <thead>
                          <tr>
                            <th>Entrega</th>
                            <th>Unidades</th>
                            <th>Solicitada</th>
                            <th>Sugerida con margen</th>
                            <th>Evaluación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alternativa.entregas.map((e, i) => (
                            <tr key={e.id}>
                              <td>{nombreLoteEntrega(i)}</td>
                              <td>{e.cantidad}</td>
                              <td>
                                {e.fechaSolicitada
                                  ? fecha(e.fechaSolicitada)
                                  : "A sugerir"}
                              </td>
                              <td>{fecha(e.fechaSugerida)}</td>
                              <td>
                                {e.cumple === false
                                  ? "Fuera de fecha"
                                  : alternativa.condiciones.length > 0
                                    ? "Por validar"
                                    : !e.fechaSugerida
                                      ? "Sin estimación"
                                      : !e.fechaSolicitada
                                        ? "Propuesta"
                                        : e.cumpleConMargen
                                          ? "Cumple"
                                          : e.cumple
                                            ? "Sin margen"
                                            : "Fuera de fecha"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <details
                      className={s.details}
                      hidden={!plan.nesting?.lotes.length}
                    >
                      <summary>Ver acomodos por tanda</summary>
                      <div className={s.tableScroll}>
                        <table className={s.table}>
                          <thead>
                            <tr>
                              <th>Tanda</th>
                              <th>Operación</th>
                              <th>Unidades</th>
                              <th>Pliegos / placas</th>
                              <th>Acomodo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.nesting?.lotes.map((l) => {
                              const indiceEntrega = entregas.findIndex(
                                (_, i) =>
                                  entregas
                                    .slice(0, i)
                                    .reduce((s, e) => s + e.cantidad, 0) ===
                                  l.desde,
                              );
                              const huellas = Array.from(
                                new Set(
                                  plan
                                    .nesting!.lotes.filter(
                                      (p) => p.operacion === l.operacion,
                                    )
                                    .flatMap((p) =>
                                      p.layouts.map((x) => x.huella),
                                    ),
                                ),
                              );
                              return (
                                <tr key={l.loteId}>
                                  <td>
                                    {nombreLoteEntrega(
                                      indiceEntrega >= 0 ? indiceEntrega : 0,
                                    )}
                                  </td>
                                  <td>
                                    {
                                      alternativa.lotes.find(
                                        (o) => o.id === l.loteId,
                                      )?.nombre
                                    }
                                  </td>
                                  <td>{l.cantidad}</td>
                                  <td>{l.placas || "—"}</td>
                                  <td className={s.layoutCopies}>
                                    {l.modo === "LOTE_COMPLETO" ? "Completo del lote" : l.layouts.map((x) => (
                                      <span key={x.huella}>
                                        {nombreLoteEntrega(
                                          huellas.indexOf(x.huella),
                                        ).replace("Lote", "Layout")}{" "}
                                        ×{x.copias}
                                      </span>
                                    ))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    <details className={s.details}>
                      <summary>Ver cómo se repartiría la producción</summary>
                      <div className={s.tableScroll}>
                        <table className={s.table}>
                          <thead>
                            <tr>
                              <th>Operación</th>
                              <th>Unidades del pedido</th>
                              <th>Piezas</th>
                              <th>Tiempo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alternativa.lotes.map((l) => (
                              <tr key={l.id}>
                                <td>{l.nombre}</td>
                                <td>
                                  {l.desde + 1}–{l.hasta} · {l.cantidad} u.
                                </td>
                                <td>{l.piezas}</td>
                                <td>
                                  {l.minutos === null
                                    ? "Sin estimar"
                                    : `${Math.round(l.minutos)} min`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                ) : null}
              </section>
            ) : null}
            {plan?.calculadaEl ? (
              <p className={s.caption}>
                Calculado el{" "}
                {new Intl.DateTimeFormat("es-AR", {
                  timeZone: plan.zona ?? zonaHoraria,
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(plan.calculadaEl))}{" "}
                · Margen de entrega: {plan.margenDiasHabiles} días hábiles.
              </p>
            ) : null}
            {plan && plan.historial.length > 1 ? (
              <details className={s.details}>
                <summary>Historial de revisiones</summary>
                <ul className={s.history}>
                  {plan.historial.map((r) => (
                    <li key={r.id}>
                      Revisión {r.numero} · {estados[r.estado] ?? r.estado} ·{" "}
                      {new Intl.DateTimeFormat("es-AR", {
                        timeZone: plan.zona ?? zonaHoraria,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(r.createdAt))}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>
      <div className={s.footer}>
        <div>
          <strong>
            {guardado ||
            (plan?.alternativaElegidaId &&
              plan.alternativaElegidaId === alternativa?.id) ? (
              <>
                <CheckIcon /> Distribución guardada
              </>
            ) : (
              "Propuesta de planificación"
            )}
          </strong>
          {puede && motivoBloqueo ? (
            <p id={motivoId} className={s.blockReason} role="status">
              {motivoBloqueo}
            </p>
          ) : null}
          <p>
            {alternativa?.reprogramacion
              ? previa ? "La reprogramación se aplicará al emitir la OT. Guardar un borrador no mueve otros trabajos." : "Se aplicarán los lotes y la agenda elegida con sus cambios de entrega aceptados."
              : previa
              ? "Al guardar la OT se crearán sus lotes, rutas y archivos. Las fechas son una proyección."
              : "Al guardar se aplicarán estos lotes a producción. Las fechas siguen sujetas a la carga del taller."}
          </p>
        </div>
        <div className={s.footerActions}>
          {puede && (plan || entregas.length > 0) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={s.eliminar}
              disabled={enviando}
              onClick={() => void eliminar()}
            >
              <Trash2Icon /> Eliminar distribución
            </Button>
          ) : null}
          {puede && alternativa ? (
            <Button
              type="button"
              className={s.primary}
              disabled={enviando || !!motivoBloqueo}
              aria-describedby={motivoBloqueo ? motivoId : undefined}
              onClick={() => void elegir()}
            >
              {alternativa.reprogramacion ? previa ? "Preparar esta reprogramación" : "Aplicar esta reprogramación" : "Guardar distribución"}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
