# Precios especiales por cliente (T08)

## Comportamiento por contrato

Esencial permite cotizar con el precio general. Pro y Avanzado permiten configurar y aplicar precios especiales por cliente. El editor admite otras combinaciones respetando las dependencias de T08: Clientes y Productos (y Materiales, requerido por Productos).

Configurar T08 no requiere T07 (reglas generales de precio). El cotizador C01 conserva sus propias dependencias, incluida T07. En la ficha del producto y en el asistente de edición, el bloqueo del precio general ya no deshabilita la sección de precios especiales.

La gestión requiere además el permiso personal `costos.gestionar`. Consultar las reglas exige `costos.ver`. Cada regla pertenece a una empresa, un producto y un cliente; las escrituras validan esa pertenencia.

## Retirar y recuperar la función

- El diagnóstico identifica las reglas activas y exige revisar la continuidad de los precios antes del cambio. Su identidad y última modificación forman parte de la huella de aceptación.
- Retirar T08 conserva las reglas y su configuración para consulta. No permite crear, editar, activar, desactivar ni eliminar reglas. La interfaz explica que no se aplican por el plan vigente y permite consultar los importes, márgenes y tramos guardados.
- Las cotizaciones nuevas usan el precio general. Recotizar un borrador también vuelve a calcular con el contrato vigente y reemplaza su snapshot de precio especial.
- Los presupuestos y OT ya guardados conservan sus importes. Se pueden aprobar, convertir y emitir después de retirar T08 sin recalcular silenciosamente lo acordado. Un precio guardado no se pierde por eliminar una regla o cambiar de plan.
- Al volver a incluir T08, las reglas activas conservadas vuelven a estar disponibles. No se modifica su marca de activación durante el cambio de contrato.

## Escrituras y cambios en curso

Crear, modificar y eliminar una regla valida T08 dentro de la transacción y bajo el bloqueo de empresa compartido con cambios de plan. Un checkout que retira T08 detiene esas escrituras.

Cotizar puede demorar: si el resultado calculado incluye un precio especial, guardar o recotizar vuelve a exigir T08 dentro de su transacción y verifica la contratación pendiente. Si el contrato cambió durante el cálculo, no se guarda un precio fuera del plan. La cotización general sin excepción sigue disponible durante un checkout pendiente.

La búsqueda de una regla efectiva exige que la cuenta pueda operar y que el cliente esté activo. La consulta histórica se conserva para una cuenta vencida, según las restricciones generales de acceso; no habilita escrituras.

## Evidencia

`planes-precios-especiales.integration.spec.ts`: nueve casos con versiones publicadas y asignadas en `gdi_saas_test`:

1. Esencial, Pro y Avanzado: lectura/CRUD por HTTP, permisos y aplicación mediante el motor real (tres casos).
2. Cotización → OT borrador → retirada de T08 → emisión con el mismo importe; nueva cotización y recotización usan precio general.
3. Presupuesto enviado → retirada de T08 → aprobación → conversión a OT → emisión, conservando el precio acordado y su snapshot.
4. Checkout pendiente: bloquea CRUD y guardado/recotización con excepción; permite el precio general.
5. Retirada de contrato después de calcular y antes de guardar: escritura rechazada y cantidad de ítems sin cambios.
6. Aislamiento entre empresas y cuenta vencida.
7. Configuración con las dependencias mínimas de T08, sin T07 ni CRM avanzado.

`precios-especiales-planes.test.tsx`: cuatro pruebas de interacción con componentes reales y API simulada: consulta sin T08, gestión de T08 con T07 deshabilitado, permisos, error y reintento.

También pasaron cálculo de precios, motor completo, capacidades comerciales, asignación de versiones y contratación HTTP. TypeScript API/web y lint focal sin errores. No se hicieron cambios en precios ni contratos de empresas operativas.

## Límites

- El cambio de contrato durante el cálculo se fuerza con una fixture transaccional y savepoints. Esta suite no afirma cubrir todas las intercalaciones con conexiones PostgreSQL independientes.
- Las pruebas de interfaz no sustituyen una sesión visual autenticada de empresa. Esa verificación sigue dentro del cierre global.
- El historial preserva las reglas todavía existentes y los snapshots de cotizaciones. No agrega un registro de cada edición histórica de una regla eliminada.
- Este incremento no cambia el catálogo comercial mensual, no define anuales y no habilita Paddle en producción.

## Continuación del cierre

Revisar la matriz completa contra las evidencias acumuladas y convertir los pendientes genéricos en casos concretos de aceptación. No interpretar “Control parcial” del catálogo como ausencia de implementación ni como prueba de cierre. La validación visual, las condiciones anuales y la configuración de producción siguen pendientes en el documento general.
