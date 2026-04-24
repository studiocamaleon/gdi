# Resoluciones por paso (Fase D)

> **Fase D** del análisis del motor por pasos. **Estado**: D.1→D.7 ✅ + sub-tema rutas ✅. D.8 postergado para Fase E.
> **Sesión**: 2026-04-23 / 2026-04-24. **Método**: análisis interactivo.

## Propósito

Mapear exhaustivamente las **decisiones que cada paso simple toma al ejecutarse**. Es el detalle del bucle a-h visto en Fase C.

Cada sub-tema (D.1, D.2, ...) cubre una decisión específica.

---

## D.1 — Activación del paso

### Modos de activación (fijos, 3)

- **OBLIGATORIO**: siempre se ejecuta.
- **OPCIONAL**: el comercial decide al cotizar.
- **CONDICIONAL**: una regla automática evalúa el JobContext.

### Input del comercial para OPCIONALES

Map booleano explícito por paso ID:

```typescript
opcionalesActivados: {
  "paso-id-3": true,    // activado
  "paso-id-7": false    // desactivado explícitamente
  // Si un paso opcional NO aparece → asumido desactivado (default)
}
```

### Declaración de CONDICIONAL

- **Backend**: JsonLogic en DB (campo `condicionJson`).
- **UI**: Rule Builder visual (tipo Zapier/Make). El usuario NO escribe JSON, arma reglas drag-and-drop. La UI genera el JsonLogic.
- **Plus (futuro opcional)**: cada familia puede tener un catálogo de "condiciones sugeridas" (presets) para arrancar más rápido.

### Modo por producto

La **familia** declara los modos soportados (`["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"]`). El **modelador** elige uno al armar la ruta.

```typescript
// catálogo de familias
{
  codigo: "diseno_grafico",
  modosActivacionSoportados: ["OBLIGATORIO", "OPCIONAL"],
  modoActivacionDefault: "OPCIONAL"
}
```

### Override de CONDICIONAL

**NO se permite**. Las condicionales son estrictas — la regla manda. Si se necesita libertad humana, modelar como OPCIONAL.

---

## D.2 — Resolución de máquina y perfil

### M-1 (máquina única)

El paso del producto guarda **directo el ID de la máquina específica**.

```typescript
pasoRuta: {
  maquinaId: "ricoh-pro-c5100-id"
}
```

### M-2 (alternativas de tecnología)

Lista explícita de candidatas en el paso del producto. Con flag `esPreferida`.

```typescript
pasoRuta: {
  maquinasCandidatas: [
    { maquinaId: "hibrida-uv-id", esPreferida: true },
    { maquinaId: "roland-latex-id" }
  ]
}
```

**Modo de elección**: MANUAL — el comercial elige en UI (radio buttons).

**Default**: si el comercial no elige, usa la `esPreferida`. Si ninguna está marcada como preferida → **error** "Falta seleccionar máquina".

### Selección de perfil (dentro de una máquina)

Cada perfil puede declarar `reglaAutoSeleccion` (JsonLogic contra JobContext).

**Cadena de decisión**:
1. Motor evalúa reglas de cada perfil contra JobContext.
2. Si una regla matchea → ese perfil es "default automático".
3. Si el comercial hizo override en UI → usa el override.
4. Si ninguna regla matchea y no hay override → **error** "No se pudo elegir perfil, exige selección manual".

### Validación de capacidad técnica

**Enfoque mixto**:
- **Modelador filtra al armar producto**: no incluye máquinas que obvia-mente no pueden (ej. no lista la Ricoh como candidata para vinilos gran formato).
- **Motor valida en runtime** contra JobContext dinámico (ej. medidas LIBRE): lanza error si la máquina elegida no soporta la configuración.

**UX**: opciones inválidas aparecen **deshabilitadas** en la UI con tooltip explicativo ("Ricoh no puede: gramaje > 350gr").

### Reglas de negocio (tirada mínima offset, etc.)

**NO se modelan en el motor**. El comercial conoce las reglas comerciales y decide. El motor no filtra por rentabilidad.

---

## D.3 — Resolución de cantidad a producir

### Los 4 mecanismos (cerrados)

