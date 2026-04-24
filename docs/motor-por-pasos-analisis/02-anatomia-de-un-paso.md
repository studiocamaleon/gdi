# Anatomía de un paso productivo

> **Fase B** del análisis del motor por pasos.
> **Sesiones**: 1 + 2 (2026-04-23). **Estado**: Fase B COMPLETA.
> **Método**: análisis interactivo en conversación, sin tocar código.

## Propósito

Definir QUÉ es un "paso de producción" y de qué se compone. Es la unidad atómica que un motor universal va a procesar para cotizar cualquier producto.

Este doc es **descriptivo del modelo conceptual**, no de la implementación actual. Sirve como base para:
- Decidir qué abstraer del código actual (qué piezas extraer al "caja de herramientas").
- Diseñar el motor por pasos cuando llegue el momento.
- Validar que cualquier producto del rubro encaje en el modelo.

---

## 1. Definición de paso

> Un **paso** es una **operación operativa**: lo que el operario percibe como una tarea. Tiene un nombre claro y un propósito identificable, y se ejecuta en un momento del flujo de fabricación.

**La unidad atómica es la operación operativa, NO el ciclo físico de la máquina.**

### Ejemplos canónicos

- **Imprimir tarjetas en la Ricoh** = 1 paso, aunque adentro la máquina haga 2 corridas (doble faz).
- **Imprimir talonario duplicado/triplicado** = 1 paso, aunque adentro imprima N capas.
- **Diseño** en Illustrator = 1 paso (1 archivo, 30 minutos).
- **Guillotinar** = 1 paso (incluye traslado de pliegos entre máquinas).
- **Embalar** = 1 paso.
- **Instalar vinilos** = 1 paso.

### Lo que NO es un paso (es interno del paso)

- Calibrar la máquina antes de imprimir → setup del paso "Imprimir".
- Cara A + Cara B de doble faz → propiedad interna que el paso multiplica.
- Trasladar pliegos físicamente → setup o run del paso siguiente.
- Las N capas de un talonario → multiplicación interna del paso "Imprimir".

### Implicación clave

Cuando un paso necesita "hacer N veces" algo (multi-color, multi-cara, multi-capa), el paso lee el parámetro del JobContext (`caras`, `tipoCopia`, `numColores`) y **internamente** multiplica su tiempo/material/costo. El motor ve **1 paso** en la ruta.

---

## 2. Relación con máquina

| Tipo | Descripción | Ejemplo |
|---|---|---|
| **M-0** | Sin máquina (puramente manual) | Embalaje manual, control de calidad visual, conteo, atado, instalación in-situ |
| **M-1** | Con máquina única | Diseño (en una computadora), Pre-prensa (en RIP), Encuadernación (en una grapadora) |
| **M-2** | Con alternativas de tecnología | Imprimir vinilo gran formato puede ser en Latex o UV (si la imprenta tiene ambas máquinas). El cliente puede elegir tecnología. |

### Perfiles de máquina

Cuando un paso usa una máquina, **la misma máquina puede tener varios "modos" o perfiles** de funcionamiento.

Ejemplos:
- Ricoh PRO C5100: perfiles `A4 papel grueso simple faz` (40 ppm), `A4 papel obra doble faz` (30 ppm), `A4 papel obra simple faz` (60 ppm), etc.
- Hibrida UV: perfiles `4 PASS` (27 m²/h), `6 PASS` (18 m²/h), `8 PASS` (13 m²/h).

Cada perfil tiene su propia productividad (velocidad). La elección del perfil afecta el tiempo y el costo.

### Implicación clave

El modelo no puede asumir "1 paso = 1 máquina = 1 velocidad". El paso puede tener N máquinas alternativas (M-2), cada una con N perfiles. Eso es responsabilidad del modelo de la ruta y del JobContext (selección).

---

## 3. Tipos de tiempo

Hay **4 tipos** de tiempo que un paso puede usar:

