"use client";

import { resumenOperacionPlan } from "@/lib/planificacion-geometria";
import { leerModoOperacionMaquina } from "@/lib/demanda-humana";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Factory, Info, Layers3, ListTree, RefreshCw, Search, TriangleAlert, X, ZoomIn, ZoomOut } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { construirEje } from "@/lib/eje-laboral";
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from "@/lib/zona";
import { abrirGruposRecorridoPlan, dependenciasPlan, entregaFinal, estadoEntregaPlan, etaConjuntoPlan, filtrarGruposPlan, filtrarRecorridoPlan, gruposPorOrdenes, gruposPorRecursos, hitosEntregasPlan, periodoCalendarioPlan, plazoEntregaPlan, rangoRecorridoPlan, type GrupoPlan, type OperacionPlan } from "@/lib/planificacion-vista";
import { fechaHoraEta } from "@/lib/eta-fechas";
import { etiquetaCalendario } from "@/lib/estaciones";
import { duracionPlan, fechaPlan, grupoAbierto, PlanificacionGantt } from "./planificacion-gantt";
import { type DatosPlanificacion, usePlanificacion } from "./use-planificacion";
import styles from "./planificacion-view.module.css";

const NIVELES_ZOOM = [25, 50, 75, 100, 150, 200, 300, 400];

