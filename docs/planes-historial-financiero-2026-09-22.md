# Planes: historial financiero al retirar funciones

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento

Retirar una función del contrato no elimina los registros ni obliga a contratarla otra vez para consultarlos. La API mantiene los permisos administrativos y el aislamiento por empresa. Las operaciones nuevas y las modificaciones siguen sujetas al contrato vigente y a los controles transaccionales.

| Función retirada | Consulta conservada | Gestión restringida |
| --- | --- | --- |
| Tesorería | Cuentas, saldos registrados y extractos, con filtros y exportación CSV | Transferencias, ajustes, arqueos y conciliación |
| Valores | Cheques propios/de terceros, estados y eventos, incluidos los cerrados | Depósito, acreditación de cheques, reversión, rechazo, endoso y débito |
| Egresos y cuentas por pagar | Egresos, categorías, saldos por proveedor y pagos registrados | Altas, edición, anulación, pagos y cambios de categorías |
| Gastos recurrentes | Plantillas anteriores, incluso inactivas | Alta, edición, activación y generación |

La orden de pago PDF puede consultarse sin CxP, pero exige **Documentos PDF**: se genera al solicitarla y no es un archivo ya materializado. Los reportes financieros y el comparativo presupuestado/real siguen exigiendo sus funciones.

En la navegación, las entradas sin gestión se presentan como historiales. Las pantallas no ofrecen altas, pagos ni acciones retiradas; tampoco abren un alta o endoso por parámetros viejos en una URL. El tab de recurrentes conserva la consulta aunque no se contrate su automatización. Los adjuntos de un egreso quedan en consulta cuando no hay gestión.

## Separación de consultas y operaciones

- Consultar Tesorería o pendientes de acreditación ya no acredita cobros ni mueve fondos. El barrido nocturno existente y la acción explícita conservan esa tarea.
- La acreditación de un **cobro electrónico anterior** pertenece a la continuidad de cobros y sigue disponible con permiso administrativo y empresa operativa, sin exigir Tesorería. No concede operaciones sobre cheques.
- Crear/editar cuentas básicas conserva su política previa de identidad/cobros; este incremento no convierte todo registro de cuentas en una función exclusiva de Tesorería. La vista histórica de Tesorería ofrece consulta.
- La inicialización heredada de categorías sólo se ejecuta para un catálogo vacío con CxP operativa, revalidada bajo el lock del contrato. Leer con la función retirada o la suscripción inactiva no siembra categorías. Un cambio de plan entre comprobación inicial y transacción tampoco las crea.
- Crear, editar y borrar categorías ahora revalida CxP en la transacción escritora. El resto del circuito conserva el protocolo de continuidad ya implementado.
- En Valores, endoso y operaciones de cheques propios requieren también CxP; no se ofrecen cuando sólo se contratan Valores/Tesorería.

## Evidencia

Sobre `gdi_saas_test`, con rollback de los escenarios. Sin cobros, mensajes o cambios de plan en empresas operativas.

- `finanzas-historial.integration.spec.ts`: **5 casos**. Asignación real Pro → Esencial, consultas por HTTP con servicios reales, permiso denegado, aislamiento entre empresas, denegación de mutaciones, consulta sin movimientos automáticos, ejecución independiente del barrido y revalidación de la inicialización de categorías. Las dependencias no usadas de Administración y el renderizador PDF están simuladas; se comprueba el acceso/contrato del PDF, no su diseño.
- Regresión: **126 casos adicionales** de continuidad financiera, egresos, recurrentes, orden de pago PDF, tesorería y funciones opcionales; **131 pruebas API únicas** en este incremento. La corrida conjunta detectó cuatro stubs antiguos de avisos sin transacción/contexto de dispositivo; se actualizaron y los 22 casos de esa suite pasaron en la corrida focal posterior.
- **21 pruebas web** en cuatro suites: historial de Egresos/CxP, rutas directas, navegación, Tesorería y Valores, acciones por capacidad/permiso y combinaciones sin CxP. Incluyen el cierre de cobros electrónicos independiente de Tesorería.
- TypeScript API de producción, tipos de escenarios y web; lint focal; `git diff --check`.
- Navegador autenticado: Tesorería y extracto cargados en Founder. Chrome dejó de responder al revisar Valores; su comprobación de navegador no se declara completada. Valores sí se verificó por HTTP e interfaz automatizada.

Los escenarios con savepoints comprueban reglas y persistencia, no carreras entre conexiones. No se cambiaron los protocolos de concurrencia financiera ya probados en el incremento anterior.

## Límites y siguientes pasos

Este cierre cubre F03–F06. No retira los controles de Cuenta corriente, Gastos fijos o Reportes ni declara que todas las combinaciones del editor están verificadas. Siguen pendientes el recorrido CAD, otros cruces permitidos, recuperación administrativa de contrataciones inciertas y configuración/verificación de la pasarela en producción. No se infieren precios anuales.

Antecedentes: [continuidad financiera](planes-continuidad-finanzas-proyectos-2026-09-22.md), [avisos](planes-continuidad-avisos-2026-09-22.md), [cierre comercial](planes-cierre-comercial-2026-09-21.md).
