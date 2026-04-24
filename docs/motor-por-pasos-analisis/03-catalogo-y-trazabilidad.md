# Catálogo de salidas canónicas + Trazabilidad por paso

> **Fase A** del análisis del motor por pasos — sub-tema "outputs y trazabilidad".
> **Sesión**: 2 (2026-04-23). **Estado**: COMPLETO.
> **Método**: análisis interactivo. NO escribir código.

## Propósito

Cerrar 2 temas que son la "salida" de cada paso al ejecutarse:

1. **Catálogo de salidas canónicas**: qué deja el paso en el JobContext para que pasos siguientes lo lean. Es **inter-paso** y debe tener nombres cerrados (catálogo).
2. **Trazabilidad por paso**: qué se guarda al ejecutar el paso para reporting/análisis futuro. Va al snapshot, NO al JobContext.

Estos dos tipos de salida son distintos y no se mezclan.

---

## 1. Catálogo de salidas canónicas (cerrado, 13 outputs)

### Enfoque: HÍBRIDO

- Pocos nombres canónicos genéricos para inter-paso.
- Cada paso ADEMÁS escribe su trazabilidad específica (no entra al catálogo, va al snapshot).

### A — Cantidades por unidad canónica (5)

Patrón `cantidad_<unidad>`. Las 5 unidades base son: unidad, pliego, placa, metro_lineal, m2.

| Output | Significado | Lo escriben típicamente |
|---|---|---|
| `cantidad_unidad` | Piezas/unidades discretas (tarjetas, libros, cajas, luminosos) | corte_*, encuadernación, embalaje, instalación |
| `cantidad_pliego` | Cantidad de pliegos | impresion_por_hoja, plegado, barniz |
| `cantidad_placa` | Cantidad de placas rígidas | impresion_por_pieza (placas), CNC |
| `cantidad_metro_lineal` | Metros lineales de rollo consumidos/laminados | impresion_por_area, laminado, plotter_corte |
| `cantidad_m2` | Metros cuadrados | impresion_por_area, instalacion_in_situ, plotter_corte |

> NO incluye `hora` — el tiempo va a trazabilidad, no al JobContext.

### B — Cantidades secundarias (3)

Info adicional que el paso pasa al siguiente para que calcule.

| Output | Significado |
|---|---|
| `cortes` | Cantidad de cortes a hacer (lo leen guillotina, plotter, troquelado) |
| `perforaciones` | Cantidad de perforaciones (lo leen perforado, anillado) |
| `puntadas` | Cantidad de puntadas (lo leen cosido) |

### C — Métricas geométricas (3)

Para visualización + a veces input de pasos siguientes.

| Output | Significado |
|---|---|
| `aprovechamiento_pct` | % del sustrato aprovechado |
| `merma_pct` | % de desperdicio operativo |
| `layout` | Placements de las piezas (para preview SVG) |

### D — Flags / estados (2)

| Output | Significado |
|---|---|
| `proof_aprobado` | Booleano: el cliente aprobó la prueba |
| `imposicion_calculada` | Booleano: pre-prensa terminó la imposición |

---

**Total: 13 outputs canónicos cerrados** que van al JobContext.

### Distinción MUTABLE vs INMUTABLE en el JobContext

Algunos pasos (típicamente `modificacion_pre`) **mutan** valores existentes del JobContext, no solo escriben outputs nuevos. Por eso distinguimos:

```
┌─ Valores MUTABLES del JobContext ──────────────────────────────────┐
│   Pueden ser sobrescritos por pasos PRE.                           │
│                                                                     │
│   • anchoMm / altoMm (medidas físicas del producto)                │
│   • m2_pedidos (área total)                                        │
│   • metros_lineales_pedidos                                        │
│                                                                     │
│   Ej: paso PRE de bolsillo_lona muta altoMm de 3000 → 3200.        │
└────────────────────────────────────────────────────────────────────┘

┌─ Valores INMUTABLES del JobContext ────────────────────────────────┐
│   NO pueden ser modificados por pasos. Permanecen como entrada.    │
│                                                                     │
│   • cantidad pedida                                                │
│   • variante elegida                                               │
│   • opciones del cliente / selecciones                             │
│   • período (mes)                                                  │
│   • cliente                                                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

Implicación para el motor: solo los pasos `modificacion_pre` tienen permiso de mutar. Otros pasos solo pueden escribir outputs canónicos NUEVOS.

### Criterios de selección automática de materiales (modo MOTOR_ELIGE_AUTO)

Cuando un paso declara `modoSeleccion: MOTOR_ELIGE_AUTO`, el motor elige una variante automáticamente. Los criterios soportados son:

| Criterio | Significado | Campo extra requerido |
|---|---|---|
| `MENOR_COSTO` | Variante con menor precio_unitario | — |
| `MAYOR_APROVECHAMIENTO` | Variante que minimiza desperdicio (típico nesting) | criterio interno del nesting |
| `MENOR_CAPACIDAD_QUE_CUMPLA` | Variante MÁS PEQUEÑA cuya capacidad sea suficiente | `criterioInput` (campo JobContext) + `criterioCampoMaterial` (campo del material) |

**Ejemplo de `MENOR_CAPACIDAD_QUE_CUMPLA`** (ANILLADORA):
```
Comercial pide libro de 80 hojas
  ↓
