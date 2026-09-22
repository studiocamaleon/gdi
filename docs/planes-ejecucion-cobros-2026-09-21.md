# Planes: ejecución, estaciones y cobros

Fecha: 21/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento incorporado

| Función | Nuevas operaciones | Continuidad |
| --- | --- | --- |
| P01 Tablero y tareas | La emisión fija `produccionControlada`. Sin tablero, la OT usa seguimiento manual y no genera pasos, incluso al abrir su ficha. | Las órdenes anteriores mantienen sus pasos, tiempos y permisos de ejecución. Los listados del tablero excluyen las órdenes emitidas en modo manual. |
| P02 Estaciones y calendarios | La API exige la función para altas, cambios y bajas de estaciones, feriados y configuración de producción. La interfaz combina función con permiso personal. | Se conservan recursos, calendarios y configuración para consultar y ejecutar trabajos existentes. P03 sigue controlando los cambios de equipos y personal. |
| F01 Cobros | Registrar anticipos independientes y configurar métodos de pago exige la función. Una nueva OT sin F01 no ofrece señas ni registro de cobros. | Una OT que habilitó cobros al emitir permite cancelar su saldo pendiente; no admite importes superiores ni anticipos nuevos por esta excepción. Se conservan consulta, acreditación, imputaciones y reversos de cobros existentes. |

### Condiciones de la orden

La migración `20260921230000_condiciones_operativas_ot` añade `produccionControlada` y `cobrosHabilitadosEmision` a `OrdenTrabajo`. Sus defaults preservan las órdenes históricas. Al crear se toman del contrato resuelto; al emitir un borrador se vuelven a resolver. No son parámetros de los DTO públicos.

La materialización de pasos requiere una orden con producción controlada, emitida y no cancelada. Abrir un borrador no genera tareas. La consulta de órdenes y de sus antecedentes se mantiene accesible.

Retirar P01 no detiene los trabajos que ya usaban el tablero. Una orden emitida en modo manual conserva ese modo: contratar el tablero después no cambia silenciosamente su circuito.

### Entrega manual

El mostrador distingue una orden sin seguimiento por tareas. Para entregarla requiere confirmar que los productos seleccionados están preparados, salvo que la OT ya estuviera marcada como finalizada. La API verifica la confirmación y la registra en el evento de entrega. Sin F01 se puede entregar sin crear un movimiento de dinero; el saldo no se transforma artificialmente en cero.

### Cobros pendientes

La continuidad exige una orden de la misma empresa, emitida, no cancelada y habilitada para cobrar en su emisión. No sustituye permisos personales ni acceso operativo de la empresa.

Antes de escribir un cobro sin F01, la transacción bloquea la fila de la orden y vuelve a comprobar su estado y saldo. El importe debe caber en ese saldo. Los reintentos con la misma clave devuelven el cobro existente. Contratar F01 permite nuevamente operar cobros sujetos a las validaciones comerciales habituales.

El recibo y las aplicaciones de un cobro se conservan aunque se retire la función. No se controla la totalidad de Administración con F01: facturación, tesorería, cuentas por cobrar y valores tienen sus propias capacidades.

## Verificación

- **91 pruebas de API en 11 suites**, incluyendo emisión, entrega de compuestos, permisos/concurrencia del tablero, estaciones, anticipos y tesorería.
- **24 pruebas de interfaz en cinco suites**: continuidad del formulario de cobro, entrega manual, ausencia de consultas de pago cuando F01 está excluida y regresiones de estaciones/tablero.
- Recorrido integrado en `gdi_saas_test`: emitir una OT habilitada; crear otra sin P01/F01; emitir un borrador con esas funciones ya retiradas; abrir las fichas sin materializar pasos; completar producción y cobrar la primera; rechazar sobrecobro y cobro sobre la segunda; entregar la segunda con confirmación manual conservando su saldo.
- TypeScript de API, web y pruebas focales. Migración aplicada a las bases locales de desarrollo y prueba, sin cambiar planes ni suscripciones.
- API y procesos de trabajo reiniciados con los cambios. API y Backoffice local responden HTTP 200.

## Lo que sigue

El catálogo marca P01/P02/F01 como **control parcial**, al igual que los bloques anteriores. No se publicaron propuestas ni se asignaron nuevas condiciones comerciales.

La próxima etapa debe definir y aplicar **versiones inmutables de planes**, con diagnóstico, asignación, auditoría y pruebas sobre una empresa de prueba. Antes de permitir retiradas reales, debe cerrar la política de cambios de alcance de órdenes abiertas: agregar trabajo, ampliar importes o reabrir operaciones no puede convertirse en una ampliación ilimitada de la continuidad. Los controles de este bloque definen el modo de emisión y el saldo pendiente actual; no reemplazan esa política de transición de contratos.
