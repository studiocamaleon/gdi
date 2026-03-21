# Plan de Implementacion V1 - Modulo Productos y Servicios (Costeo)

## 1) Objetivo
Diseñar e implementar un modulo de `Productos y Servicios` para cotizar y costear de forma trazable, reutilizable y multitenant, integrando:
- centros de costo y tarifas publicadas,
- procesos productivos,
- materias primas y stock,
- servicios tercerizados,
- reglas de conversion de formatos/unidades.

La meta operativa es poder cotizar un item (ejemplo: tarjeta personal) con detalle de costos por bloque y luego ejecutar consumo real de stock de forma inteligente.

## 2) Alcance V1
Incluye:
- Maestro de productos/servicios por familia y subfamilia.
- Versionado de receta de costeo (ruta + materiales + tercerizados).
- Motor de calculo tecnico y economico para cotizacion.
- Vista de detalle de costos por item (bloques y subtotales).
- Motor de abastecimiento inteligente para consumo de stock.

No incluye en V1:
- Optimizacion avanzada de imposicion por IA.
- Planificacion fina de produccion (scheduler completo).
- Integraciones externas (MIS/JDF/XJDF/contabilidad) en tiempo real.

## 3) Principios de diseno
1. Separar `unidad de cotizacion` de `unidad real de inventario`.
2. La logica de costeo debe depender de `familia/subfamilia`.
3. Todo calculo relevante debe quedar en `snapshot versionado`.
4. Multitenant: reglas de conversion y politicas por tenant.
5. Simular en presupuesto, ejecutar en orden confirmada.

## 4) Modelo funcional propuesto
## 4.1 Entidades principales
1. `FamiliaProducto`
- Codigo, nombre, activo.
- Define patron de costeo general.

2. `SubfamiliaProducto`
- Pertenece a familia.
- Define parametros/filtros y formulas especificas.

3. `ProductoServicio`
- Tipo: `producto` | `servicio`.
- Codigo, nombre, familia, subfamilia, estado.

4. `ProductoVersion`
- Version numerica + vigencia.
- Snapshot de configuracion de costeo.
- Estado: borrador/publicada.

5. `RutaProduccionVersion`
- Pasos ordenados (diseno, impresion, laminado, guillotina, etc.).
- Centro de costo, reglas de tiempo/productividad.

6. `MaterialesVersion`
- Insumos por paso.
- Reglas de consumo, unidad tecnica, merma.
- Regla de valorizacion (precio referencia / costo promedio / politica tenant).

7. `TercerizadosVersion`
- Servicio, proveedor sugerido, unidad, precio, regla de consumo.

8. `ReglaConversionFormatoTenant`
- Conversiones permitidas (ej: SRA3 -> A4).
- Rendimiento teorico, merma fija y/o porcentual.
- Restricciones por gramaje/acabado/material.

9. `CostoSnapshotItem`
- Resultado completo de calculo para presupuesto/orden.
- Persistencia de inputs, formulas aplicadas y valores finales.

## 4.2 Relaciones clave
- Producto -> muchas versiones.
- Version -> una ruta + muchos materiales + muchos tercerizados.
- Version -> una familia/subfamilia (hereda logica base).
- Tenant -> muchas reglas de conversion.
- Presupuesto/Orden -> muchos snapshots de costo por item.

## 5) Motor de costeo (arquitectura logica)
## 5.1 Pipeline
1. Resolver plantilla de costeo por familia/subfamilia.
2. Validar entradas obligatorias de cotizacion.
3. Calculo tecnico de imposicion/consumo.
4. Calculo de costo de procesos.
5. Calculo de costo de materiales.
6. Calculo de costo tercerizado.
7. Consolidacion de subtotales y total.
8. Generacion de detalle explicable por item.

## 5.2 Bloques de calculo
1. Procesos
- Costo paso = horas equivalentes * tarifa centro publicada.
- Soporta setup + run + cleanup + tiempos fijos.

2. Materia prima
- Costo MP = cantidad requerida * costo unitario seleccionado.
- Cantidad requerida puede venir de formulas por proceso.
- Debe incluir merma tecnica.

3. Tercerizados
- Costo tercerizado = cantidad * precio proveedor.

4. Total
- Total item = subtotal procesos + subtotal MP + subtotal tercerizados.

## 5.3 Politica de costo de material (configurable)
V1 recomendada:
- Cotizacion: usar `precioReferencia` por variante.
- Opcional por tenant: usar `costoPromedioStock` cuando exista.

## 6) Motor de abastecimiento inteligente (stock)
Objetivo: ejecutar consumo real aunque el formato de trabajo no exista como stock directo.

## 6.1 Reglas
1. Consumir primero formato exacto (si existe stock suficiente).
2. Si falta, convertir desde formato padre permitido por regla tenant.
3. Aplicar rendimiento y merma de conversion.
4. Si no alcanza, marcar faltante.

## 6.2 Registro en inventario
Se recomienda registrar conversion como movimientos trazables:
1. Egreso formato padre (ej: SRA3).
2. Ingreso interno formato hijo (ej: A4) en ubicacion tecnica.
3. Egreso formato hijo a produccion.

