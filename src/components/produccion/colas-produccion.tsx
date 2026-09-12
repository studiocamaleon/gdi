'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, CircleCheck, CirclePause, Clock3, Factory, Layers, Scan, LoaderCircle, LockKeyhole, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import workspaceTheme from '@/components/ui/workspace-theme.module.css';
import workspaceUi from '@/components/ui/workspace-ui.module.css';
import { PasoAccionesProduccion, ETIQUETAS_ACCION } from './paso-acciones';
import { CompletarSeleccionCola } from './completar-seleccion-cola';
import { SimularNestingCola } from './simular-nesting-cola';
import { accionesDisponiblesProduccion, completarSeriaInstantaneo, type OpcionesAccionProduccion } from '@/lib/acciones-produccion';
import type { TableroPasoAccion } from '@/lib/tablero-produccion';
import { mesaPasoProduccion } from '@/lib/ordenes-trabajo-api';
import { ConfiguracionGrupoCola } from './configuracion-grupo-cola';
import { toast } from 'sonner';
import { usePuede } from '@/components/navigation/permisos-provider';
import { alternarSeleccionCola, alternarGrupoCola, motivoSeleccionCola, motivoNestingSeleccionCola, seleccionColaVigente, SELECCION_COLA_VACIA, type SeleccionCola } from '@/lib/seleccion-cola';
import { getColaMaquina, getResumenColas, completarTrabajosCola, accionTrabajoCola, gruposVisualesCola, formatoCola, detallePerfilCola, fechaCola, dimensionPiezaCola,
  type TiempoCola, type DatosCola, type EstadoCola, type ResumenColas, type TrabajoCola } from '@/lib/colas-produccion';
import s from './colas-produccion.module.css';

const ESTADOS: Array<{ id: EstadoCola; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'listos', label: 'Listos' }, { id: 'en_curso', label: 'En curso' },
  { id: 'en_espera', label: 'En espera' }, { id: 'pausados', label: 'Pausados' },
];
const ESTADO_FILA = { listos: 'Listo', en_curso: 'En curso', en_espera: 'En espera', pausados: 'Pausado' };
const ICONO_ESTADO = { listos: CircleCheck, en_curso: LoaderCircle, en_espera: Clock3, pausados: CirclePause };

export function TablaCola({ datos, seleccion = SELECCION_COLA_VACIA, onAlternar, onGrupo, onAccion, onTomarMesa, ocupado = false }: {
  datos: DatosCola; seleccion?: SeleccionCola; ocupado?: boolean; onAccion?: AccionColaHandler; onTomarMesa?: (item: TrabajoCola) => void; onAlternar?: (item: TrabajoCola) => void; onGrupo?: (items: TrabajoCola[]) => void;
}) {
  const grupos = gruposVisualesCola(datos.items);
  return <Table className={workspaceUi.dataTable}>
    <TableHeader><TableRow>
      <TableHead><div className={s.badges}>{onGrupo && <Checkbox aria-label="Seleccionar todos los trabajos de esta página" disabled={ocupado}
        checked={datos.items.length > 0 && datos.items.every(i => seleccion.ids.includes(i.id))}
        indeterminate={datos.items.some(i => seleccion.ids.includes(i.id)) && !datos.items.every(i => seleccion.ids.includes(i.id))}
        onCheckedChange={() => onGrupo(datos.items)} />}Trabajo</div></TableHead><TableHead>Medidas</TableHead><TableHead>Sustrato</TableHead>
      <TableHead>Modo de color</TableHead><TableHead>Entrega</TableHead><TableHead>Estado</TableHead>
    </TableRow></TableHeader>
    {grupos.map(grupo => <TableBody key={grupo.key}>
      <TableRow className={workspaceUi.groupRow}><TableCell colSpan={6}>
        <ConfiguracionGrupoCola materialNombre={grupo.configuracion.materialNombre}>
          <span className={s.groupCount}>{grupo.items.length} {grupo.items.length === 1 ? 'trabajo' : 'trabajos'}{datos.pages > 1 ? ' en esta página' : ''}</span>
          {onGrupo && <Button variant="ghost" size="sm"
            disabled={ocupado || grupo.items.every(i => Boolean(motivoSeleccionCola(i, seleccion)))}
            onClick={() => onGrupo(grupo.items)}>
            {grupo.items.every(i => seleccion.ids.includes(i.id)) ? 'Quitar selección' : 'Seleccionar grupo'}
          </Button>}
        </ConfiguracionGrupoCola>
      </TableCell></TableRow>
      {grupo.items.map(item => <FilaTrabajo key={item.id} item={item} seleccion={seleccion} onAlternar={onAlternar} onAccion={onAccion} onTomarMesa={onTomarMesa} ocupado={ocupado} />)}
    </TableBody>)}
  </Table>;
}

