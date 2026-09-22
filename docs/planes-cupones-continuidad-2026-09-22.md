# Cupones: cambio de plan, emisión e historial

Fecha: 22/09/2026. Función R02 (`cupones`). Forma parte del [cierre de planes](planes-estado-real-y-cierre-2026-09-21.md).

## Política operativa

| Situación | Comportamiento |
| --- | --- |
| Plan con Cupones y permisos suficientes | Crear, editar, validar y aplicar cupones. |
| Presupuesto con un uso reservado | No se puede retirar Cupones hasta convertir/completar sus compromisos o resolver el presupuesto y liberar el uso. |
| Presupuesto parcialmente convertido | Aunque la primera OT haya consumido el uso, el presupuesto aprobado conserva un compromiso pendiente. |
| OT abierta con cupón, incluido un borrador | Se pide completar su entrega, cancelar o revisar el descuento del borrador antes de retirar la función. |
| Función retirada, sin compromisos pendientes | Se conservan lista, reglas guardadas, usos y eventos. No se conceden nuevas aplicaciones ni cambios en los cupones. |
| Contratación pendiente que retiraría Cupones | Se detienen nuevas altas, ediciones, reservas y redenciones. Se permiten la consulta y el cierre de compromisos. |
| Cuenta vencida | Consulta disponible según los permisos personales; gestión denegada. |

La retirada no borra cupones, descuentos, importes de OT ni sus antecedentes. El menú presenta **Historial de cupones** y la pantalla explica el alcance de consulta. Los roles, permisos personales y aislamiento por empresa siguen aplicando.

## Correcciones técnicas

- Alta, edición, eliminación, reserva y redención revalidan el contrato dentro de su transacción, bajo el mismo lock de empresa que usan los cambios de plan. La creación y edición de líneas de OT también lo revalidan, incluidos los borradores. Las operaciones que generan compromisos también consultan las contrataciones pendientes.
- La liberación conserva su actualización condicional por estado: repetirla no devuelve dos usos. No requiere Cupones, porque cierra un compromiso y no crea otro.
- El diagnóstico compartido por asignación y contratación cuenta reservas de presupuestos, conversiones parciales y todas las OT abiertas que contienen descuentos por cupón. No depende únicamente de `CuponRedencion.ordenId`: una conversión parcial puede compartir esa redención entre varias OT.
- La API limita los controles de R02 a las operaciones de gestión y validación. El listado y el historial mantienen su permiso de CRM tras la retirada.
- La página de consulta no ofrece edición cuando la función está excluida, falta el permiso personal o la suscripción es de sólo lectura.

## Error adicional encontrado al emitir una OT

Al pasar una OT de borrador a emitida, el caller entregaba al método de redención una selección reducida de las líneas: identificadores y monto del descuento. El validador esperaba además tipo, valor, subtotal y referencias de cotización, y podía rechazar un cupón válido.

La redención ahora carga **todas las líneas persistidas de la OT** para validar el alcance y la distribución. También considera los usos anteriores de esa OT al comprobar el límite, para que un cupón no compita contra su propio uso. El subtotal se convierte explícitamente a número antes de sumarlo al descuento; los `Decimal` de Prisma no deben concatenarse como texto.

## Evidencia

La nueva suite `apps/api/src/cupones/__tests__/planes-cupones.integration.spec.ts` tiene once escenarios con PostgreSQL `gdi_saas_test`, versiones publicadas y servicios reales:

- Los tres contratos por HTTP: lectura, alta, validación y permisos.
- Reservar y liberar de forma idempotente; bloqueo de la asignación mientras existe la reserva; retirada efectiva después del cierre; conservación del historial y rechazo de nuevas escrituras.
- Conversión parcial con el uso ya consumido y OT abiertas que comparten usos.
- Contratación pendiente: altas, ediciones y reservas denegadas; eliminación de un cupón sin uso disponible.
- Cambio de contrato entre la validación inicial y la escritura: no queda el cupón ni un evento parcial. Los dos recorridos de OT también fuerzan esa retirada después de validar el cupón y comprueban que no se guarda otra orden, tanto en borrador como emitida.
- Cuenta vencida e intento de consultar el historial de otra empresa.
- Dos recorridos con el motor real y el producto de prueba: cotización con descuento → OT directa o borrador → emisión → repetición idempotente → cancelación. Se verifica un único uso consumido, su importe y su posterior liberación.

**Resultado:** 86 pruebas de API en ocho suites y 22 de interfaz en tres archivos aprobadas. TypeScript de API y web aprobados. Lint focal de Cupones, diagnóstico, catálogo y archivos web aprobado; `git diff --check` aprobado.

El lint completo del servicio de OT informa 40 errores y tres advertencias fuera de las líneas modificadas en este incremento. No se presenta ese archivo completo como libre de problemas de lint. El bloque de cupones modificado no tiene diagnósticos.

## Límites

- El recorrido comercial probado usa la capa de servicios real. Los tests HTTP usan una sesión de prueba; no sustituyen una prueba del login ni un recorrido de navegador de la empresa.
- Los escenarios de cambio entre validación y escritura son secuenciales con savepoints y rollback. No se presentan como una prueba de dos conexiones concurrentes; el cierre usa el lock compartido ya empleado por el contrato.
- Los borradores con cupones requieren revisión antes de retirar R02. No se convierten silenciosamente en descuentos manuales.
- R03 (Fidelización) tiene un circuito de puntos y reservas distinto y sigue pendiente de su propio cierre de continuidad. Este incremento no concede ni retira sus funciones.
- No se modificaron contratos de empresas operativas, ofertas de Paddle ni precios.
