"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { resumenOperacionPlan } from "@/lib/planificacion-geometria";
import { leerModoOperacionMaquina } from "@/lib/demanda-humana";

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Factory, Info, Layers3, ListTree, Maximize2, Minimize2, RefreshCw, SlidersHorizontal, TriangleAlert, X, ZoomIn, ZoomOut } from "lucide-react";
import { Label, SearchField, Slider, Switch } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import { useDesignScope, useDesignTheme, useLegacyDesignScope } from "@/components/design-system/appearance";
import layout from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { construirEje } from "@/lib/eje-laboral";
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from "@/lib/zona";
import { abrirGruposRecorridoPlan, dependenciasPlan, entregaFinal, estadoEntregaPlan, etaConjuntoPlan, filtrarGruposPlan, filtrarRecorridoPlan, gruposPorOrdenes, gruposPorRecursos, hitosEntregasPlan, periodoCalendarioPlan, plazoEntregaPlan, rangoRecorridoPlan, type GrupoPlan, type OperacionPlan } from "@/lib/planificacion-vista";
import { fechaHoraEta } from "@/lib/eta-fechas";
import { etiquetaCalendario } from "@/lib/estaciones";
import { duracionPlan, fechaPlan, grupoAbierto, PlanificacionGantt, type PosicionCalendarioPlan } from "./planificacion-gantt";
import { type DatosPlanificacion, usePlanificacion } from "./use-planificacion";
import styles from "./planificacion-view.module.css";
import header from "./planificacion-header.module.css";

import { ReprogramacionSheet } from "./reprogramacion-sheet";

const NIVELES_ZOOM = [25, 50, 75, 100, 150, 200, 300, 400];

