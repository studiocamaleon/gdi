# Máquinas mecanizadas (Corte Láser, Router CNC) — modelo de perfiles

> Definir la "estructura probada" de perfiles operativos para las máquinas de
> mecanizado, tomando el modelo relevado de Holdprint, para poder usar de verdad
> los pasos `corte_laser`, `grabado_laser` y `cnc` (hoy sin máquina configurada).
> Fecha: 2026-08-04. Estado: **IMPLEMENTADO (Fase 1), sin commitear.**

## Ejecución 2026-08-04 (Fase 1)

Decisiones tomadas: magnitud = **recorrido** (perímetro), unidad **nativa**
(láser mm/s, CNC mm/min), grabado por recorrido igual (raster → T-4). Hecho:

- **Enum `MM_MIN`** (Prisma + migración aditiva `20260804120000` + DTO + tipo front
  + `MaquinariaTemplateFieldUnit` + labels).
- **Motor**: la unidad→minutos se extrajo a `productividad-tiempo.ts`
  (`runMinPorProductividad`, función pura testeada). Agregó ramas `MM_S`/`MM_MIN`
  (recorrido en metros → mm ×1000). La rama T-3 ahora usa el resolver magnitud-aware
  **solo si la familia declara `magnitudTiempoDefault`** (gate: impresión/guillotina/
  laminado quedan idénticos).
- **Familias** (`familias.ts`): `corte_laser`, `grabado_laser`, `cnc` declaran
  `magnitudTiempoDefault: 'perimetro_piezas_m'`; `cnc` sumó T-4.
- **Templates** (`maquinaria-templates.ts`): `buildCorteLaserSections` (velocidad
  mm/s) y `buildRouterCncSections` (mm/min) con la tabla operación × material ×
  espesor + velocidad + setup. `defaultProductionUnit` → mm_s / mm_min.
- **RULES** (profile-rules) + `TEMPLATE_CATALOG_RULES`: claves e unidad por plantilla.
- **Tests**: `runMinPorProductividad` con 9 casos (mm/s, mm/min, m/min, ppm, hora).

Verificación: API build tsc + front tsc verdes. Suite motor: **17 fallos
PRE-EXISTENTES** (cotización falla por falta de tarifas de agosto 2026 — confirmado
con `git stash`, no es de este cambio) + los 9 nuevos pasan; sin regresión.

## Fase 2 (2026-08-04) — auto-selección de perfil

**Hecho:** auto-selección por **OPERACIÓN**. `indicePerfilUnicoPorOperacion`
(`seleccion-perfil-operacion.ts`, pura, 7 tests) mapea familia→operación
(`corte_laser`→CORTE/SEMICORTE, `grabado_laser`→GRABADO) y, en `resolverPerfil`
(motor), si queda **un solo** perfil de esa operación, ese gana. Una máquina con un
perfil por operación resuelve sola; con varios de la misma operación elige el
comercial. `cnc` no mapea (su operación no la fija la familia). Sin regresión (motor
sigue 11 fallos pre-existentes).

**Bloqueado — auto-resolución fina por material+espesor (→ Fase 3):** requiere
plumbing que hoy no existe:
- El `JobContext` NO expone `espesor` ni la familia de material del sustrato (sólo
  `slotMateriales` con ids y ancho/largo). Y `corte_laser`/`cnc` **no tienen slot de
  sustrato** (sólo `grabado_laser` lo tiene).
- `resolverPerfil(paso, jobContext)` no recibe el material ya resuelto (con sus
  `atributosVarianteJson`, donde vive el espesor).
- Plan: (1) dar a `corte_laser`/`cnc` un slot de sustrato; (2) resolver su material
  (familia + `espesor` de `atributosVarianteJson`) antes de `resolverPerfil`;
  (3) matchear en código el perfil por `tipoOperacion` + material + rango
  `espesorMinMm`–`espesorMaxMm` (como el filtro de operación, extendido).

**Otros pendientes:** semillas con perfiles reales (mejor que el usuario cargue los
de SU máquina, no los de Holdprint), grabado raster por área, verificación E2E
(el tema de tarifas ya se destrabó con el carry-forward de load-tarifas).

