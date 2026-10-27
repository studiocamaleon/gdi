import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IluminacionTubosEjecutada } from '../../../apps/api/src/motor-universal/iluminacion-tubos-led';

const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function IluminacionTubosResumen({ plan }: { plan: IluminacionTubosEjecutada }) {
  const horizontal = plan.orientacion === 'horizontal';
  return (
    <Card size="sm">
      <CardHeader><CardTitle>Distribución de tubos LED · por cartel</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {plan.tubosPorCartel <= 500 ? <svg viewBox={`-20 -20 ${plan.anchoMm + 40} ${plan.altoMm + 40}`} role="img" aria-label={`${plan.tubosPorCartel} tubos LED de ${numero(plan.largoTuboMm / 10)} cm`} className="h-56 w-full text-primary">
          <rect width={plan.anchoMm} height={plan.altoMm} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {Array.from({ length: plan.tubosPorCartel }, (_, i) => {
            const fila = Math.floor(i / plan.tubosPorFila), columna = i % plan.tubosPorFila;
            const transversal = plan.retiroMm + (fila + 0.5) * plan.separacionFilasMm;
            const inicio = plan.retiroMm + plan.separacionExtremosMm / 2 + columna * (plan.largoTuboMm + plan.separacionExtremosMm);
            return <line key={i} x1={horizontal ? inicio : transversal} y1={horizontal ? transversal : inicio} x2={horizontal ? inicio + plan.largoTuboMm : transversal} y2={horizontal ? transversal : inicio + plan.largoTuboMm} stroke="currentColor" strokeWidth={3} vectorEffect="non-scaling-stroke" />;
          })}
        </svg> : null}
        <p>{plan.tubosPorCartel} tubos de {numero(plan.largoTuboMm / 10)} cm · {plan.filas} filas de {plan.tubosPorFila} · {numero(plan.wattsPorCartel)} W por cartel.</p>
        <p>Alimentación directa a 220 V · sin fuente externa.</p>
        <p className="text-sm text-muted-foreground">Separación entre filas: {numero(plan.separacionFilasMm / 10)} cm. Holgura de montaje: {numero(plan.retiroMm / 10)} cm por borde. Validar uniformidad con la profundidad y la lona elegidas.</p>
      </CardContent>
    </Card>
  );
}
