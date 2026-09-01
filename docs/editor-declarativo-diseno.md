# Editor declarativo del paso — análisis y diseño

> Nace del feedback del usuario 2026-07-30 sobre el asistente guiado
> (E.3.2 v2): el guiado mostraba SOLO lo pendiente; el objetivo real es
> una **capa de abstracción humana sobre TODO el editor** — las mismas
> opciones, todas, guiadas y con contexto — con paridad garantizada para
> que el guiado REEMPLACE al detallado. "Lo mismo que venimos haciendo:
> una sola fuente de información estandarizada" (usuario).
>
> Rama: `feat/editor-declarativo` (desde dev). El detallado NO se toca
> hasta que la cobertura sea total.

## 1. El principio

La misma jugada del proyecto entero, aplicada al editor:

| Problema | Solución que ya hicimos |
|---|---|
| 52 outputs folklóricos | Registro de Capacidades (una fuente, alias) |
| defaults repetidos por producto | FamiliaPasoDefaults (una tabla, fallback vivo) |
| **editor: 60+ campos cableados en un monolito de 9k líneas, y un guiado que persigue paridad a mano** | **Esquema declarativo del paso: una fuente → dos presentaciones** |

Cada opción configurable se declara UNA vez (clave, sección, pregunta en
humano, ayuda, control, visibilidad, estado actual en humano, origen del
default). El guiado y —eventualmente— el detallado se renderizan del
mismo esquema: **una opción nueva = una entrada = aparece en ambos**. La
paridad deja de ser una promesa y pasa a ser estructura, protegida por
un test de cobertura (esquema vs censo).

## 2. Censo COMPLETO del editor (2026-07-30)

Fuente: `config-pasos-editor-view.tsx` + `paso-tercerizado-panel.tsx`.
El censo de Avanzado ya estaba (wizard-ruta-diseno.md §1, 19 campos);
esto agrega las otras cinco secciones. **~62 opciones en total.**

### Tercerización (switch + panel)

| Campo | Aparece | Pregunta guiada propuesta |
|---|---|---|
| Lo terceriza (switch) | **sólo si la familia NO lo declara** | Si el paso nació tercerizado (E.2, defaults de familia), la pregunta NO se repite: aparece colapsado — "Lo hace **Terminaciones Patagonicas** — declarado en el paso · Cambiar (internalizar)". Sólo pasos sin declaración ven "¿Quién hace este paso?" |
| Proveedor | tercerizado | "¿A quién se le compra?" |
| Fuente de costo (matriz/tarifa/fijo) | tercerizado | "¿Cómo cotiza el proveedor?" |
| Plazo (días) | tercerizado | "¿Cuánto tarda en entregar?" |
| Tecnología (reportes) | tercerizado | "¿Con qué tecnología se hace?" (para reportes) |
| Atributos + valores (matriz) | fuente=matriz | "¿Qué cosas mueven el precio?" |
| Cantidades (columnas) | fuente=matriz | "¿En qué cantidades cotiza?" |
| Grilla de costos | fuente=matriz | "Cargá los precios" |
| Magnitud + tarifa + mínimo | fuente=tarifa | "¿Cuánto cobra por unidad/m²/metro?" |
| Costo fijo | fuente=fijo | "¿Cuánto cobra por trabajo?" |

### Activación

| Campo | Aparece | Pregunta guiada |
|---|---|---|
| Nombre visible | siempre | "¿Cómo se llama este paso acá?" (resumen: nombre de familia si vacío) |
| Cuándo se ejecuta (4 pills) | siempre | "¿Cuándo se ejecuta?" (resumen: "Siempre — fijado por el paso" si familia fijó) |
| Regla condicional (builder) | modo=condicional | "¿Con qué regla se activa?" (control rico existente) |
| Necesita que también se ejecuten | hay otros pasos | "¿Arrastra otros pasos al activarse?" |
| Multiplicadores | familia los declara | **"¿Qué variables multiplican el trabajo acá?"** — toggles de los soportados por la familia (caras, tipo de copia…) que activan `multiplicadoresActivos`; resumen: "Multiplica por caras" / "Sin multiplicadores". **GAP detectado (usuario)**: el wizard de CREACIÓN de pasos nunca pregunta multiplicadores — las familias tenant nacen sin (`multiplicadores: []`). Tarea nueva: pregunta "¿el trabajo cambia con las caras/copias?" en el wizard de pasos |

### Tiempo y costo

