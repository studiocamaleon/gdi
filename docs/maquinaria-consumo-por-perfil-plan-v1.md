# Plan Funcional-Tecnico: Consumo de Materia Prima por Perfil en Maquinaria (v1)

## 1) Objetivo
Definir un modelo consistente para calcular consumo de consumibles en Maquinaria en funcion del perfil operativo, evitando carga duplicada y campos ambiguos.

Este plan complementa lo ya implementado:
1. Vinculo de consumibles/repuestos de Maquinaria con `MateriaPrimaVariante`.
2. Flags de Materia Prima: `esConsumible` y `esRepuesto`.

## 2) Hallazgos del flujo actual (relevamiento profundo)
Estado actual en `src/components/costos/maquinaria-panel.tsx`:
1. Paso 2 (`Perfiles operativos`) y Paso 3 (`Consumibles`) existen como pasos separados.
2. Paso 3 no modela una relacion explicita "perfil -> consumo".
3. En consumibles todavia existen campos redundantes para el modelo final:
   - `nombre` texto libre
   - `tipo`
   - `unidad`
4. Al tener `materiaPrimaVarianteId`, esos campos deberian derivarse desde la variante/material y no ser fuente primaria de datos.
5. Hay `consumoBase`, pero no queda canonizada su unidad/driver por perfil ni por canal.

Conclusion:
El formulario necesita pasar de "lista de consumibles" a "matriz de consumo por perfil".

## 3) Decision funcional principal
Implementar consumo parametrizado por perfil para consumibles, con dos niveles:
1. Nivel base (todas las maquinas): consumo por perfil y por consumible.
2. Nivel avanzado (impresoras): consumo por perfil, consumible y canal/color.

## 4) Alcance por tipo de plantilla de maquina
Plantillas actuales:
1. `router_cnc`
2. `corte_laser`
3. `impresora_3d`
4. `impresora_dtf`
5. `impresora_dtf_uv`
6. `impresora_uv_mesa_extensora`
7. `impresora_uv_cilindrica`
8. `impresora_uv_flatbed`
9. `impresora_uv_rollo`
10. `impresora_solvente`
11. `impresora_inyeccion_tinta`
12. `impresora_latex`
13. `impresora_sublimacion_gran_formato`
14. `impresora_laser`
15. `plotter_cad`
16. `mesa_de_corte`
17. `plotter_de_corte`

Clasificacion recomendada:
1. `isPrinter = true`:
   - toda plantilla que inicia con `impresora_`
2. `isPrinter = false`:
   - resto (router, laser de corte, mesa de corte, plotters de corte/CAD, 3D)

Regla:
1. Consumo por perfil aplica a todas.
2. Consumo por canal/color solo cuando `isPrinter = true`.

Nota:
`isPrinter` no debe ser editable por usuario. Debe derivarse de plantilla.

## 5) Canonizacion de unidad para costeo (A4 vs m2)
Problema:
La industria usa mucho "A4 equivalente", pero los trabajos reales vienen en A4, SRA3, SRA3+, rollos y formatos personalizados.

Decision recomendada:
1. Unidad canónica interna para impresion por superficie: `m2`.
2. `a4_equiv` como unidad derivada para:
   - reporting,
   - interoperabilidad,
   - cargas legacy.

Definiciones:
1. `A4 = 0.210 m x 0.297 m = 0.06237 m2`
2. `a4_equiv = area_m2 / 0.06237`

Ejemplos:
1. SRA3 (32x45 cm): `0.144 m2 = 2.309 a4_equiv`
2. SRA3+ (32.5x50 cm): `0.1625 m2 = 2.605 a4_equiv`

## 6) Rediseño UX propuesto (Paso 3)
### 6.1 Estructura nueva
Reemplazar Paso 3 por dos bloques:
1. `3.1 Consumibles vinculados`
2. `3.2 Reglas de consumo por perfil`

### 6.2 3.1 Consumibles vinculados
Campos:
1. `MateriaPrimaVariante` (selector, obligatorio)
2. `Activo` (switch)
3. `Observaciones` (opcional)

Campos eliminados de UI:
1. `Nombre` libre
2. `Tipo`
3. `Unidad`