Motor lee criterioInput "hojasPorLibro" del JobContext = 80
  ↓
Motor compara con criterioCampoMaterial "capacidadMaxHojas" de cada variante:
  espiral 6mm  → cap 25  ❌ no cumple
  espiral 10mm → cap 60  ❌ no cumple
  espiral 15mm → cap 100 ✓ cumple
  espiral 20mm → cap 150 ✓ cumple
  espiral 30mm → cap 250 ✓ cumple
  ↓
Motor elige el MÁS PEQUEÑO que cumple → espiral 15mm.
```

---

## 2. Trazabilidad por paso (snapshot completo)

### Propósito

Al ejecutar un paso, se guarda **toda la info necesaria para reporting/análisis futuro**. No se mezcla con el JobContext (que es lo que pasos siguientes leen).

### Molde A-G

```
┌─ TRAZABILIDAD DE UN PASO EJECUTADO ─────────────────────────────────┐
│                                                                      │
│ A. IDENTIDAD                                                         │
│   • familia              (ej: impresion_por_hoja)                    │
│   • familia_version      (ej: 1)                                     │
│   • paso_id              (id del paso en la ruta del producto)       │
│   • orden                (orden en la ruta)                          │
│   • config_aplicada      (snapshot de la config usada)               │
│                                                                      │
│ B. RECURSOS USADOS                                                   │
│   • maquina              (id + nombre + plantilla)                   │
│   • perfil_operativo     (id + nombre + parámetros)                  │
│   • centro_costo         (id + nombre)                               │
│   • operario             (si se registra)                            │
│                                                                      │
│ C. INSUMOS CONSUMIDOS (lista)                                        │
│   Cada item:                                                         │
│   • materia_prima        (id + nombre)                               │
│   • variante             (id + atributos: gramaje, color, ancho...)  │
│   • cantidad             (cuánto se consumió)                        │
│   • unidad               (gramos, ml, pliegos, m², etc.)             │
│   • precio_unitario      (en el período)                             │
│   • costo_total                                                      │
│   • es_sustrato          (booleano: es el sustrato principal?)       │
│                                                                      │
│ D. TIEMPOS DESGLOSADOS                                               │
│   • setup_min                                                        │
│   • run_min              (productivo)                                │
│   • cleanup_min                                                      │
│   • tiempo_fijo_min                                                  │
│   • total_min                                                        │
│                                                                      │
│ E. CANTIDADES PROCESADAS                                             │
│   • cantidad_pedida_cliente                                          │
│   • cantidad_input_paso       (lo que entró al paso del anterior)    │
│   • cantidad_output_paso      (lo que produjo el paso)               │
│   • merma_calculada                                                  │
│   • merma_aplicada_pct                                               │
│                                                                      │
│ F. COSTOS POR BUCKET                                                 │
│   • costo_centro_costo                                               │
│   • costo_materiales         (por insumo)                            │
│   • cargos_flat              (con motivo: tercerizacion, viatico)    │
│   • costo_total_paso                                                 │
│                                                                      │
│ G. MÉTRICAS / WARNINGS                                               │
│   • aprovechamiento_pct                                              │
│   • layout                  (si aplica visualización)                │
│   • warnings                (alertas no bloqueantes)                 │
│   • metricas_extra          (k-values custom de la familia)          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Reportes posibles habilitados por la trazabilidad