type AccionColaHandler = (item: TrabajoCola, accion: TableroPasoAccion, opts?: OpcionesAccionProduccion) => Promise<void>;

function MedidasTrabajoCola({ configuracion: c }: { configuracion: TrabajoCola['configuracion'] }) {
  const panelizado = (c.panelesPorPiezaMax ?? 0) > 1;
  const medidas = panelizado ? c.paneles : c.piezas?.map(p => ({ ...p, panel: null, paneles: null }));
  if (!medidas?.length) return <span className={s.secondary}>
    {panelizado ? 'Medidas de paneles no disponibles' : 'Medidas de piezas sin registrar'}
  </span>;
  return <ul className={s.measures} aria-label={panelizado ? 'Medidas de los paneles para producir' : 'Medidas de las piezas para producir'}>
    {medidas.map((p, i) => <li key={i}>
      {p.panel && <span className={s.secondary}>Panel {p.panel}/{p.paneles}</span>}
      <span>{`${p.cantidad.toLocaleString('es-AR')} u. × ${dimensionPiezaCola(p)}`}</span>
    </li>)}
  </ul>;
}

function FilaTrabajo({ item, seleccion, onAlternar, onAccion, onTomarMesa, ocupado }: { item: TrabajoCola; seleccion: SeleccionCola; ocupado: boolean; onAccion?: AccionColaHandler; onTomarMesa?: (item: TrabajoCola) => void; onAlternar?: (item: TrabajoCola) => void }) {
  const c = item.configuracion;
  const perfil = detallePerfilCola(c);
  const IconoEstado = ICONO_ESTADO[item.estadoCola];
  const seleccionado = seleccion.ids.includes(item.id);
  const motivo = motivoSeleccionCola(item, seleccion);
  return <TableRow data-state={seleccionado ? 'selected' : undefined}>
    <TableCell><div className={s.work}>
      <div className={s.badges}>
        {onAlternar &&
          <span className={s.check} title={seleccionado ? 'Quitar de la selección' : motivo ?? 'Seleccionar trabajo'}>
            <Checkbox checked={seleccionado} disabled={ocupado || (!seleccionado && Boolean(motivo))}
              aria-label={`Seleccionar ${item.ordenNumero} · ${item.producto}${item.lote ? ` · ${item.lote.nombre}` : ''}`}
              onCheckedChange={() => onAlternar(item)} />
          </span>}
        <strong>{item.ordenNumero}</strong>{item.lote && <Badge variant="outline">{item.lote.nombre}</Badge>}
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" className={s.workLink} nativeButton={false}
            aria-label={`Ver trabajo ${item.ordenNumero} · ${item.producto}${item.lote ? ` · ${item.lote.nombre}` : ''}`}
            render={<Link href={`/produccion/tablero?item=${encodeURIComponent(item.itemId)}`} />} />}>
            <ArrowUpRight />
          </TooltipTrigger>
          <TooltipContent>Ver trabajo</TooltipContent>
        </Tooltip>
      </div>
      <span className={s.workName} title={item.producto}>{item.producto}</span>
      {item.componenteDe && item.componenteDe !== item.producto && <span className={s.secondary} title={item.componenteDe}>{item.componenteDe}</span>}
      <span className={s.secondary}>{item.cliente}{!c.piezas?.length && !c.productoCompuesto && <> · {item.cantidad} {item.unidad}</>}</span>
      <span className={s.secondary}>{item.nombre}</span>
      {c.layoutConservado && <Badge variant="outline" title={c.productoCompuesto ? 'Producto compuesto: se conserva su layout calculado.' : 'Se conserva la distribución calculada.'}><LockKeyhole data-icon="inline-start" />{c.productoCompuesto ? 'Layout bloqueado' : 'Conservar layout'}</Badge>}
      {c.ejecucionCompartida && <span className={s.secondary}>Ejecución compartida</span>}
    </div></TableCell>
    <TableCell><MedidasTrabajoCola configuracion={c} /></TableCell>
    <TableCell><div className={s.format}>
      <span className={s.dimension}>{formatoCola(c.formatos, c.materialSubfamilia)}</span>
      {c.formatoModificado && <small>Cotizado: {formatoCola(c.formatosCotizados, c.materialSubfamilia)}</small>}
    </div></TableCell>
    <TableCell><div className={s.format}>
      <Badge variant="secondary">{c.modoColor ?? 'Sin dato'}</Badge>
      {perfil && <small title={c.perfilNombre ?? undefined}>Perfil: {perfil}</small>}
      {c.caras && <small>{c.caras === 2 ? 'Doble faz' : 'Una cara'}</small>}
    </div></TableCell>
    <TableCell><span className={s.date}>{fechaCola(item.fechaEntrega)}</span></TableCell>
    <TableCell><div className={s.status} data-estado={item.estadoCola}>
      <Badge variant="outline"><IconoEstado data-icon="inline-start" className={s.statusIcon} />{ESTADO_FILA[item.estadoCola]}</Badge>
      {item.control && onAccion && <PasoAccionesProduccion {...item.control} busy={ocupado} referencia={`${item.ordenNumero} · ${item.producto}${item.lote ? ` · ${item.lote.nombre}` : ''}`} onAccion={(accion, opts) => onAccion(item, accion, opts)} />}
      {item.control?.puedeTomarMesa && onTomarMesa && <Button variant="outline" size="sm" disabled={ocupado} onClick={() => onTomarMesa(item)}>Mover a mi mesa</Button>}
      {item.responsable && <span className={s.secondary}>{item.responsable}</span>}
      {item.motivos.length > 0 && <details className={s.reasons}><summary>Ver motivo{item.motivos.length > 1 ? 's' : ''}</summary>
        <ul>{item.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </details>}
    </div></TableCell>
  </TableRow>;
}