## 1. Estado actual (nuestro)

| Plantilla | Perfil hoy | Problema |
|-----------|-----------|----------|
| CORTE_LASER | **único**, tiempo por **T-4** (el comercial lo carga a mano al cotizar) | No hay velocidades estandarizadas; el paso no se puede costear solo. |
| ROUTER_CNC | **único**, `productivityValue` en **m²/h** (T-3) | Área ≠ recorrido: un corte calado tiene poco m² y mucho recorrido → subvalúa. Sin tabla por material/espesor. |

Familias (todas M-1, `DIRECT_FROM_JOBCONTEXT`, magnitud = **piezas**):
`corte_laser` (T-3/T-4), `grabado_laser` (T-3/T-4), `cnc` (T-3).

## 2. Modelo relevado de Holdprint (2026-07-21, memoria análisis competitivo)

Patrón común de sus mecanizadas: **(1) envolvente de trabajo, (2) TABLA de perfiles
de operación, (3) setup min por perfil**. El perfil **se resuelve solo por familia de
material + espesor** al cotizar, y `tiempo = geometría ÷ productividad + setup`.

- **Corte Láser**: envolvente 2,5×5 m, Z30; velocidad por espesor 2→30 mm:
  **450/120/90/30/20 m/h**; grabado **1500 m/h**; semicorte **600 m/h**. (Metros lineales.)
- **Router CNC**: X 2,8 / Y 5 / Z 150 mm; **19 perfiles** tipo Corte/Grabación/
  Semicortado por material×espesor en **m lineales/h** (MDF 3→18mm: 100→10; acrílico
  2→20mm: 35→17; PVC exp 2→30: 35→10; ACM 3: 25; grabado 1000; semicorte 200); setup 10 min.
- **(Bonus) Impresora 3D**: volumen 42³ cm; perfiles por **tamaño de pieza** (buckets
  hasta 1.000/8.000/27.000/64.000 cm³) → filamento (m) + tiempo (h) por bucket.
- **Mesa de corte** (Zünd): X 4,3 / Y 4 / Z 50; corte 10→50mm 100→60 m/h + Pliegue 120 + Semi 60.

Insight que ya habíamos anotado: **el valor no está en "la máquina" sino en la TABLA de
velocidades por operación × material × espesor.**

## 3. Lo que el motor YA soporta (no hay que inventarlo)

- **Magnitud de recorrido**: `piezaPerimetroTotalM` en el JobContext, auto-calculada
  por `calcularPerimetroPiezasM` (metros lineales del contorno de las piezas). Ya la
  usan `colocacion_ojales` y el costeo tercerizado (`perimetro_ml`). Para piezas
  rectangulares, perímetro = 2·(ancho+alto).
- **Unidades lineales**: el enum `UnidadProduccionMaquina` tiene `METRO_LINEAL`,
  `M_MIN`; la rama T-3 del motor calcula `runMin = cantidad / productividad` para
  `M_MIN` (m/min) y `= (cantidad/productividad)*60` para unidades por hora.
- **Elección de magnitud por familia**: `magnitudTiempoDefault` (una familia dice qué
  cantidad alimenta la productividad — piezas, perímetro, área…).
- **Auto-resolución de perfil**: `detalle.reglaSeleccion` (JsonLogic) elige el perfil
  cuyo criterio (material + espesor) matchea. Ya lo usa impresión/guillotina.
- **Perfiles múltiples por máquina**: el editor ya es una TABLA de filas de perfil.

Conclusión: **la "estructura probada" de Holdprint es implementable con lo existente.**

## 4. Modelo propuesto

### 4.1 Estructura del perfil operativo (la tabla)
Una fila por combinación operación × material × espesor. Campos del perfil:

| Campo | Tipo | Rol |
|-------|------|-----|
| `nombre` | text | Ej. "Corte MDF 6mm". |
| `tipoOperacion` | select: CORTE · GRABADO · SEMICORTE (CNC suma FRESADO/PERFORADO) | discriminante |
| `materialCompat` | familia/subfamilia de materia prima | criterio de resolución |
| `espesorMinMm` / `espesorMaxMm` | number | rango de espesor que cubre |
| `velocidad` | number, **m/h** | productividad (metros de recorrido por hora) |
| `setupMin` | number | carga + calibración por trabajo |