| Bloque | Reportes |
|---|---|
| **A. Identidad** | "¿Cuántas veces se ejecutó la familia X este mes?" |
| **B. Recursos** | "Ocupación de la Ricoh", "Horas en Centro Impresión Laser", "Productividad por operario" |
| **C. Insumos** | "Consumo de tóner CMYK acumulado en gramos", "Stock proyectado de Opalina 250gr", "Costo de papel mensual" |
| **D. Tiempos** | "% de tiempo en setup vs productivo", "Cuello de botella por máquina" |
| **E. Cantidades** | "Volumen producido por familia", "Merma promedio por familia/máquina" |
| **F. Costos** | "Margen por producto", "Estructura: % material vs tiempo vs flat" |
| **G. Métricas** | "Aprovechamiento promedio del rollo de vinilo", "Productos con más warnings" |

---

## 3. Cuándo se guarda la trazabilidad (snapshots)

### Decisión

**SOLO cuando la cotización se marca como FORMAL** (con validez para el cliente).

### Flujo

```
┌─ FLUJO DE COTIZACIÓN ───────────────────────────────────────────────┐
│                                                                      │
│  1. Comercial calcula precios en pantalla                            │
│     → motor por pasos ejecuta                                        │
│     → resultado en memoria                                           │
│     → NO se guarda snapshot todavía                                  │
│                                                                      │
│  2. Comercial decide "formalizar" (presupuesto al cliente)           │
│     → backend genera SNAPSHOT con trazabilidad A-G de TODOS pasos    │
│     → se guarda fecha de vencimiento (15, 30 días)                   │
│     → se guardan costos congelados (tarifas/precios del momento)     │
│                                                                      │
│  3a. Cliente acepta dentro del vencimiento                           │
│      → cotización pasa a ORDEN DE TRABAJO                            │
│      → se honra el precio del snapshot                               │
│                                                                      │
│  3b. Cliente vuelve después del vencimiento                          │
│      → se hace nueva cotización con costos actuales                  │
│      → snapshot anterior queda histórico                             │
│                                                                      │
│  3c. Cliente no vuelve                                               │
│      → cotización vence                                              │
│      → snapshot histórico para análisis comercial                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Implicación para el motor

El motor por pasos **siempre genera la trazabilidad completa** al ejecutar (A-G). Quien decide guardarla o no es **el caller** (controller del endpoint), según el contexto:
- Cálculo en pantalla → calcular y devolver, no persistir.
- Formalizar → calcular y persistir snapshot completo.

**El motor no se mete con persistencia.** Es función pura: input → output (incluye trazabilidad).

---

## 4. Estructura del SNAPSHOT persistido

```
CotizacionFormalSnapshot {
  id, tenantId, cliente, fechaCotizacion, fechaVencimiento,
  productoServicioId, varianteId, cantidad,
  
  resultado: {
    total, unitario,
    subtotales: { centroCosto, materiasPrimas, cargosFlat },
    pasos: [
      {
        // Trazabilidad A-G por paso
        identidad: {...},
        recursos: {...},
        insumos: [...],
        tiempos: {...},
        cantidades: {...},
        costos: {...},
        metricas: {...}
      }
    ]
  },
  
  costos_congelados: {
    // Snapshot de tarifas y precios del momento
    tarifasCentroCosto: [{ centroCostoId, periodo, tarifa }],
    preciosMaterialesPrincipales: [{ varianteId, precio }]
  },
  
  estado: 'FORMAL' | 'ACEPTADA' | 'VENCIDA' | 'CONVERTIDA_EN_ORDEN'
}
```

---

## 5. Implicaciones para el motor por pasos

1. **El motor calcula y devuelve siempre la trazabilidad completa**. No es opcional.
2. **El motor es función pura**: input → output. No persiste.
3. El **caller decide** si guarda snapshot (al formalizar cotización).
4. Los **costos congelados** se guardan junto con el snapshot, no con el motor.
5. La **reproducibilidad** del precio se logra leyendo el snapshot (no re-ejecutando el motor con costos nuevos).

---

## 6. Próximos pasos

1. **Fase C — Modelo conceptual del motor**: pseudocódigo del flujo del motor por pasos. Ya con el catálogo + trazabilidad + JobContext claros.
2. **Fase D — Resoluciones por paso**: cada paso tiene N decisiones a resolver al ejecutar (qué máquina elegir, qué perfil, qué material). Mapear todas.
3. **Fase E — Validación con casos reales**: ejecutar el modelo en papel sobre 3-5 productos.
4. **Fase F — Gap analysis**: estado actual vs modelo futuro.
5. **Fase G — Roadmap revisado**.