export function ColasProduccion({ initialResumen, initialError, initialMaquinaId }: {
  initialResumen: ResumenColas; initialError: string | null; initialMaquinaId?: string;
}) {
  const [resumen, setResumen] = React.useState(initialResumen);
  const [maquinaId, setMaquinaId] = React.useState(initialMaquinaId ?? initialResumen.maquinas.find(m => m.pendientes > 0)?.id ?? initialResumen.maquinas[0]?.id ?? '');
  const [filtro, setFiltro] = React.useState({ estado: 'todos' as EstadoCola, q: '', page: 1 });
  const [buscarMaquina, setBuscarMaquina] = React.useState('');
  const [datos, setDatos] = React.useState<DatosCola | null>(null);
  const [errorResumen, setErrorResumen] = React.useState(initialError);
  const [errorDetalle, setErrorDetalle] = React.useState<string | null>(null);
  const error = errorDetalle ?? errorResumen;
  const [cargando, setCargando] = React.useState(Boolean(maquinaId));
  const [revision, setRevision] = React.useState(0);
  const [seleccion, setSeleccion] = React.useState<SeleccionCola>(SELECCION_COLA_VACIA);
  const [completando, setCompletando] = React.useState(false);
  const [simulacionIds, setSimulacionIds] = React.useState<string[] | null>(null);
  const [accionId, setAccionId] = React.useState<string | null>(null);
  const ocupado = completando || accionId !== null;
  const [revisionTiempos, setRevisionTiempos] = React.useState<TrabajoCola[] | null>(null);
  const enviando = React.useRef(false);
  const [errorAccion, setErrorAccion] = React.useState<string | null>(null);
  const ejecutar = usePuede('produccion.ejecutar'), supervisar = usePuede('produccion.supervisar');
  const puedeCompletar = ejecutar || supervisar;
  const [refrescando, setRefrescando] = React.useState(false);
  const resumenRequest = React.useRef<AbortController | null>(null);
  const consultaAnterior = React.useRef('');

  React.useEffect(() => {
    if (!maquinaId) { setDatos(null); setCargando(false); setErrorDetalle(null); return; }
    const ctrl = new AbortController();
    const consulta = JSON.stringify([maquinaId, filtro]);
    if (consultaAnterior.current !== consulta) { setCargando(true); setDatos(null); }
    consultaAnterior.current = consulta;
    setErrorDetalle(null);
    const timer = setTimeout(() => {
      void getColaMaquina(maquinaId, filtro, ctrl.signal).then(r => {
        if (!ctrl.signal.aborted) setDatos(r);
      }).catch(e => { if (!ctrl.signal.aborted) setErrorDetalle(e instanceof Error ? e.message : 'No se pudo cargar la cola.'); })
        .finally(() => { if (!ctrl.signal.aborted) setCargando(false); });
    }, filtro.q ? 250 : 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [maquinaId, filtro, revision]);

  const refrescar = React.useCallback(async () => {
    resumenRequest.current?.abort();
    const ctrl = new AbortController(); resumenRequest.current = ctrl;
    setRefrescando(true); setRevision(r => r + 1);
    try {
      const r = await getResumenColas(ctrl.signal);
      if (!ctrl.signal.aborted) {
        setResumen(r); setErrorResumen(null);
        setMaquinaId(actual => r.maquinas.some(m => m.id === actual) ? actual : r.maquinas.find(m => m.pendientes > 0)?.id ?? r.maquinas[0]?.id ?? '');
      }
    } catch (e) { if (!ctrl.signal.aborted) setErrorResumen(e instanceof Error ? e.message : 'No se pudieron actualizar las máquinas.'); }
    finally { if (!ctrl.signal.aborted) setRefrescando(false); }
  }, []);
  React.useEffect(() => {
    const focus = () => { if (document.visibilityState === 'visible') void refrescar(); };
    window.addEventListener('focus', focus);
    const timer = setInterval(focus, 60_000);
    return () => { window.removeEventListener('focus', focus); clearInterval(timer); resumenRequest.current?.abort(); };
  }, [refrescar]);

  function seleccionar(id: string) {
    if (enviando.current) return;
    setMaquinaId(id); setFiltro({ estado: 'todos', q: '', page: 1 });
    setSeleccion(SELECCION_COLA_VACIA); setErrorAccion(null);
    window.history.replaceState(null, '', `/produccion/colas?maquina=${encodeURIComponent(id)}`);
  }
  function filtrar(cambio: Partial<typeof filtro>) {
    if (enviando.current) return;
    setErrorAccion(null);
    setFiltro(f => ({ ...f, ...cambio })); setSeleccion(SELECCION_COLA_VACIA);
  }
  function seleccionarGrupo(items: TrabajoCola[]) {
    if (!enviando.current) setSeleccion(actual => alternarGrupoCola(actual, items));
  }
  async function completar(tiempos: TiempoCola[] = []) {
    if (enviando.current || !seleccion.ids.length) return;
    enviando.current = true; setCompletando(true); setErrorAccion(null);
    try {
      const r = await completarTrabajosCola(maquinaId, seleccion.ids, tiempos);
      setRevisionTiempos(null);
      setSeleccion(SELECCION_COLA_VACIA);
      toast.success(`${r.completados} ${r.completados === 1 ? 'trabajo completado' : 'trabajos completados'}`);
      await refrescar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudieron completar los trabajos. Actualizá la cola para comprobar su estado.');
      void refrescar();
      throw e;
    } finally { enviando.current = false; setCompletando(false); }
  }
  function prepararCompletado() {
    const items = (datos?.items ?? []).filter(i => seleccion.ids.includes(i.id));
    const impedido = items.find(i => !i.control || !accionesDisponiblesProduccion(i.control).includes('completar'));
    if (impedido) { setErrorAccion(`${impedido.ordenNumero} · ${impedido.producto}: no se puede completar en su estado o asignación actual. Revisá el trabajo como en el Tablero.`); return; }
    if (items.some(i => completarSeriaInstantaneo(i.control.paso))) setRevisionTiempos(items);
    else void completar().catch(() => undefined);
  }
  async function ejecutarAccion(item: TrabajoCola, accion: TableroPasoAccion, opts?: OpcionesAccionProduccion) {
    if (enviando.current) return;
    enviando.current = true; setAccionId(item.id); setErrorAccion(null);
    try {
      await accionTrabajoCola(maquinaId, item.id, accion, opts);
      setSeleccion(actual => ({ ids: actual.ids.filter(id => id !== item.id) }));
      toast.success(`${item.ordenNumero}: ${ETIQUETAS_ACCION[accion].toLocaleLowerCase('es')} registrado`);
      await refrescar();
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo registrar la acción.');
      void refrescar();
      throw e;
    } finally { enviando.current = false; setAccionId(null); }
  }
  async function tomarMesa(item: TrabajoCola) {
    if (enviando.current) return;
    enviando.current = true; setAccionId(item.id); setErrorAccion(null);
    try { await mesaPasoProduccion(item.id, true); await refrescar(); }
    catch (e) { setErrorAccion(e instanceof Error ? e.message : 'No se pudo mover a tu mesa.'); }
    finally { enviando.current = false; setAccionId(null); }
  }
  const seleccionVigente = seleccionColaVigente(seleccion, datos?.items ?? []);
  const motivoNesting = motivoNestingSeleccionCola(seleccion, datos?.items ?? []);
  const haySeleccion = seleccion.ids.length > 0;
  const detalleSeleccion = haySeleccion
    ? motivoNesting ?? 'Un mismo material seleccionado. Podés simular su acomodo en rollo.'
    : 'Seleccioná trabajos para operar en conjunto.';
  const maquina = resumen.maquinas.find(m => m.id === maquinaId);
  const totalMaquina = datos?.totales.todos ?? maquina?.pendientes ?? 0;
  const maquinas = resumen.maquinas.filter(m => `${m.nombre} ${m.estacion?.nombre ?? ''}`.toLocaleLowerCase('es').includes(buscarMaquina.toLocaleLowerCase('es')));

  return <div className={cn(workspaceTheme.theme, s.page)}>
    {revisionTiempos && <CompletarSeleccionCola items={revisionTiempos} onConfirmar={completar} onCancelar={() => setRevisionTiempos(null)} />}
    {simulacionIds && <SimularNestingCola maquinaId={maquinaId} pasoIds={simulacionIds} onCerrar={() => setSimulacionIds(null)} />}
    <header className={s.header}>
      <div className={s.title}><span className={s.eyebrow}>Producción</span><h1>Colas de trabajo</h1></div>
      <div className={s.actions}>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/produccion/planificacion" />}>Planificación<ArrowUpRight data-icon="inline-end" /></Button>
        <Button variant="ghost" size="sm" onClick={() => void refrescar()} disabled={refrescando}><RefreshCw data-icon="inline-start" className={refrescando ? 'animate-spin' : undefined} />Actualizar</Button>
      </div>
    </header>
    {error && <Alert variant="destructive"><AlertTitle>No se pudo actualizar la vista</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <div className={s.workspace}>
      <aside className={s.machines} aria-label="Máquinas">
        <div className={s.machineSearch}>
          <div className={s.railHeading}><span>Máquinas con trabajo</span><Badge variant="secondary">{resumen.maquinas.length}</Badge></div>
          <InputGroup><InputGroupInput aria-label="Buscar máquina" placeholder="Buscar máquina…" value={buscarMaquina} onChange={e => setBuscarMaquina(e.target.value)} /><InputGroupAddon><Search /></InputGroupAddon></InputGroup>
        </div>
        <ScrollArea className={s.machineScroll}>
        <nav className={s.machineList} aria-label="Colas por máquina">
          {maquinas.map(m => <Button key={m.id} variant={m.id === maquinaId ? 'default' : 'ghost'} className={s.machineButton} aria-pressed={m.id === maquinaId} onClick={() => seleccionar(m.id)}>
            <span className={s.machineIcon}><Factory /></span>
            <span className={s.machineCopy}><span>{m.nombre}</span><small>{m.estacion?.nombre ?? 'Sin estación'}{m.enCurso ? ` · ${m.enCurso} en curso` : ''}{!m.activo ? ' · Inactiva' : ''}</small></span>
            <Badge variant={m.id === maquinaId ? 'secondary' : 'outline'}>{m.pendientes}</Badge>
          </Button>)}
          {!maquinas.length && <p className={s.noMachines}>{buscarMaquina ? 'No hay máquinas con trabajo que coincidan.' : 'No hay máquinas con trabajo pendiente.'}</p>}
        </nav>
        </ScrollArea>
        {resumen.sinMaquina > 0 && <div className={s.unassigned}><span>{resumen.sinMaquina} operaciones sin máquina</span><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/produccion/tablero" />}>Ver en tablero<ArrowUpRight data-icon="inline-end" /></Button></div>}
      </aside>
      <section className={s.queue} aria-label="Trabajo de la máquina">
        <div className={s.mobileMachine}><Select value={maquinaId || null} onValueChange={id => { if (id) seleccionar(id); }} items={resumen.maquinas.map(m => ({ value: m.id, label: m.nombre }))}>
          <SelectTrigger aria-label="Seleccionar máquina"><SelectValue placeholder="Elegir máquina" /></SelectTrigger>
          <SelectContent><SelectGroup>{resumen.maquinas.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectGroup></SelectContent>
        </Select></div>
        <div className={s.queueHeader}>
          <div><h2 className={workspaceUi.sectionTitle}>{maquina?.nombre ?? 'Trabajo por máquina'}</h2><p>{maquina?.estacion?.nombre ?? 'Seleccioná una máquina para ver su cola.'}</p></div>
          {maquina && <div className={s.queueTotal}><strong>{totalMaquina}</strong><span>{totalMaquina === 1 ? 'operación' : 'operaciones'}</span></div>}
        </div>
        <Tabs value={filtro.estado} onValueChange={v => filtrar({ estado: v as EstadoCola, page: 1 })} className={s.tabs}>
          <div className={s.toolbar}>
            <TabsList>{ESTADOS.map(e => <TabsTrigger key={e.id} value={e.id}>{e.label}{datos && <span className={s.tabCount}>{datos.totales[e.id]}</span>}</TabsTrigger>)}</TabsList>
            <div className={s.search}><InputGroup><InputGroupInput aria-label="Buscar OT, cliente, lote o trabajo" placeholder="Buscar OT, cliente o trabajo…" maxLength={120} value={filtro.q} onChange={e => filtrar({ q: e.target.value, page: 1 })} /><InputGroupAddon><Search /></InputGroupAddon></InputGroup></div>
          </div>
          <TabsContent value={filtro.estado} className={s.content}>
            <div className={s.context}><Layers aria-hidden="true" /><span>Agrupados por material</span><span className={s.contextSource}>Plan de fabricación vigente</span></div>
            <div className={s.selectionBar}>
              <div className={s.selectionCopy}><strong aria-live="polite">{haySeleccion ? `${seleccion.ids.length} ${seleccion.ids.length === 1 ? 'trabajo seleccionado' : 'trabajos seleccionados'}` : 'Sin trabajos seleccionados'}</strong>
                <span id="motivo-nesting-cola" aria-live="polite" title={detalleSeleccion}>{detalleSeleccion}</span>
              </div>
              <div className={s.actions}><Button variant="ghost" size="sm" disabled={!haySeleccion || ocupado} onClick={() => { setSeleccion(SELECCION_COLA_VACIA); setErrorAccion(null); }}>Limpiar</Button>
                <Button variant="outline" size="sm" disabled={!haySeleccion || Boolean(motivoNesting) || cargando || ocupado} aria-describedby="motivo-nesting-cola" onClick={() => { if (!motivoNesting) setSimulacionIds([...seleccion.ids]); }}><Scan data-icon="inline-start" />Simular nesting</Button>
                {puedeCompletar && <Button size="sm" disabled={!haySeleccion || !seleccionVigente || cargando || ocupado} onClick={prepararCompletado}><CircleCheck data-icon="inline-start" />{completando ? 'Completando…' : 'Completar seleccionados'}</Button>}</div>
            </div>
            {errorAccion && <Alert variant="destructive"><AlertTitle>No se pudo registrar la acción</AlertTitle><AlertDescription>{errorAccion}</AlertDescription></Alert>}
            <div className={s.tableScroll} aria-busy={cargando}>
              {cargando ? <div className={s.loading} role="status" aria-label="Cargando trabajos">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                : datos?.items.length ? <TablaCola datos={datos} seleccion={seleccion} ocupado={ocupado} onAccion={puedeCompletar ? ejecutarAccion : undefined} onTomarMesa={puedeCompletar ? item => void tomarMesa(item) : undefined} onAlternar={item => setSeleccion(actual => alternarSeleccionCola(actual, item))} onGrupo={seleccionarGrupo} />
                : !error && <Empty><EmptyHeader><EmptyMedia variant="icon"><Factory /></EmptyMedia><EmptyTitle>{maquinaId ? 'No hay trabajos en esta selección' : 'No hay trabajo pendiente en máquinas'}</EmptyTitle><EmptyDescription>{filtro.estado === 'listos' ? 'Podés revisar En espera para ver qué falta antes de producir.' : 'Las operaciones de las órdenes emitidas aparecerán en la máquina que tienen asignada.'}</EmptyDescription></EmptyHeader></Empty>}
            </div>
          </TabsContent>
        </Tabs>
        <footer className={s.footer} aria-live="polite"><span>{datos ? `${datos.total} ${datos.total === 1 ? 'operación' : 'operaciones'} · Página ${datos.page} de ${datos.pages}` : cargando ? 'Cargando…' : 'Sin resultados'}</span>
          <div className={s.actions}><Button size="icon-sm" variant="outline" aria-label="Página anterior" disabled={cargando || !datos || datos.page <= 1} onClick={() => filtrar({ page: (datos?.page ?? 1) - 1 })}><ChevronLeft /></Button>
            <Button size="icon-sm" variant="outline" aria-label="Página siguiente" disabled={cargando || !datos || datos.page >= datos.pages} onClick={() => filtrar({ page: (datos?.page ?? 1) + 1 })}><ChevronRight /></Button></div>
        </footer>
      </section>
    </div>
  </div>;
}