export function PlanificacionView(inicial: DatosPlanificacion) {
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
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [verPendientes, setVerPendientes] = useState(false);
  const [mostrarDependencias, setMostrarDependencias] = useState(true);
  const [focoRecorrido, setFocoRecorrido] = useState(false);
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

  if (sinSimulacion) return <section className={styles.page} aria-label="Planificación de producción" aria-busy={calculando}>
    <Alert variant={error ? 'destructive' : 'default'}><RefreshCw className={calculando ? styles.spinning : undefined} />
      <AlertTitle>{error ? 'No se pudo calcular la planificación' : 'Calculando planificación'}</AlertTitle>
      <AlertDescription>{error ?? 'Estamos ubicando las operaciones y sus dependencias en el calendario.'}</AlertDescription>
    </Alert>
    {error && <Button variant="outline" onClick={() => void actualizar()}>Volver a intentar</Button>}
  </section>;

  return <section className={styles.page} aria-label="Planificación de producción" aria-busy={calculando}>
    <h1 className="sr-only">Planificación de producción</h1>

    {error && <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo completar la consulta</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {calculando && <Badge variant="secondary"><RefreshCw className={styles.spinning} />Actualizando fechas</Badge>}
    {(datos.initialPartialWarning || datos.initialMeta.alcance !== "completo") && <Alert><Info /><AlertDescription>{datos.initialPartialWarning ?? "Tu acceso muestra sólo parte del taller. Esta proyección puede omitir carga de otros trabajos y no confirma la capacidad total."}</AlertDescription></Alert>}

    <div className={styles.stats}>
      <Card><CardContent className={styles.statContent}><div><span>Órdenes en producción</span><strong>{numeroOrdenes}<small>OT</small></strong></div><ListTree aria-hidden="true" /></CardContent></Card>
      <Card><CardContent className={styles.statContent}><div><span>Operaciones con fecha</span><strong>{programadas}<small>de {operaciones.length}</small></strong></div><CalendarDays aria-hidden="true" /></CardContent></Card>
      <Card><CardContent className={styles.statContent}><div><span>Entregas para revisar</span><strong>{ordenesVencidas + ordenesPorRevisar + ordenesEnRiesgo}<small>{ordenesVencidas} vencidas · {ordenesEnRiesgo} en riesgo · {ordenesPorRevisar} por confirmar</small></strong></div><TriangleAlert aria-hidden="true" /></CardContent></Card>
    </div>

    <Tabs value={modo} onValueChange={(valor) => { setModo(valor as "recursos" | "ordenes"); if (valor === "ordenes" && seleccionId) setAbiertos((actual) => ({ ...actual, ...abrirGruposRecorridoPlan(ordenes, relacionadas) })); }} className={styles.workbench}>
    <div className={styles.viewControls}>
      <TabsList aria-label="Agrupar planificación"><TabsTrigger value="recursos"><Factory />Por recursos</TabsTrigger><TabsTrigger value="ordenes"><ListTree />Por órdenes</TabsTrigger></TabsList>
      <div className={styles.periodControls}>
        <Button size="icon" variant="ghost" aria-label="Período anterior" disabled={desde <= hoy} onClick={() => cambiarPeriodo(sumarDiasAClave(desde, -Number(periodo)))}><ChevronLeft /></Button>
        <span className={styles.periodLabel}>{fechaPlan(eje.dias[0]?.fecha ?? desde).slice(0, 5)} — {fechaPlan(hasta)}</span>
        <Button size="icon" variant="ghost" aria-label="Período siguiente" onClick={() => cambiarPeriodo(sumarDiasAClave(desde, Number(periodo)))}><ChevronRight /></Button>
        <Button variant="outline" onClick={() => { cambiarPeriodo(hoy); void actualizar(); }}>Ahora</Button>
        <Select items={[{ value: "7", label: "Semana" }, { value: "14", label: "2 semanas" }, { value: "recorrido", label: "Recorrido" }]} value={recorridoVisible ? "recorrido" : periodo} onValueChange={(valor) => { if (valor === "recorrido") verRecorrido(); else if (valor) { setFocoRecorrido(false); setPeriodo(valor); } }}><SelectTrigger aria-label="Período del calendario"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="7">Semana</SelectItem><SelectItem value="14">2 semanas</SelectItem><SelectItem value="recorrido" disabled={!rangoRecorrido}>Recorrido</SelectItem></SelectGroup></SelectContent></Select>
      </div>
    </div>

    <TabsContent value={modo} key={modo} className={styles.ganttCard}>
      <div className={styles.toolbar}>
        <InputGroup className={styles.search}><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput placeholder="Buscar OT, cliente, lote o tarea…" value={consulta} onChange={(e) => { setFocoRecorrido(false); setConsulta(e.target.value); }} aria-label="Buscar en planificación" /></InputGroup>
        <div className={styles.toolbarActions}>
          <label className={styles.switchLabel}><Switch size="sm" checked={mostrarDependencias} onCheckedChange={setMostrarDependencias} />Dependencias</label>
          <div className={styles.zoomControls} role="group" aria-label="Zoom horizontal">
            <span id={zoomLabelId}>Zoom<span className="sr-only"> horizontal, porcentaje</span></span>
            <Button variant="ghost" size="icon-sm" aria-label="Reducir zoom horizontal" title="Reducir zoom horizontal" disabled={zoom <= 25} onClick={() => setZoom(NIVELES_ZOOM.filter(nivel => nivel < zoom).at(-1) ?? 25)}><ZoomOut /></Button>
            <Slider className={styles.zoomSlider} aria-labelledby={zoomLabelId} min={25} max={400} step={5} largeStep={25} value={[zoom]} onValueChange={valor => setZoom(typeof valor === "number" ? valor : valor[0] ?? 100)} />
            <Button variant="ghost" size="icon-sm" aria-label="Aumentar zoom horizontal" title="Aumentar zoom horizontal" disabled={zoom >= 400} onClick={() => setZoom(NIVELES_ZOOM.find(nivel => nivel > zoom) ?? 400)}><ZoomIn /></Button>
            <output className={styles.zoomValue} aria-label="Zoom actual">{zoom}%</output>
          </div>
          <Button variant="ghost" size="sm" onClick={() => expandir(true)}>Desplegar filas</Button><Button variant="ghost" size="sm" onClick={() => expandir(false)}>Plegar filas</Button>
          {seleccionId && <Button variant="ghost" size="icon-sm" onClick={() => { setSeleccionId(null); setPanelAbierto(false); setFocoRecorrido(false); }} aria-label="Limpiar selección"><X /></Button>}
          <Button variant="outline" size="icon-sm" onClick={() => void actualizar()} disabled={actualizando} aria-label="Actualizar planificación" title={actualizando ? "Actualizando planificación" : "Actualizar planificación"}><RefreshCw className={actualizando ? styles.spinning : undefined} /></Button>
        </div>
      </div>
      <PlanificacionGantt grupos={grupos} entregas={entregas} modo={modo} eje={eje} desde={desde} hasta={hasta} zona={zona} ahora={ahora} zoom={zoom} volverAlInicio={volverAlInicio} abiertos={abiertos} alternar={alternar} seleccionId={seleccionId} relacionadas={relacionadas} mostrarDependencias={mostrarDependencias} seleccionar={seleccionarEnGantt} riesgo={riesgo} />
      <div className={styles.legend}>
        <div><span><i className={styles.legendOperator} />Operario</span><span><i className={styles.legendMachine} />Operación autónoma</span><span><i className={styles.legendWait} />Espera / fuera de horario</span><span><i className={styles.legendSelected} />Selección</span><span><i className={styles.legendRelated} />Relacionada</span><span><i className={styles.legendPartial} />Orientativa</span><span><i className={styles.legendDiamond} />Entrega</span></div>
        {seleccion ? <div className={styles.selectionActions}>
          <span className={styles.selectionText} title={`${seleccion.item.ordenNumero} · ${seleccion.item.loteEntrega?.nombre ?? seleccion.productoNombre} · ${seleccion.paso.nombre}`}>{seleccion.item.ordenNumero}{seleccion.item.loteEntrega ? ` · ${seleccion.item.loteEntrega.nombre}` : ""} · {seleccion.paso.nombre}</span>
          <Button variant="ghost" size="sm" onClick={verRecorrido} disabled={!rangoRecorrido}>Ver recorrido</Button>
          <Button variant="outline" size="sm" onClick={() => setPanelAbierto(true)}>Ver detalle</Button>
        </div> : <span>{consulta ? `${visibles.size} de ${operaciones.length} operaciones` : `${operaciones.length} operaciones`} · Seleccioná una tarea para ver sus dependencias</span>}
      </div>
    </TabsContent>
    </Tabs>

    <footer className={styles.footer}>
      <div className={styles.footerNotes}><span>Calendario laboral · {zona.replaceAll("_", " ")} · Desplazá horizontalmente para recorrer los días</span><span>Consulta: {fechaHora(ahora)} · Indicadores sobre todas las órdenes accesibles.</span></div>
      <Button variant={pendientes.length || sinRuta.length ? "outline" : "ghost"} size="sm" onClick={() => setVerPendientes(true)}><Info data-icon="inline-start" />{pendientes.length + sinRuta.length ? `${pendientes.length + sinRuta.length} sin planificación completa` : "Estado de la planificación"}</Button>
    </footer>

    <Sheet open={panelAbierto && !!seleccion} onOpenChange={setPanelAbierto}>
      <SheetContent className={styles.detailPanel} initialFocus={tituloDetalle}>
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
            <Separator />
            <div className={styles.detailSection}><h3>Fechas de producción y entrega</h3><dl className={styles.facts}>
              <dt>Inicio de la operación</dt><dd>{fechaHora(seleccion.agenda?.inicio)}</dd>
              <dt>Fin de la operación</dt><dd>{fechaHora(seleccion.agenda?.fin)}</dd>
              <dt>Fin previsto{seleccion.item.loteEntrega ? " del lote" : " del producto"}</dt><dd>{fechaHora(etaSeleccion.finEstimado)}</dd>
              <dt>Entrega comprometida{seleccion.item.loteEntrega ? " del lote" : " del producto"}</dt><dd className={plazoSeleccion.vencida || plazoSeleccion.fueraDeFecha ? styles.fechaFueraDePlazo : undefined}>{fechaPlan(entregaSeleccion)}</dd>
              <dt>Fin previsto de la OT</dt><dd>{fechaHora(etaOrden.finEstimado)}</dd>
              <dt>Entrega final comprometida</dt><dd className={plazoOrden.vencida || plazoOrden.fueraDeFecha ? styles.fechaFueraDePlazo : undefined}>{fechaPlan(entregaOrden)}</dd>
            </dl>
              {plazoSeleccion.vencida ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>La fecha de entrega ya venció</AlertTitle><AlertDescription>El compromiso guardado es el {fechaPlan(entregaSeleccion)} y todavía hay producción pendiente.{etaSeleccion.finEstimado && ` Con la planificación actual, el fin productivo se estima para ${fechaHora(etaSeleccion.finEstimado)}.`}</AlertDescription></Alert> : plazoSeleccion.fueraDeFecha ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>La producción proyectada supera la entrega</AlertTitle><AlertDescription>El compromiso es el {fechaPlan(entregaSeleccion)}; el fin productivo se estima para {fechaHora(etaSeleccion.finEstimado)}.</AlertDescription></Alert> : entregaSeleccion && estadoSeleccion === "prevista" ? <p className={styles.note}>La producción proyectada termina dentro de la fecha comprometida.</p> : !entregaSeleccion ? <p className={styles.note}>Este producto todavía no tiene una fecha de entrega comprometida.</p> : null}
              {(plazoOrden.vencida && !plazoSeleccion.vencida || plazoOrden.fueraDeFecha && !plazoSeleccion.fueraDeFecha) && <Alert variant="destructive"><TriangleAlert /><AlertTitle>Revisá también la entrega final de la OT</AlertTitle><AlertDescription>La OT tiene una entrega comprometida para el {fechaPlan(entregaOrden)} y su fin productivo se estima para {fechaHora(etaOrden.finEstimado)}.</AlertDescription></Alert>}
              {estadoSeleccion === "revision" && <Alert><Info /><AlertTitle>Proyección orientativa</AlertTitle><AlertDescription>{motivosRevisionSeleccion.length ? motivosRevisionSeleccion.join(" ") : "Faltan datos o hay dependencias sin confirmar."} Esta estimación puede cambiar al completar esos datos.</AlertDescription></Alert>}
              <p className={styles.note}>El fin previsto se recalcula con el trabajo pendiente desde ahora. La entrega comprometida es la fecha guardada en la orden y se conserva hasta que se acuerde una reprogramación.</p>
            </div>
            <Separator />
            <div className={styles.detailSection}><h3>Recurso y calendario</h3>{(() => {
              const estacion = datos.estaciones.find((estacion) => estacion.id === seleccion.estacionId);
              const equipo = estacion?.equipoProduccion;
              const fases = resumenOperacionPlan(seleccion.agenda?.tramosOperacion);
              const reservas = seleccion.agenda?.reservasHumanas ?? [];
              const minutosHumanos = reservas.reduce((sum, reserva) => sum + (reserva.fin - reserva.inicio) / 60_000 * reserva.personas, 0);
              return <><dl className={styles.facts}>{seleccion.paso.maquinaId && <><dt>Operación de máquina</dt><dd>{operacionSeleccion === "con_operario" ? "Con operario" : operacionSeleccion === "autonoma" ? "Autónoma" : "Sin configurar"}</dd></>}<dt>Calendario</dt><dd>{estacion ? etiquetaCalendario(estacion.calendario) ?? "Sin calendario propio; estimación orientativa" : "Sin estación configurada"}</dd><dt>Equipo compartido</dt><dd>{equipo ? `${equipo.nombre} · ${equipo.personas} personas` : "Sin configurar"}</dd>{reservas.length > 0 && <><dt>Equipo, incluida separación</dt><dd>{duracionPlan(minutosHumanos)} · persona</dd></>}{fases.operario > 0 && <><dt>Trabajo de operario</dt><dd>{duracionPlan(fases.operario)}</dd></>}{fases.maquina_atendida > 0 && <><dt>Operación con operario</dt><dd>{duracionPlan(fases.maquina_atendida)}</dd></>}{fases.maquina > 0 && <><dt>Operación autónoma</dt><dd>{duracionPlan(fases.maquina)}</dd></>}{fases.sin_verificar > 0 && <><dt>Atención sin verificar</dt><dd>{duracionPlan(fases.sin_verificar)}</dd></>}</dl><p className={styles.note}>{fases.sin_verificar > 0 ? "El desglose no permite confirmar toda la atención: se reserva al equipo de forma conservadora." : "Preparación, carga, recarga y cierre ocupan al equipo. La operación autónoma permite atender otra máquina; la operación con operario mantiene al equipo ocupado."}{seleccion.agenda?.faseEnCursoEstimada && " La fase actual se proyecta con el calendario y los tramos registrados."}</p>{seleccion.paso.maquinaId && <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/costos/maquinaria/${seleccion.paso.maquinaId}`} />}>Ver configuración de máquina<ArrowUpRight data-icon="inline-end" /></Button>}</>;
            })()}</div>
            <Separator />
            <div className={styles.detailSection}><h3><ArrowDownRight />Depende de</h3>
              {seleccion.predecesores.length ? seleccion.predecesores.map((id) => {
                const op = operaciones.find((op) => op.id === id);
                const item = datos.initialItems.find((item) => item.pasos.some((paso) => paso.id === id));
                const paso = item?.pasos.find((paso) => paso.id === id);
                return op ? <Button variant="outline" className={styles.dependencyButton} key={id} onClick={() => elegir(op)}><span>{op.paso.nombre}<small>{op.item.loteEntrega?.nombre ?? op.productoNombre}{op.item.loteEntrega?.id !== seleccion.item.loteEntrega?.id ? " · Dependencia compartida" : ""}</small></span><ChevronRight /></Button> : <p className={styles.dependencyDone} key={id}>{paso?.nombre ?? "Dependencia fuera de esta consulta"}<Badge variant="secondary">{paso?.estado === "hecho" ? "Completada" : "Sin información"}</Badge></p>;
              }) : <p className={styles.note}>Sin pasos previos pendientes.</p>}
              <h3><ArrowUpRight />Habilita después</h3>
              {operaciones.filter((op) => op.predecesores.includes(seleccion.id)).length ? operaciones.filter((op) => op.predecesores.includes(seleccion.id)).map((op) => <Button variant="outline" className={styles.dependencyButton} key={op.id} onClick={() => elegir(op)}><span>{op.paso.nombre}<small>{op.item.loteEntrega?.nombre ?? op.productoNombre}</small></span><ChevronRight /></Button>) : <p className={styles.note}>No hay operaciones posteriores pendientes.</p>}
              {!!seleccion.paso.gatesOperativos?.some((gate) => gate.estado === "PENDIENTE") && <Alert><TriangleAlert /><AlertTitle>Requisitos pendientes</AlertTitle><AlertDescription>{seleccion.paso.gatesOperativos.filter((gate) => gate.estado === "PENDIENTE").map((gate) => gate.detalle ?? (gate.tipo === "MATERIAL" ? "Disponibilidad de material" : "Control de calidad")).join(" · ")}</AlertDescription></Alert>}
            </div>
          </div>
          <div className={styles.detailFooter}><Button variant="outline" onClick={irATarea} disabled={!seleccion.agenda}><CalendarDays data-icon="inline-start" />Ubicar en calendario</Button><Button nativeButton={false} render={<Link href={`/produccion/ordenes/${seleccion.item.ordenId}`} />}>Ver orden<ArrowUpRight data-icon="inline-end" /></Button></div>
        </>}
      </SheetContent>
    </Sheet>

    <Sheet open={verPendientes} onOpenChange={setVerPendientes}><SheetContent className={styles.detailPanel} initialFocus={tituloEstado}>
      <SheetHeader className={styles.detailHeader}><SheetTitle ref={tituloEstado} tabIndex={-1}>Estado de la planificación</SheetTitle><SheetDescription>Datos pendientes de las órdenes accesibles. Cambiar la vista o los filtros no los elimina del cálculo.</SheetDescription></SheetHeader>
      <div className={styles.detailBody}>
        {!pendientes.length && !sinRuta.length && <Alert><Clock3 /><AlertTitle>Todas las operaciones tienen una fecha proyectada</AlertTitle><AlertDescription>{[...estados.values()].includes("revision") ? "Hay estimaciones orientativas: revisá los equipos, calendarios y dependencias en el detalle de las tareas." : "Podés consultar sus recursos, lotes y dependencias en el calendario."}</AlertDescription></Alert>}
        {pendientes.map((op) => <div className={styles.pendingItem} key={op.id}><Badge variant="outline">{op.item.ordenNumero}{op.item.loteEntrega ? ` · ${op.item.loteEntrega.nombre}` : ""}</Badge><strong>{op.paso.nombre}</strong><p>{op.motivo}</p><Button variant="outline" size="sm" onClick={() => { setVerPendientes(false); elegir(op); }}>Ver operación<ChevronRight data-icon="inline-end" /></Button></div>)}
        {sinRuta.map((item) => <div className={styles.pendingItem} key={item.id}><Badge variant="outline">{item.ordenNumero}</Badge><strong>{item.nombre}</strong><p>Este ítem no tiene una ruta productiva en el tablero.</p></div>)}
      </div>
    </SheetContent></Sheet>
  </section>;
}