- **A — DIRECT_FROM_JOBCONTEXT**: lee directo un campo del context (ej. `cantidad`, `m2_pedidos`).
- **B — HEREDAR_DEL_OUTPUT_CANONICO**: lee un output que escribió un paso anterior (ej. `cantidad_pliego` de Imprimir).
- **C — CALCULADO_POR_PASO**: el paso ejecuta su propio cálculo (típicamente nesting).
- **D — CONVERSIÓN**: aplica fórmula a otro valor (ej. `cajas = cantidad / piezasPorCaja`).

### Quién elige el mecanismo

**Opción híbrida**: la familia declara los mecanismos soportados. Si soporta solo uno, no hay decisión (automático). Si soporta varios, el modelador elige al armar.

```typescript
{
  codigo: "embalar",
  mecanismosCantidad: ["DIRECT_FROM_JOBCONTEXT", "CONVERSION"]
}

{
  codigo: "imprimir_por_hoja",
  mecanismosCantidad: ["CALCULADO_POR_PASO"]  // fijo
}

// En el producto
{
  pasoId: "paso-embalar",
  mecanismoCantidad: "CONVERSION",
  configMecanismo: { piezasPorCaja: 100 }  // parámetros en el paso
}
```

### Multi-cantidad (pasos compuestos)

Guillotina necesita `pliegos` + `cortes`. Plotter necesita `m²` + `piezas`.

**Modelo**: el paso declara una **cantidad PRINCIPAL** (sobre la que se calcula el tiempo) + **cantidades SECUNDARIAS** (inputs adicionales para fórmulas internas).

### Cadena de fallback

**NO soportamos cadena** (por ahora). Un mecanismo elegido, si falla, error. Si aparece caso real, se agrega después.

---

## D.4 — Cálculo de tiempo

### Origen de setup/cleanup/tiempoFijo — Jerarquía

```
1. Override en el paso del producto (si el modelador puso un valor)
2. Del perfil de la máquina (si M-1/M-2 con perfiles)
3. De la familia (default conceptual)
4. 0 si nada
```

### Cálculo de RUN

```
T-1: run = 0 (no escala; todo el tiempo es tiempoFijo)
T-2: run = (cantidad / productividad_paso_propia) × 60   → minutos
T-3: run = (cantidad / productividad_perfil) × 60         → minutos

Con merma:
run_final = run_base × (1 + merma_pct / 100)
```

### Multiplicadores (caras, capas)

**Casos simples** (doble faz, multi-capa, laminado 2 caras):
- Opción A: la familia declara sus **multiplicadores soportados** (campos del JobContext que multiplican run).

```typescript
{
  codigo: "impresion_por_hoja",
  multiplicadoresSoportados: ["caras", "tipoCopia"]
}

{
  codigo: "encuadernado_engrapado",
  multiplicadoresSoportados: []  // sin multiplicadores
}
```

El motor aplica genéricamente: para cada multiplicador declarado, lee el campo del JobContext y multiplica el run.

**Caso especial: multi-color** (vinilo 3 colores = 3 corridas con materiales propios):
- Opción X: **sub-pasos internos del paso**. El paso "Cortar vinilo" tiene una colección interna de "ejecuciones por color" y suma todo. El motor ve 1 paso, internamente N ejecuciones.

### Redondeo

**Tiempo se redondea a minutos enteros hacia arriba** (ceil). Garantiza que ningún paso "se cobre de menos".

### Caso legacy: Talonario sin tiempoFijo

El código actual tiene `totalMin = setupMin + runMin + cleanupMin` (sin tiempoFijo) para talonario, vs `+ tiempoFijoMin` en digital. Pendiente de decidir: **¿bug histórico o feature?**. Se revisa en Fase E (validación con casos reales).

---

## D.5 — Resolución de materiales

### Cómo declarar los materiales de un paso

**Opción híbrida (slots + adicionales)**:

```typescript
// En el catálogo de familia
{
  codigo: "impresion_por_hoja",
  slotsRequeridos: [
    { codigo: "sustrato_principal", tipo: "SUSTRATO", requerido: true },
    { codigo: "tinta_o_toner", tipo: "CONSUMIBLE_MAQUINA", requerido: true }
  ],
  permiteSlotsAdicionales: true  // modelador puede agregar más libremente
}

// En la ruta del producto
{
  pasoId: "paso-imprimir",
  materiales: [
    { slot: "sustrato_principal", /* config del material */ },
    { slot: "tinta_o_toner", /* config */ },
    { slot: "slot-custom-1", /* material adicional que el modelador agregó */ }
  ]
}
```

