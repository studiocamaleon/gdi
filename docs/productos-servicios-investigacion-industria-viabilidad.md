# Investigacion de Industria y Viabilidad
## Modulo Productos y Servicios (ERP Produccion Grafica)

Fecha: 2026-03-12

## 1) Objetivo de esta investigacion

Responder con evidencia:

1. Si el ERP esta lo suficientemente maduro para iniciar `Productos y servicios`.
2. Que dependencias previas deben completarse para evitar deuda funcional.
3. Como deberia modelarse funcional y tecnicamente este modulo para un ERP grafico profesional.

## 2) Referentes de industria relevados (fuentes oficiales)

### 2.1 PrintVis (MIS grafico)

Patrones clave observados:

1. El uso de `Item Type` es obligatorio y condiciona comportamiento funcional (sustrato, tinta, terminacion externa, producto terminado).
2. `Qualities` es un subtipo de Item Type y afecta calculo, transferencia de material, compra y velocidad.
3. La estimacion se compone de unidades de calculo ligadas a procesos, centros de costo y materiales.
4. Las `Speed Tables` modelan velocidad por reglas (calidad, gramaje, formato, cantidad, dificultad), no como una sola constante.

Implicacion para nuestro modulo:

- `Producto/Servicio` no puede ser solo un maestro comercial: debe orquestar proceso tecnico + materiales + reglas de costo.

### 2.2 Odoo (MRP estandar de referencia)

Patrones clave observados:

1. El BOM define componentes y tambien operaciones de manufactura.
2. Las operaciones se ejecutan en work centers con setup, cleanup, capacidad y costo/hora.
3. Las variantes de producto son de primer nivel y sus atributos afectan venta y operacion.

Implicacion:

- Para escalar, necesitamos estructura de `Producto base + variantes + BOM + routing` integrada al costo.

### 2.3 ERPNext (MRP estandar de referencia)

Patrones clave observados:

1. Item master unifica productos y servicios, distinguiendo stockeables vs no stockeables.
2. BOM con operaciones alimenta costo, Work Orders y Job Cards.
3. Las operaciones piden workstation, tiempo y tarifa horaria para costeo.

Implicacion:

- Conviene un catalogo unificado de productos/servicios con bandera de stock y con enlace directo a ruta de proceso.

### 2.4 CERM + Avanti (MIS especializados en impresion)

Patrones clave observados:

1. En conversion grafica real, el problema no es solo fabricar: es gestionar estimacion, orden, cambios, inventario de materia prima y terminado, y costo real por trabajo.
2. Se enfatiza integracion en tiempo real entre negocio y piso productivo (datos de maquina, estado de trabajo, costos, desperdicio).
3. CERM explicita complejidad de packaging flexible: multi-material, laminaciones, optimizacion de rollo y tracking de desperdicio.
4. Avanti explicita modulos integrados de estimacion, orden, inventory (raw + finished), job costing/tracking, scheduling, fulfillment y conectividad JDF.

Implicacion:

- Nuestro modulo debe diseñarse desde el inicio para convivir con ejecucion real y trazabilidad, aunque la primera version no cubra shop-floor completo.

### 2.5 CIP4 (estandar de integracion de industria grafica)

Patrones clave observados:

1. JDF/XJDF estan orientados a interoperabilidad MIS-dispositivos-procesos.
2. XJDF reduce complejidad del ticket completo y modela intercambio entre aplicaciones.
3. MIS ICS para XJDF formaliza coordinacion de piso y control MIS.

Implicacion:

- Debemos preservar identificadores y eventos de proceso/trabajo para integraciones futuras (aunque no implementemos JDF/XJDF ahora).

## 3) Diagnostico del ERP actual (repo)

Estado actual verificado en codigo y esquema:

1. Base multi-tenant y seguridad: presente.
2. Registros maestros operativos: clientes, proveedores, empleados: presentes.
3. Costos:
   - plantas/areas/centros,
   - componentes por periodo,
   - capacidad,
   - tarifa publicada por periodo.
4. Maquinaria:
   - maquinas por plantilla,
   - perfiles operativos,
   - consumibles y desgaste,
   - enlace a centro de costo.
5. Procesos:
   - rutas versionadas por tenant,
   - operaciones con setup/run/cleanup,
   - reglas formula/tabla de productividad y merma,
   - evaluacion de costo tecnico por periodo,
   - bandera `validaParaCotizar`.
6. Inventario:
   - maestro de materias primas y variantes (SKU, precio referencia, compatibilidades).
   - pero no hay aun stock por lote/ubicacion, movimientos ni kardex implementados en API real.

Lectura de madurez:

- Existe un "nucleo tecnico" fuerte para iniciar Productos/Servicios.
- La principal brecha previa no es procesos ni costos: es inventario transaccional (stock/lotes/movimientos).

## 4) Viabilidad de iniciar ahora el modulo

### Decision recomendada

Si, es viable iniciar `Productos y servicios` ahora, con estrategia por fases y con dos precondiciones de alcance:

1. Lanzar primero un `MVP de catalogo y configuracion tecnica/comercial`.
2. Planificar en paralelo el `inventario transaccional` para cerrar costo real y promesa de stock.

### Riesgos si se implementa sin esas precondiciones

1. Cotizaciones sin respaldo de disponibilidad o valorizacion real de stock.
2. Margen distorsionado por falta de costo real de consumo/lote.
3. Duplicacion de logica entre procesos y productos si no se define contrato de integracion unico.

## 5) Dependencias previas necesarias

### Bloqueantes para go-live productivo (no para empezar desarrollo)

