# Investigacion y Plan
## Modulo Inventario / Centro de Stock (ERP Produccion Grafica)

Fecha: 2026-03-12

## 1) Objetivo

Definir un camino realista para implementar inventario en nuestro ERP, con foco en:

1. valor operativo real,
2. trazabilidad profesional,
3. complejidad controlada.

## 2) Hallazgos de industria (referentes)

## 2.1 PrintVis (MIS grafico)

Patrones relevantes para inventario en imprenta:

1. `Material Requirements` como lista operativa de lo que cada trabajo necesita.
2. `Item Reservations` para comprometer stock por trabajo antes del consumo.
3. consumo de materiales conectado al job costing y a item ledger entries.
4. compras vinculadas a requerimientos de material y ubicaciones.

Lectura:

- En gráfica, inventario no es solo “existencia”: se integra con estimación, reservas y consumo real por trabajo.

## 2.2 Avanti Slingshot (Print MIS)

Patrones relevantes:

1. inventario de `raw + finished goods` en tiempo real.
2. puntos de reorden, niveles óptimos y EOQ.
3. tracking de movimientos completo (commits, receipts, adjustments, moves, issues).
4. opciones de costeo (último costo, promedio, FIFO).
5. módulo específico para rollos (FIFO por fecha de recepción, detalle por rollo, ubicación, barcode).

Lectura:

- Para industria gráfica, rollos/hojas y trazabilidad de movimientos son críticos.

## 2.3 CERM (MIS labels/packaging)

Patrones relevantes:

1. material stock management explícito como parte del core.
2. fuerte integración EDI con proveedores para PO/ASN e ingreso a stock.
3. foco en trazabilidad completa y manejo de complejidad sheetfed/roll-based.

Lectura:

- En empaques/etiquetas, inventario está muy conectado con proveedor, recepción y trazabilidad por material.

## 2.4 ERP general (Odoo / ERPNext)

Patrones estables y probados:

1. `warehouse + locations` como base.
2. lotes/series para trazabilidad.
3. stock entry por propósito: receipt, issue, transfer, adjustment, manufacturing.
4. estrategias de salida FIFO/FEFO/ubicación cercana.

Lectura:

- Un ledger de movimientos + saldos por ubicación/lote resuelve el 80% del valor con complejidad razonable.

## 3) Estado actual del ERP (diagnóstico interno)

Hoy tenemos:

1. `MateriaPrima`, `MateriaPrimaVariante` y compatibilidades con maquinaria/procesos.
2. precio referencia por variante.
3. API CRUD de materias primas.

Hoy NO tenemos implementado en API/DB productiva:

1. almacenes ni ubicaciones,
2. lotes,
3. movimientos,
4. kardex,
5. reservas,
6. valorización de stock real.

Conclusión:

- El catálogo técnico de materia prima está bien encaminado.
- Falta el núcleo transaccional de inventario (centro de stock).

## 4) Propuesta para nuestro ERP: profesional y simple

## 4.1 Principios de diseño

1. Primero trazabilidad y consistencia; después optimización avanzada.
2. Ledger inmutable de movimientos (fuente de verdad).
3. Saldos materializados para performance.
4. Soporte de lotes opcional por material, no obligatorio para todo.
5. Integración gradual con procesos/costos (sin bloquear al equipo).

## 4.2 Alcance MVP recomendado (sin sobreingeniería)

1. Maestro de almacenes.
2. Ubicaciones por almacén.
3. Lotes opcionales por variante (según flag del material).
4. Movimientos de stock:
   - ingreso,
   - egreso,
   - ajuste,
   - transferencia.
5. Saldo actual por variante + ubicación + lote.
6. Kardex por variante (historial de movimientos).
7. Regla de valorización inicial: `promedio ponderado`.

Lo que dejamos fuera del MVP:

1. wave picking,
2. reglas avanzadas de putaway,
3. FEFO/FIFO automáticos complejos por estrategia multinivel,
4. WMS con scanning masivo,
5. MRP automático.

## 4.3 Modelo de datos mínimo sugerido