**Validación**: el motor exige que todos los slots `requerido: true` estén completos. Si falta → error.

### Variantes del material — 3 modos de selección

Cada slot del material declara uno de estos 3 modos:

```
┌─ HARDCODED ─────────────────────────────────────────────────────────┐
│   La variante es FIJA en el producto.                               │
│   Ej: "Tarjetas Premium" = Opalina 250gr hardcoded.                 │
└─────────────────────────────────────────────────────────────────────┘

┌─ COMERCIAL_ELIGE ───────────────────────────────────────────────────┐
│   El producto soporta varias variantes y el comercial elige al      │
│   cotizar (radio buttons en UI).                                    │
│   Ej: "Tarjetas Estándar" — el comercial elige 200/250/300gr.       │
│   Permite UN SOLO PRODUCTO con flexibilidad de material.            │
└─────────────────────────────────────────────────────────────────────┘

┌─ MOTOR_ELIGE_AUTO ──────────────────────────────────────────────────┐
│   El motor elige automáticamente según criterio configurable.       │
│   Ej: nesting de gran formato elige el rollo más eficiente entre    │
│       los compatibles.                                               │
│   Criterios posibles: MENOR_COSTO, MAYOR_APROVECHAMIENTO, etc.      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2 fuentes de materiales (separadas)

```
┌─ FUENTE 1: Materiales del PASO (declarados) ────────────────────────┐
│   Vienen de los slots declarados en la ruta del producto.           │
│   Típico: sustrato principal, insumos del paso, servicios externos. │
│   Los configura el modelador. El comercial puede elegir variantes. │
└─────────────────────────────────────────────────────────────────────┘

┌─ FUENTE 2: Consumibles del PERFIL DE MÁQUINA (heredados) ───────────┐
│   Vienen automáticamente de la máquina/perfil seleccionado.         │
│   Típico: tóner CMYK por clic, tinta UV por m², film por metro      │
│   lineal, desgaste de cuchilla.                                      │
│   El modelador NO los configura. El motor los aplica automático.     │
└─────────────────────────────────────────────────────────────────────┘
```

**Ambas fuentes se acumulan** en la trazabilidad del paso (bloque C del molde A-G).

### Cantidad consumida — Fórmulas

5 fórmulas cerradas:

```typescript
formula:
  | "por_unidad_productiva"   // 1 × cantidad del paso
  | "por_m2"                  // 1.5 m² × cantidad
  | "por_pieza"               // 1 bolsa × piezas
  | "por_metro_lineal"        // 1 ml × metros lineales
  | "fijo"                    // valor fijo, no escala

aplicaMultiCaras: boolean   // si true, multiplica por caras
```

### Estrategia de costo

**El PASO declara** qué estrategia aplica a cada material (al armar producto):

- **simple**: `cantidad × precio_unitario` (la mayoría de materiales).
- **m2-exact** (rígidos): área exacta × precio/m².
- **consumed-length** (rígidos): placas llenas + última proporcional.
- **plate-segments** (rígidos): escalones de % ocupación (ya extraído en `costing/`).
- (futuras estrategias: rollo-optima, etc.)

El mismo material puede usarse con distinta estrategia en distintos productos.

### Materiales condicionales dentro de un paso

**Pendiente de resolver**. Depende de cómo se estructuran los perfiles de máquina (donde típicamente viven los consumibles condicionales). Se aborda en el sub-tema próximo "Estructura de máquinas y perfiles".

---

## D.6 — Cargos directos

### Definición

**Cargo directo** = monto que NO sale de las fórmulas estándar del motor (tiempo × tarifa, cantidad × precio_unitario_material).

### Distinción importante: cargo directo ≠ adicional

- **Adicional** (jerga de imprenta): cualquier cosa extra al producto base. Incluye pasos opcionales (laminado, hotstamping) que el motor costea con fórmulas estándar.
- **Cargo directo**: lo que NO encaja en las fórmulas estándar. Algunos adicionales son cargos directos (envío, viático), otros NO (laminado es paso opcional).

### Catálogo cerrado (5 tipos)

| Tipo | Ubicación natural |
|---|---|
| Tercerización | Paso |
| Viático | Paso (`toma_medidas`) o Cotización |
| Combustible / flete | Paso (`envio`) o Cotización |
| Plancha / matriz custom | Paso (slot) |
| Recargo urgencia | Cotización |

> **Royalties**: descartado del catálogo activo. Corporearte casi no trabaja con productos licenciados; si aparece, se trata como cargo de cotización ad-hoc o se factura aparte.

### Ubicación: 2 niveles (híbrido)

```
┌─ Cargos de PASO ──────────────────────────────────────────────────┐
│   Pertenecen a un paso específico de la ruta del producto.        │
│   Ej: matriz custom de hotstamping, tercerización de corte láser  │
│       de placa exótica, viático cuando toma_medidas es paso.       │
└────────────────────────────────────────────────────────────────────┘