export function PlanificacionView(inicial: DatosPlanificacion & { puedeReprogramar?: boolean; puedeCambiarEntrega?: boolean }) {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const { className: legacyTheme, ...legacyScope } = useLegacyDesignScope();
  const { datos, operaciones, simulacion, ahora, zona, noLaborables, actualizar, actualizando, error, calculando, sinSimulacion } = usePlanificacion(inicial);
  const [modo, setModo] = useState<"recursos" | "ordenes">("recursos");
  const [consulta, setConsulta] = useState("");
  const [inicioPeriodo, setDesde] = useState(() => claveFechaEnZona(new Date(inicial.consultadoEl), zona));
  const [periodo, setPeriodo] = useState("7");
  const [zoom, setZoom] = useState(100);
  const zoomLabelId = useId();
  const [volverAlInicio, setVolverAlInicio] = useState(0);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [edicionFecha, setEdicionFecha] = useState<"produccion" | "entrega" | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [verPendientes, setVerPendientes] = useState(false);
  const [mostrarDependencias, setMostrarDependencias] = useState(true);
  const [focoRecorrido, setFocoRecorrido] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const ampliarRef = useRef<HTMLButtonElement>(null);
  const posicionCalendario = useRef<PosicionCalendarioPlan | null>(null);
  const leerPosicion = useCallback(() => posicionCalendario.current, []);
  const guardarPosicion = useCallback((posicion: PosicionCalendarioPlan) => { posicionCalendario.current = posicion; }, []);
  const tituloDetalle = useRef<HTMLHeadingElement>(null);
  const tituloEstado = useRef<HTMLHeadingElement>(null);
  const seleccion = operaciones.find((op) => op.id === seleccionId) ?? null;
  const modoMaquina = (op: OperacionPlan) => leerModoOperacionMaquina(datos.estaciones.flatMap(e => e.maquinas).find(m => m.id === op.paso.maquinaId)?.operacionMaquina);
  const operacionSeleccion = seleccion ? modoMaquina(seleccion) : null;
  const relacionadas = useMemo(() => dependenciasPlan(operaciones, seleccionId), [operaciones, seleccionId]);
  const rangoRecorrido = useMemo(() => rangoRecorridoPlan(operaciones, relacionadas, zona), [operaciones, relacionadas, zona]);
  const recorridoVisible = focoRecorrido && !!rangoRecorrido && !!seleccion;
  const hoy = claveFechaEnZona(ahora, zona);
  const { desde, hasta, inicio } = useMemo(() => periodoCalendarioPlan(
    recorridoVisible ? rangoRecorrido.desde : inicioPeriodo, Number(periodo), ahora, zona,
    recorridoVisible ? rangoRecorrido.hasta : undefined,
  ), [recorridoVisible, rangoRecorrido, inicioPeriodo, periodo, ahora, zona]);
  const hastaInstante = useMemo(() => instanteDe(hasta, "23:59", zona), [hasta, zona]);
  const eje = useMemo(() => construirEje({ estaciones: datos.estaciones, ahora: inicio, hasta: hastaInstante, noLaborables, zona }), [datos.estaciones, inicio, hastaInstante, noLaborables, zona]);
  const recursos = useMemo(() => gruposPorRecursos(operaciones, datos.estaciones), [operaciones, datos.estaciones]);
  const ordenes = useMemo(() => gruposPorOrdenes(operaciones, datos.initialItems), [operaciones, datos.initialItems]);
  const grupos = useMemo(() => {
    const filtrados = filtrarGruposPlan(modo === "recursos" ? recursos : ordenes, consulta);
    return recorridoVisible ? filtrarRecorridoPlan(filtrados, relacionadas) : filtrados;
  }, [modo, recursos, ordenes, consulta, recorridoVisible, relacionadas]);
  const estados = useMemo(() => new Map(datos.initialItems.map((item) => [item.id, estadoEntregaPlan(simulacion.porItem.get(item.id), item.fechaEntrega, zona)])), [datos.initialItems, simulacion, zona]);
  const plazos = useMemo(() => new Map(datos.initialItems.map(item => [item.id, plazoEntregaPlan(simulacion.porItem.get(item.id), item.fechaEntrega, ahora, zona)])), [datos.initialItems, simulacion, ahora, zona]);
  const itemsConTrabajoPendiente = useMemo(() => datos.initialItems.filter(item => item.sinRuta || item.pasos.some(paso => paso.estado !== "hecho")), [datos.initialItems]);
  const riesgo = useMemo(() => new Set(itemsConTrabajoPendiente.filter(item => {
    const plazo = plazos.get(item.id);
    return plazo?.vencida || plazo?.fueraDeFecha;
  }).map(item => item.id)), [itemsConTrabajoPendiente, plazos]);
  const idsOrdenesVencidas = new Set(itemsConTrabajoPendiente.filter(item => plazos.get(item.id)?.vencida).map(item => item.ordenId));
  const idsOrdenesEnRiesgo = new Set(datos.initialItems.filter((item) => riesgo.has(item.id) && !idsOrdenesVencidas.has(item.ordenId)).map((item) => item.ordenId));
  const ordenesEnRiesgo = idsOrdenesEnRiesgo.size;
  const ordenesVencidas = idsOrdenesVencidas.size;
  const ordenesPorRevisar = new Set(itemsConTrabajoPendiente.filter((item) => estados.get(item.id) === "revision" && !idsOrdenesEnRiesgo.has(item.ordenId) && !idsOrdenesVencidas.has(item.ordenId)).map((item) => item.ordenId)).size;
  const pendientes = operaciones.filter((op) => !op.agenda);
  const sinRuta = datos.initialItems.filter((item) => item.sinRuta);
  const visibles = useMemo(() => new Set(grupos.flatMap((grupo) => grupo.operaciones.map((op) => op.id))), [grupos]);
  const entregas = useMemo(() => hitosEntregasPlan(ordenes, visibles), [ordenes, visibles]);
  const programadas = operaciones.filter((op) => op.agenda).length;
  const numeroOrdenes = new Set(datos.initialItems.map((item) => item.ordenId)).size;
  const idsProducto = new Set(operaciones.filter((op) => seleccion && op.productoId === seleccion.productoId).map((op) => op.item.id));
  const itemsSeleccion = datos.initialItems.filter((item) => seleccion && (seleccion.item.loteEntrega ? item.loteEntrega?.id === seleccion.item.loteEntrega.id : idsProducto.has(item.id)));
  const etaSeleccion = etaConjuntoPlan(itemsSeleccion, simulacion);
  const entregaSeleccion = entregaFinal(itemsSeleccion);
  const estadoSeleccion = estadoEntregaPlan(etaSeleccion, entregaSeleccion, zona);
  const plazoSeleccion = plazoEntregaPlan(etaSeleccion, entregaSeleccion, ahora, zona);
  const itemsOrden = datos.initialItems.filter((item) => item.ordenId === seleccion?.item.ordenId);
  const etaOrden = etaConjuntoPlan(itemsOrden, simulacion);
  const entregaOrden = entregaFinal(itemsOrden);
  const plazoOrden = plazoEntregaPlan(etaOrden, entregaOrden, ahora, zona);
  const motivosRevisionSeleccion = [...new Set(operaciones.filter(op => itemsSeleccion.some(item => item.id === op.item.id) && (op.agenda?.parcial || !op.agenda)).map(op =>
    `${op.paso.nombre}: ${op.motivo ?? (op.paso.maquinaId && !modoMaquina(op) ? "falta configurar si la operación de máquina requiere operario." : op.agenda?.tramosOperacion?.some(tramo => tramo.tipo === "sin_verificar") ? "falta verificar el desglose de la operación." : "falta confirmar recurso, equipo o calendario.")}`))];
  const fechaHora = (fecha: Date | null | undefined) => fecha ? fechaHoraEta(fecha, { zona, ahora }) : "Sin estimación completa";
  const elegir = (op: OperacionPlan) => { setSeleccionId(op.id); setPanelAbierto(true); };
  const seleccionarEnGantt = (op: OperacionPlan) => {
    setSeleccionId(op.id);
    setPanelAbierto(false);
    setMostrarDependencias(true);
    if (modo === "ordenes") setAbiertos((actual) => ({ ...actual, ...abrirGruposRecorridoPlan(ordenes, dependenciasPlan(operaciones, op.id)) }));
  };
  const verRecorrido = () => {
    setFocoRecorrido(true);
    setConsulta("");
    setMostrarDependencias(true);
    setPanelAbierto(false);
    setAbiertos((actual) => ({ ...actual, ...abrirGruposRecorridoPlan(ordenes, relacionadas) }));
  };
  const cambiarPeriodo = (fecha: string) => { setFocoRecorrido(false); setDesde(fecha > hoy ? fecha : hoy); setVolverAlInicio((actual) => actual + 1); };
  const alternar = (grupo: GrupoPlan) => setAbiertos((actual) => ({ ...actual, [grupo.id]: !grupoAbierto(grupo, actual) }));
  const expandir = (expandido: boolean) => {
    const resultado: Record<string, boolean> = {};
    const recorrer = (grupos: GrupoPlan[]) => grupos.forEach((grupo) => { resultado[grupo.id] = expandido; recorrer(grupo.hijos); });
    recorrer(modo === "recursos" ? recursos : ordenes);
    setAbiertos(resultado);
  };
  const irATarea = () => {
    if (seleccion?.agenda) setDesde(claveFechaEnZona(seleccion.agenda.inicio, zona));
    setFocoRecorrido(false);
    setConsulta("");
    setAbiertos(abrirGruposRecorridoPlan(ordenes, relacionadas));
    setPanelAbierto(false);
  };

  if (sinSimulacion) return <section {...scope} data-visual="brand" className={`${legacyTheme ?? designTheme} ${layout.page} ${styles.page}`} aria-label="Planificación de producción" aria-busy={calculando}>
    <Alert variant={error ? 'destructive' : 'default'}>{calculando ? <GdiSpinner /> : <RefreshCw />}
      <AlertTitle>{error ? 'No se pudo calcular la planificación' : 'Calculando planificación'}</AlertTitle>
      <AlertDescription>{error ?? 'Estamos ubicando las operaciones y sus dependencias en el calendario.'}</AlertDescription>
    </Alert>
    {error && <ActionButton variant="outline" onPress={() => void actualizar()}>Volver a intentar</ActionButton>}
  </section>;

  const paneles = <>
    <Sheet open={panelAbierto && !!seleccion} onOpenChange={setPanelAbierto}>
      <SheetContent {...scope} {...legacyScope} className={`${legacyTheme ?? designTheme} ${styles.detailPanel}`} overlayClassName={`${designTheme} ${styles.detailOverlay}`} initialFocus={tituloDetalle}>
        {seleccion && <>
          <SheetHeader className={styles.detailHeader}>
            <div className={styles.detailBadges}><Badge variant="outline">{seleccion.item.ordenNumero}</Badge>{seleccion.item.loteEntrega && <Badge variant="secondary"><Layers3 />{seleccion.item.loteEntrega.nombre}</Badge>}</div>
            <SheetTitle ref={tituloDetalle} tabIndex={-1} className={styles.detailTitle}>{seleccion.paso.nombre}</SheetTitle>
            <SheetDescription>{seleccion.item.clienteNombre} · {seleccion.productoNombre}</SheetDescription>
          </SheetHeader>
          <div className={styles.detailBody} key={seleccion.id}>
            <div className={styles.detailSection}><h3>Trabajo</h3><dl className={styles.facts}>
              <dt>Componente / producto</dt><dd>{seleccion.item.nombre}</dd>
              <dt>Cantidad{seleccion.item.loteEntrega ? " del lote" : ""}</dt><dd>{seleccion.item.loteEntrega?.cantidad ?? seleccion.item.cantidad} {seleccion.item.loteEntrega?.unidad ?? seleccion.item.cantidadUnidad}</dd>
              <dt>Estación</dt><dd>{seleccion.estacionNombre}</dd><dt>Máquina</dt><dd>{seleccion.maquinaNombre ?? (seleccion.agenda?.tercerizado ? "Proveedor externo" : "Sin máquina asociada")}</dd>
              <dt>Duración cotizada</dt><dd>{duracionPlan(seleccion.paso.duracionEstimadaMin)}</dd>
              {seleccion.agenda?.enCurso && <><dt>Tiempo pendiente</dt><dd>{duracionPlan(seleccion.agenda.duracionMin)}</dd></>}
              {seleccion.agenda?.tercerizado && <><dt>Plazo del proveedor</dt><dd>{seleccion.agenda.plazoDias ?? "Sin definir"} días hábiles</dd></>}
            </dl><p className={styles.note}>La duración proviene de la cotización y se consulta sin modificarla.</p></div>
            <div className={styles.detailSection}><h3>Fechas de producción y entrega</h3><dl className={styles.facts}>
              <dt>Inicio de la operación</dt><dd>{fechaHora(seleccion.agenda?.inicio)}</dd>
              <dt>Fin de la operación</dt><dd>{fechaHora(seleccion.agenda?.fin)}</dd>
              <dt>Fin previsto{seleccion.item.loteEntrega ? " del lote" : " del producto"}</dt><dd>{fechaHora(etaSeleccion.finEstimado)}</dd>
              <dt>Entrega comprometida{seleccion.item.loteEntrega ? " del lote" : " del producto"}</dt><dd className={plazoSeleccion.vencida || plazoSeleccion.fueraDeFecha ? styles.fechaFueraDePlazo : undefined}>{fechaPlan(entregaSeleccion)}</dd>
              <dt>Fin previsto de la OT</dt><dd>{fechaHora(etaOrden.finEstimado)}</dd>
              <dt>Entrega final comprometida</dt><dd className={plazoOrden.vencida || plazoOrden.fueraDeFecha ? styles.fechaFueraDePlazo : undefined}>{fechaPlan(entregaOrden)}</dd>
            </dl>
              {(inicial.puedeReprogramar || inicial.puedeCambiarEntrega) && <div className={styles.selectionActions}>
                <ActionButton variant="outline" size="sm" onPress={() => { setPanelAbierto(false); setEdicionFecha(inicial.puedeCambiarEntrega ? "entrega" : "produccion"); }}><CalendarDays size={16} aria-hidden />Reprogramar</ActionButton>
              </div>}
              {plazoSeleccion.vencida ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>La fecha de entrega ya venció</AlertTitle><AlertDescription>El compromiso guardado es el {fechaPlan(entregaSeleccion)} y todavía hay producción pendiente.{etaSeleccion.finEstimado && ` Con la planificación actual, el fin productivo se estima para ${fechaHora(etaSeleccion.finEstimado)}.`}</AlertDescription></Alert> : plazoSeleccion.fueraDeFecha ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>La producción proyectada supera la entrega</AlertTitle><AlertDescription>El compromiso es el {fechaPlan(entregaSeleccion)}; el fin productivo se estima para {fechaHora(etaSeleccion.finEstimado)}.</AlertDescription></Alert> : entregaSeleccion && estadoSeleccion === "prevista" ? <p className={styles.note}>La producción proyectada termina dentro de la fecha comprometida.</p> : !entregaSeleccion ? <p className={styles.note}>Este producto todavía no tiene una fecha de entrega comprometida.</p> : null}
              {(plazoOrden.vencida && !plazoSeleccion.vencida || plazoOrden.fueraDeFecha && !plazoSeleccion.fueraDeFecha) && <Alert variant="destructive"><TriangleAlert /><AlertTitle>Revisá también la entrega final de la OT</AlertTitle><AlertDescription>La OT tiene una entrega comprometida para el {fechaPlan(entregaOrden)} y su fin productivo se estima para {fechaHora(etaOrden.finEstimado)}.</AlertDescription></Alert>}
              {estadoSeleccion === "revision" && <Alert><Info /><AlertTitle>Proyección orientativa</AlertTitle><AlertDescription>{motivosRevisionSeleccion.length ? motivosRevisionSeleccion.join(" ") : "Faltan datos o hay dependencias sin confirmar."} Esta estimación puede cambiar al completar esos datos.</AlertDescription></Alert>}
              <p className={styles.note}>El fin previsto se recalcula con el trabajo pendiente desde ahora. La entrega comprometida es la fecha guardada en la orden y se conserva hasta que se acuerde una reprogramación.</p>
            </div>
            <div className={styles.detailSection}><h3>Recurso y calendario</h3>{(() => {
              const estacion = datos.estaciones.find((estacion) => estacion.id === seleccion.estacionId);
              const equipo = estacion?.equipoProduccion;
              const fases = resumenOperacionPlan(seleccion.agenda?.tramosOperacion);
              const reservas = seleccion.agenda?.reservasHumanas ?? [];
              const minutosHumanos = reservas.reduce((sum, reserva) => sum + (reserva.fin - reserva.inicio) / 60_000 * reserva.personas, 0);
              return <><dl className={styles.facts}>{seleccion.paso.maquinaId && <><dt>Operación de máquina</dt><dd>{operacionSeleccion === "con_operario" ? "Con operario" : operacionSeleccion === "autonoma" ? "Autónoma" : "Sin configurar"}</dd></>}<dt>Calendario</dt><dd>{estacion ? etiquetaCalendario(estacion.calendario) ?? "Sin calendario propio; estimación orientativa" : "Sin estación configurada"}</dd><dt>{estacion?.planificacionPorEmpleados ? "Empleados de la estación" : "Equipo compartido"}</dt><dd>{estacion?.planificacionPorEmpleados ? `${estacion.empleados.length} personas · horarios individuales` : equipo ? `${equipo.nombre} · ${equipo.personas} personas` : "Sin configurar"}</dd>{reservas.length > 0 && <><dt>Atención, incluida separación</dt><dd>{duracionPlan(minutosHumanos)} · persona</dd></>}{fases.operario > 0 && <><dt>Trabajo de operario</dt><dd>{duracionPlan(fases.operario)}</dd></>}{fases.maquina_atendida > 0 && <><dt>Operación con operario</dt><dd>{duracionPlan(fases.maquina_atendida)}</dd></>}{fases.maquina > 0 && <><dt>Operación autónoma</dt><dd>{duracionPlan(fases.maquina)}</dd></>}{fases.sin_verificar > 0 && <><dt>Atención sin verificar</dt><dd>{duracionPlan(fases.sin_verificar)}</dd></>}</dl><p className={styles.note}>{fases.sin_verificar > 0 ? "El desglose no permite confirmar toda la atención: se reservan operarios de forma conservadora." : "Preparación, carga, recarga y cierre ocupan a los operarios. La operación autónoma permite atender otra máquina; la operación con operario mantiene a los operarios ocupados."}{seleccion.agenda?.faseEnCursoEstimada && " La fase actual se proyecta con el calendario y los tramos registrados."}</p>{seleccion.paso.maquinaId && <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/costos/maquinaria/${seleccion.paso.maquinaId}`} />}>Ver configuración de máquina<ArrowUpRight data-icon="inline-end" /></Button>}</>;
            })()}</div>
            <div className={styles.detailSection}><h3><ArrowDownRight />Depende de</h3>
              {seleccion.predecesores.length ? seleccion.predecesores.map((id) => {
                const op = operaciones.find((op) => op.id === id);
                const item = datos.initialItems.find((item) => item.pasos.some((paso) => paso.id === id));
                const paso = item?.pasos.find((paso) => paso.id === id);
                return op ? <ActionButton variant="outline" className={styles.dependencyButton} key={id} onPress={() => elegir(op)}><span>{op.paso.nombre}<small>{op.item.loteEntrega?.nombre ?? op.productoNombre}{op.item.loteEntrega?.id !== seleccion.item.loteEntrega?.id ? " · Dependencia compartida" : ""}</small></span><ChevronRight size={16} aria-hidden /></ActionButton> : <p className={styles.dependencyDone} key={id}>{paso?.nombre ?? "Dependencia fuera de esta consulta"}<Badge variant="secondary">{paso?.estado === "hecho" ? "Completada" : "Sin información"}</Badge></p>;
              }) : <p className={styles.note}>Sin pasos previos pendientes.</p>}
              <h3><ArrowUpRight />Habilita después</h3>
              {operaciones.filter((op) => op.predecesores.includes(seleccion.id)).length ? operaciones.filter((op) => op.predecesores.includes(seleccion.id)).map((op) => <ActionButton variant="outline" className={styles.dependencyButton} key={op.id} onPress={() => elegir(op)}><span>{op.paso.nombre}<small>{op.item.loteEntrega?.nombre ?? op.productoNombre}</small></span><ChevronRight size={16} aria-hidden /></ActionButton>) : <p className={styles.note}>No hay operaciones posteriores pendientes.</p>}
              {!!seleccion.paso.gatesOperativos?.some((gate) => gate.estado === "PENDIENTE") && <Alert><TriangleAlert /><AlertTitle>Requisitos pendientes</AlertTitle><AlertDescription>{seleccion.paso.gatesOperativos.filter((gate) => gate.estado === "PENDIENTE").map((gate) => gate.detalle ?? (gate.tipo === "MATERIAL" ? "Disponibilidad de material" : "Control de calidad")).join(" · ")}</AlertDescription></Alert>}
            </div>
          </div>
          <div className={styles.detailFooter}><ActionButton variant="outline" onPress={irATarea} isDisabled={!seleccion.agenda}><CalendarDays size={16} aria-hidden />Ubicar en calendario</ActionButton><Button nativeButton={false} render={<Link href={`/produccion/ordenes/${seleccion.item.ordenId}`} />}>Ver orden<ArrowUpRight data-icon="inline-end" /></Button></div>
        </>}
      </SheetContent>
    </Sheet>

    {edicionFecha && seleccion && <ReprogramacionSheet key={`${seleccion.id}-${edicionFecha}`} pasoId={seleccion.id} paso={seleccion.paso.nombre}
      trabajo={`${seleccion.item.ordenNumero} · ${seleccion.item.loteEntrega?.nombre ?? seleccion.productoNombre}`} zona={zona} inicio={seleccion.agenda?.inicio ?? null}
      entrega={entregaSeleccion} tipo={edicionFecha} puedeReprogramar={!!inicial.puedeReprogramar} puedeCambiarEntrega={!!inicial.puedeCambiarEntrega} onClose={() => { setEdicionFecha(null); setPanelAbierto(true); }}
      onSaved={() => { setEdicionFecha(null); setPanelAbierto(true); void actualizar(); }} />}

    <Sheet open={verPendientes} onOpenChange={setVerPendientes}><SheetContent {...scope} {...legacyScope} className={`${legacyTheme ?? designTheme} ${styles.detailPanel}`} overlayClassName={`${designTheme} ${styles.detailOverlay}`} initialFocus={tituloEstado}>
      <SheetHeader className={styles.detailHeader}><SheetTitle ref={tituloEstado} tabIndex={-1}>Estado de la planificación</SheetTitle><SheetDescription>Datos pendientes de las órdenes accesibles. Cambiar la vista o los filtros no los elimina del cálculo.</SheetDescription></SheetHeader>
      <div className={styles.detailBody}>
        {!pendientes.length && !sinRuta.length && <Alert><Clock3 /><AlertTitle>Todas las operaciones tienen una fecha proyectada</AlertTitle><AlertDescription>{[...estados.values()].includes("revision") ? "Hay estimaciones orientativas: revisá los equipos, calendarios y dependencias en el detalle de las tareas." : "Podés consultar sus recursos, lotes y dependencias en el calendario."}</AlertDescription></Alert>}
        {pendientes.map((op) => <div className={styles.pendingItem} key={op.id}><Badge variant="outline">{op.item.ordenNumero}{op.item.loteEntrega ? ` · ${op.item.loteEntrega.nombre}` : ""}</Badge><strong>{op.paso.nombre}</strong><p>{op.motivo}</p><ActionButton variant="outline" size="sm" onPress={() => { setVerPendientes(false); elegir(op); }}>Ver operación<ChevronRight size={16} aria-hidden /></ActionButton></div>)}
        {sinRuta.map((item) => <div className={styles.pendingItem} key={item.id}><Badge variant="outline">{item.ordenNumero}</Badge><strong>{item.nombre}</strong><p>Este ítem no tiene una ruta productiva en el tablero.</p></div>)}
      </div>
    </SheetContent></Sheet>
  </>;

  const contenido = <section {...scope} data-visual="brand" data-expanded={ampliada || undefined} className={`${legacyTheme ?? designTheme} ${layout.page} ${styles.page}`} aria-label="Planificación de producción" aria-busy={calculando}>


    {error && <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo completar la consulta</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {calculando && <Badge variant="secondary"><GdiSpinner />Actualizando fechas</Badge>}
    {(datos.initialPartialWarning || datos.initialMeta.alcance !== "completo") && <Alert><Info /><AlertDescription>{datos.initialPartialWarning ?? "Tu acceso muestra sólo parte del taller. Esta proyección puede omitir carga de otros trabajos y no confirma la capacidad total."}</AlertDescription></Alert>}

    <div className={header.compactSummary}>
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" className={header.summaryButton} />} aria-label="Ver resumen de la planificación">
          <span><strong>{numeroOrdenes}</strong> órdenes</span><span><strong>{operaciones.length}</strong> operaciones</span>
          <span title="Entregas para revisar" data-warning={ordenesVencidas + ordenesPorRevisar + ordenesEnRiesgo > 0}><TriangleAlert size={13} aria-hidden /><strong>{ordenesVencidas + ordenesPorRevisar + ordenesEnRiesgo}</strong><span>entregas<span className={header.summaryReview}> para revisar</span></span></span><ChevronDown size={14} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className={header.summaryPopover}>
          <PopoverTitle>Resumen de la planificación</PopoverTitle>
          <dl><dt>Órdenes en producción</dt><dd>{numeroOrdenes}</dd><dt>Operaciones con fecha</dt><dd>{programadas} de {operaciones.length}</dd><dt>Entregas vencidas</dt><dd>{ordenesVencidas}</dd><dt>Entregas en riesgo</dt><dd>{ordenesEnRiesgo}</dd><dt>Entregas por confirmar</dt><dd>{ordenesPorRevisar}</dd></dl>
          <p className={styles.note}>Indicadores sobre todas las órdenes accesibles.</p>
        </PopoverContent>
      </Popover>
    </div>
    <div {...scope} className={`${designTheme} ${header.stats}`}>
      <ListMetric label="Órdenes en producción" value={numeroOrdenes} hint="Órdenes de trabajo" icon={ListTree} />
      <ListMetric label="Operaciones con fecha" value={programadas} hint={`De ${operaciones.length} operaciones`} icon={CalendarDays} />
      <ListMetric label="Entregas para revisar" value={ordenesVencidas + ordenesPorRevisar + ordenesEnRiesgo} hint={`${ordenesVencidas} vencidas · ${ordenesEnRiesgo} en riesgo · ${ordenesPorRevisar} por confirmar`} icon={TriangleAlert} tone={ordenesVencidas + ordenesPorRevisar + ordenesEnRiesgo ? "danger" : "neutral"} />
    </div>

    <div className={styles.workbench}>
    <div {...scope} className={`${designTheme} ${header.viewControls}`}>
      <SegmentedControl tone="graphite" aria-label="Agrupar planificación" value={modo} options={[
        { value: "recursos", label: "Por recursos", icon: <Factory size={15} aria-hidden /> },
        { value: "ordenes", label: "Por órdenes", icon: <ListTree size={15} aria-hidden /> },
      ]} onChange={(valor) => { setModo(valor as "recursos" | "ordenes"); if (valor === "ordenes" && seleccionId) setAbiertos((actual) => ({ ...actual, ...abrirGruposRecorridoPlan(ordenes, relacionadas) })); }} />
      <ActionButton ref={ampliarRef} className={header.expandButton} variant="outline" aria-label={ampliada ? "Cerrar planificación ampliada" : "Ampliar planificación"} aria-haspopup={ampliada ? undefined : "dialog"} onPress={() => setAmpliada(!ampliada)}>
        {ampliada ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}<span>{ampliada ? "Cerrar ampliación" : "Ampliar"}</span>
      </ActionButton>
      <div className={header.periodControls}>
        <div className={header.periodNavigation} role="group" aria-label="Navegar por el calendario">
          <ActionButton isIconOnly variant="ghost" aria-label="Período anterior" isDisabled={desde <= hoy} onPress={() => cambiarPeriodo(sumarDiasAClave(desde, -Number(periodo)))}><ChevronLeft size={16} /></ActionButton>
          <span className={header.periodLabel} title={`${fechaPlan(eje.dias[0]?.fecha ?? desde)} — ${fechaPlan(hasta)}`}>{fechaPlan(eje.dias[0]?.fecha ?? desde).slice(0, 5)} — {fechaPlan(hasta).slice(0, 5)}<span className={header.periodYear}>{fechaPlan(hasta).slice(5)}</span></span>
          <ActionButton isIconOnly variant="ghost" aria-label="Período siguiente" onPress={() => cambiarPeriodo(sumarDiasAClave(desde, Number(periodo)))}><ChevronRight size={16} /></ActionButton>
        </div>
        <ActionButton variant="outline" onPress={() => { cambiarPeriodo(hoy); void actualizar(); }}>Ahora</ActionButton>
        <SelectField className={header.periodSelect} aria-label="Período del calendario" options={[{ value: "7", label: "Semana" }, { value: "14", label: "2 semanas" }, { value: "recorrido", label: "Recorrido", disabled: !rangoRecorrido }]} value={recorridoVisible ? "recorrido" : periodo} onChange={(valor) => { if (valor === "recorrido") verRecorrido(); else if (valor) { setFocoRecorrido(false); setPeriodo(valor); } }} />
      </div>
    </div>

    <div key={modo} className={styles.ganttCard} role="region" aria-label={`Calendario por ${modo === "recursos" ? "recursos" : "órdenes"}`}>
      <div {...scope} className={`${designTheme} ${header.toolbar}`}>
        <SearchField className={header.search} value={consulta} onChange={(valor) => { setFocoRecorrido(false); setConsulta(valor); }} aria-label="Buscar en planificación">
          <SearchField.Group className={`${layout.searchGroup} ${focus.singleBorder}`}>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar OT, cliente, lote o tarea…" />
          </SearchField.Group>
        </SearchField>
        <div className={header.toolbarActions}>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />} aria-label="Opciones de vista"><SlidersHorizontal size={15} aria-hidden /><span className={header.optionsLabel}>Opciones de vista</span></PopoverTrigger>
            <PopoverContent align="end" className={`${designTheme} ${header.optionsPopover}`}>
              <PopoverTitle>Opciones de vista</PopoverTitle>
              <Switch size="sm" isSelected={mostrarDependencias} onChange={setMostrarDependencias}>
                <Switch.Content className={header.switchLabel}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  <Label>Dependencias</Label>
                </Switch.Content>
              </Switch>
              <div className={header.zoomControls} role="group" aria-label="Zoom horizontal" onKeyDownCapture={(event) => {
                if (!(event.target instanceof HTMLInputElement) || (event.key !== "PageUp" && event.key !== "PageDown")) return;
                event.preventDefault();
                event.stopPropagation();
                const salto = event.key === "PageUp" ? 25 : -25;
                setZoom(actual => Math.min(400, Math.max(25, actual + salto)));
              }}>
                <span id={zoomLabelId}>Zoom<span className="sr-only"> horizontal, porcentaje</span></span>
                <ActionButton variant="ghost" isIconOnly aria-label="Reducir zoom horizontal" title="Reducir zoom horizontal" isDisabled={zoom <= 25} onPress={() => setZoom(NIVELES_ZOOM.filter(nivel => nivel < zoom).at(-1) ?? 25)}><ZoomOut size={16} /></ActionButton>
                <Slider className={header.zoomSlider} aria-labelledby={zoomLabelId} minValue={25} maxValue={400} step={5} value={zoom} onChange={valor => setZoom(typeof valor === "number" ? valor : valor[0] ?? 100)}>
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb aria-label="Zoom horizontal, porcentaje" />
                  </Slider.Track>
                </Slider>
                <ActionButton variant="ghost" isIconOnly aria-label="Aumentar zoom horizontal" title="Aumentar zoom horizontal" isDisabled={zoom >= 400} onPress={() => setZoom(NIVELES_ZOOM.find(nivel => nivel > zoom) ?? 400)}><ZoomIn size={16} /></ActionButton>
                <output className={header.zoomValue} aria-label="Zoom actual">{zoom}%</output>
              </div>
              <div className={header.rowActions} role="group" aria-label="Desplegar o plegar filas">
                <ActionButton variant="outline" onPress={() => expandir(true)}>Desplegar filas</ActionButton>
                <ActionButton variant="outline" onPress={() => expandir(false)}>Plegar filas</ActionButton>
              </div>
            </PopoverContent>
          </Popover>
          {seleccionId && <ActionButton variant="ghost" isIconOnly onPress={() => { setSeleccionId(null); setPanelAbierto(false); setFocoRecorrido(false); }} aria-label="Limpiar selección"><X size={16} /></ActionButton>}
          <ActionButton variant="outline" isIconOnly onPress={() => void actualizar()} isDisabled={actualizando} aria-label="Actualizar planificación" title={actualizando ? "Actualizando planificación" : "Actualizar planificación"}>{actualizando ? <GdiSpinner /> : <RefreshCw size={16} />}</ActionButton>
        </div>
      </div>
      <PlanificacionGantt leerPosicion={leerPosicion} guardarPosicion={guardarPosicion} grupos={grupos} entregas={entregas} modo={modo} eje={eje} desde={desde} hasta={hasta} zona={zona} ahora={ahora} zoom={zoom} volverAlInicio={volverAlInicio} abiertos={abiertos} alternar={alternar} seleccionId={seleccionId} relacionadas={relacionadas} mostrarDependencias={mostrarDependencias} seleccionar={seleccionarEnGantt} riesgo={riesgo} />
      <div className={styles.legend}>
        <div className={styles.calendarHelp}>
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" />}><Info size={14} aria-hidden />Referencias</PopoverTrigger>
            <PopoverContent align="start" side="top" className={styles.referencesPopover}>
              <PopoverTitle>Cómo leer la planificación</PopoverTitle>
              <div className={styles.legendItems}><span><i className={styles.legendOperator} />Operario</span><span><i className={styles.legendMachine} />Operación autónoma</span><span><i className={styles.legendWait} />Espera / fuera de horario</span><span><i className={styles.legendSelected} />Selección</span><span><i className={styles.legendRelated} />Relacionada</span><span><i className={styles.legendPartial} />Orientativa</span><span><i className={styles.legendDiamond} />Entrega</span></div>
              <p className={styles.note}>Calendario laboral · {zona.replaceAll("_", " ")}. Desplazá horizontalmente para recorrer los días.</p>
              <p className={styles.note}>Consulta: {fechaHora(ahora)}. Seleccioná una tarea para ver sus dependencias y reprogramarla.</p>
            </PopoverContent>
          </Popover>
          <ActionButton variant={pendientes.length || sinRuta.length ? "outline" : "ghost"} size="sm" onPress={() => setVerPendientes(true)} aria-label="Estado de la planificación"><Info size={14} aria-hidden />{pendientes.length + sinRuta.length ? `${pendientes.length + sinRuta.length} sin planificar` : "Estado"}</ActionButton>
        </div>
        {seleccion ? <div className={styles.selectionActions}>
          <span className={styles.selectionText} title={`${seleccion.item.ordenNumero} · ${seleccion.item.loteEntrega?.nombre ?? seleccion.productoNombre} · ${seleccion.paso.nombre}`}>{seleccion.item.ordenNumero}{seleccion.item.loteEntrega ? ` · ${seleccion.item.loteEntrega.nombre}` : ""} · {seleccion.paso.nombre}</span>
          <ActionButton variant="ghost" size="sm" onPress={verRecorrido} isDisabled={!rangoRecorrido}>Ver recorrido</ActionButton>
          <ActionButton variant="outline" size="sm" onPress={() => setPanelAbierto(true)}>Ver detalle</ActionButton>
        </div> : <span className={styles.operationCount}>{consulta ? `${visibles.size} de ${operaciones.length} operaciones` : `${operaciones.length} operaciones`}</span>}
      </div>
    </div>
    </div>

    {paneles}
  </section>;

  return <>
    {!ampliada && <><h1 className="sr-only">Planificación de producción</h1>{contenido}</>}
    <Dialog open={ampliada} onOpenChange={(abierta, evento) => {
      if (!abierta && (panelAbierto || edicionFecha || verPendientes)) { evento.cancel(); return; }
      setAmpliada(abierta);
    }}>
      <DialogContent {...scope} {...legacyScope} className={`${legacyTheme ?? designTheme} ${styles.expandedDialog}`} showCloseButton={false} finalFocus={ampliarRef}>
        <DialogTitle className="sr-only">Planificación ampliada</DialogTitle>
        <DialogDescription className="sr-only">Calendario de producción a pantalla completa. Conserva los filtros, la selección y las fechas. Cerrá la ampliación para volver a la vista anterior.</DialogDescription>
        {ampliada && contenido}
      </DialogContent>
    </Dialog>
  </>;
}
