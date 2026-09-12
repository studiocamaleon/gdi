'use client';

import * as React from 'react';
import { RotateCw, LockKeyhole, Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { simularNestingCola, type SimulacionNestingCola } from '@/lib/colas-produccion';
import { NestingCanvas } from '@/components/nesting/nesting-canvas';
import { dibujoNestingCola } from '@/lib/nesting-cola-vista';
import { cn } from '@/lib/utils';
import theme from '@/components/ui/workspace-theme.module.css';
import ui from '@/components/ui/workspace-ui.module.css';
import s from './simular-nesting-cola.module.css';

const numero = (v: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(v);
type Alternativa = SimulacionNestingCola['alternativas'][number];

export function DibujoSimulacionRollo({ datos, alternativa, svgRef }: {
  datos: SimulacionNestingCola; alternativa: Alternativa; svgRef?: React.Ref<SVGSVGElement>;
}) {
  const result = React.useMemo(() => dibujoNestingCola(datos, alternativa), [datos, alternativa]);
  return <NestingCanvas result={result} svgRef={svgRef}
    accessibleLabel={`Acomodo en rollo de ${numero(alternativa.anchoMm / 1000)} m por ${numero(alternativa.largoMm / 1000)} m`} />;
}

export function SimularNestingCola({ maquinaId, pasoIds, onCerrar }: { maquinaId: string; pasoIds: string[]; onCerrar: () => void }) {
  const [datos, setDatos] = React.useState<SimulacionNestingCola | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ancho, setAncho] = React.useState<number | null>(null);
  const [revision, setRevision] = React.useState(0);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const solicitudRef = React.useRef<{ clave: string; resultado: Promise<SimulacionNestingCola> } | null>(null);
  const ids = JSON.stringify(pasoIds);
  React.useEffect(() => {
    let activa = true;
    const clave = JSON.stringify([maquinaId, ids, revision]);
    setError(null); setDatos(null);
    // Reutilizar el arranque si React repite el efecto. Cancelar el fetch no
    // cancela el cálculo ya iniciado en el servidor y generaba un falso conflicto.
    if (solicitudRef.current?.clave !== clave) {
      solicitudRef.current = { clave, resultado: simularNestingCola(maquinaId, JSON.parse(ids) as string[]) };
    }
    void solicitudRef.current.resultado
      .then(r => { if (activa) { setDatos(r); setAncho(r.alternativas[0]?.anchoMm ?? null); } })
      .catch(e => { if (activa) setError(e instanceof Error ? e.message : 'No se pudo calcular el acomodo.'); });
    return () => { activa = false; };
  }, [maquinaId, ids, revision]);
  const alternativa = datos?.alternativas.find(a => a.anchoMm === ancho);
  function descargar() {
    if (!svgRef.current || !alternativa) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svgRef.current)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `simulacion-rollo-${alternativa.anchoMm}mm.svg`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Dialog open onOpenChange={open => { if (!open) onCerrar(); }}>
    <DialogContent className={cn(theme.theme, s.dialog)}>
      <DialogHeader className={s.header}>
        <DialogTitle className={ui.sectionTitle}>Simular nesting</DialogTitle>
        <DialogDescription>{datos ? `${datos.maquina.nombre} · ${datos.materialNombre} · ${datos.trabajos.length} trabajos · ${datos.piezas.length} piezas / paneles` : `${pasoIds.length} trabajos seleccionados · Acomodo en rollo`}</DialogDescription>
      </DialogHeader>
      <div className={s.body}>
        {error ? <Alert variant="destructive"><AlertTitle>No se pudo simular</AlertTitle><AlertDescription>{error}<Button variant="outline" size="sm" onClick={() => setRevision(v => v + 1)}><RefreshCw data-icon="inline-start" />Reintentar</Button></AlertDescription></Alert>
          : !datos ? <div role="status" className={s.loading}><p>Comparando los anchos del material…</p><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></div>
          : <>
            {alternativa && <>
              <div className={s.widths}><span>Ancho de rollo</span><ToggleGroup value={[String(ancho)]} onValueChange={v => { if (v.length) setAncho(Number(v[0])); }} variant="outline" spacing={1} aria-label="Ancho de rollo">
                {datos.alternativas.map((a, i) => <ToggleGroupItem key={a.anchoMm} value={String(a.anchoMm)}>{numero(a.anchoMm / 1000)} m{i === 0 && <Badge variant="secondary">Recomendado</Badge>}</ToggleGroupItem>)}
              </ToggleGroup></div>
              <dl className={s.metrics}><div><dt>Largo necesario</dt><dd>{numero(alternativa.largoMm / 1000)} m</dd></div><div><dt>Material consumido</dt><dd>{numero(alternativa.superficieM2)} m²</dd></div><div><dt>Aprovechamiento</dt><dd>{numero(alternativa.aprovechamientoPct)}%</dd></div></dl>
              <p className={s.note}>Recomendado por menor superficie consumida entre los acomodos calculados. Se respetan el ancho y los márgenes de la máquina, la rotación y los paneles de cada trabajo.</p>
              <div className={s.drawing}><DibujoSimulacionRollo datos={datos} alternativa={alternativa} svgRef={svgRef} /></div>
            </>}
            {!alternativa && <Alert><AlertTitle>Las piezas no caben en los anchos disponibles</AlertTitle><AlertDescription>Se conservaron las medidas y la orientación permitida de cada trabajo.</AlertDescription></Alert>}
            <details className={s.details}><summary>Comparar anchos y ver márgenes</summary>
              <Table className={ui.dataTable}><TableHeader><TableRow><TableHead>Ancho</TableHead><TableHead>Largo</TableHead><TableHead>Consumo</TableHead><TableHead>Aprovechamiento</TableHead></TableRow></TableHeader><TableBody>
                {datos.alternativas.map(a => <TableRow key={a.anchoMm}><TableCell>{numero(a.anchoMm / 1000)} m</TableCell><TableCell>{numero(a.largoMm / 1000)} m</TableCell><TableCell>{numero(a.superficieM2)} m²</TableCell><TableCell>{numero(a.aprovechamientoPct)}%</TableCell></TableRow>)}
              </TableBody></Table>
              <p className={s.note}>{datos.maquina.nombre} · Ancho máximo: {numero(datos.maquina.anchoMaximoMm / 1000)} m. Márgenes: {numero(datos.margenes.izquierda)} / {numero(datos.margenes.derecha)} mm laterales; {numero(datos.margenes.inicio)} / {numero(datos.margenes.fin)} mm al inicio y al final. Separación horizontal / vertical: {numero(datos.separacionMm)} / {numero(datos.separacionVerticalMm)} mm. Incluye las demasías configuradas; se aplica el mayor requisito de los trabajos seleccionados.</p>
            </details>
            {datos.descartados.map(d => <p className={s.note} key={d.anchoMm}><strong>{numero(d.anchoMm / 1000)} m:</strong> {d.motivo}</p>)}
            <details className={s.details}><summary>Piezas incluidas y permisos de rotación</summary><Table className={ui.dataTable}><TableHeader><TableRow><TableHead>Trabajo / pieza</TableHead><TableHead>Medida</TableHead><TableHead>Rotación</TableHead><TableHead>Solapes</TableHead></TableRow></TableHeader><TableBody>
              {datos.piezas.map(p => <TableRow key={p.id}><TableCell>{p.etiqueta}</TableCell><TableCell>{numero(p.anchoMm / 10)} × {numero(p.altoMm / 10)} cm</TableCell><TableCell><Badge variant="outline">{p.permiteRotar ? <RotateCw data-icon="inline-start" /> : <LockKeyhole data-icon="inline-start" />}{p.permiteRotar ? 'Permitida' : 'Orientación fija'}</Badge></TableCell><TableCell>{p.panel ? `${numero(p.solapeInicioMm)} / ${numero(p.solapeFinMm)} mm` : '—'}</TableCell></TableRow>)}
            </TableBody></Table></details>
          </>}
      </div>
      <footer className={s.footer}><p>Simulación orientativa. La combinación queda a criterio del impresor. Las OT y la planificación se mantienen.</p><div className={s.actions}>
        {alternativa && <Button variant="outline" onClick={descargar}><Download data-icon="inline-start" />Descargar dibujo</Button>}
        <Button onClick={onCerrar}>Cerrar</Button>
      </div></footer>
    </DialogContent>
  </Dialog>;
}
