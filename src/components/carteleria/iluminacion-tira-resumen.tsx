import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IluminacionTiraEjecutada } from '../../../apps/api/src/motor-universal/iluminacion-tira-led.contrato';

const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function IluminacionTiraResumen({ plan }: { plan: IluminacionTiraEjecutada }) {
  const horizontal = plan.orientacion === 'horizontal';
  const inicio = ((horizontal ? plan.anchoMm : plan.altoMm) - plan.largoFilaMm) / 2;
  const filasDibujo = Math.min(plan.filas, 200);
  return (
    <Card size="sm">
      <CardHeader><CardTitle>Distribución de tira LED · por cartel</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <svg viewBox={`-20 -20 ${plan.anchoMm + 40} ${plan.altoMm + 40}`} role="img" aria-label={`${plan.filas} filas de tira LED ${horizontal ? 'horizontales' : 'verticales'}`} className="h-56 w-full text-primary">
          <rect width={plan.anchoMm} height={plan.altoMm} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {Array.from({ length: filasDibujo }, (_, i) => {
            const posicion = plan.retiroMm + (i + 0.5) * plan.separacionRealMm * plan.filas / filasDibujo;
            return <line key={i} x1={horizontal ? inicio : posicion} y1={horizontal ? posicion : inicio} x2={horizontal ? inicio + plan.largoFilaMm : posicion} y2={horizontal ? posicion : inicio + plan.largoFilaMm} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <p>{plan.filas} filas de {numero(plan.largoFilaMm / 10)} cm · {numero(plan.metrosPorCartel)} m de tira · {numero(plan.wattsPorCartel)} W a {plan.tensionV} V.</p>
        <p>{plan.fuentes ? `${plan.fuentes.porCartel} fuente${plan.fuentes.porCartel === 1 ? '' : 's'} de ${numero(plan.fuentes.capacidadW)} W por cartel` : 'Fuentes pendientes de selección'} · margen adicional {numero(plan.margenPct)}%.</p>
        <p className="text-sm text-muted-foreground">Separación real: {numero(plan.separacionRealMm / 10)} cm. Validar uniformidad con el frente y la profundidad elegidos. El dibujo muestra la distribución; las conexiones se definen en taller.</p>
        <p className="text-sm text-muted-foreground">{plan.maxAlimentacionM === null ? 'Pendiente: confirmar con el proveedor el largo máximo de tira por alimentación.' : `Límite declarado: ${numero(plan.maxAlimentacionM)} m por alimentación; al menos ${plan.alimentacionesMinimas} tramos alimentados por cartel.`}</p>
      </CardContent>
    </Card>
  );
}
