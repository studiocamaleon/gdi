# Estandar ERP: Claves Canonicas y Unidades

## Objetivo
Definir una regla unica para todo el ERP:

1. Las claves tecnicas deben ser canonicas (sin unidad embebida en el nombre).
2. La unidad debe vivir en `unit`.
3. Cuando existan ambas dimensiones, el orden debe ser `ancho` y luego `alto`.

## Reglas obligatorias

1. No usar sufijos de unidad en `key`.
2. Usar claves canonicas: `ancho`, `alto`, `largo`, `espesor`, `gramaje`, `diametro`, `tension`, `corriente`, `potencia`, etc.
3. Definir la unidad solo en metadatos (`unit`).
4. En tablas de variantes: `ancho` siempre antes que `alto`.
5. Para magnitudes electricas, usar unidades tecnicas explicitas (`v`, `a`, `w`, `w_m`, `lm`, `k`).

## Ejemplos

- Incorrecto: `anchoMm`
- Correcto: `ancho` + `unit: "mm"`

- Incorrecto: `tensionV`
- Correcto: `tension` + `unit: "v"`

- Incorrecto: `presentacionMl`
- Correcto: `presentacion` + `unit: "ml"`

## Estado actual

1. Materia Prima:
- migrado a claves canonicas.
- con compatibilidad legacy al cargar ficha (`alias legacy -> canonico`).
- con validacion automatica:
  - rechazo de keys con sufijos de unidad.
  - validacion de orden `ancho` -> `alto`.

2. Otros modulos:
- mantener esta regla para cualquier nueva implementacion o refactor.
- si se detectan claves legacy, normalizar en el proximo cambio del modulo.

## Implementacion tecnica de control

- Validadores en `src/lib/canonical-keys.ts`.
- Aplicados actualmente en `src/lib/materia-prima-templates.ts`.

