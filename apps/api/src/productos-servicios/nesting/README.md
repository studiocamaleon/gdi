# `nesting/` — Utilities puras de cálculo geométrico

Este directorio contiene **algoritmos matemáticos** que calculan cómo acomodar
piezas en superficies disponibles (placas, rollos, pliegos). Son **funciones
puras**, sin side-effects, sin DB, sin acceso a HTTP.

Las familias de paso del modelo universal (ver `../pasos/familias.ts`)
declaran cuál de estos algoritmos usan, y los motores v2 los invocan como
utilities compartidas.

---

## Contrato común de todos los nestings

Cada algoritmo respeta estas reglas:

1. **Función pura** — mismo input, mismo output. Sin randomness, sin fecha,
   sin I/O.
2. **Input fuertemente tipado** — TypeScript con campos explícitos. Nada de
   `Record<string, unknown>` en la firma.
3. **Output incluye `placements`** — la posición x/y, dimensiones y rotación
   de cada pieza en la superficie. La UI usa `placements` para dibujar el
   preview gráfico.
4. **Sin efectos laterales** — no modifica el input, no loguea, no escribe DB.
5. **Testeable en isolación** — sin mocks de Prisma ni HTTP. Basta con
   fixtures estáticos.

---

## Algoritmos disponibles

| Archivo | Qué resuelve | Features |
|---|---|---|
| `nesting-placa-rigida.ts` | Piezas en placa finita (PVC, MDF, acrílico) | Grid rectangular, multi-medida con MaxRectsPacker, rotación, márgenes |
| `nesting-rollo.ts` | Piezas en rollo continuo (vinilo, lona, tela) | Ancho imprimible de máquina, 4 márgenes, rotación, panelizado (auto/manual) |
| `nesting-hoja.ts` | Piezas en pliego finito (A3, SRA3, etc.) | Itera formatos de pliego canónicos, elige el óptimo por criterio |

## Algoritmos que NO viven acá (y por qué)

- **Pricing de placa rígida** (`m2_exacto`, `largo_consumido`, `segmentos_placa`) →
  no son nesting, son reglas de cobro sobre el resultado del nesting.
- **Selección material+plotter de vinyl cut** → regla de selección (no es
  cálculo geométrico, es decisión de negocio).
- **Transformación UI-específica del preview** (colores React, SVG coords) →
  helper de frontend o adapter del motor. Los `placements` base vienen del
  nesting.

---

## Cómo agregar un algoritmo nuevo

1. Crear `nesting-<nombre>.ts` con función pura tipada.
2. Input: objeto con todos los parámetros (máquina, material, medidas, config).
3. Output: objeto con `placements`, métricas (cantidad, aprovechamiento,
   largo consumido, etc.) y trazabilidad.
4. Crear `nesting-<nombre>.spec.ts` con tests unitarios (rápidos, puros).
5. Si alguna familia de paso lo necesita, declarar en `../pasos/familias.ts`:
   ```ts
   modoNesting: 'produce',
   nestingAlgoritmo: 'nesting-<nombre>',
   ```

---

## Relación con familias y motores

```
┌─────────────────┐       ┌──────────────────┐        ┌────────────────────┐
│ familias.ts     │       │ nesting/         │        │ motors/*.motor.ts  │
│                 │       │                  │        │                    │
│ declara cuál    │──────→│ funciones puras  │←───────│ invoca al ejecutar │
│ nesting usa     │       │ con placements   │        │ un paso            │
│ cada familia    │       │ en el output     │        │                    │
└─────────────────┘       └──────────────────┘        └────────────────────┘
```

Los motores v2 son **orquestadores**: leen la config del producto, resuelven
materiales/máquinas, invocan el nesting apropiado, propagan el layout entre
pasos encadenados (`produce` → `consume`).