Esos datos se muestran como lectura desde Materia Prima:
1. nombre material
2. unidad de uso
3. precio costo referencia

### 6.3 3.2 Reglas de consumo por perfil
Vista tipo tabla/matriz:
1. Filas: perfiles operativos (creados en Paso 2)
2. Columnas: consumibles vinculados
3. Celda: consumo por unidad de salida del perfil

Campos por celda (MVP):
1. `rate` (numero)
2. `rateUnit` (unidad de consumo, ej: ml, g, m2)
3. `driverUnit` (unidad de salida, ej: m2, copia, metro_lineal, pieza)
4. `setupFijo` (opcional)
5. `mermaPct` (opcional)

Regla UX:
1. Si no hay perfiles en Paso 2, no se habilita matriz (mostrar aviso guiado).

### 6.4 Extensión para impresoras (nivel avanzado)
Para `isPrinter = true` agregar modo "detalle por canal":
1. canal/color: C, M, Y, K, W, Barniz (configurable por plantilla/perfil)
2. consumo por canal en `ml/m2` (u otra unidad compatible)

## 7) Modelo de datos recomendado
Mantener entidades actuales de consumibles/repuestos y agregar reglas separadas.

Tabla nueva sugerida: `MaquinaReglaConsumoConsumible`
1. `id`
2. `tenantId`
3. `maquinaId`
4. `perfilOperativoId` (obligatorio)
5. `consumibleId` (obligatorio, FK a `MaquinaConsumible`)
6. `canal` (nullable; usado en impresoras)
7. `driverUnit` (unidad de salida)
8. `rate`
9. `rateUnit`
10. `setupFijo` (nullable)
11. `setupUnit` (nullable)
12. `mermaPct` (nullable)
13. `activo`
14. timestamps

Restricciones:
1. unique: (`tenantId`, `maquinaId`, `perfilOperativoId`, `consumibleId`, `canal`)
2. validar compatibilidad de unidades (`rateUnit` y `setupUnit`) contra modulo de unidades canonicas.

## 8) Reglas de negocio
1. Un consumible sin regla explicita para un perfil:
   - puede heredar default de maquina/consumible (si existe),
   - o marcar warning obligatorio antes de pasar a "lista".
2. Repuestos:
   - seguir con vida util/prorrateo,
   - no mezclar con matriz de consumo de produccion.
3. Costo en calculo:
   - `consumo_total = output * rate + setupFijo + merma`
   - `costo = consumo_total * costo_unitario_materia_prima`

## 9) Plan de implementación por fases
### Fase A (MVP fuerte)
1. Simplificar UI de consumibles (solo variante + metadatos operativos).
2. Crear matriz de consumo por perfil.
3. Persistir reglas por perfil/consumible (sin canal).
4. Validar unidades canonicas.

### Fase B (impresoras)
1. Habilitar `isPrinter` derivado por plantilla.
2. Agregar modo por canal/color en reglas.
3. Presets por tecnologia (CMYK, CMYK+W, CMYK+W+V).

### Fase C (integración costeo)
1. Conectar reglas al motor de procesos/cotizacion.
2. Habilitar override controlado por trabajo.
3. Exponer trazabilidad en historial de costos.

## 10) Cambios concretos de formulario (resumen)
1. Paso 2 mantiene perfiles como fuente de verdad.
2. Paso 3 deja de pedir nombre/tipo/unidad manual de consumible.
3. Paso 3 incorpora matriz perfil x consumible.
4. Paso 3 impresoras agrega detalle opcional por canal.

## 11) Riesgos y mitigaciones
1. Riesgo: complejidad UI en Paso 3.
   - Mitigacion: MVP sin canales + tabla simple editable.
2. Riesgo: unidades inconsistentes.
   - Mitigacion: usar `src/lib/unidades.ts` y validaciones server.
3. Riesgo: migracion de datos incompletos.
   - Mitigacion: autogenerar reglas default temporales y mostrar warnings.

## 12) Decision recomendada para continuar
Avanzar con Fase A de inmediato, porque:
1. corrige el defecto funcional actual (sin consumo por perfil),
2. simplifica carga de consumibles,
3. deja base lista para el nivel avanzado de impresoras.