┌─ Cargos de COTIZACIÓN ────────────────────────────────────────────┐
│   Transversales a toda la cotización, no asociados a un paso.     │
│   Ej: envío único compartido por 3 productos, recargo urgencia    │
│       sobre toda la cotización, viático ad-hoc.                    │
└────────────────────────────────────────────────────────────────────┘
```

> **NO existe nivel intermedio "producto"**: el único caso candidato (royalty pegado al producto) no es frecuente en Corporearte. Si aparece, va como cargo de cotización con referencia al producto.

### 3 modos de cálculo del monto

```typescript
modoCalculo:
  | "MONTO_FIJO_PLANO"           // valor literal, no escala
  | "PORCENTAJE_SOBRE_BASE"      // % sobre subtotal/venta/costo
  | "POR_UNIDAD_INPUT"           // monto × valor del input declarado
```

**Configuración por modo**:

```typescript
// MONTO_FIJO_PLANO
{ modoCalculo: "MONTO_FIJO_PLANO", monto: 8000 }   // $8.000 fijos

// PORCENTAJE_SOBRE_BASE
{
  modoCalculo: "PORCENTAJE_SOBRE_BASE",
  porcentaje: 30,               // 30%
  baseDeCalculo: "SUBTOTAL"     // SUBTOTAL | VENTA | COSTO
}

// POR_UNIDAD_INPUT
{
  modoCalculo: "POR_UNIDAD_INPUT",
  precioPorUnidad: 80,          // $80
  inputCantidad: "distanciaKm"  // del JobContext de la cotización
}
```

> **NO se soporta JsonLogic custom** para fórmulas. Si aparece un caso muy retorcido, se modela ad-hoc.

### Modos de activación (3, iguales a los pasos)

Los cargos directos comparten la semántica de D.1:

- **OBLIGATORIO**: siempre se aplica.
- **OPCIONAL**: el comercial decide al cotizar.
- **CONDICIONAL**: regla JsonLogic contra el JobContext.

Cada tipo del catálogo declara `modosActivacionSoportados` (qué modos son válidos). El modelador elige al declarar el cargo en el paso/producto.

### Quién declara y quién agrega: HÍBRIDO

**Modelador (al armar producto)**:
- Declara cargos pre-asociados al paso o al producto.
- Ej: "Tarjetas Hotstamping" lleva cargo OBLIGATORIO 'matriz custom $8.000' en el paso de hotstamping.

**Comercial (al cotizar)**:
- Activa los OPCIONALES pre-declarados.
- **Puede agregar cargos AD-HOC** no pre-declarados, eligiendo del catálogo (5 tipos) + monto + descripción.
- Ej: agrega 'viático $5.000 ad-hoc — entrega en Tigre' a nivel cotización aunque el producto no lo declaró.

**Catálogo de cargos del tenant** (futuro): plantillas reusables ("Envío CABA = $2.500", "Matriz hotstamping standard = $8.000") que el modelador puede pre-llenar.

### Pisos (costos mínimos): NO se modelan

Decisión explícita: NO modelamos comportamiento de piso ("garantía mínimo $5.000 por cotización"). Razón: la semántica de "ajustar HACIA ARRIBA" si el cálculo natural cae bajo X es distinta a "sumar un cargo", y mete complejidad por casos poco frecuentes.

**Workaround**: el comercial ve el subtotal y decide manualmente si subir el monto o aceptar.

### Trazabilidad

**Bucket nuevo `cargos_directos`** en el output del motor, paralelo a los buckets de tiempo y materiales.

```typescript
// Output del motor para un paso
{
  pasoId: "hotstamping",
  tiempo: { setup: 5, run: 12, total: 17, costo: 850 },
  materiales: [...],
  cargos_directos: [
    {
      tipo: "MATRIZ_CUSTOM",
      descripcion: "Matriz hotstamping foil dorado custom",
      modoCalculo: "MONTO_FIJO_PLANO",
      monto: 8000,
      origen: "PRE_DECLARADO_MODELADOR"   // o "AD_HOC_COMERCIAL"
    }
  ],
  costoTotalPaso: 850 + 8000  // tiempo + materiales + cargos directos
}

