# Materia Prima: Matriz Oficial de Dimensiones por Plantilla (V1)

Fecha: 2026-03-12
Estado: Base funcional aprobada para implementación

## 1) Objetivo

Definir la matriz oficial de `dimensiones` por plantilla de materia prima para:

1. usar esas dimensiones como columnas del tab `Variantes`;
2. evitar duplicidad de captura en tabs técnicos intermedios;
3. asegurar consistencia de unidades para cálculo, stock y costo;
4. servir de base para evolución futura del módulo.

---

## 2) Principios de modelado

1. La `plantilla` define las dimensiones disponibles.
2. El usuario carga valores solo en `Variantes`.
3. Las dimensiones pueden ser:
- `obligatorias`
- `opcionales`
4. Las unidades no son labels: son unidades canónicas con dimensión física y reglas de conversión.
5. Campos operativos internos (IDs, hashes, etc.) no se exponen como datos funcionales.

---

## 3) Unidades canónicas (V1)

Unidades base recomendadas:

1. Longitud: `m`
- derivadas: `cm`, `mm`
2. Área técnica: `g/m2` (gramaje)
3. Volumen: `L`
- derivadas: `ml`
4. Masa: `kg`
- derivadas: `g`
5. Conteo: `unidad` (para valores no físicos o discretos)

Regla:

- solo convertir entre unidades compatibles de la misma dimensión física.

---

## 4) Matriz final por plantilla

## 4.1 `sustrato_hoja`

Dimensiones obligatorias:

1. `formatoComercial` (texto)
2. `anchoCm` (numérico, `cm`)
3. `altoCm` (numérico, `cm`)
4. `gramajeGm2` (numérico, `g/m2`)
5. `material` (texto; ejemplo: ilustración, obra, opalina)
6. `acabado` (texto)

Dimensiones opcionales:

- ninguna

---

## 4.2 `sustrato_rollo_flexible`

Dimensiones obligatorias:

1. `largoRolloM` (numérico, `m`)
2. `anchoRolloM` (numérico, `m`)
3. `acabado` (texto)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- no incluir `tipoAdhesivo`, `espesor`, ni `colorBase` como dimensiones de variante.

---

## 4.3 `sustrato_rigido`

Dimensiones obligatorias:

1. `anchoM` (numérico, `m`)
2. `altoM` (numérico, `m`)
3. `espesorMm` (numérico, `mm`)
4. `colorBase` (texto)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- `material` no se trata como dimensión de variante en esta plantilla; se espera una materia prima por material.

---

## 4.4 `tinta_impresion`

Dimensiones obligatorias:

1. `canalColor` (texto)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- no incluir `presentacionMl` como dimensión de variante.

---

## 4.5 `toner`

Dimensiones obligatorias:

1. `color` (texto)
2. `rendimientoPaginasISO` (numérico, `unidad`)

Dimensiones opcionales:

- ninguna

---

## 4.6 `film_transferencia`

Dimensiones obligatorias:

1. `anchoRolloM` (numérico, `m`)
2. `largoRolloM` (numérico, `m`)

Dimensiones opcionales:

1. `tipoPeel` (texto)

---

## 4.7 `papel_transferencia`

Dimensiones obligatorias:

1. `anchoRolloM` (numérico, `m`)
2. `gramajeGm2` (numérico, `g/m2`)

Dimensiones opcionales:

1. `largoRolloM` (numérico, `m`)

---

## 4.8 `laminado_film`

Dimensiones obligatorias:

1. `anchoRolloM` (numérico, `m`)
2. `largoRolloM` (numérico, `m`)
3. `acabado` (texto)

Dimensiones opcionales:

- ninguna

---

## 4.9 `quimico_acabado`

Dimensiones obligatorias:

1. `presentacionMl` (numérico, `ml`)
2. `tipoQuimico` (texto)

Dimensiones opcionales:

- ninguna

---

## 4.10 `polvo_dtf`

Dimensiones obligatorias:

1. `tipoPolvo` (texto)
2. `presentacionKg` (numérico, `kg`)

Dimensiones opcionales:

- ninguna

---

## 4.11 `anillado_encuadernacion`

Dimensiones obligatorias:

1. `material` (texto; ejemplo: ring-wire, plástico)
2. `diametroMm` (numérico, `mm`)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- no incluir `paso`; aplica solo a un subconjunto (wire) y no al total de materiales de anillado.

---

## 4.12 `tapa_encuadernacion`

Dimensiones obligatorias:

1. `formatoComercial` (texto)
2. `anchoM` (numérico, `m`)
3. `altoM` (numérico, `m`)
4. `material` (texto)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- `espesor` se elimina como dimensión en V1.

---

## 4.13 `argolla_llavero_accesorio`

Dimensiones obligatorias:

1. `diametroInternoMm` (numérico, `mm`)
2. `material` (texto)

Dimensiones opcionales:

- ninguna

Nota funcional explícita:

- no incluir `espesorAlambre` en V1.

---

## 4.14 `ojal_ojalillo_remache`

Dimensiones obligatorias:

1. `diametroInternoMm` (numérico, `mm`)
2. `material` (texto)

Dimensiones opcionales:

1. `medidaOjal` (texto)

---

## 4.15 `portabanner_estructura`

Dimensiones obligatorias:

1. `tipoPortabanner` (texto)
2. `anchoVisibleM` (numérico, `m`)
3. `altoVisibleM` (numérico, `m`)

Dimensiones opcionales:

- ninguna

---

## 5) Implementación funcional acordada

1. El tab `Template técnico` se elimina de la ficha de materia prima.
2. `Variantes` es la única pantalla de captura de dimensiones.
3. La grilla de `Variantes` toma columnas dinámicas desde esta matriz.
4. Campos internos como `SKU` se pueden autogenerar por sistema cuando no son relevantes para usuario de negocio.

---

## 6) Gobernanza de cambios

Cuando se agregue o cambie una dimensión:

1. actualizar este documento;
2. actualizar `src/lib/materia-prima-templates.ts`;
3. validar compatibilidad de unidades canónicas;
4. revisar impacto en costos, inventario y cotización.
