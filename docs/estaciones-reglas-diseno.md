# Estaciones por reglas — rediseño (diseño)

> Estado: **diseño**, sin ejecución. Rama `feat/estaciones-reglas`.
> Sucesor de `docs/estaciones-diseno.md` (el modelo actual, 2026-07-17).
> Fecha: 2026-07-31.

## 1. Objetivo / disparador

Hoy una estación agrupa **familias de pasos**, y el paso llega a su estación por
la familia (+ un filtro por máquina que usa el **centro de costo** como proxy).
Eso limita en dos casos reales:

1. **Una misma familia (o categoría) con pasos distintos que van a estaciones
   distintas.** La familia los agrupa a todos en una sola estación; no hay forma
   de mandar unos a una estación y otros a otra.
2. **Un mismo tipo de paso que corre en distintas máquinas/tecnologías**, cada
   una en su estación (ej. 4 estaciones de impresión: UV, eco solvente, digital
   producción, digital centro de copiado). El separador fino de hoy es el
   **centro de costo**, que es un concepto de **costeo**, no de piso de taller,
   y no distingue *misma tecnología / distinta máquina* si comparten centro.

**Principio del rediseño (idea del usuario):** la **estación declara qué
agrupa** mediante **reglas/filtros**; el **paso no declara ninguna estación**; y
el ruteo se hace por la **señal real (máquina / tecnología)**, no por el centro
de costo.

## 2. Estado actual (lo que hay)

- **`Estacion`**: nombre, `etapa` (fija, catálogo de 6), `capacidadConcurrente`,
  `icono`, `horario`. Relaciones: `familias` (`EstacionFamilia`), `maquinas`
  (`Maquina.estacionId`), `empleados` (`EstacionEmpleado`).
- **`EstacionFamilia`**: rutea un `familiaCodigo` (catálogo o UUID de
  `FamiliaTenant`) a una estación. Es la única fuente de ruteo.
- **`Maquina`**: `estacionId` (en qué estación está) y `tecnologia` (catálogo
  uv/dtf_textil/…). El costeo usa `centroCostoPrincipalId` — eje independiente.
- **Derivación** (`resolverEstacionDePaso`, src/lib/tablero-produccion.ts):
  familia → estaciones candidatas; si el paso tiene `centroCostoId`, gana la
  estación cuya **máquina tiene ese mismo centro**; si no, la "general" (sin
  máquinas); si no, "Sin estación". Determinista.
- **Sin `estacionId` en el paso** (D7): el mapeo es en lectura.
- **El paso materializado sólo recuerda `familiaCodigo` + `centroCostoId`** — NO
  guarda `maquinaId` ni `tecnologia`. El motor SÍ los resuelve al cotizar
  (`resolverTecnologiaMaquina`, elige la máquina), pero no se persisten en el
  paso.
- **Editor de pasos del tenant**: selector de **una sola** estación (escribe una
  fila en `EstacionFamilia`; al editar hace *replace destructivo*).
- **Consumidores**: tablero "Por estación", capacidad de estaciones y el motor
  de ETA (`apps/api/src/eta/…` y `src/lib/flujo-produccion.ts`).

## 3. Los problemas concretos

1. **La familia es una clave de ruteo demasiado gruesa.** Todos los pasos de una
   familia caen en la(s) misma(s) estación(es). No se pueden separar pasos
   distintos de la misma familia/categoría.
2. **El separador fino es el centro de costo (proxy de costeo).** Mezcla dos
   ejes que el propio diseño quería separados, y no distingue misma-tecnología /
   distinta-máquina cuando comparten centro.
3. **El selector único de estación en el paso limita el paso.** Y su *replace
   destructivo* pisa cualquier asignación multi-estación hecha del lado de la
   estación.

## 4. Prerrequisito: el paso debe recordar su máquina

Para filtrar "por máquina" o "por tecnología", el paso materializado tiene que
saber **con qué máquina se hizo**. Hoy sólo guarda el centro. **El motor ya
elige la máquina y resuelve su tecnología al cotizar** — falta persistirlo:

> Persistir `maquinaId` (y de ahí la `tecnologia`) en la trazabilidad del paso
> materializado. Con eso, la estación filtra por la señal real y el centro de
> costo deja de participar del ruteo (sigue sólo para costeo).

## 5. Modelo propuesto: la estación captura por reglas

Una **Estación** declara un conjunto de **reglas de captura**. Cada regla
matchea un paso por uno de estos criterios (de más específico a más general):

| Regla | Matchea el paso si… | Ejemplo |
|---|---|---|
| **Por máquina** | se hizo con esa máquina | "Centro de copiado" = las láser puntuales |
| **Por tecnología** | su máquina es de esa tecnología | "Impresión UV" = tecnología `uv` |
| **Por paso concreto** | es esa familia/paso puntual | separar dos pasos de la misma categoría |
| **Por familia** | pertenece a esa familia | "Bordado" = familia bordado |

