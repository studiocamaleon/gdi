# Centros de costo — arrastre de tarifas mes a mes (carry-forward)

> El sistema exigía re-cargar las tarifas de cada centro al cambiar de mes, y el
> motor fallaba la cotización si el mes en curso no tenía tarifa PUBLICADA (era el
> origen de fallos en dev/tests cada vez que arrancaba un mes nuevo). Ahora las
> tarifas se arrastran solas; el botón manual de copiar también volvió.
> Fecha: 2026-08-04. Estado: **IMPLEMENTADO, sin commitear.**

## Problema

- Las tarifas de centro viven por período: `CentroCostoTarifaPeriodo` (PUBLICADA/
  BORRADOR) + los datos que la producen (`CentroCostoLinea`, `CentroCostoCapacidadPeriodo`),
  todos con `periodo` "YYYY-MM".
- El motor las leía por período EXACTO (`loadTarifasHorarias`, único punto que
  centraliza los 4 motores). Sin tarifa del mes → cotización `exitoso:false`.
- El botón "Copiar mes anterior" de la ficha se perdió en el refactor de carga
  manual (commit `6cc699d8`).

## Solución

### 1. Arrastre automático al LEER (motor) — `load-tarifas.ts`
En vez de pedir el período exacto, `loadTarifasHorarias` toma la tarifa PUBLICADA
más reciente **≤ período pedido**, por centro:

```
where: { tenantId, estado: PUBLICADA, periodo: { lte: periodoPedido } }
orderBy: { periodo: 'desc' }   // el primero por centro = el vigente
```

- Si el mes pedido tiene tarifa, gana ella (es la mayor ≤ período) → comportamiento
  idéntico al histórico.
- Si no, hereda la del último mes publicado. La imprenta no re-carga nada cada mes:
  valen las anteriores hasta que las cambie.
- Es un fallback de LECTURA: no escribe nada, no materializa períodos. Sólo el
  camino de cotización; los reportes/ficha siguen viendo el dato real por período.

### 2. Botón manual "Copiar de {período anterior}" — `centro-costo-ficha.tsx`
Trae la planilla del período anterior (líneas + horas productivas) al formulario
actual, marca sucio y deja que el usuario revise y guarde (publica en el período
actual). Para cuando SÍ quiere editar partiendo de lo anterior. Es front puro
(reusa `getCentroCostoConfiguracion` del período anterior); el helper
`periodoAnterior("YYYY-MM")` vive en `src/lib/costos.ts`.

## Efecto colateral (bueno)
El arrastre destrabó 6 tests del motor que fallaban por falta de tarifa de agosto
2026 (17 → 11). Los 11 restantes son aserciones stale pre-existentes que el problema
de tarifas venía enmascarando (confirmado: fallan igual con los cambios del motor
revertidos) — a resolver aparte.

## Futuro (no hecho)
- Mostrar en la ficha los valores heredados como "de {período}" cuando el mes en
  curso no tiene datos propios (hoy aparece vacío hasta copiar).
- Materializar el período nuevo por cron al cambiar de mes (hoy el arrastre es lazy
  en lectura, que alcanza para cotizar).