| Tipo | Cómo se calcula | Cuándo aplica | Ejemplo |
|---|---|---|---|
| **T-1: Tiempo fijo** | Definido al modelar el paso. No escala con cantidad. | Paso sin máquina o con tiempo independiente del volumen. | "Diseño Gráfico" = 30 min siempre. "Pre-prensa" = 10 min siempre. |
| **T-2: Productividad propia del paso** | El paso declara su velocidad (ej. m²/h). `tiempo = cantidad / productividad`. | Paso sin máquina pero que escala con cantidad. | "Instalación de vinilos" = 5 m²/h. Para 20 m² → 4 horas. |
| **T-3: Productividad de máquina+perfil** | La máquina/perfil define la velocidad. `tiempo = cantidad / productividad_perfil`. | Paso con máquina cuya velocidad depende del perfil elegido. | "Imprimir Ricoh A4 simple faz" = 40 ppm. Para 13 pliegos → 0.325 min de run. |
| **T-4: Input manual del comercial** | El comercial INGRESA el tiempo al cotizar. El motor lo usa directo. | Paso cuyo tiempo varía tanto con material/diseño/complejidad que NO se puede estandarizar. | CORTE_LASER (RIP del láser le da el tiempo exacto). ROUTER_CNC custom (software CAM). |

### Patrón "modosTiempoHabilitados" — quién elige cuándo hay varios

Una familia puede declarar **múltiples tipos de tiempo soportados**. El proceso de selección es:

```
La FAMILIA declara modosTiempoSoportados (universo de modos posibles).
  Ej: cnc → [T-3, T-4]
      diseno_grafico → [T-1, T-2]
      impresion_por_hoja → [T-3]   (uno solo)

El MODELADOR del producto define modosTiempoHabilitados (subset).
  Ej: Producto "Cajas MDF estándar" → [T-3]
      Producto "Pieza CNC custom"   → [T-4]
      Producto "CNC genérico"       → [T-3, T-4]

Decisión final:
  Si modosTiempoHabilitados.length === 1:
    → motor usa ese modo automáticamente, comercial NO elige.
  Si modosTiempoHabilitados.length > 1:
    → COMERCIAL elige al cotizar (UI muestra opciones).
```

### Componentes adicionales del tiempo

Independientemente del tipo, todo paso puede tener:
- **Setup**: preparación al iniciar (montaje, calibración).
- **Cleanup**: cierre al terminar (limpieza, desmontaje).
- **Tiempo fijo extra**: tiempo agregado independiente de cantidad (algunos motores hoy lo usan, otros no — ej. talonario lo ignora).

El tiempo total típico = `setup + run + cleanup + (tiempoFijo si aplica)`.

### Implicación clave para tipos T-2 y T-3

Para calcular el tiempo de un paso con productividad (T-2 o T-3), hay que conocer ANTES la **cantidad a producir**. Esa cantidad NO siempre es la cantidad pedida por el cliente — suele ser el resultado de un cálculo previo (típicamente nesting, ver §4).

---

## 4. Unidad de producción del paso

### Concepto

Cada paso opera sobre una **unidad de producción propia**, que la define el TIPO DE PASO (no el producto).

| Paso | Unidad propia | Ejemplo (pedido: 100 tarjetas) |
|---|---|---|
| Diseño gráfico | trabajos | 1 trabajo |
| Pre-prensa | trabajos | 1 trabajo |
| Imprimir | pliegos | 13 pliegos (sale del nesting) |
| Guillotinar | pliegos + cortes | 13 pliegos × N cortes (depende del nesting + parámetros físicos guillotina) |
| Embalar | piezas o cajas | 100 piezas, o 1 caja |
| Instalar | m² | 5 m² |

### De dónde sale la "cantidad" del paso

Tres caminos típicos:

1. **Del nesting (algoritmo)**: Imprimir necesita saber cuántos pliegos. El nesting calcula `100 tarjetas / 8 que entran por pliego = 13 pliegos`.
2. **De la cantidad pedida directa**: Embalar 100 tarjetas → cantidad = 100.
3. **Del paso anterior (cadena productiva)**: Guillotina hereda los 13 pliegos que produjo Imprimir.

### Cadena productiva

Los pasos forman una cadena **producir → consumir**:

```
Imprimir (produce: 13 pliegos)
   ↓
Guillotinar (consume: 13 pliegos, produce: 100 piezas cortadas)
   ↓
Embalar (consume: 100 piezas, produce: cajas)
```

### Pasos compuestos

**No todos los pasos son simples**. Algunos necesitan **múltiples variables** + **parámetros físicos de la máquina**.