**Derivación** (reemplaza a `resolverEstacionDePaso`):
- Para cada paso, se evalúan las reglas de todas las estaciones y gana la de
  **mayor especificidad**: `máquina > tecnología > paso concreto > familia`.
- Determinista: un paso cae en **una sola** estación. Empates dentro del mismo
  nivel se previenen con reglas de consistencia (abajo). Sin match → **"Sin
  estación"**.
- La **etapa** sigue fija por estación (D4 del modelo actual, no cambia).
- Sigue **sin `estacionId` en el paso**: reconfigurar re-rutea en vivo.

**Reglas de consistencia** (validadas en el service, como hoy la "una general
por familia"):
- Una **máquina** captura en **una sola** estación (una máquina vive en una
  estación — se mantiene).
- Una **tecnología** capturada por a lo sumo una estación (si no, ambigüedad).
- Prioridad explícita resuelve solapamientos entre niveles (una impresora UV
  matchea "por máquina" y "por tecnología uv" → gana la de máquina).

## 6. Los casos del usuario, contra el modelo

- **4 impresiones** (UV / eco solvente / digital producción / digital centro de
  copiado): UV y eco por **tecnología**; las dos digitales (misma tecnología,
  distinta máquina) por **máquina**. Ya no importa si las láser comparten centro
  de costo.
- **Bordado / serigrafía / estampado** (sin máquina, familias propias distintas):
  por **familia / paso concreto** — cada paso propio a su estación.
- **Misma familia, pasos distintos a estaciones distintas**: por **paso
  concreto** (la regla que hoy no existe).
- **Paso sin máquina de tecnología única**: una regla "por familia/paso" y listo
  — como bien señaló el usuario, ahí una estación fija nunca fue problema.

## 7. Migración desde el modelo actual

- Las asignaciones `EstacionFamilia` de hoy → reglas **"por familia"** (mapeo 1:1,
  neutral para lo que ya andaba por familia).
- El **filtro por centro de costo** de la derivación se **retira** en favor de
  "por máquina" (necesita el prerrequisito §4). Mientras tanto puede convivir
  como fallback para órdenes viejas sin `maquinaId` persistido.
- El **selector único** del editor de pasos del tenant: se **saca** (el ruteo se
  arma desde la estación) o se convierte en "regla por paso" no destructiva.

## 8. Impacto (qué toca)

- **Schema**: modelo de reglas de estación (reemplaza/extiende `EstacionFamilia`);
  `maquinaId` (+ tecnología derivable) en la trazabilidad del paso.
- **Motor / materialización**: persistir el `maquinaId` elegido en cada paso.
- **Derivación**: nueva `resolverEstacionDePaso` por reglas + prioridad.
- **Backend estaciones** (`produccion.service.ts`): CRUD de reglas + validaciones
  de consistencia.
- **Front**: UI de armado de estaciones **por tecnología / máquina / paso /
  familia**; sacar el selector de estación del editor de pasos.
- **Consumidores**: tablero "Por estación", capacidad y ETA usan la derivación
  nueva (misma interfaz de salida: paso → estación).

## 9. Fases sugeridas

- **A — Persistir la máquina en el paso** (prerrequisito). Sin cambio de UX;
  habilita todo lo demás. Fallback al centro para órdenes sin `maquinaId`.
- **B — Modelo de reglas + derivación** (backend): reglas de estación, nueva
  resolución con prioridad, validaciones de consistencia, migración de
  `EstacionFamilia` → regla "por familia".
- **C — UI de estaciones por filtros** (front): armar estaciones por
  tecnología/máquina/paso/familia; sacar el selector del editor de pasos.
- **D — Retiro del ruteo viejo**: quitar el filtro por centro de costo y el
  `EstacionFamilia` legacy una vez migrado y verificado.

## 10. Decisiones abiertas

1. ¿Las reglas son una tabla nueva (`EstacionRegla` con `tipo` +
   `valor`) o se extiende `EstacionFamilia` con un `tipo`? (Recomendación: tabla
   nueva, más clara; `EstacionFamilia` se migra y se retira.)
2. La `tecnologia` del paso: ¿se persiste junto al `maquinaId` o se deriva
   siempre de la máquina en lectura? (Recomendación: guardar `maquinaId`, derivar
   tecnología — una sola fuente de verdad.)
3. ¿Se permite una regla "catch-all" por estación (como la "general" de hoy)
   para los pasos sin máquina que no matchean nada? (Probable que sí.)
4. Órdenes históricas sin `maquinaId`: ¿fallback permanente al centro de costo, o
   se acepta que caigan a "Sin estación"? (Recomendación: fallback al centro
   mientras existan.)