| Campo | Aparece | Pregunta guiada |
|---|---|---|
| **Tiempo del comercial** (switch + valor sugerido + unidad) | siempre, **PRIMERA pregunta de la sección** (corrección del usuario) | "¿El tiempo lo estima el comercial al cotizar?" — si SÍ, se SUPRIMEN ritmo, tandas, tiempo fijo y calcular-según (hoy el detallado los muestra igual y confunde) |
| ¿Cómo se calcula el tiempo? (modo) | familia soporta >1 y NO estima el comercial | "¿Cómo se mide el tiempo acá?" (resumen: el único soportado) |
| Centro de costo | sin máquina | **"¿En qué centro productivo se realiza este paso?"** (corrección del usuario; resumen: "Usando el del paso: X"). Actualizar también los copys ya en producción que dicen "quién lo cobra" (banner E.3.1, wizard de pasos, ficha de defaults) |
| Operarios (dotación) | siempre | "¿Cuántas personas trabajan?" |
| Cómo cargar el ritmo (productividad/por tanda) | T-2 | "¿Cómo medís el ritmo?" |
| Productividad + unidad | T-2 ritmo | "¿A qué ritmo?" (resumen: "Usando el del paso: 45/h") |
| Batch (tiempo por tanda + tamaño) | T-2 tanda | "¿Cuánto tarda una tanda y de cuántas?" |
| Cantidad operativa (mecanismo) | familia soporta >1 | "¿Sobre cuántas piezas trabaja?" (mismo lenguaje del wizard E.2) |
| Herencia: origen (paso + capacidad) | mecanismo=HEREDAR | "¿De qué paso hereda?" (B.3.3, ya existe) |
| Calcular tiempo según (fuente) | T-2 | "¿El ritmo cuenta piezas, m² o metros?" |
| Piezas a montar | montaje | "¿Qué monta: piezas del pedido o pliegos impresos?" |
| Modo talonario | pre_prensa | "¿Es un talonario? ¿Cómo se apila?" |
| Tiempo fijo estimado | T-1 | "¿Cuántos minutos lleva?" (resumen: default del paso) |

### Máquina y perfil

| Campo | Aparece | Pregunta guiada |
|---|---|---|
| Máquina (M-1) | familia con máquina | "¿En qué máquina se hace?" |
| Perfil operativo | máquina elegida | "¿Con qué perfil?" |
| Máquinas candidatas (+ por candidata: perfil default, preferida, orden) | familia M-2 | "¿Entre qué máquinas elige el comercial?" — **control: la UI del DETALLADO extraída como componente** (corrección del usuario: la card v2 de botones se descarta) |
| Modo de color del producto | impresión | "¿Se imprime a color o en negro?" |
| Modos de color permitidos (por candidata / M-1) | impresión | "¿Qué modos ofrece esta máquina acá?" |

### Materiales (por slot; los declarados + adicionales)

| Campo | Aparece | Pregunta guiada |
|---|---|---|
| Agregar slot declarado / adicional | familia lo permite | "¿Qué materiales gasta acá?" |
| Nombre del componente | slot adicional | "¿Cómo se llama?" |
| Rol (sustrato/componente/consumible/packaging) | slot adicional | **PODA (decisión del usuario)**: medido — el motor no decide nada con el rol; sólo dos heurísticas de display en la ficha de propuesta, ambas con fallback por código de slot. La pregunta se elimina del guiado (y del detallado al retirarlo); la columna queda, los usos de la ficha se ajustan |
| ¿Quién elige el material? (fijo/candidatos/comercial/motor) | por slot | "¿Quién decide cuál se usa?" |
| Material fijo (búsqueda MP + variante) | modo fijo | "¿Cuál exactamente?" — **control: el buscador del DETALLADO extraído como componente** (corrección del usuario: la card v2 se descarta) |
| Materiales candidatos (+ default por candidato) | modos elegibles | "¿Entre cuáles se elige?" |
| Criterio del sistema | modo motor | "¿Con qué criterio elige el sistema?" |
| ¿Cómo se calcula el consumo? (fórmula) | por slot | **"¿Cómo se calcula el consumo?"** (corrección del usuario: "cuánto gasta por unidad" era peor) |
| Costeo (simple/exacto) | por slot | **"¿Cómo se costea este material?"** (corrección del usuario: "cómo se cobra" se confunde con el precio al cliente). Misma corrección aplica al costeo del sustrato del censo Avanzado: "¿Cómo se costea la placa/rollo?" |
| Base de consumo + cantidad por base | fórmula por base | "¿Por cada cuántos se gasta uno?" |
| Multiplicar por caras | por slot | "¿La doble faz gasta doble?" |

### Avanzado / oficio