// Output del motor a nivel cotización
{
  productos: [...],
  subtotal: 24500,
  cargos_directos_cotizacion: [
    {
      tipo: "RECARGO_URGENCIA",
      descripcion: "Entrega para mañana",
      modoCalculo: "PORCENTAJE_SOBRE_BASE",
      porcentaje: 30,
      baseDeCalculo: "SUBTOTAL",
      monto: 7350,
      origen: "AD_HOC_COMERCIAL"
    }
  ],
  total: 24500 + 7350
}
```

Cada cargo guarda su `tipo` para reportes agrupados.

---

## D.7 — Validaciones (errores que cortan)

### Alcance

D.7 cubre las validaciones que el **motor** ejecuta y que **CORTAN** la cotización (errores). Las validaciones se reparten en 3 tipos:

| Tipo | Descripción | Dónde se valida |
|---|---|---|
| **A** — Shape/format del input | "cantidad debe ser entero positivo", "fecha válida", "medidas no-negativas" | **FRONT (no es D.7)**. El motor confía en que llega válido. |
| **B** — Compatibilidad runtime entre catálogo y JobContext | "gramaje 400gr no entra en Ricoh (max 350gr)", "200 hojas/libro no entran en ningún anillo" | **MOTOR en runtime**. Es el corazón de D.7. |
| **C** — Conectividad y completitud del modelado | "slot requerido sin material", "paso N necesita output que ningún paso anterior escribe" | Idealmente al **guardar la ruta o el producto** (Journey 1). El motor mantiene chequeo defensivo en runtime. |

### Origen: solo la FAMILIA declara validaciones

**Decisión clave**: la única capa que declara reglas de validación es la **familia** del paso. Plantillas de máquina, materiales y cargos directos solo aportan **DATOS** que esas reglas consumen. Esto mantiene el modelo simple y centralizado.

```typescript
// Catálogo de familia
{
  codigo: "impresion_por_hoja",
  validaciones: [
    {
      codigo: "jobcontext_tiene_cantidad",
      tipo: "REQUIRES_INPUT",
      campo: "cantidad",
      mensaje: "Falta declarar cantidad"
    },
    {
      codigo: "maquina_soporta_gramaje",
      tipo: "COMPARE",
      campoJobContext: "gramajeGr",
      campoMaquina: "gramajeMaxGr",
      operador: "<=",
      mensaje: "Gramaje del papel ({jc.gramajeGr}gr) excede capacidad de la máquina ({maq.gramajeMaxGr}gr)"
    }
  ]
}

// Catálogo de plantilla de máquina (SOLO datos, sin lógica)
{
  codigo: "IMPRESORA_LASER",
  paramsTecnicos: { gramajeMaxGr: 350, anchoMaxMm: 330 }
}
```

### Tipos de validación soportados

```typescript
tipo:
  | "REQUIRES_INPUT"     // verifica que un campo del JobContext exista y no sea null
  | "COMPARE"            // compara dos valores (operadores: <=, >=, ==, !=, <, >)
  | "IN_RANGE"           // verifica que un valor esté entre min y max
  | "ONE_OF"             // verifica que un valor pertenezca a una lista
  | "EXISTS_OUTPUT"      // (Tipo C) verifica que un output canónico haya sido escrito por algún paso anterior
