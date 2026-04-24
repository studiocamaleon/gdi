# Resoluciones por paso (Fase D)

> **Fase D** del análisis del motor por pasos. **Estado**: PARCIAL (D.1→D.5 cerrados, D.6-D.8 pendientes).
> **Sesión**: 2026-04-23. **Método**: análisis interactivo.

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

## Pendientes de Fase D

### Sub-temas pendientes

- **D.6 — Cargos flat**: tercerización, viático, royalties, costo mínimo. (Poco material, probablemente corto.)
- **D.7 — Validaciones e inputs del JobContext**: qué inputs necesita cada paso, cómo los valida, errores tipados.
- **D.8 — Warnings**: qué casos generan warnings (no cortan pero avisan: nesting bajo aprovechamiento, merma alta, tirada baja para máquina, etc.).

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
| **Sub-tema: Máquinas y perfiles** | ⏳ próxima sesión |
| D.6 Cargos flat | Pendiente |
| D.7 Validaciones | Pendiente |
| D.8 Warnings | Pendiente |