Los 19 campos del censo E.0 (wizard-ruta-diseno.md §1): overrides de
tiempo (3), acomodo (algoritmo/demasía), pliego de impresión (4),
panelizado (6, con interpretación fundida al ancho), márgenes extra,
costeo del sustrato (2). Clasificación y preguntas YA definidas ahí.

### Revisión del usuario (2026-07-30) — incorporada

Las nueve anotaciones de la lectura del doc quedaron aplicadas arriba:
tercerizado no se re-pregunta si la familia lo declara; multiplicadores
definidos como toggles + gap del wizard de pasos anotado; "centro
productivo" como pregunta; el tiempo del comercial va PRIMERO y suprime
las preguntas de ritmo; las cards v2 de máquina/candidatas y material
se DESCARTAN a favor de la UI del detallado extraída como componentes;
el rol de materiales se PODA; consumo y costeo reformulados.

## 3. El esquema (shape propuesto)

```ts
// src/lib/editor-paso/schema.ts — LA fuente. Front-only en v1.
export interface ContextoOpcion {
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;   // trae defaults, capacidades, slots
  lookups: LookupsConfigPaso;             // máquinas, centros, proveedores
  pasos: PasoAsistente[];                 // para herencia/co-ejecución
  paramsPaso: Record<string, unknown>;
}

export interface OpcionPaso {
  clave: string;                          // 'activacion.cuando', 'tiempo.ritmo'
  seccion: SeccionPaso;                   // quien | activacion | tiempo | maquina | materiales | oficio | ajustes
  pregunta: string;                       // el guiado
  ayuda?: string;                         // contexto en idioma de taller
  visible: (ctx) => boolean;              // condición (familia/forma/config)
  resumen: (ctx) => string;               // "Siempre — fijado por el paso"
  origenValor: (ctx) => 'config' | 'default-paso' | 'default-maquina' | 'sin-definir';
  pendiente?: PendientePasoTipo;          // link al motor E.3.1 (prioriza)
  control: ControlOpcion;                 // declarativo u componente rico
}

type ControlOpcion =
  | { tipo: 'pills' | 'select'; opciones: (ctx) => Array<{value, label, desc?}>; aplicar: (ctx, v) => PatchPaso }
  | { tipo: 'numero'; unidad?: string; aplicar: ... }
  | { tipo: 'texto' | 'toggle'; aplicar: ... }
  | { tipo: 'componente'; id: 'material-slot' | 'candidatas' | 'tercerizado' | 'regla' | 'herencia' | 'grilla' };
```

- Los **componentes ricos ya construidos** (candidatas v2, buscador de
  material, panel tercerizado, selector de herencia, rule builder) se
  registran como controles `componente` — no se reescriben.
- `resumen` + `origenValor` alimentan el estado colapsado del guiado
  ("Usando el ritmo del paso: 45/h · Cambiar") y absorben los
  placeholders "usando default" de E.1.3.
- El **motor de pendientes** (E.3.1) deja de filtrar y pasa a PRIORIZAR:
  pregunta con pendiente → abierta y primera; resuelta → colapsada con
  resumen; el orden de secciones es fijo y narrativo.

## 4. Presentación vigente

- **Guiado (el asistente flotante de E.3.2 v2)**: recorre secciones como
  capítulos; cada opción visible se muestra SIEMPRE — abierta si
  pendiente, colapsada con resumen + "Cambiar" si resuelta. Nada
  desaparece: paridad visible.
- **Detallado (retirado el 2026-08-31)**: la validación funcional cerró la
  transición. Ya no existe selector ni preferencia local: el esquema guiado
  es la única presentación del editor. El test de paridad permanece como
  guardián del contrato y además verifica que toda opción no material
  pertenezca a un eje renderizable.

## 5. Plan por sub-fases

- **A — Esquema + shell + Activación** (validación de la forma):

  > **Estado 2026-07-30: HECHA — a validar por el usuario.**
  > `src/lib/editor-paso/schema.ts` (OpcionPaso completo: pregunta,
  > ayuda, visible, resumen, origenValor, pendiente, control declarativo
  > o componente) + `schema.test.ts` con el TEST DE PARIDAD (el censo
  > §2 vive como constante: clave censada sin declarar o declarada sin
  > censar = test roto; migrar una sección = acto consciente). Renderer
  > `SeccionGuiada`/`OpcionGuiadaFila`/`ControlGuiado` en el asistente:
  > toda opción visible se muestra SIEMPRE — abierta si su pendiente
  > está vivo o está sin-definir, colapsada con resumen + badge de
  > origen ("· del paso") + Cambiar. Activación completa: nombre,
  > cuándo (pills restringidas si la familia fijó), regla condicional
  > (RuleBuilder del detallado EMBEBIDO), co-ejecución, multiplicadores
  > (toggles). Las cards transicionales siguen para las secciones B-D y
  > ya excluyen lo cubierto. Copys "centro productivo" barridos
  > (pendientes, asistente, wizard de pasos, ficha defaults). Verificado
  > en vivo: Bordado muestra las 3 preguntas visibles colapsadas con
  > "· del paso" y ✓ Listo. 9 tests nuevos (371 front en total).
 el
  módulo `editor-paso/` con el schema, el renderer guiado de
  secciones-pregunta (abierto/colapsado/Cambiar), el test de paridad, y
  la sección Activación COMPLETA (nombre, cuándo, regla, co-ejecución,
  multiplicadores). El usuario valida la forma final acá.