La regla de auto-selección se **deriva** de (materialCompat + rango de espesor +
tipoOperacion) — el modelador no escribe JsonLogic a mano.

### 4.2 Magnitud y UNIDAD del tiempo (investigado 2026-08-04)
`tiempo_run = recorrido / velocidad_del_perfil`, con
`recorrido = piezaPerimetroTotalM` (perímetro de las piezas). Suma `setupMin`. Es el
modelo Holdprint.

**Unidad de la velocidad = la NATIVA de cada máquina** (no m/h — el usuario no debe
convertir). Investigación: los láser CO2 se configuran en **mm/s** (default de
LightBurn); los router CNC en **mm/min** (feed rate estándar).

| Máquina | Unidad | Rama del motor |
|---------|--------|----------------|
| Corte Láser | **mm/s** (default), opción mm/min | `MM_S` ya existe: `run = recorrido_mm / v / 60` |
| Router CNC | **mm/min** | falta `MM_MIN` en el enum (1 línea), o usar `M_MIN` (m/min) |

Ojo con la unidad del recorrido según la rama: `MM_S` espera el recorrido en **mm**
(= `piezaPerimetroTotalM × 1000`); `M_MIN` lo espera en **m** (directo). El adaptador
del paso debe pasar la magnitud en la unidad que corresponde a la velocidad del perfil.

- **Límite honesto**: el perímetro rectangular es buen proxy para cortes simples
  (letras, paneles, cajas), pero **subvalúa** un vector calado/filigrana (el recorrido
  real > contorno). Para esos, escape **T-4** (el operario carga los metros/tiempo
  reales del RIP/CAM).

### 4.3 Grabado / fresado (raster vs vector)
- Grabado **vectorial** y corte → por **recorrido** (m/h), como arriba.
- Grabado **raster** o fresado de **desbaste** → por **área** (m²/h) usando
  `piezaAreaTotalM2` (ya existe). El perfil declara su unidad según la operación.

## 5. Decisiones a tomar

1. **Magnitud + unidad**: RESUELTO (investigación 2026-08-04) → **recorrido en unidad
   NATIVA** (láser mm/s, CNC mm/min), con **T-4** de escape para calados. Falta decidir
   solo si agregamos `MM_MIN` al enum para el CNC o lo dejamos en `M_MIN` (m/min).
2. **Alcance**: ¿modelamos las 2 (CORTE_LASER + ROUTER_CNC) con la misma estructura
   ahora, y dejamos 3D/mesa de corte para después? → **rec: sí**.
3. **Semicorte / grabado**: ¿los tratamos como `tipoOperacion` dentro del mismo perfil
   (una fila por operación) o perfiles separados? → **rec: `tipoOperacion` en la fila.**

## 6. Plan de implementación (tentativo)

- **A** — Familias: `corte_laser`/`cnc`/`grabado_laser` pasan su magnitud a perímetro
  (`magnitudTiempoDefault`) manteniendo T-4 como alternativa; revisar `outputsCanonicos`.
- **B** — Templates: reescribir `buildCorteLaserSections` y `buildRouterCncSections`
  con la sección de perfiles-tabla (tipoOperacion + material + espesorMin/Max +
  velocidad m/h + setup). Derivar `reglaSeleccion` de esos campos al guardar.
- **C** — Backend RULES (`maquinaria-template-profile-rules.ts`): claves + required.
- **D** — Semillas: cargar los perfiles reales relevados de Holdprint como punto de
  partida (curvas MDF/acrílico/PVC/ACM por espesor) para la Cortadora CO2 y el CNC.
- **E** — Tests de motor: un producto "Letra corpórea MDF 6mm" → verificar
  `tiempo = perímetro / velocidad + setup`.

## 7. Fuera de alcance (futuro)
- Impresora 3D (perfiles por volumen de pieza → filamento + tiempo por bucket).
- Recorrido real desde el vector del archivo (hoy aproximamos con el perímetro).
- Mesa de corte (Zünd) con tipo Pliegue.