Ejemplo: Guillotina
- Necesita: cantidad de pliegos + cantidad de cortes (ambos del nesting de impresión).
- Necesita: capacidad máxima de pila por tanda (parámetro de la máquina, depende del grosor del papel).
- Cálculo: `tandas = pliegos / capacidad_por_tanda` → `tiempo = tandas × cortes_por_tanda × tiempo_por_corte`.

**Implicación**: el modelo general debe contemplar que un paso pueda leer parámetros físicos de la máquina (no solo productividad). Hoy esto es excepcional, pero es un patrón a tener en cuenta.

---

## 5. JobContext (estado compartido del trabajo)

### Concepto

> Los pasos NO son aislados. Existe un **JobContext** que viaja con la cotización: contiene info que los pasos leen y opcionalmente escriben para los siguientes.

### Composición del JobContext

#### 📥 Inputs iniciales (vienen del cliente al cotizar)

- **Cantidad pedida** (100 tarjetas, 5 m² de vinilo, etc.).
- **Medidas del producto** (anchoMm, altoMm) cuando es modo LIBRE.
- **Selecciones del cliente** (con/sin laminado, qué papel, qué color, opcionales activados).
- **Variante elegida** (Estandar 9x5, Tamaño 7x3, etc.).

#### 🌐 Variables dinámicas (del momento de cotizar)

- **Período** (mes) — porque las tarifas de centro de costo cambian mes a mes.
- **Stock actual** de materias primas — para elegir alternativa o avisar warning.
- **Reglas comerciales del cliente** — descuentos, precios especiales VIP.

> NO incluye disponibilidad/capacidad de máquinas en el momento. Eso es de producción, no de cotización.

#### 🔁 Outputs intermedios (los escriben los pasos) — CATÁLOGO CERRADO

Las salidas son de un **catálogo cerrado de "salidas canónicas"**, no campos libres. Esto evita colisiones y hace que cualquier paso sepa qué esperar de los anteriores.

Ejemplos de salidas canónicas (lista preliminar — se valida en Fase A):

- `pliegos` — cantidad de pliegos (lo escribe el nesting de impresión por hoja)
- `cortes` — cantidad de cortes a hacer (lo escribe el nesting o pre-prensa)
- `m2_impresos` — m² impresos (lo escribe el nesting de gran formato)
- `metros_lineales` — metros de rollo consumido
- `piezas_cortadas` — cantidad de piezas finales cortadas
- (etc., a definir)

Cada paso declara qué salidas canónicas escribe.

### Implicación clave

El motor por pasos NO es una secuencia simple `paso1 → paso2 → paso3`. Es:

```
JobContext
   ↑↓
[Paso 1] [Paso 2] [Paso 3] [Paso 4]
```

Cada paso lee del context lo que necesita y escribe sus resultados. La "cadena productiva" del §4 es un caso particular de esto (paso A escribe pliegos, paso B los lee).

### Patrón nuevo: pasos PRE que MUTAN el JobContext

Algunos pasos no solo escriben outputs nuevos sino que **modifican** valores existentes del JobContext que afectan a pasos siguientes.

**Caso típico**: lona con bolsillos arriba/abajo:

```
JobContext inicial (lo que pidió el cliente):
  anchoMm: 2000
  altoMm:  3000   ← área visible

Paso "Modificación PRE - Bolsillos" se ejecuta:
  Lee:      altoMm = 3000
  MUTA:     altoMm = 3200   (+100 arriba, +100 abajo)
  Escribe:  bolsilloArribaMm = 100, bolsilloAbajoMm = 100

Pasos siguientes (impresión, etc.) leen:
  altoMm = 3200   ← ya está modificado
  Imprimen 2m × 3.2m correctamente.
```

**Distinción importante** entre valores del JobContext:
- **Mutables** (medidas físicas: altoMm, anchoMm, m²): pueden ser sobrescritos por pasos PRE.
- **Inmutables** (cantidad pedida, variante elegida, opciones del cliente): NO se modifican.

Esto se modela con la familia `modificacion_pre` (ver §10).

---

## 6. Materiales que consume un paso

### Existencia

**No todos los pasos consumen materiales**. Casos típicos sin materiales:
- Diseño gráfico
- Pre-prensa (armar imposición en computadora)
- Control de calidad visual

El motor NO debe forzar materiales por paso. Algunos pasos solo cobran tiempo.

### Tipos de material

Cuando un paso consume materiales, hay 4 tipos identificados:

| Tipo | Descripción | Ejemplos |
|---|---|---|
| **Sustrato principal** | Lo que se imprime/corta/encuaderna. Suele ser el mayor componente del costo. | Papel Opalina, vinilo, placa MDF, lona. |
| **Consumibles de máquina** | Lo que la máquina gasta al funcionar. Asociado a la máquina+perfil. | Tinta, tóner, film de laminado, agua, gas, electricidad. |
| **Insumos del paso** | Lo que el PASO consume (no la máquina). | Grapas, cola, anillado, espiral, cinta, embalaje. |
| **Servicios externos** | Costo a un proveedor externo cuando se terceriza el paso. | Estampado especial, troquelado custom, envío. |

### Cálculo del costo del material

> **NO hay una lógica común** para calcular el costo del material. **Depende del tipo de material**.

Hallazgo del usuario:
- **Hojas (papel)**: se cobran por hoja. `costo = pliegos × precio_por_pliego`.
- **Rígidos (placas)**: distintas estrategias (m² exacto / largo consumido / segmentos por placa). Hoy implementadas como las 3 estrategias de costing #1 ya extraídas.
- **Vinilo**: contempla márgenes de impresión + vinilo de desperdicio en el rollo según nesting + lo realmente impreso. Lógica más compleja.

### Implicación clave para el módulo `costing/`

El módulo `costing/` que arrancamos con la sub-fase #1 (m2-exact, consumed-length, plate-segments) cubre el caso **rígidos**. Para cubrir todos los tipos de material van a hacer falta más estrategias o un modelo más rico de "estrategia de costo según tipo de material".

> **NO modelamos el precio comercial al cliente** (descuentos, márgenes). Eso es otra capa encima del costo. Por ahora: solo costo.

---

## 7. Activación del paso

### Modos

Un paso puede tener uno de estos 3 modos de activación:

| Modo | Quién decide | Ejemplo |
|---|---|---|
| **OBLIGATORIO** | Nadie. Siempre se ejecuta. | "Imprimir" en una ruta de tarjetas. |
| **OPCIONAL** | El **comercial** al armar la orden de trabajo. | "Diseño Gráfico" — el comercial sabe si el cliente trae arte y decide. "Laminado" — el comercial pregunta al cliente. |
| **CONDICIONAL** | El **JobContext** + reglas del paso (automático). | Si `JobContext.uso = 'exterior'` → activar paso "Laminar UV" sí o sí. |

### Quién decide qué

- **OPCIONAL**: NO depende del JobContext. Depende de decisión humana del comercial.
- **CONDICIONAL**: SÍ depende del JobContext. Hay reglas que evalúan el contexto y deciden automático.

### Validación de capacidades

> NO es responsabilidad del motor.

Si una empresa no tiene laminadora, **no incluye el paso "Laminar" en la ruta del producto**. Cada empresa crea sus productos según sus capacidades. El motor confía en que la ruta es válida.

---

## 8. El costo final = 3 buckets

### Buckets de costo

Todo paso produce costo en 1 a 3 de estos buckets:

| Bucket | Cómo se calcula | Cuándo aparece |
|---|---|---|
| **💰 Centro de costo** | `tiempo × tarifa_horaria` | Casi siempre (excepto cargos puramente flat). |
| **📦 Materias primas** | `cantidad × precio` (con lógica según tipo de material) | Cuando el paso consume materiales. |
| **💵 Cargos flat** | Cantidad fija (no escalable) | Tercerización, royalties, viático, envío, costo mínimo del paso. |

### Cómo se muestra al comercial

- **Vista del comercial al cotizar**: total único (suma de los 3 buckets).
- **Sistema interno**: trazabilidad completa por bucket, por paso, por máquina, por material. Esto se usa para reportes, análisis de rentabilidad y vistas detalladas.

> La trazabilidad completa NO se descarta. Es input para futuras vistas y reporting.

---

## 9. Síntesis del modelo

