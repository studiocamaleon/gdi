# Plancha térmica + Aplicación de transfer textil — diseño

> Reencuadre de la familia `aplicacion_transfer` como el **planchado** sobre prenda,
> y modelado de la máquina **plancha térmica** (nueva plantilla) con sus perfiles
> operativos, para que el motor calcule la productividad (T-3).
> Fecha: 2026-08-03. Estado: **IMPLEMENTADO** (sin commitear). Decisiones tomadas:
> **split** (familia textil M-1 aparte de DTF UV manual M-0) + perfil **por ciclo**.

## Estado de ejecución (2026-08-03)

Hecho y verde (tsc build API + front tocado, 11 tests maquinaria + 37 pasos/plancha):
- Prisma: enum `PLANCHA_TERMICA` + migración `20260803201500_add_plancha_termica_plantilla` (aditiva, `ADD VALUE`), aplicada con `migrate deploy` + `prisma generate`.
- Backend: `PlantillaMaquinariaDto.plancha_termica`; entradas en `RULES` (profile-rules), `RULES` (machine-rules) y `TEMPLATE_CATALOG_RULES` (geometría PLANO / unidad PIEZAS_H).
- Derivación ciclo→productividad: módulo puro `apps/api/src/maquinaria/plancha-termica.ts` (`deriveProductividadPlanchaTermica`), llamado en `maquinaria.service.ts` `buildPerfilData`. Test unitario `__tests__/plancha-termica-productividad.spec.ts` (5 casos).
- Front: tipo `"plancha_termica"` + `buildPlanchaTermicaSections()` + entrada en `maquinariaTemplates` (`maquinaria-templates.ts`); entrada en `materia-prima-templates.ts`.
- Familias (`familias.ts` + `types.ts`): `aplicacion_transfer` → **"Aplicación DTF UV manual"** (M-0/T-2, objetos); NUEVA `aplicacion_transfer_textil` → **"Aplicación de transfer textil"** (M-1/T-3, `PLANCHA_TERMICA`). Mapas UI `tablero-produccion.ts` + `tracking.ts`.

Decisión de datos: el código `aplicacion_transfer` se quedó como la familia MANUAL, así los 2 configs vivos (Remera y Taza, ambos T-2 manual) NO se rompen. La Remera se puede re-apuntar a `aplicacion_transfer_textil` cuando se configure una plancha.



## 1. Estado actual

- **Familia `aplicacion_transfer`** (`familias.ts`): nombre "Aplicación de transfer
  (DTF, DTG)", categoría `produccion_impresion`. `relacionMaquina = ['M-0','M-1']`,
  `modosTiempo = ['T-2','T-3']`, `plantillasCompatibles: []` (vacío — hueco: soporta
  M-1 pero no declara ninguna máquina). Slots: `textil` (sustrato/objeto base) +
  `film_transfer` (opcional, si se compra el transfer ya impreso). La impresión del
  film DTF ya la hace `IMPRESORA_GRAN_FORMATO_POR_AREA` con tecnología DTF_UV /
  DTF_TEXTIL en un paso anterior.
- **Uso real en base dev:** 1 ruta / 2 configs de producto, **todas T-2 manual, sin
  máquina asignada**. Hoy nadie usa una plancha: el planchado se carga a mano.
- **No existe** la plantilla de plancha térmica. El enum `PlantillaMaquinaria`
  (Prisma) tiene 12 plantillas; ninguna es una plancha.

## 2. El reencuadre conceptual

El paso NO es "imprimir el transfer" (eso es gran formato aparte). El paso **es el
planchado**: aplicar calor+presión para fijar el diseño sobre la prenda. Bajo esa
lente cabe DTF textil, sublimación, vinilo textil (transfer de corte), serigrafía-
transfer — todos son "prensar sobre la prenda". La tecnología del film es un atributo,
no una familia distinta.

**Rename:** `nombre` → **"Aplicación de transfer textil"** (el `codigo`
`aplicacion_transfer` se mantiene, para no romper rutas/OTs/estaciones).

### 2.1 Tensión: el caso MANUAL (DTF UV sobre tazas/objetos)

La familia hoy también cubre la aplicación **manual** (M-0) de DTF UV sobre objetos
rígidos (tazas, botellas) — y los 2 configs vivos son justamente manuales (T-2). Si
la volvemos "textil + M-1 puro", ese caso queda huérfano y rompemos los 2 configs.

