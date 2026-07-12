# Mano de obra sólo en setup/cleanup (no en el runtime de máquina)

Fecha: 2026-07-11

## Problema

La tarifa horaria de cada centro de costo es **una sola tarifa mezclada**:

```
tarifaCalculada = costoMensualTotal / capacidadPractica
```

donde `costoMensualTotal` incluye, en la misma bolsa, la mano de obra
(componentes `SUELDOS` + `CARGAS`) junto con maquinaria, energía, alquiler,
amortización, gastos generales y el reparto absorbido.

El motor costea cada paso como:

```
totalMin = setup + run + cleanup + tiempoFijo
costo    = (totalMin / 60) × tarifaCalculada
```

Como la mano de obra ya viene dentro de `tarifaCalculada`, **el operario se
cobra también sobre el `run`** — el tiempo en que la máquina corre sola. Eso no
refleja la realidad: durante el run la máquina es autónoma y el operario no está
dedicado (prepara/limpia, o atiende otras máquinas).

## Objetivo

La hora hombre debe cobrarse **sólo sobre setup + cleanup (+ tiempo fijo)** en
los pasos con máquina. El costo de máquina (amortización, energía, overhead)
sigue aplicando a todo el tiempo que la máquina está ocupada (setup + run +
cleanup + fijo). En los pasos **sin máquina** (M-0 manuales: embalaje, diseño,
armado) la mano de obra sigue cobrándose sobre todo el tiempo, porque ahí el
operario ES quien hace el trabajo.

## Diseño: desdoblar la tarifa del centro

Se calcula y publica, junto a la tarifa total, una **sub-tarifa de mano de obra**:

```
costoMensualManoObra = Σ componentes con categoría ∈ { SUELDOS, CARGAS }
tarifaManoObra       = costoMensualManoObra / capacidadPractica
tarifaMaquina        = tarifaCalculada − tarifaManoObra      (≥ 0)
```

El motor costea:

```
minutosMaquina  = setup + run + cleanup + tiempoFijo          (= totalMin)
tieneMaquina    = paso.maquina?.centroCostoPrincipalId != null
minutosOperario = tieneMaquina ? (setup + cleanup + tiempoFijo) : totalMin
                = tieneMaquina ? (totalMin − run)            : totalMin

costo = minutosMaquina/60  × tarifaMaquina
      + minutosOperario/60 × tarifaManoObra
```

### Propiedades

- **Retro-compatible en pasos sin máquina**: `minutosOperario = totalMin`, por lo
  que `costo = totalMin/60 × (tarifaMaquina + tarifaManoObra) = totalMin/60 ×
  tarifaCalculada`. Idéntico a hoy.
- **En pasos con máquina** baja exactamente `run/60 × tarifaManoObra`: se saca la
  mano de obra del run y nada más.
- **Fallback seguro**: tarifas publicadas antes de esta feature tienen
  `tarifaManoObra = 0` hasta que se recalculan/re-publican → se comportan como
  hoy (toda la tarifa va a `tarifaMaquina`, aplicada a `totalMin`). No hay que
  forzar backfill; recalcular la tarifa del centro activa el nuevo comportamiento.

## Decisiones (confirmadas con el usuario 2026-07-11)

- **Hora hombre = SUELDOS + CARGAS.**
- **Tiempo fijo (T-1) cuenta como operario** en pasos con máquina (se trata como
  setup/cleanup, no como run desatendido).

## Alcance / limitaciones v1

- La mano de obra usa la **misma `capacidadPractica`** que la máquina como
  denominador (aproximación). Un denominador de horas-hombre propio queda para
  una mejora futura.
- No hay "factor de supervisión" parcial durante el run: la mano de obra sobre el
  run es 0. Si en el futuro un operario supervisa N máquinas, se podría cargar una
  fracción.

## Piezas tocadas

1. Schema: `CentroCostoTarifaPeriodo.costoMensualManoObra` y `.tarifaManoObra`
   (Decimal 12,2, default 0) + migración.
2. `buildTarifaSnapshot`: computa y persiste la mano de obra; la agrega a
   `resumenJson`.
3. `loadTarifasHorarias`: devuelve `{ tarifa, manoObra }` por centro.
4. Motor `computeTiempoPaso`: aplica el split y expone el desglose
   (`costoMaquina`, `costoManoObra`, `tarifaManoObra`, `minutosOperario`).
5. UI desglose por paso: muestra máquina vs. mano de obra.