```
┌─ Un paso tiene estas dimensiones ─────────────────────────────────┐
│                                                                    │
│  Identidad        : nombre, código, descripción                    │
│  Familia/tipo     : impresión / corte / encuadernación / ...       │
│  Relación máquina : M-0 (sin) / M-1 (única) / M-2 (alternativas)   │
│  Perfiles         : si hay máquina, N modos posibles               │
│  Tipo de tiempo   : T-1 (fijo) / T-2 (prod propia) / T-3 (prod máq)│
│  Componentes T    : setup, run, cleanup, [tiempoFijo extra]        │
│  Unidad           : pliegos, m², piezas, ... (de catálogo cerrado) │
│  Activación       : OBLIGATORIO / OPCIONAL / CONDICIONAL           │
│  Materiales       : 0..N de 4 tipos                                │
│  Outputs          : qué salidas canónicas escribe al JobContext    │
│  Buckets de costo : centroCosto + materiasPrimas + cargosFlat      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

```
┌─ El motor por pasos opera así ────────────────────────────────────┐
│                                                                    │
│  1. Recibe: producto + ruta (lista de pasos) + JobContext inicial  │
│  2. Para cada paso de la ruta:                                     │
│     a. Decide si se ejecuta (OBL / OPC / COND).                    │
│     b. Lee del JobContext lo que necesita.                         │
│     c. Calcula tiempo (T-1/T-2/T-3) + materiales + cargos flat.    │
│     d. Escribe en JobContext sus salidas canónicas.                │
│     e. Acumula su costo en los 3 buckets.                          │
│  3. Devuelve total + trazabilidad completa.                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. Qué impacto tiene este modelo en lo que ya extrajimos

### Sobre `nesting/` (Fase 1 completa)

✅ **Se valida y se queda**. El nesting es **precondición** del cálculo de cantidad-a-producir cuando hay máquina (T-3). Es una pieza de Lego correcta.

### Sobre `costing/` (sub-fase #1)

🟡 **Cubre el bucket "centro de costo" parcialmente**. Las 3 estrategias (m2-exact, consumed-length, plate-segments) cubren el bucket **materiales para rígidos**. Faltan estrategias para hojas (papel) y vinilo (más complejo). Esto va a evolucionar en fases futuras.

✅ **`loadTarifasHorarias` se queda**. Es info necesaria para todos los pasos T-3 (con máquina).

✅ **`calculateOperationCost` se queda**. Es la fórmula del bucket "centro de costo" (`tiempo × tarifa`).

### Sobre el sub-fase #2 que NO hicimos (composición setup+run+cleanup)

⏳ **Se replantea desde el modelo**. La función "calcular tiempo de un paso" debe respetar los 3 tipos T-1/T-2/T-3 y poder leer del JobContext. NO es solo una suma de 4 números — es resolver "qué tipo de tiempo aplica, leer parámetros, calcular".

---

## 11. Pendientes abiertos para próximas fases

1. **Fase A — Inventario de tipos de paso**: armar el catálogo de "familias de paso" (impresión, corte, encuadernación, etc.) usando el lenguaje común que armamos en esta fase. Cada familia describe qué unidades canónicas usa, qué outputs escribe, etc.

2. **Definir el catálogo cerrado de salidas canónicas**: hoy lo dejé como ejemplo (`pliegos`, `cortes`, etc.) — en Fase A se cierra la lista exhaustiva.

3. **Fase C — Modelo conceptual del motor**: cómo orquesta todo (recibe ruta, ejecuta pasos, devuelve total). Pseudocódigo de alto nivel.

4. **Fase D — Resoluciones por paso**: cada paso tiene N "decisiones" que resolver (qué máquina elegir, qué perfil, qué material). Mapear todas.

5. **Fase E — Validación contra casos reales**: ejecutar el modelo en papel sobre 3-5 productos reales.

6. **Fase F — Gap analysis**: estado actual vs modelo futuro.

7. **Fase G — Roadmap revisado de extracciones**: con todo lo anterior, definir orden de extracciones que sirvan al modelo.

---

## 12. Convenciones del método interactivo

Para futuras sesiones de análisis (Fase A, C, D, etc.), seguimos este método:

1. Empezamos con una pregunta concreta + ejemplos del rubro gráfico.
2. Yo (Claude) hago preguntas tipo cliclables (`AskUserQuestion`) cuando puedo dar opciones claras.
3. Cuando necesito explicación, lo digo en texto.
4. Cada cierto tiempo muestro el "mapa mental" actualizado para validar.
5. NO escribo código durante el análisis.
6. Al final de la sesión escribo el doc consolidado con lo conversado.

Este doc es el output completo de **Fase B (sesiones 1 + 2, 2026-04-23)**. Próxima sesión arranca **Fase A (Inventario de tipos de paso)** con el lenguaje y modelo que ya armamos.