Dos caminos (→ **decisión pendiente**, §6):

- **(A) Familia híbrida M-0·M-1 (recomendado):** se queda soportando ambas. Con
  plancha (M-1, T-3) para el planchado textil; a mano (M-0, T-2) para tazas/objetos y
  para talleres que planchan sin cargar la máquina. El nombre "transfer textil" es el
  caso dominante, y el manual sigue disponible sin ceremonia. Cero migración.
- **(B) Split en dos familias:** `aplicacion_transfer` pasa a M-1 textil puro, y el
  caso manual-objeto se muda a una familia propia (o a `trabajo_manual`). Más limpio
  conceptualmente pero exige migrar los 2 configs vivos y decidir el destino del caso
  taza. Rompe el "cero fricción" del manual.

## 3. Nueva plantilla `PLANCHA_TERMICA`

Sigue el patrón del catálogo (`src/lib/maquinaria-templates.ts`, molde = ANILLADORA:
capacidad física mínima + perfiles operativos que sólo aportan tiempo).

| Aspecto | Valor propuesto |
|---|---|
| enum `PlantillaMaquinaria` | `PLANCHA_TERMICA` (Prisma) / `"plancha_termica"` (tipo front) |
| `family` (UI) | `terminacion` (o nueva `estampado_textil`) |
| `geometry` | `PLANO` (plancha plana). Nota: prensas de taza son `CILINDRICO` → v2 |
| `defaultProductionUnit` | `PIEZAS_H` |
| `allowedProfileTypes` | `FABRICACION` (como anilladora/soldadora) |

**Capacidades físicas** (columnas universales de `Maquina`) — lo que el sistema
necesita saber de la máquina:
- `anchoUtil` (mm) — ancho de la plancha.
- `largoUtil` (mm) — alto/largo de la plancha.
- *(spec, opcional, en `parametrosTecnicosJson`)* temperatura máx (°C), presión.

El tamaño de plancha es informativo en v1 y habilita a futuro "cuántas estampas
chicas entran por bajada" (nesting de estampas), hoy resuelto con el campo
`piezasPorBajada` del perfil.

## 4. Perfil operativo de la plancha — el corazón del modelado

El motor (validado, ver §5) calcula en T-3 genérico:

```
runMin = (cantidadPiezas / productividad) * 60  + setupMin + cleanupMin   → ceil
```

con `productividad` = `productivityValue` en piezas/hora. El `detalleJson` **no**
deriva productividad en el path genérico (sólo primitivas especiales tipo guillotina).
Entonces hay dos formas de modelar el perfil:

### Opción Simple — productividad directa
Campos: `nombre`, `productivityValue` (estampas/hora, `PIEZAS_H`), `setupMin`
(calentamiento), `cleanupMin`. Igual que cabina/anilladora. Cero trabajo de motor.
Contra: el usuario tiene que traducir mentalmente "15s de prensado" → "estampas/hora".

### Opción Ciclo (recomendada) — el usuario piensa en segundos, derivamos piezas/h
El operario de estampado razona por ciclo, no por piezas/hora. El perfil pide los
tiempos del ciclo y **derivamos** la productividad al guardar:

| Campo del perfil | Ejemplo | Dónde vive |
|---|---|---|
**SIMPLIFICADO 2026-08-04** (a pedido: "hay demasiada información"). El perfil quedó
en 5 campos:

| Campo | Ejemplo | Dónde vive |
|-------|---------|------------|
| `nombre` | "DTF textil" | universal |
| `setupMin` (calentamiento de la plancha, una vez por tanda) | 10 | universal |
| `tiempoPreplanchadoSeg` (pre-press: quita humedad/arrugas) | 8 | `detalle` |
| `tiempoPrensadoSeg` (**planchado** principal, requerido) | 16 | `detalle` |
| `tiempoPostplanchadoSeg` (post-press: curado/replanchado) | 8 | `detalle` |

Se quitaron tipoTransfer, temperaturaC, presion, el toggle doblePrensado,
tiempoManipulacionSeg y piezasPorBajada (el nombre del perfil ya identifica la
tecnología; los specs no hacían falta para el costo).

**Derivación** (`deriveProductividadPlanchaTermica`, en `buildPerfilData` al guardar):
```
segundosCiclo = preplanchado + planchado + postplanchado
productividad (piezas/h) = 3600 / segundosCiclo
```