Ventaja: kardex auditable y costo coherente.

## 6.3 Ejemplo operativo
- Cotizacion usa hoja A4 tecnica.
- Stock real solo en SRA3.
- Sistema calcula cuantas SRA3 cortar para generar A4 requeridas.
- Ejecuta movimientos y descuenta stock de SRA3 correctamente.

## 7) UX propuesta (Detalle de Producto en Tabs)
1. `General`
- Tipo (producto/servicio), codigo, nombre, familia, subfamilia, estado.

2. `Especificacion`
- Tamano pieza, cantidades estandar, reglas de imposicion, acabados disponibles.

3. `Ruta de Produccion`
- Pasos, centro de costo, formula de tiempos, productividad.

4. `Materiales`
- Insumos por paso, cantidad/formula, unidad, merma, regla de costo.

5. `Conversion y Stock`
- Reglas de conversion, origen de consumo, simulacion de abastecimiento.

6. `Costos`
- Vista tipo tablero por bloques:
  - Procesos (filas + subtotal)
  - Materia prima (filas + subtotal)
  - Tercerizados (filas + subtotal)
  - Total item

7. `Precio y Margen`
- Precio sugerido, margen bruto, sensibilidad por cantidad.

8. `Versiones`
- Historial de versiones, comparacion y publicacion.

## 8) Flujo de negocio
## 8.1 Presupuesto (simulacion)
1. Seleccionar producto/servicio + version.
2. Cargar parametros (cantidad, acabados, contexto).
3. Ejecutar motor de costeo.
4. Guardar snapshot de cotizacion.

## 8.2 Orden confirmada (ejecucion)
1. Reusar snapshot aprobado o recalcular segun politica.
2. Ejecutar plan de abastecimiento.
3. Registrar movimientos de inventario.
4. Mantener trazabilidad entre orden y costo ejecutado.

## 9) Implementacion por fases
## Fase 0 - Definicion funcional (sin codigo)
- Cerrar reglas de familia inicial: `Imprenta digital hoja`.
- Definir parametros obligatorios y formulas.
- Definir conversiones base A4/A3/SRA3 por tenant.

## Fase 1 - Modelo y API base
- Entidades: familia/subfamilia/producto/version/ruta/material/tercerizado.
- CRUD y versionado.
- Contratos de snapshot.

## Fase 2 - Motor de costeo
- Implementar pipeline de calculo.
- Integrar tarifas de centros y precios de MP.
- Exponer endpoint de simulacion.

## Fase 3 - Motor de abastecimiento
- Reglas de conversion por tenant.
- Simulacion de consumo.
- Ejecucion con movimientos trazables.

## Fase 4 - UX completa por tabs
- Editor de producto/version.
- Vista de costos por bloque (como referencia visual acordada).
- Simulador de cotizacion por cantidad estandar.

## Fase 5 - Integracion comercial
- Uso en presupuesto y orden.
- Persistencia de snapshots por item.
- Reportes de margen/costo.

## 10) Caso piloto recomendado
Familia: `Imprenta digital hoja`
Producto piloto: `Tarjetas personales 9x5 cm`
Cantidades estandar: 100 / 200 / 500
Ruta:
1. Diseno grafico (opcional)
2. Impresion digital color
3. Laminado (opcional)
4. Guillotinado

Validar:
- calculo de piezas por hoja util,
- conversion stock SRA3 -> A4,
- detalle de costo por bloque,
- consumo real en inventario.

## 11) Criterios de aceptacion V1
1. Se puede crear producto/servicio con familia y version.
2. Se puede cotizar con desglose completo por item.
3. El total coincide con la suma de subtotales.
4. Se puede simular y ejecutar consumo inteligente de stock.
5. El consumo queda auditado en movimientos.
6. El sistema soporta tenants con reglas distintas de formatos.

## 12) Riesgos y mitigaciones
1. Riesgo: formulas demasiado libres.
- Mitigacion: plantillas por familia con validaciones obligatorias.

2. Riesgo: inconsistencia entre cotizacion y ejecucion.
- Mitigacion: snapshot versionado y politica de recalculo explicita.

3. Riesgo: conversiones no configuradas por tenant.
- Mitigacion: fallback controlado + warning bloqueante.

4. Riesgo: costo MP ambiguo.
- Mitigacion: politica de valorizacion definida por tenant.

## 13) Decisiones pendientes (para cerrar antes de Fase 1)
1. Politica default de costo MP: `precioReferencia` o `costoPromedio`.
2. Unidad base comercial por subfamilia (unidad/lote/hoja).
3. Politica de recalculo de snapshot al confirmar orden.
4. Catalogo inicial de servicios tercerizados por proveedor.
5. Reglas minimas de conversion por tenant para go-live.

## 14) Proximo paso sugerido
Cerrar Fase 0 con una matriz funcional concreta de `Imprenta digital hoja`:
- campos obligatorios,
- formulas exactas,
- reglas de merma,
- reglas de conversion,
- salidas esperadas del detalle de costo.

