# Merma operativa y bases de consumo

## Regla de dominio

La merma física del sustrato no se propaga como un porcentaje ciego a todos
los costos. El motor distingue dos causas:

1. **Desperdicio geométrico:** márgenes, separaciones, retazos y redondeo del
   material cobrado por el nesting. Afecta al sustrato, pero una zona vacía no
   recibe tinta ni crea por sí sola una pasada adicional.
2. **Merma operativa:** arranque, pruebas o impresiones rechazadas. Es una
   repetición esperada de la corrida y afecta sustrato, tinta, clicks y tiempo
   variable. No repite setup, cleanup ni consumos por original como el máster
   de una duplicadora.

`mermaAdicionalPct` del slot `sustrato_principal` es la fuente de merma
operativa para un paso de impresión. Los demás slots conservan su pérdida
propia, pero no gobiernan la máquina.

## Bases canónicas

| Costo             | Base de cálculo                                                 |
| ----------------- | --------------------------------------------------------------- |
| Sustrato          | unidades o superficie cobradas por el nesting + merma operativa |
| Tinta/tóner       | área de piezas acomodadas × cobertura × caras + merma operativa |
| Clicks            | pliegos procesados × caras × equivalencia A4 + merma operativa  |
| Cabezal por tinta | ml de tinta calculados, incluida la merma operativa             |
| Tiempo            | corrida productiva + corrida de merma; setup y cleanup una vez  |

El área impresa nunca se reconstruye desde la superficie completa comprada. En
un nesting multi o de rollo se usa `metricasRaw.areaUtilMm2`; en un
`grid-2d-single`, cuya vista contiene la capacidad de una hoja modelo, se
escala el área unitaria por la cantidad solicitada. `demandaRectangular`, si
existe, tiene prioridad porque describe la demanda exacta.

## Trazabilidad

Cada línea afectada congela `mermaAdicional` con:

- `porcentaje`;
- `cantidadTrabajo`;
- `cantidadMerma`.

El total de la línea siempre es la suma de ambas cantidades. En sustratos con
nesting, `detalleCosteoNesting` sigue describiendo exclusivamente el costeo
geométrico; la merma operativa queda separada y se agrega después. Así el visor
no necesita inventar un acomodo inexistente para explicar la pérdida de
proceso.

En nesting compuesto sólo se agrupan pasos con el mismo porcentaje operativo:
el porcentaje forma parte de la firma de compatibilidad. El lote conserva por
separado el costo geométrico, el costo de merma y el total, y luego distribuye
ese total entre los componentes con la misma ponderación usada para el
sustrato consolidado.

## Casos de control

- Una hoja ocupada al 50%: se cobra una hoja, se tinta el área colocada y se
  cuenta la pasada real; el 50% vacío no se convierte en tinta.
- Diez hojas productivas con 20% operativo: se costean doce hojas esperadas,
  tinta para doce corridas equivalentes y doce clicks base equivalentes.
- Doble faz: tinta y clicks multiplican por caras antes de aplicar la pérdida
  operativa.
- Un máster de duplicadora: continúa siendo uno por original/cara; las hojas
  rechazadas no crean otro máster.