- **B — Tiempo y costo + Máquina y perfil** — **HECHA (2026-07-30)**.
  > Las 13 opciones de Tiempo y las 4 de Máquina declaradas en el
  > esquema con el test de paridad ampliado (18 tests). El tiempo del
  > comercial va PRIMERO y suprime ritmo/tanda/tiempo fijo/calcular-según
  > (verificado en vivo con Bordado). Tres bloques del detallado se
  > extrajeron como componentes compartidos —
  > `CandidatasDetalladoEditor`, `ModoColorDetalladoEditor` y
  > `TiempoComercialDetalladoEditor` — y el asistente los renderiza
  > idénticos al detallado (las cards v2 de botones se ELIMINARON, tal
  > como pediste). El catálogo de opciones T-2 (unidades, modos, fuentes,
  > defaults por familia) se movió a `src/lib/editor-paso/catalogo-tiempo.ts`
  > para que esquema y detallado lean la misma fuente. Ajustes sobre el
  > censo descubiertos al implementar: (1) `maquina.modo_color` es UNA
  > clave — "modo del producto" y "modos permitidos" son un solo control
  > en el detallado, y por candidata los modos viven dentro de
  > candidatas; (2) el escape "tiempo fijo estimado (h)" del ritmo T-2
  > (`horasEstimadas`) no es clave propia: vive dentro del control de
  > ritmo en ambas vistas. Trampa de portal: las clases del detallado
  > (`ps-*`, `field`, `segmented`) están scopeadas bajo `.pasos-sections`
  > y el Sheet vive en un portal — los componentes extraídos se envuelven
  > con ese wrapper en el asistente. Verificado en vivo: Talonarios →
  > Impresión de original muestra Máquina y perfil con las 2 candidatas
  > Ricoh (perfil default + modos por candidata) y Pre-prensa muestra el
  > modo talonario.
- **C — Materiales** — **HECHA (2026-07-30)**.
  > Las 10 claves declaradas (el rol quedó PODADO como pediste;
  > "base + cantidad por base" es UN control). `materiales.agregar` es a
  > nivel paso; el resto se evalúa POR SLOT: el contexto del esquema ganó
  > `slot` y el patch ganó el tipo `"slot"`. El asistente renderiza un
  > grupo por slot configurado (título + Quitar + sus preguntas) y los
  > chips para sumar slots declarados o componentes adicionales. Dos
  > bloques más del detallado extraídos como componentes compartidos:
  > `MaterialFijoSlotDetalladoEditor` (buscador + variante fija) y
  > `CandidatosSlotDetalladoEditor` (candidatos con variantes habilitadas
  > y default) — el buscador `MaterialSearchSelect` ya era un componente
  > autónomo y se reusa tal cual. El catálogo de opciones de materiales
  > (quién elige, fórmulas, costeo, bases, criterios) se movió a
  > `src/lib/editor-paso/catalogo-materiales.ts`. La card transicional de
  > material del asistente se RETIRÓ (ya no obliga a ir al detallado —
  > el reclamo original de tus capturas). El costeo del slot se oculta
  > cuando Acomodado/nesting lo define (mismo criterio que el detallado).
  > Verificado en vivo con Talonarios → Impresión de original: grupo
  > "Sustrato principal" con las 5 preguntas y el buscador del detallado
  > adentro del Sheet; el detallado quedó idéntico. 7 tests nuevos
  > (25 del esquema, 387 front en total).