**Productividad en vivo:** el editor de perfiles (`perfiles-editor.tsx`) muestra una
columna calculada "Productividad (piezas/h)" solo para `plancha_termica`, con
`productividadPlanchaEnVivo` (espejo del cálculo del backend) mientras se editan los
segundos. El backend sigue siendo la fuente de verdad al guardar.

**Enfriamiento / pelado en frío (decisión 2026-08-04): tiempo activo.** El ciclo
cuenta SOLO el tiempo activo. En cold-peel el enfriamiento (minutos) NO se carga: se
asume trabajo en paralelo (se plancha la siguiente prenda mientras una enfría). Un
modelo con enfriamiento + factor de paralelismo queda pendiente (v2).
Se guarda ese número en `productivityValue` (unit `PIEZAS_H`) → **el motor funciona sin
tocarse**, y el desglose del ciclo queda en `detalleJson` para transparencia y edición.

> "Tiempo de espera" en sublimación = la plancha cerrada 45-60s: ese tiempo ES el
> `tiempoPrensadoSeg` (tiempo-máquina del ciclo). Si un operario maneja varias planchas
> en paralelo, la productividad real sube — se modela en v2 (factor de paralelismo);
> en v1 una plancha = un ciclo secuencial.

## 5. Cómo lo usa el motor (ya verificado, sin cambios)

- Familia `aplicacion_transfer` con `mecanismoCantidad = DIRECT_FROM_JOBCONTEXT`
  (`jobContext.cantidad` = nº de prendas). Con plancha (M-1) y `modoTiempo = T-3`:
  el motor toma `perfil.productivityValue` (piezas/h) → `runMin = (piezas/prod)*60`,
  suma setup/cleanup, `ceil` a minutos. (`motor.service.ts:2795-2853`, `:5464-5504`.)
- Auto-selección de perfil por `detalle.reglaSeleccion` (JsonLogic) si hay varias
  planchas/perfiles; si hay uno solo, ése. (`motor.service.ts:5867+`.)
- **Ningún cambio de motor** con la Opción Ciclo B1 (derivamos productividad afuera).

## 6. Plan de implementación

Depende de dos decisiones (§6.0). Etapas:

**§6.0 Decisiones previas**
- D1: ¿familia híbrida M-0·M-1 (A) o split M-1 textil puro (B)? → **rec A**.
- D2: ¿perfil Simple o Ciclo? → **rec Ciclo (B1)**.

**Etapa A — Enum + tipos (backend)**
- Prisma: agregar `PLANCHA_TERMICA` al enum `PlantillaMaquinaria` + migración formal.
- `src/lib/maquinaria.ts`: agregar `"plancha_termica"` al tipo `PlantillaMaquinaria`.

**Etapa B — Plantilla en el catálogo (frontend)**
- `maquinaria-templates.ts`: `buildPlanchaTermicaSections()` (capacidades físicas +
  perfiles operativos con los campos del ciclo) + entrada en `maquinariaTemplates`.
- Si va la Opción Ciclo: helper que deriva `productivityValue` de los campos del ciclo
  al guardar el perfil (UI o `maquinaria` service).

**Etapa C — Familia**
- `familias.ts` `aplicacion_transfer`: `nombre` → "Aplicación de transfer textil";
  `plantillasCompatibles: ['PLANCHA_TERMICA']`; `tiposPerfilCompatibles: ['FABRICACION']`.
  relacionMaquina/modosTiempo según D1 (rec: dejar `['M-0','M-1']` / `['T-2','T-3']`).
- Mapas UI (`tablero-produccion.ts`, `tracking.ts`) e ícono si aplica.

**Etapa D — Datos/seed**
- Opcional: cargar una plancha de ejemplo con perfiles DTF/Sublimación en dev para
  probar E2E (respetando que dev tiene integraciones vivas).

**Etapa E — Tests**
- Motor: un producto "Remera estampada" con plancha M-1/T-3 → verificar el tiempo
  calculado = `(piezas/prod)*60 + setup`, con `ceil`.

## 7. Fuera de alcance (v2)
- Prensa de taza/gorra (`CILINDRICO`) como plantilla aparte.
- Factor de paralelismo (un operario, varias planchas).
- Nesting de varias estampas chicas por bajada derivado del tamaño de plancha.
