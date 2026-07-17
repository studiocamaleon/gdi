# Capacidad operativa de estaciones — diseño

> Análisis 2026-07-17 (rama `fix/tablero-sin-estacion-orden-kanban`). Sucesora
> directa de la "Fase B" anunciada en docs/estaciones-diseno.md §8 ("horario
> estructurado para planificación de entrega"). Corrige la métrica de carga
> del tablero y sienta la base de la proyección de ocupación y, más adelante,
> de la demora estimada por el sistema.

## 1. Estado actual (relevado)

- **Configuración**: `Estacion.capacidadConcurrente` (Int, default 1) y
  `Estacion.horario` (texto libre informativo, no participa de ningún
  cálculo). Nada más.
- **Métrica del tablero** (`tablero-produccion.tsx`):
  `loadPct = pasos activos / capacidadConcurrente`. 4 pasos en una estación
  con concurrencia 2 → "200% de capacidad". Una impresora (concurrencia 1)
  con 15 trabajos → "1500%". La `LoadBar` y la KPI fusionada "2/3" del
  detalle usan el mismo conteo.
- **Datos ya persistidos que la métrica ignora**:
  - `OrdenTrabajoItemPaso.duracionEstimadaMin` — snapshot del motor
    (`paso.tiempo.totalMin`) al emitir la OT.
  - `iniciadoEl` / `completadoEl` por paso — duración REAL histórica de cada
    paso ejecutado, por familia.

## 2. Concepto

Dos ideas se confunden en la fórmula actual y hay que separarlas:

1. **Concurrencia ≠ capacidad.** "Puedo hacer N a la vez" acota cuántos
   pasos están *en curso* en un instante. El único porcentaje honesto contra
   ese número es `en_curso / puestos`, que nunca supera 100%. Lo que espera
   no es sobre-capacidad: es **cola**.
2. **La cola se mide en tiempo, no en pasos.** 15 sellos de 4 minutos son
   1 hora de cola; 3 lonas de 6 horas son 2 días. La unidad de la carga son
   **horas de trabajo encolado**, y para volverlas accionables hace falta el
   divisor que hoy no existe: las **horas operativas por día** de la
   estación.

La card del tablero pasa a leer:

```
Ocupación   = en curso / puestos          →  "2/2 puestos ocupados"
Cola        = Σ duración estimada         →  "~14 h de cola"
Proyección  = cola caminada por calendario →  "≈ 1,8 días"
```

## 3. Decisiones

- **D1 — La capacidad se mide en tiempo.** Muere el "% de capacidad" por
  conteo de pasos. La estación expone: ocupación instantánea
  (`en_curso / puestos`), cola en horas y su equivalente en días operativos.
- **D2 — Calendario semanal POR ESTACIÓN** (decisión usuario 2026-07-17).
  Estructura: para cada día de la semana, activo/inactivo + franja
  `desde`–`hasta` (una franja por día; cortes de mediodía quedan para después
  si alguna vez hacen falta). Se persiste como `calendarioJson` en
  `Estacion` — es configuración que viaja siempre con la estación, no
  necesita queries relacionales. La UI ofrece **"Copiar horarios de:
  [estación]"** que vuelca el calendario de otra estación en el borrador
  (acción de cliente; sin endpoint).
- **D3 — `horario` (texto libre) se retira.** El label visible se deriva del
  calendario ("L–V 8:00–18:00 · S 9:00–13:00"). La columna se dropea en la
  migración; era informativa, no hay dato que preservar. Estación sin
  calendario configurado → muestra "Sin horario" y el tablero informa la
  cola sólo en horas (sin proyección en días).
- **D4 — `capacidadConcurrente` cambia de rol: son PUESTOS.** Deja de ser
  denominador de un conteo y pasa a multiplicar horas: capacidad diaria =
  horas del calendario × puestos. Sólo corresponde >1 cuando los puestos
  trabajan de verdad en paralelo (2 mesas de acabado con 2 operarios = 2×);
  una impresora es 1 puesto aunque tenga 15 trabajos encolados. La columna
  no se renombra (evitar churn de migración); cambian label y help de la UI
  ("Puestos de trabajo — cuántos pasos avanzan EN PARALELO de verdad").
- **D5 — Cola fase 1 = pasos ACTIVOS, en horas.** La cola de la estación
  suma `duracionEstimadaMin` de los pasos que el tablero ya le rutea (el
  paso listo de cada item, regla de secuencia). Los **bloqueados suman** a la
  cola (el trabajo no desaparece por estar bloqueado) y se siguen mostrando
  aparte. Limitación aceptada: los pasos futuros de items en curso todavía
  no pesan sobre sus estaciones — eso es la proyección de ocupación
  (fase 2, §9).
- **D6 — Fallback de duración: mediana histórica por familia** (decisión
  usuario 2026-07-17). Para pasos sin `duracionEstimadaMin` (manuales,
  OTs previas al snapshot con tiempo): mediana de `completadoEl − iniciadoEl`
  de los pasos `hecho` de la misma familia del tenant (mediana y no
  promedio: resiste el paso que quedó "en curso" un fin de semana). Sin
  historia → el paso queda **sin estimar**: suma 0 a la cola y la card
  muestra "n sin estimar" para no vender precisión falsa. No hay default
  global inventado.
- **D7 — Proyección en días = caminar el calendario, no dividir.** Los "≈ N
  días" se calculan consumiendo las horas de cola contra el calendario desde
  ahora (hoy quedan 3 h operativas, mañana es domingo inactivo, etc.), con
  los puestos como multiplicador. Una división por "capacidad diaria
  promedio" miente en fines de semana y estaciones de media jornada.
- **D8 — Feriados FUERA de esta fase** (decisión usuario 2026-07-17). El
  calendario semanal no modela excepciones de fecha. Cuando se necesite:
  tabla de fechas no laborables a nivel tenant, consumida por el mismo
  caminado de D7.
- **D9 — El cálculo vive en el front; las medianas en el back.** El tablero
  ya arma el modelo de estaciones client-side con estaciones + pasos; la
  cola y el caminado del calendario se computan ahí. Lo único que el front
  no puede derivar es la mediana histórica → endpoint nuevo
  `GET /produccion/duraciones-familias` (D6).

## 4. Modelo (migración)

```prisma
model Estacion {
  // capacidadConcurrente Int @default(1)  → queda (rol nuevo: puestos, D4)
  // horario String?                       → SE DROPEA (D3)
  /// Calendario semanal operativo (D2). Shape validado en DTO:
  /// { dias: { lun: { desde: "08:00", hasta: "18:00" } | null, mar: …, dom: null } }
  /// null = sin calendario configurado (sin proyección en días).
  calendarioJson Json?
}
```

Sin cambios en `OrdenTrabajoItemPaso` (ya tiene todo) ni en las tablas de
vínculo de estación.

## 5. Contrato

`GET /produccion/estaciones` — la proyección suma:

```ts
type CalendarioDia = { desde: string; hasta: string } | null; // "HH:MM"
type Estacion = {
  // … campos actuales, sin `horario` …
  calendario: { dias: Record<"lun"|"mar"|"mie"|"jue"|"vie"|"sab"|"dom", CalendarioDia> } | null;
};
```

`POST/PUT` aceptan `calendario?` con validación: `desde < hasta`, formato
`HH:MM`, al menos un día activo si no es null.

**Nuevo** `GET /produccion/duraciones-familias` →
`Array<{ familiaCodigo: string; medianaMin: number; muestras: number }>`
— mediana de `completadoEl − iniciadoEl` de pasos `hecho` del tenant,
agrupada por familia (sólo familias con ≥ 3 muestras para no proyectar sobre
anécdota). Se consulta al montar el tablero, junto con estaciones.

## 6. Cálculo (front, tablero)

```
duración(paso) = duracionEstimadaMin
              ?? medianaFamilia(paso.familiaCodigo)   // D6
              ?? null                                  // "sin estimar"

colaMin(estación)  = Σ duración(pasos ruteados, incl. bloqueados)   // D5
sinEstimar         = # pasos con duración null
ocupación          = # en_curso / puestos                            // D4

díasCola(estación) = caminar calendario desde AHORA consumiendo
                     colaMin / puestos; null si no hay calendario     // D7
```

Card de estación: `"2/2 puestos · 14 h de cola (≈ 1,8 d)"` +
`LoadBar` con segmentos **ponderados por horas** (pendiente/urgente/
bloqueado), max = capacidad de un día. KPI fusionada del detalle ("2/3") pasa
a `en_curso/puestos`. "Sin estación" no proyecta (no tiene calendario ni
puestos): muestra sólo horas de cola.

## 7. UI

- **Panel estaciones, sección 04** ("Capacidad y planificación"):
  - Stepper "Puestos de trabajo" (label/help nuevos, D4).
  - Editor de calendario semanal: 7 filas día → toggle activo + `desde`/
    `hasta`. Default al crear: L–V 9:00–18:00 (editable), para que el caso
    común salga en dos clicks.
  - Select "Copiar horarios de:" con las demás estaciones activas → pisa el
    borrador del calendario (sólo el calendario, no los puestos).
  - La card del listado muestra el label derivado ("L–V 8–18").
- **Tablero**: card y detalle según §6. El texto "% de capacidad"
  desaparece.

## 8. Casos borde

- Estación sin calendario → cola en horas, sin "≈ días"; badge "Sin
  horario".
- Todos los pasos sin estimar (taller recién arrancando, sin historia) →
  cola "—" + "5 sin estimar"; la ocupación instantánea funciona igual.
- Paso `en_curso` desde hace días (olvidado abierto): su duración estimada
  ya está consumida — la cola cuenta la duración completa de los `en_curso`
  igual (simplificación fase 1; descontar transcurrido es refinamiento).
- Mediana con outliers (paso iniciado un viernes, completado el lunes): la
  mediana resiste; el corte de ≥ 3 muestras evita proyectar sobre un caso.
- `desde == hasta` o rango invertido → 400 del DTO.
- Calendario con 0 días activos → se guarda como null (equivale a "sin
  calendario").
- Copiar horarios de una estación sin calendario → opción deshabilitada en
  el select.

## 9. Fase 2a — Carga EN CAMINO (2026-07-17)

Caso que la motiva: el operador ve "cola 2 h" en Gran formato UV y promete
sobre eso, pero hay 5 vinilos más en Diseño que van a caer en esa estación
cuando terminen su paso previo. La cola de pasos ACTIVOS subestima el
trabajo conocido.

- **D10 — Carga en camino** = Σ duración (mismo fallback de mediana D6) de
  los pasos `pendiente` NO activos de items vivos, ruteados a su estación
  con la misma resolución D1. Los items BLOQUEADOS cuentan (el bloqueo se
  destraba; el trabajo no desaparece). Cálculo 100 % front: los pasos
  futuros ya viajan materializados con familia, centro y duración.
- **D11 — Sin timing.** Lo en camino se muestra como monto aparte, nunca
  sumado a la cola como si llegara ya (sobrestimaría el corto plazo). La
  fecha de llegada real exige simular el flujo → fase 2b.
- **D12 — Presentación.**
  - Card: `0/1 puestos · cola 2h 35m · +3h 20m en camino`; la LoadBar suma
    un segmento RAYADO para lo en camino (misma escala de un día lleno) y
    un chip "+N en camino". Estaciones sin cola pero CON carga en camino
    dejan de caer al bucket "sin actividad": muestran card.
  - Detalle: la KPI de cola pasa a rango honesto caminando el calendario
    dos veces — `v: "2h 35m (+3h 20m)"`, `k: "≈ 0,4 d · hasta 1,1 d"`.
  - Toolbar: total del taller "N en camino".
  - Los pasos en camino sin estimar se suman al chip "n sin estimar".

## 10. Fases siguientes (fuera de este doc)

- **Fase 2b — Simulación de flujo**: caminar los pasos restantes de cada
  item insertándolos en la cola FIFO de cada estación (calendario +
  puestos) → fecha estimada de llegada y fin por paso; timeline por
  estación. Requiere feriados (D8) y política para bloqueados/prioridades.
- **Fase 3 — Demora sugerida por OT**: el mismo motor de simulación
  respondiendo "si este trabajo entra AHORA, ¿cuándo sale?" para nuevas
  OTs. Merece análisis y doc propios. Trampa conocida: pasos dependientes
  de terceros (tercerizados, aprobación del cliente) que ninguna simulación
  de taller predice.

## 11. Journey (verificación E2E)

1. Configurar "Impresión digital": 1 puesto, calendario L–V 8:00–18:00.
   "Corte y terminación": 2 puestos, "Copiar horarios de: Impresión
   digital" → mismo calendario; agregar sábado 9:00–13:00.
2. Tablero con OTs reales: la card de Impresión digital muestra
   `en_curso/1 puesto`, la cola en horas = suma de `duracionEstimadaMin` de
   sus pasos activos, y "≈ N d" consistente con el calendario (verificar a
   mano contra un caso con horas restantes de hoy + fin de semana en el
   medio).
3. Paso manual sin duración de una familia CON historia → toma la mediana
   (verificar contra `GET /produccion/duraciones-familias`). De una familia
   SIN historia → card muestra "1 sin estimar" y no infla la cola.
4. Estación nueva sin calendario → cola sólo en horas + "Sin horario".
5. Bloquear un paso → sigue sumando horas a la cola y aparece en el desglose
   de bloqueados.