- **D — Tercerización + oficio** — **HECHA (2026-07-30)**.
  > Sección "Quién lo hace" PRIMERA del esquema (E.2): la bifurcación
  > tercerizado con tu corrección — si la familia lo declara, la pregunta
  > no se repite (colapsada "— declarado en el paso"; internalizar es
  > Cambiar). Las filas proveedor/fuente/plazo/tecnología/grilla del
  > censo viven DENTRO de `quien.proveedor` (el `PasoTercerizadoPanel`
  > embebido: una UI cohesiva = un control, como modo_color); su origen
  > espeja el motor de pendientes (sin proveedor O sin precios =
  > sin-definir, "cotiza $0"). Sección "Ajustes del trabajo" (oficio):
  > setup y cleanup declarativos + `oficio.acomodado` — la card entera de
  > Acomodado/nesting del detallado (censo E.0 filas 4-19: algoritmo,
  > demasía, pliego, panelizado, márgenes, costeo del sustrato) extraída
  > como `AcomodadoDetalladoEditor`; la humanización fina de pliego y
  > panelizado como preguntas separadas queda anotada abajo (§7). La
  > fila 3 del censo ya vivía como tiempo.tiempo_fijo; la sección
  > "ajustes" (escapes) se eliminó — algoritmo y layout manual viven
  > dentro del acomodado, igual que en el detallado. Con esto el CENSO
  > quedó cubierto COMPLETO (SECCIONES_PENDIENTES = []) y las
  > question-cards transicionales del asistente se RETIRARON: todo el
  > asistente sale del esquema. Verificado en vivo: Talonarios muestra
  > "Quién lo hace" primera y "Ajustes del trabajo" con el card completo
  > (márgenes con diagrama, costeo); Bordado → "La hace un proveedor"
  > abre el panel completo, el chip pasa a ámbar 2 y las secciones
  > internas se ocultan. 5 tests nuevos (30 del esquema, 392 front).
- **E — Cobertura 100% verificada → retiro del detallado** (decisión
  final del usuario tras probar).
  > **Estado 2026-08-31: HECHA.** Se retiró el acceso a Detallado y la
  > preferencia guardada en navegador. El hueco final detectado —los
  > multiplicadores declarados pero sin eje visible— se cerró ubicándolos en
  > Información básica, antes de Materiales, con etiquetas humanas y fallback
  > seguro para futuras claves del motor.
  > **Vista guiada EXPANDIDA (2026-07-30, idea del usuario)**: para
  > decidir con las dos a la vista, el cuerpo del asistente se extrajo
  > como `SeccionesEsquemaPaso` (una fuente, dos shells) y el editor ganó
  > un toggle **Detallado | Guiado** en el header del paso (elección
  > recordada por navegador vía localStorage). "Guiado" renderiza las
  > secciones-pregunta del esquema A PÁGINA COMPLETA en el panel
  > principal — mismo header, navegación y Guardar — donde los controles
  > ricos extraídos lucen mejor que en el Sheet (candidatas en 3
  > columnas). El asistente flotante sigue existiendo para el recorrido
  > paso-a-paso; el detallado sigue intacto. Nota: los pasos EXTRAS
  > mantienen su vista propia (el toggle aplica a los pasos base).

## 6. Decisiones

1. **Guiado como editor único + test de paridad** — confirmado y aplicado el
   2026-08-31.
   El botón permite guardar un **borrador incompleto** aunque existan
   pendientes de máquina, centro, materiales o parámetros. Esos pendientes
   siguen bloqueando la publicación/cotización, no la continuidad del trabajo.
   Sólo una estructura imposible de persistir (JSON o regla condicional
   inválidos) rechaza el guardado.
2. **Ubicación**: `src/lib/editor-paso/` (schema + tipos) con el
   renderer en components. Front-only: el esquema es de PRESENTACIÓN;
   la verdad de negocio sigue en el back (validador/motor).
3. **El asistente sigue siendo el shell** (Sheet flotante E.3.2 v2):
   sólo cambia su contenido de "cards de pendientes" a "secciones
   completas priorizadas".

## 7. Abierto (no bloquea el retiro, sí lo mejora)

- **Humanización fina de pliego y panelizado**: hoy `oficio.acomodado`
  entrega el card del detallado entero (paridad garantizada). Las
  preguntas humanas del censo E.0 ("¿En qué pliego se imprime?",
  "¿Esta pieza puede salir en paneles?", el ancho máximo con su
  interpretación fundida y previsualización) son la evolución natural:
  partir el card en claves propias cuando el editor visual del acomodo
  entre en agenda.
- **Nombre del proveedor en el resumen**: `quien.proveedor` resume
  "Proveedor elegido" porque los lookups del config-paso no traen
  proveedores (el panel los carga solo). Sumar proveedores al lookup
  permitiría "Lo hace Terminaciones Patagónicas" también colapsado.
- **Algoritmo para pasos tenant**: el censo E.0 ya lo marcó — con
  superficie B.3.4 el selector no debería ofrecerse (el sistema decide);
  hoy se muestra igual que en el detallado por paridad.