1. `Almacen` (tenant, codigo, nombre, activo).
2. `AlmacenUbicacion` (almacen, codigo, nombre, activo).
3. `LoteMateriaPrimaVariante` (variante, lote, vencimiento opcional, costo unitario opcional, ubicacion opcional).
4. `StockMateriaPrimaVariante` (variante + ubicacion + lote, cantidadDisponible, cantidadReservada).
5. `MovimientoMateriaPrima` (tipo, signo, cantidad, costo, referencia, usuario, timestamp).

Nota:

- Este modelo ya está pre-diseñado en `docs/materia-prima-prisma-y-arquitectura.md`; podemos usarlo como base y recortar lo no esencial para la primera entrega.

## 4.4 Reglas de negocio MVP

1. No permitir stock negativo por defecto.
2. Si la materia prima exige lote, no permitir movimiento sin lote.
3. Transferencia = salida + entrada atómicas.
4. Cada movimiento debe tener `referenciaTipo/referenciaId` para auditoría.
5. Kardex inmutable (sin editar movimientos históricos; solo contramovimientos).

## 4.5 Estrategia para gráfica (rollos, hojas, tintas)

1. FIFO simple por fecha de ingreso para consumo sugerido.
2. FEFO opcional solo en subfamilias con vencimiento (tintas/químicos).
3. Unidad canónica ya existente se mantiene para validar conversiones compatibles.
4. Rollos/hojas se manejan como variantes + lote (sin modelo especial de “roll object” en V1).

## 5) Integración con módulos actuales

1. `Procesos`:
   - hoy sigue evaluando costo técnico con precios de referencia;
   - luego podrá leer costo valorizado real por variante/lote.
2. `Costos`:
   - podrá consumir snapshots de costo material real por período.
3. `Productos y servicios` (futuro):
   - usará disponibilidad/reservas para promesa de entrega y margen real.

## 6) Plan de implementación recomendado

## Fase 0 - Definición funcional (rápida)

1. Confirmar tipos de movimiento V1.
2. Definir política de lote por subfamilia (obligatorio/opcional).
3. Definir política de stock negativo (recomendado: bloqueado).

## Fase 1 - Núcleo de stock

1. Migraciones Prisma para almacén, ubicación, lote, stock, movimiento.
2. Servicio transaccional de movimientos con validaciones.
3. Endpoints:
   - `POST /inventario/movimientos`
   - `GET /inventario/stock`
   - `GET /inventario/movimientos` (kardex)

## Fase 2 - UX operativa

1. Nuevo menú `Inventario > Centro de stock`.
2. Vistas:
   - stock actual,
   - ingreso/egreso/ajuste,
   - transferencias,
   - kardex.
3. Integración en ficha de materia prima (tab inventario real).

## Fase 3 - Profesionalización gradual

1. reservas simples por referencia de trabajo,
2. reposición básica por mínimo/máximo,
3. FEFO opcional en subfamilias con vencimiento.

## 7) Decisión recomendada

Sí, es una muy buena decisión priorizar inventario/centro de stock antes de productos y servicios.

Motivo:

1. reduce retrabajo,
2. mejora calidad de costo y disponibilidad,
3. deja a productos/servicios con base realmente operable.

## 8) Fuentes consultadas

- PrintVis Purchase Guide: https://learn.printvis.com/Pages/pvspurchaseguide/
- PrintVis Item Reservations: https://learn.printvis.com/Legacy/Purchasing/ItemRes/
- PrintVis Material Requirements: https://learn.printvis.com/Legacy/Warehouse/MaterialRequirements/
- PrintVis Job Costing: https://learn.printvis.com/Legacy/JobCosting/JobCosting/
- Avanti Slingshot Core Modules (PDF): https://avantisystems.com/wp-content/uploads/2025/06/Avanti-ePS-Slingshot-CoreModules-June-2025.pdf-1.pdf
- CERM pricing/modules (Material Stock Management): https://www.cerm.net/pricing
- CERM PO automation + ASN to stock (example): https://www.cerm.net/partner-integrations/herma-po-automation
- CERM sheetfed labels traceability context: https://www.cerm.net/cerm-mis-for-sheetfed-labels
- Odoo inventory management (warehouses/locations): https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management.html
- Odoo removal strategies (FIFO/FEFO/etc): https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies.html
- ERPNext Batch: https://docs.frappe.io/erpnext/user/manual/en/batch
- ERPNext Stock Entry: https://docs.frappe.io/erpnext/user/manual/en/stock-entry