```

> **No se soportan validaciones JsonLogic custom** en este nivel. Si aparece un caso muy retorcido, se discute si vale agregarlo a la familia o se modela aparte.

### Manejo de múltiples errores: híbrido (juntar por paso, cortar entre pasos)

El motor recorre el DAG paso por paso. Para cada paso:

1. Ejecuta TODAS las validaciones declaradas por su familia.
2. Acumula todos los errores detectados en ese paso.
3. Si hay al menos un error, **NO avanza al siguiente paso** (sus inputs pueden ser inválidos).
4. Devuelve la lista de errores del paso fallado + lista de pasos no ejecutados.

**Pro**: el comercial ve todos los errores corregibles del paso fallado de una sola vez (ej: "máquina no soporta gramaje" + "máquina no soporta ancho" juntos). Sin "cascade" de errores ruidosos en pasos posteriores.

### Forma del error tipado

```typescript
{
  pasoId: "paso-imprimir",
  pasoCodigo: "impresion_por_hoja",
  validacionCodigo: "maquina_soporta_gramaje",
  severidad: "ERROR",
  mensaje: "Gramaje del papel (400gr) excede capacidad de la máquina (350gr)",
  contexto: {
    jobContext: { gramajeGr: 400 },
    maquina: { id: "ricoh-pro-c5100-id", gramajeMaxGr: 350 }
  },
  sugerencia: "Cambiar a una máquina con mayor capacidad de gramaje o reducir el gramaje del papel"
}
```

### Severidad

D.7 = solo **ERROR** (corta cotización). Los WARNINGs (avisos no-bloqueantes) van en D.8 aparte. Conceptos limpios y separados.

### Validaciones de Journey 1 (al guardar ruta o producto)

Aunque el motor las chequea defensivamente, las validaciones de Tipo C se ejecutan idealmente **antes** de llegar al motor:

- Al guardar una **ruta**: validar conectividad (cada paso lee outputs que algún paso anterior escribe).
- Al guardar un **producto**: validar slots requeridos llenos, máquinas asignadas para pasos M-1, candidatas declaradas para pasos M-2.

Esto evita que se persistan rutas/productos rotos que después al cotizar exploten.

---

## D.8 — Warnings (POSTERGADO para Fase E)

**Decisión 2026-04-24**: el sub-tema D.8 (warnings no-bloqueantes) se posterga hasta tener casos reales (Fase E). Modelar warnings sin haber walked productos reales es especulativo: no sabemos qué warnings realmente le importan al comercial vs qué warnings agregan ruido.

**Cuando se retome** (después de Fase E), las preguntas a responder serán:
- ¿Quién los declara? (familia, plantilla, modelador en producto, configuración tenant)
- ¿Thresholds fijos o configurables?
- ¿Cómo aparecen en el output (lista paralela a errores / por paso / dos buckets)?
- ¿El comercial puede dismissar warnings específicos? ¿Se persiste el dismiss?

**Casos candidatos a validar en Fase E** (qué warnings aparecen naturalmente al walkear productos reales):
- Aprovechamiento de nesting bajo
- Merma alta vs configurada
- Tirada baja/alta para la máquina elegida
- Stock insuficiente del material
- Datos viejos (precios snapshotted hace mucho)
- Decisión sub-óptima (eligió alternativa NO PREFERIDA)
- Total de cotización fuera del rango típico
- Tarifa horaria del centro de costo en 0 o no definida

### Sub-tema paralelo (crítico)

- **Estructura de máquinas y perfiles** (abierto por el usuario en D.5): necesitamos profundizar en cómo se modelan plantillas de máquinas, sus parámetros técnicos, los perfiles operativos, y sus consumibles. Toca D.2 (resolución máquina/perfil), D.4 (de dónde salen setup/cleanup/run), D.5 (fuente 2 de materiales), y D.7 (validaciones de capacidad).

Este sub-tema es la próxima sesión, antes de seguir con D.6-D.8.

---

## Estado de Fase D

| Sub-tema | Estado |
|---|---|
| D.1 Activación | ✅ |
| D.2 Máquina/perfil | ✅ |
| D.3 Cantidad | ✅ |
| D.4 Tiempo | ✅ |
| D.5 Materiales | ✅ (con pendiente "materiales condicionales" → a resolver en sub-tema máquinas/perfiles) |
| **Sub-tema: Máquinas y perfiles** | 🟡 9 plantillas modeladas, faltan estructural |
| D.6 Cargos directos | ✅ |
| D.7 Validaciones (errores) | ✅ |
| D.8 Warnings | ⏸️ Postergado para Fase E |
| **Sub-tema: Ruta de producción reusable** | ✅ (`07-ruta-de-produccion.md`) |