1. Inventario transaccional:
   - almacenes/ubicaciones,
   - lotes,
   - movimientos,
   - reservas/compromisos,
   - kardex.
2. Regla de valorizacion definida por tenant (al menos FIFO o promedio).
3. Politica de versionado de lista de materiales y ruta por producto.

### Recomendadas para Fase inicial

1. Congelar contrato tecnico entre `Procesos -> Productos/Servicios` (input/output de evaluacion).
2. Definir estrategia fiscal/comercial minima:
   - moneda,
   - impuestos,
   - listas de precio,
   - margen objetivo.
3. Definir politica de SKU/codigo para producto terminado y servicio.

## 6) Propuesta funcional del modulo Productos y Servicios

### 6.1 Capacidades del MVP

1. Maestro unificado:
   - tipo: `producto` | `servicio` | `mixto`.
2. Producto base y variantes:
   - atributos comerciales/tecnicos,
   - SKU por variante.
3. Configuracion tecnica:
   - referencia a `ProcesoDefinicion` (routing principal),
   - contexto minimo de evaluacion (tirada + atributos).
4. Configuracion de materiales:
   - BOM de referencia por variante (con opcionales).
5. Configuracion comercial:
   - precio manual y/o precio calculado,
   - margen objetivo,
   - bandera vendible.

### 6.2 Datos minimos sugeridos

1. `ProductoServicio`
   - codigo, nombre, tipo, estado, unidad comercial, familia comercial.
2. `ProductoServicioVariante`
   - sku, atributos, activa, vendible.
3. `ProductoServicioReceta`
   - referencia versionada a `ProcesoDefinicion` + reglas de contexto.
4. `ProductoServicioBOM`
   - variante, materiaPrimaVariante, cantidad base, merma.
5. `ProductoServicioPrecio`
   - lista, moneda, formula/margen, vigencia.

### 6.3 Regla de costo tecnico recomendada

`costoTecnico = costoTiempoProcesos + costoMateriales (+ costoTercerizado)`

con snapshot por periodo para evitar drift historico.

## 7) Plan de implementacion recomendado

## Fase A (inmediata) - Analisis + Contratos

1. Definir contrato de integracion `Productos/Servicios <-> Procesos`.
2. Definir taxonomia comercial y tipos de producto/servicio.
3. Cerrar modelo de datos v1 y eventos de auditoria.

Salida: documento funcional + ADR de arquitectura.

## Fase B - MVP Catalogo (sin stock transaccional)

1. CRUD maestro producto/servicio + variantes.
2. Vinculacion a proceso y BOM de referencia.
3. Simulacion de costo tecnico por variante usando API actual de procesos.
4. Precio sugerido por margen.

Salida: modulo util para preventa/cotizacion tecnica interna.

## Fase C - Inventario transaccional

1. lotes/ubicaciones/movimientos/kardex.
2. reservas y compromiso por orden.
3. valorizacion de consumo real.

Salida: soporte real para promesa de entrega y margen real.

## Fase D - Comercial operativo

1. listas de precio avanzadas,
2. descuentos/bonificaciones,
3. impuestos,
4. versionado formal de receta/ruta.

Salida: modulo comercial-productivo completo.

## Fase E - Integraciones shop-floor

1. eventos de ejecucion,
2. captura de consumo real,
3. alineacion con estandares CIP4/JDF-XJDF (cuando aplique).

## 8) Conclusiones ejecutivas

1. El ERP SI tiene base madura para comenzar Productos/Servicios ahora.
2. La columna vertebral tecnica (costos + maquinaria + procesos) esta en buen estado para soportarlo.
3. La brecha principal para madurez de negocio completa es inventario transaccional (lotes/movimientos/kardex).
4. La estrategia correcta no es esperar a tener todo: es avanzar con MVP de catalogo/ingenieria comercial y encadenar inventario transaccional como siguiente bloque.
5. Si seguimos este orden, evitamos retrabajo y mantenemos coherencia de datos para un ERP profesional.

## 9) Fuentes externas consultadas

- PrintVis Item Type Code: https://learn.printvis.com/Pages/itemtypecode/
- PrintVis Speed Tables: https://learn.printvis.com/Legacy/Estimation/SpeedTable/
- PrintVis Creating an Estimate: https://learn.printvis.com/Legacy/Estimation/Estimate/
- PrintVis Item Qualities: https://learn.printvis.com/Legacy/General/ItemQualities-AS/
- Odoo Bill of Materials: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/basic_setup/bill_configuration.html
- Odoo Work Centers: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/advanced_configuration/using_work_centers.html
- Odoo Product Variants: https://www.odoo.com/documentation/19.0/applications/sales/sales/products_prices/products/variants.html
- ERPNext Item: https://docs.frappe.io/erpnext/item
- ERPNext Bill of Materials: https://docs.frappe.io/erpnext/bill-of-materials
- ERPNext Workstation: https://docs.frappe.io/erpnext/workstation
- CERM Flexible Packaging MIS: https://www.cerm.net/cerm-mis-for-flexible-packaging
- CERM x Durst integration: https://www.cerm.net/blog/durst-group-and-cerm-announce-seamless-integration-for-label-production
- CIP4 What is (X)JDF: https://www.cip4.org/print-automation/jdf
- CIP4 MIS ICS release 2.1: https://www.cip4.org/news-detail/MIS-for-XJDF-release-2.1
- Avanti Slingshot Core Modules (PDF): https://avantisystems.com/wp-content/uploads/2025/06/Avanti-ePS-Slingshot-CoreModules-June-2025.pdf-1.pdf
