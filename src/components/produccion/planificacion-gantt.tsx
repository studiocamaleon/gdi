"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Diamond, Factory, Layers3, Package, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { anclarZoom, type DiaEje, type EjeLaboral } from "@/lib/eje-laboral";
import type { GrupoPlan, HitoEntregaPlan, OperacionPlan } from "@/lib/planificacion-vista";
import { minutosPlan } from "@/lib/planificacion-vista";
import { geometriaBarraPlan, segmentosOperacionPlan, resumenOperacionPlan, recorridoDependenciaPlan } from "@/lib/planificacion-geometria";
import { claveFechaEnZona, instanteDe, partesEnZona } from "@/lib/zona";
import styles from "./planificacion-view.module.css";

export function duracionPlan(minutos: number | null | undefined) {
  if (minutos == null) return "Sin estimación";
  if (minutos > 0 && minutos < 1) return `${Math.max(1, Math.round(minutos * 60))} s`;
  const min = Math.round(minutos);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}

export function fechaPlan(fecha: string | null) {
  if (!fecha) return "Sin fecha";
  const [y, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

type Props = {
  grupos: GrupoPlan[];
  entregas: HitoEntregaPlan[];
  modo: "recursos" | "ordenes";
  eje: EjeLaboral;
  desde: string;
  hasta: string;
  zona: string;
  ahora: Date;
  zoom: number;
  volverAlInicio: number;
  abiertos: Record<string, boolean>;
  alternar: (grupo: GrupoPlan) => void;
  seleccionId: string | null;
  relacionadas: Set<string>;
  mostrarDependencias: boolean;
  seleccionar: (op: OperacionPlan) => void;
  riesgo: Set<string>;
};

type Barra = { op: OperacionPlan; geometria: ReturnType<typeof geometriaBarraPlan>; pista: number };
type Fila = { grupo: GrupoPlan; profundidad: number; abierta: boolean; resumen: boolean; barras: Barra[]; alto: number; y: number };

export function grupoAbierto(grupo: GrupoPlan, abiertos: Record<string, boolean>) {
  return abiertos[grupo.id] ?? (grupo.tipo === "orden" || grupo.tipo === "producto");
}

export function PlanificacionGantt(props: Props) {
  const { grupos, entregas, modo, eje, desde, hasta, zona, ahora, zoom, volverAlInicio, abiertos, seleccionId, relacionadas, mostrarDependencias, seleccionar, alternar, riesgo } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAnterior = useRef(0);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  useEffect(() => {
    const elemento = scrollRef.current;
    if (!elemento) return;
    const observar = new ResizeObserver(() => {
      setAnchoDisponible(elemento.clientWidth - parseFloat(getComputedStyle(elemento).getPropertyValue("--columna")));
    });
    observar.observe(elemento);
    return () => observar.disconnect();
  }, [grupos.length, eje.dias.length]);
  // 100% mantiene la escala inicial de dos jornadas. El mínimo pertenece a
  // esa base, no al resultado: reducir zoom también debe funcionar en portátiles.
  const anchoDia = Math.max(360, anchoDisponible / 2) * zoom / 100;
  const escala = anchoDia / Math.max(1, eje.jornadaMin);
  const ancho = Math.max(anchoDia, eje.totalMin * escala);
  const vistaAnterior = useRef({ desde, escala, volverAlInicio });
  useLayoutEffect(() => {
    const elemento = scrollRef.current;
    const anterior = vistaAnterior.current;
    if (elemento) {
      // Capturado antes del resize: el navegador puede haber recortado ya
      // scrollLeft al nuevo ancho cuando se aleja cerca del final del período.
      elemento.scrollLeft = anterior.desde !== desde || anterior.volverAlInicio !== volverAlInicio ? 0 : anclarZoom({ scrollLeft: scrollAnterior.current, offsetX: 0, zAnterior: anterior.escala, zNuevo: escala });
      scrollAnterior.current = elemento.scrollLeft;
    }
    vistaAnterior.current = { desde, escala, volverAlInicio };
  }, [desde, escala, volverAlInicio]);
  const diasVisibles = eje.dias.filter((dia) => dia.fecha >= desde && dia.fecha <= hasta);
  const hitosPorPosicion = useMemo(() => {
    const puntos = new Map<number, HitoEntregaPlan[]>();
    for (const hito of entregas) {
      if (hito.fecha < desde || hito.fecha > hasta) continue;
      const x = eje.aX(instanteDe(hito.fecha, "23:59", zona));
      puntos.set(x, [...(puntos.get(x) ?? []), hito]);
    }
    return [...puntos].sort(([a], [b]) => a - b);
  }, [entregas, desde, hasta, eje, zona]);
  const { filas, posiciones, altoTotal } = useMemo(() => {
    const filas: Fila[] = [];
    const posiciones = new Map<string, { x: number; fin: number; y: number }>();
    let y = 0;
    const recorrer = (grupos: GrupoPlan[], profundidad: number) => {
      for (const grupo of grupos) {
        const abierta = grupoAbierto(grupo, abiertos);
        const resumen = modo === "ordenes" ? grupo.tipo !== "operacion" : grupo.hijos.length > 0 && abierta;
        const barras: Barra[] = [];
        const pistas: number[] = [];
        if (!resumen) {
          const ordenadas = grupo.operaciones.filter((op) => op.agenda && claveFechaEnZona(op.agenda.fin, zona) >= desde && claveFechaEnZona(op.agenda.inicio, zona) <= hasta)
            .sort((a, b) => a.agenda!.inicio.getTime() - b.agenda!.inicio.getTime() || a.id.localeCompare(b.id));
          for (const op of ordenadas) {
            const geometria = geometriaBarraPlan(eje.aX(op.agenda!.inicio) * escala, eje.aX(op.agenda!.fin) * escala, ancho);
            if (geometria.ancho <= 0) continue;
            // Sólo los intervalos simultáneos necesitan otra pista; no son puestos.
            let pista = pistas.findIndex((fin) => fin <= geometria.x);
            if (pista === -1) pista = pistas.length;
            pistas[pista] = geometria.finTemporal;
            barras.push({ op, geometria, pista });
            posiciones.set(op.id, { x: geometria.x, fin: geometria.finTemporal, y: y + 16 + pista * 42 + 17 });
          }
        }
        const alto = resumen ? (grupo.tipo === "orden" ? 66 : 58) : Math.max(76, pistas.length * 42 + 30);
        filas.push({ grupo, profundidad, abierta, resumen, barras, alto, y });
        y += alto;
        if (abierta && grupo.hijos.length) recorrer(grupo.hijos, profundidad + 1);
      }
    };
    recorrer(grupos, 0);
    return { filas, posiciones, altoTotal: y };
  }, [grupos, abiertos, modo, zona, desde, hasta, ancho, eje, escala]);

  const hoy = claveFechaEnZona(ahora, zona);
  const horaActual = partesEnZona(ahora, zona);
  const minutoActual = horaActual.hh * 60 + horaActual.mm;
  const ahoraVisible = hoy >= desde && hoy <= hasta && diasVisibles.some((dia) => dia.fecha === hoy && minutoActual >= dia.desdeMin && minutoActual < dia.desdeMin + dia.ancho);
  const formatoFechaHora = new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const formatoHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  const horasDelDia = (dia: DiaEje) => {
    const fin = dia.desdeMin + dia.ancho;
    const paso = escala * 60 >= 55 ? 60 : 120;
    const marcas = [dia.desdeMin];
    for (let min = Math.ceil(dia.desdeMin / paso) * paso; min < fin; min += paso) {
      if ((min - dia.desdeMin) * escala >= 52 && (fin - min) * escala >= 52) marcas.push(min);
    }
    return [...marcas, fin];
  };

  if (!filas.length || !diasVisibles.length) return <Empty className={styles.empty}>
    <EmptyHeader><EmptyMedia variant="icon"><Workflow /></EmptyMedia><EmptyTitle>{!filas.length ? "No hay operaciones para mostrar" : "Sin jornadas laborales en este período"}</EmptyTitle>
      <EmptyDescription>{!filas.length ? "Probá con otra búsqueda o revisá las órdenes pendientes de producción." : "Cambiá el período para consultar la siguiente jornada de trabajo."}</EmptyDescription></EmptyHeader>
  </Empty>;

  return <TooltipProvider delay={200}><div ref={scrollRef} className={styles.scroll} data-mode={modo} onScroll={event => { scrollAnterior.current = event.currentTarget.scrollLeft; }} tabIndex={0} role="region" aria-label={`Calendario de planificación por ${modo}; desplazamiento horizontal y vertical`}>
    <div className={styles.canvas} style={{ width: `calc(var(--columna) + ${ancho}px)`, minWidth: "100%" }}>
      <div className={styles.calendarHeader}>
        <div className={styles.corner}><span>{modo === "recursos" ? "Recurso / estación" : "Orden / operación"}</span><small>Horas pendientes</small></div>
        <div className={styles.days} style={{ width: ancho }}>
          {diasVisibles.map((dia) => <div className={styles.day} data-today={dia.fecha === hoy} data-compact={dia.ancho * escala < 110} data-tiny={dia.ancho * escala < 65} title={`${dia.etiqueta} · ${formatoHora(dia.desdeMin)}–${formatoHora(dia.desdeMin + dia.ancho)}`} key={dia.fecha} style={{ left: dia.x * escala, width: dia.ancho * escala }}>
            <div><span>{dia.etiqueta.split(" ")[0]}</span><strong>{dia.etiqueta.split(" ")[1]}</strong></div>
            <div className={styles.hours}>{horasDelDia(dia).map((min) => <span key={min} style={{ left: (min - dia.desdeMin) * escala }}>{formatoHora(min)}</span>)}</div>
          </div>)}
        </div>
      </div>
      {modo === "recursos" && <div className={styles.deliveriesRow}>
        <div className={styles.rowLabel}><Diamond className={styles.deliveryIcon} aria-hidden="true" /><div className={styles.labelText}><strong>Entregas</strong><small>Compromisos por producto o lote</small></div></div>
        <div className={styles.track} style={{ width: ancho }}>
          {hitosPorPosicion.map(([x, hitos]) => {
            const posicion = Math.max(14, Math.min(ancho - 14, x * escala));
            const primero = hitos[0];
            const etiqueta = hitos.length > 1 ? `${hitos.length} entregas` : `${primero.orden.replace(/^OT-\d{4}-/, "")} · ${primero.lote ?? primero.producto}`;
            return <Tooltip key={x}>
              <TooltipTrigger render={<button type="button" />} className={styles.deliveryPoint} data-start={posicion < 160} style={{ left: posicion }} aria-label={hitos.map(hito => `Entrega ${hito.orden}, ${hito.lote ?? hito.producto}: ${fechaPlan(hito.fecha)}`).join("; ")}>
                <Diamond aria-hidden="true" /><span className={styles.deliveryCaption} style={{ maxWidth: Math.min(180, anchoDia - 28) }}>{etiqueta}</span>
              </TooltipTrigger>
              <TooltipContent><div className={styles.deliveryTooltip}>{hitos.map(hito => <div key={hito.id}><strong>{hito.orden}{hito.lote ? ` · ${hito.lote}` : ""} · {fechaPlan(hito.fecha)}</strong><span>{hito.producto} · {hito.cliente}</span>{hito.lote && <span>{hito.detalle}</span>}</div>)}<small>Fecha comprometida, sin hora definida. El rombo se ubica al cierre de la jornada; los días no laborables se comprimen.</small></div></TooltipContent>
            </Tooltip>;
          })}
          {!hitosPorPosicion.length && <span className={styles.deliveryEmpty}>Sin entregas comprometidas en este período</span>}
        </div>
      </div>}
      <div className={styles.calendarBody} style={{ height: altoTotal }}>
        <div className={styles.gridLines} style={{ width: ancho, height: altoTotal }} aria-hidden="true">
          {diasVisibles.map((dia) => <div key={dia.fecha} className={styles.gridDay} style={{ left: dia.x * escala, width: dia.ancho * escala }}>{horasDelDia(dia).slice(1, -1).map((min) => <span className={styles.gridHour} key={min} style={{ left: (min - dia.desdeMin) * escala }} />)}</div>)}
          {ahoraVisible && <div className={styles.now} style={{ left: Math.min(ancho - 1, eje.aX(ahora) * escala) }}><span>Ahora · {formatoHora(minutoActual)}</span></div>}
        </div>
        {filas.map(({ grupo, profundidad, abierta, resumen, barras, alto }) => {
          const agendas = grupo.operaciones.flatMap((op) => op.agenda ? [op.agenda] : []);
          const inicio = agendas.length ? new Date(Math.min(...agendas.map((a) => a.inicio.getTime()))) : null;
          const fin = agendas.length ? new Date(Math.max(...agendas.map((a) => a.fin.getTime()))) : null;
          const resumenVisible = resumen && inicio && fin && claveFechaEnZona(fin, zona) >= desde && claveFechaEnZona(inicio, zona) <= hasta;
          const icono = grupo.tipo === "orden" ? <Package /> : grupo.tipo === "lote" ? <Layers3 /> : grupo.tipo === "estacion" ? <Factory /> : null;
          const fuera = grupo.operaciones.some((op) => op.agenda) && !barras.length && !resumenVisible;
          const seleccionada = grupo.tipo === "operacion" && grupo.operaciones[0].id === seleccionId;
          return <div className={styles.row} data-kind={grupo.tipo} data-selected={seleccionada} key={grupo.id} style={{ height: alto }}>
            <div className={styles.rowLabel} style={{ paddingLeft: 12 + profundidad * 13 }}>
              {grupo.hijos.length ? <Button variant="ghost" size="icon-xs" aria-label={`${abierta ? "Contraer" : "Expandir"} ${grupo.nombre}`} aria-expanded={abierta} onClick={() => alternar(grupo)}>{abierta ? <ChevronDown /> : <ChevronRight />}</Button> : <span className={styles.treeSpacer} />}
              {icono && <span className={styles.rowIcon}>{icono}</span>}
              <div className={styles.labelText}>
                {grupo.tipo === "operacion" ? <button className={styles.taskLabel} onClick={() => seleccionar(grupo.operaciones[0])} title={grupo.nombre}>{grupo.nombre}</button> : <strong title={grupo.nombre}>{grupo.nombre}</strong>}
                <small title={[grupo.detalle, grupo.entrega ? `Entrega: ${fechaPlan(grupo.entrega)}` : null].filter(Boolean).join(" · ")}>{grupo.detalle}{grupo.entrega ? ` · Ent. ${fechaPlan(grupo.entrega).slice(0, 5)}` : ""}</small>
              </div>
              <span className={styles.load} title="Duración laboral pendiente de toda la cola; no incluye esperas ni noches">{grupo.operaciones.every((op) => op.agenda?.tercerizado) ? "Plazo externo" : duracionPlan(grupo.operaciones.some((op) => op.agenda?.duracionMin != null) ? minutosPlan(grupo.operaciones) : null)}</span>
            </div>
            <div className={styles.track} style={{ width: ancho }}>
              {resumenVisible && <div className={styles.summaryBar} style={{ left: eje.aX(inicio!) * escala, width: Math.max(4, (eje.aX(fin!) - eje.aX(inicio!)) * escala) }} title={`Tramo estimado de ${grupo.nombre}`} />}
              {grupo.entrega && grupo.entrega >= desde && grupo.entrega <= hasta && <Tooltip>
                <TooltipTrigger render={<button type="button" />} className={styles.milestone} style={{ left: Math.max(14, Math.min(ancho - 14, eje.aX(instanteDe(grupo.entrega, "23:59", zona)) * escala)) }} aria-label={`Entrega ${grupo.nombre}: ${fechaPlan(grupo.entrega)}`}><Diamond aria-hidden="true" /></TooltipTrigger>
                <TooltipContent><div className={styles.taskTooltip}><strong>Entrega {grupo.nombre}</strong><span>{fechaPlan(grupo.entrega)}{grupo.tipo === "orden" ? " · Entrega final de la OT" : ""}</span><span>Fecha comprometida, sin hora definida.</span></div></TooltipContent>
              </Tooltip>}
              {barras.map(({ op, geometria: g, pista }) => {
                const tramos = op.agenda?.tramosOperacion ?? [];
                const fases = segmentosOperacionPlan(tramos, d => eje.aX(d) * escala, g);
                const tiempos = resumenOperacionPlan(tramos);
                return <Tooltip key={op.id}>
                <TooltipTrigger render={<button type="button" />} className={styles.bar}
                  data-short={g.corta}
                  data-selected={op.id === seleccionId} data-related={op.id !== seleccionId && relacionadas.has(op.id)} data-risk={riesgo.has(op.item.id)} data-partial={op.agenda?.parcial || op.agenda?.duracionMin == null && !op.agenda?.tercerizado}
                  style={{ left: g.x, width: g.ancho, top: 16 + pista * 42 }} onClick={() => seleccionar(op)}
                  aria-label={`${op.item.ordenNumero}, ${op.item.loteEntrega?.nombre ?? op.productoNombre}, ${op.paso.nombre}, ${duracionPlan(op.agenda?.duracionMin)}. Seleccionar y ver dependencias`} aria-pressed={op.id === seleccionId}>
                  <span className={styles.phaseStrip} aria-hidden="true">{fases.map((fase, indice) => <span key={indice} className={styles.phaseSegment} data-phase={fase.tipo} style={{ left: `${fase.inicio}%`, width: `${fase.ancho}%` }} />)}</span>
                  {!g.corta && <><strong>{op.item.ordenNumero.replace(/^OT-\d{4}-/, "")} · {op.paso.nombre}</strong><small>{op.item.loteEntrega?.nombre ? `${op.item.loteEntrega.nombre} · ` : ""}{op.item.clienteNombre}</small></>}
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className={styles.taskTooltip}>
                    <strong>{op.paso.nombre}</strong>
                    <span>{op.item.ordenNumero}{op.item.loteEntrega ? ` · ${op.item.loteEntrega.nombre}` : ""}</span>
                    <span>{op.item.clienteNombre} · {op.productoNombre}</span>
                    <span>{duracionPlan(op.agenda?.duracionMin)}{op.agenda?.parcial ? " · Estimación orientativa" : ""}</span>
                    {tiempos.operario > 0 && <span>Trabajo de operario: {duracionPlan(tiempos.operario)}</span>}
                    {tiempos.maquina_atendida > 0 && <span>Operación de máquina con operario: {duracionPlan(tiempos.maquina_atendida)}</span>}
                    {tiempos.maquina > 0 && <span>Operación de máquina autónoma: {duracionPlan(tiempos.maquina)}</span>}
                    {tiempos.sin_verificar > 0 && <span>Atención sin verificar: {duracionPlan(tiempos.sin_verificar)}</span>}
                    {op.agenda?.faseEnCursoEstimada && <span>Fase actual proyectada con el calendario y los tramos registrados.</span>}
                    {op.agenda && <span>{formatoFechaHora.format(op.agenda.inicio)} → {formatoFechaHora.format(op.agenda.fin)}</span>}
                  </div>
                </TooltipContent>
              </Tooltip>; })}
              {!resumen && !barras.length && <span className={styles.noRange}>{fuera ? "Fuera del período visible" : "Sin fecha estimada"}</span>}
            </div>
          </div>;
        })}
        {mostrarDependencias && seleccionId && <svg className={styles.dependencies} style={{ width: ancho, height: altoTotal }} aria-hidden="true">
          <defs><marker id="plan-flecha" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="currentColor" /></marker></defs>
          {filas.flatMap((fila) => fila.barras).map((barra) => barra.op).filter((op) => relacionadas.has(op.id)).flatMap((op) => op.predecesores.filter((id) => relacionadas.has(id)).map((id) => {
            const origen = posiciones.get(id), destino = posiciones.get(op.id);
            if (!origen || !destino) return null;
            return <path key={`${id}:${op.id}`} d={recorridoDependenciaPlan(origen, destino)} markerEnd="url(#plan-flecha)" />;
          }))}
        </svg>}
      </div>
    </div>
  </div></TooltipProvider>;
}
