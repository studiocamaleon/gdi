# Cobros, entregas y acreditación por liquidación

Publicado en producción el 15/10/2026 mediante el [PR integrador #102](https://github.com/studiocamaleon/gdi/pull/102), después de la aceptación de staging. Web `fc6277ff7`, API/ambos workers `9d2cf372a`, incluyendo la protección contra avisos duplicados. Ver [registro de producción](../deploy/produccion/VALIDACION.md) y [pruebas de staging](../deploy/staging/VALIDACION.md).

## Problemas corregidos

- La entrega y el escaneo exigían permisos de Producción aun cuando el vendedor podía gestionar órdenes comerciales. Gestionar órdenes ahora permite entregar; consultar órdenes permite escanear. Revertir una entrega sigue exigiendo gestionar Producción.
- Cobrar desde la entrega vuelve a validar el permiso de cobro en el servidor. Poder entregar no habilita registrar dinero. La API conserva los controles de saldo de la OT, empresa, caja asignada y reintentos.
- La entrega rápida usaba el destino predeterminado del medio aunque no estuviera entre las cuentas autorizadas del vendedor. Ahora usa ese destino sólo si está disponible y tiene la moneda de la empresa; en otro caso elige una cuenta compatible autorizada. La fecha del cobro corresponde a la zona horaria de la empresa.
- Si falla la carga de medios o cuentas, se muestra ese error en lugar de afirmar que no hay medios configurados.
- Sentry registró una entrega con `P2028` el 13/10/2026 al actualizar fidelización (incidencia API-D). Se amplía el límite de esa transacción de 5 a 20 segundos. Si igualmente vence después de registrar un cobro, el mensaje aclara que el pago quedó registrado y que debe revisarse antes de reintentar sólo la entrega.

No se pudo vincular un evento a la persona reportada porque no había OT ni horario. Los rechazos de permisos 403 no se envían a Sentry según la política vigente; su ausencia allí no descarta el problema. No se modificaron permisos de personas ni datos financieros reales.

## Acreditación de varios cobros

En Administración → Tesorería → Cobros por acreditar se pueden seleccionar hasta 50 cobros electrónicos. «Acreditar seleccionados» abre una revisión con una fecha real y un nombre/referencia de LIQ compartidos. Muestra las comisiones, IVA, retenciones y neto de cada cobro, y el total separado por moneda. Antes de confirmar hay que marcar que los importes coinciden con la liquidación recibida. Si alguno difiere, se ajusta mediante la acreditación individual.

El servidor exige los mismos permisos y el mismo alcance completo de cuentas que la acreditación individual. Valida todos los cobros dentro de una transacción: si uno es ajeno, está anulado, es un cheque, no tiene una cuenta válida o sus descuentos consumen el importe, se revierte el lote entero. Los cheques mantienen su circuito de cartera de valores.

Un reintento de la misma liquidación no duplica movimientos. Si un cobro ya fue acreditado con otra fecha o referencia, devuelve un conflicto y pide actualizar la lista. La interfaz también bloquea el doble clic mientras se procesa la solicitud. No requiere migración de base de datos.

## Comprobaciones

- Regresión de permisos: las tres pruebas nuevas fallaban con la implementación anterior; ahora el vendedor puede entregar, el lector no puede modificar y un operador sin permiso de cobro no puede cargar pagos desde la entrega.
- Base exclusiva de tests: vendedor con caja asignada, cobro y entrega real con confirmación demorada más de cinco segundos; pruebas de saldo completo y control de estado.
- Base exclusiva de tests y HTTP con autenticación: lote válido, reintentos concurrentes, una sola entrada por cobro, reversión completa ante una línea inválida, otra empresa, falta de permisos, cajas restringidas e IDs duplicados.
- Interfaz: selección, referencia compartida, preservación de comisiones, error y reintento, bloqueo de doble clic y ausencia de acciones sin permisos. Se conserva el circuito Emitir y entregar.
- Navegador Chrome local: se abrió la vista real con cobros ficticios, se seleccionaron dos y se verificó el resumen con total $29.637 y una LIQ común; sin errores de consola. La escritura financiera se comprobó con la API y PostgreSQL de tests, no mediante la muestra visual.

Las pruebas locales no ejecutan envíos ni cobros externos. La muestra temporal usada para comprobar la interfaz no se incluye en la aplicación publicada.

En staging, Chrome comprobó el cobro y entrega de una OT ficticia de $12.000 por un vendedor y la acreditación conjunta de dos cobros de $10.000/$20.000 con una LIQ común: $29.637 netos. PostgreSQL y HTTP confirmaron saldo cero, un movimiento por cobro, rechazo del pago extra y del cambio de LIQ. Tres recibos PDF generados y sin errores de consola en los recorridos. Las cuentas ficticias quedaron desactivadas y su auditoría se conserva en una empresa separada. Ese ensayo no modificó producción.

En producción se comprobó la carga del listado y de una OT entregada/saldada: un cobro, saldo cero y bloqueo de cobro adicional. Tesorería permitió seleccionar dos cobros y revisar la fecha, referencia común de LIQ, comisiones, retenciones y neto; se canceló la revisión y se limpió la selección. Sin errores ni advertencias de consola. No se acreditaron cobros ni se entregaron órdenes reales como prueba. Los recorridos de escritura y rol vendedor se comprobaron en staging y en PostgreSQL/HTTP de tests.
