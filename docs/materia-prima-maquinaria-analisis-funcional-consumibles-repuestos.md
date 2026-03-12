# Analisis Funcional: Integracion Materia Prima con Consumibles/Repuestos de Maquinaria

## 1) Objetivo
Definir un modelo consistente para que `Maquinaria` consuma el maestro de `Materia Prima` sin duplicar costos, manteniendo flexibilidad operativa.

## 2) Problema actual
Hoy existen datos de consumibles/repuestos en Maquinaria que pueden divergir de Materia Prima:

1. Duplicacion de carga de costo.
2. Riesgo de inconsistencia en cotizacion/costo tecnico.
3. Doble mantenimiento de proveedor, unidad y variantes.

## 3) Principio funcional
`Materia Prima` debe ser la fuente unica de verdad para costos y catalogo de insumos.

Maquinaria no debe redefinir costo del insumo/repuesto cuando existe referencia a Materia Prima.

## 4) Propuesta funcional (modelo hibrido recomendado)

### 4.1 Clasificacion en Materia Prima
Agregar en la ficha de Materia Prima (nivel base):

1. `esConsumible` (boolean)
2. `esRepuesto` (boolean)

Permitir ambos activos.

### 4.2 Seleccion en Maquinaria
En secciones de `Consumibles` y `Desgaste/Repuestos`:

1. Selector principal por `MateriaPrimaVariante` (no solo MateriaPrima base).
2. Filtro por flags:
   - Consumibles: solo `esConsumible = true`
   - Repuestos: solo `esRepuesto = true`
3. Filtro adicional por compatibilidad:
   - plantilla de maquinaria
   - maquina concreta (si aplica)
   - perfil operativo (opcional)

### 4.3 Campos que quedan locales en Maquinaria
Aunque exista referencia a Materia Prima, en Maquinaria se mantienen campos de uso operativo:

1. regla de consumo por perfil o modo
2. vida util / ciclos / horas (para repuestos)
3. observaciones de mantenimiento
4. prioridad o criticidad

No mantener costo manual cuando hay referencia a Materia Prima.

## 5) Contrato de datos propuesto

### 5.1 Materia Prima
En `MateriaPrima`:

1. `esConsumible: boolean` (default `false`)
2. `esRepuesto: boolean` (default `false`)

### 5.2 Maquinaria Consumible/Repuesto
Agregar referencia opcional:

1. `materiaPrimaVarianteId: string | null`

Regla:
si `materiaPrimaVarianteId` existe, costo unitario se toma de la variante de Materia Prima.

## 6) Reglas funcionales de costo

1. Costo tecnico de proceso usa costo de Materia Prima variante cuando exista referencia.
2. Si no existe referencia, usar costo manual legacy (solo transicion).
3. Al vincular una referencia, bloquear edicion manual de costo y mostrar origen "Maestro Materia Prima".

## 7) Reglas de UX

1. En Materia Prima, mostrar switches:
   - "Es consumible"
   - "Es repuesto"
2. En Maquinaria, selector con busqueda:
   - muestra nombre + variantes (dimensiones) + unidad de uso + precio costo.
3. Mostrar badge de estado:
   - "Vinculado a Materia Prima"
   - "Manual (legacy)"
4. Mostrar advertencia si variante vinculada queda inactiva o sin precio.

## 8) Compatibilidad y casos borde

1. Variante inactiva:
   - no aparece en nuevas selecciones.
   - las referencias existentes quedan con warning y opcion de reemplazo.
2. Precio nulo:
   - warning en Maquinaria y en evaluacion de costo.
3. Cambio de unidad:
   - validar compatibilidad de unidad o requerir factor de conversion explicito.
4. Eliminacion logica de Materia Prima:
   - no romper historicos; mantener referencia para trazabilidad.

## 9) Migracion recomendada

### Fase 1 (sin ruptura)
1. agregar flags en Materia Prima
2. agregar `materiaPrimaVarianteId` en Maquinaria consumible/repuesto
3. mantener costo manual legado

### Fase 2 (adopcion guiada)
1. asistente para mapear consumibles/repuestos existentes a Materia Prima
2. reportar no vinculados
3. bloquear costo manual en nuevos registros vinculados

### Fase 3 (consistencia fuerte)
1. forzar referencia a Materia Prima en nuevas altas (segun politica)
2. costo manual solo permitido por excepcion controlada

## 10) Criterios de aceptacion

1. Un insumo/repuesto vinculado no duplica costo en Maquinaria.
2. La evaluacion de costo usa la misma fuente de verdad que Inventario.
3. Los filtros por `esConsumible`/`esRepuesto` y compatibilidad funcionan en selector.
4. Los casos borde generan warning claro y accion sugerida.
5. Se conserva trazabilidad historica de referencias.

## 11) Decision sugerida

Implementar ya el modelo hibrido con flags + referencia a `MateriaPrimaVariante`.

Es el punto de equilibrio entre:
1. consistencia ERP,
2. transicion gradual,
3. continuidad operativa sin bloquear equipos existentes.

