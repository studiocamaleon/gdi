# Planes: stock, equipos, cuentas por cobrar y etiquetas

## Alcance implementado

Se conectaron I06, S01, P03 y F02 al evaluador vigente. El editor sigue guardando propuestas: este cambio no publica versiones ni modifica las suscripciones de empresas reales.

| Función | Al excluirla | Lo que sigue disponible |
| --- | --- | --- |
| Etiquetas descargables (I06) | Impide generar el PDF, incluso si la vista previa ya estaba cargada. | La impresión directa usa su propia capacidad I04. Los QR internos ya impresos siguen identificando la OT para entrega. |
| Existencias (S01) | Impide crear o editar depósitos y ubicaciones, movimientos y transferencias manuales. | Materiales y costos para cotizar, lectura del stock e historial. No altera los saldos existentes. |
| Equipos productivos (P03) | Impide altas/ediciones de equipos y nuevas asignaciones de personas u horarios desde estaciones. | Estaciones básicas y lectura de los equipos actuales. Editar datos operativos conserva la configuración histórica. |
| Cuentas por cobrar (F02) | Impide consultar el extracto consolidado y deudores, incluyendo acceso directo a sus páginas. | Cobros de OT, pagos de clientes, imputaciones y entrega. No presenta un saldo cero ficticio cuando no consulta el extracto. |

## Etiquetas: tres capacidades diferentes

- I06 permite descargar etiquetas como PDF de 100 × 150 mm. La API valida la empresa y el plan antes de renderizar. No exige certificado, QZ, impresora configurada ni C04 (PDF comerciales).
- I04 permite enviar etiquetas a la impresora conectada. Puede usar la vista previa sin habilitar el botón de descarga manual.
- I05 controla las colas de documentos; no se exige para una etiqueta directa.
- C06 controla el seguimiento público. El QR de la etiqueta identifica internamente la orden; no necesita crear un enlace público.

## Reservas y operaciones existentes

La política y las nuevas reservas requieren S01 y S02. Al emitir una OT con cualquiera de ellas excluida no se crean necesidades ni reservas automáticamente.

Una OT ya incorporada al control puede consumir lo que tiene efectivamente reservado o liberarlo, con las validaciones existentes de usuario, empresa, suscripción, estado, revisión y política. Sin estos módulos no puede aumentar su reserva, incorporar otra OT mediante una liberación ficticia ni generar nuevas necesidades como efecto lateral. Las modificaciones de una OT controlada que requieren recalcular sus necesidades siguen bloqueadas hasta resolver la continuidad.

`registrarMovimientoTx` permanece como operación interna para consumos y recepciones autorizadas. La entrada pública de movimientos exige S01 independientemente del origen enviado por el cliente; escribir `compra` o `consumo_produccion` no evita el control.

Las recepciones conservan sus controles actuales de compras/recepciones. **Falta definir y aplicar la política de cambio de contrato para compras abiertas.** Una compra emitida no demuestra por sí sola que se contrató recepción: antes de permitir una baja deben resolverse esos compromisos o bloquearse la transición con un diagnóstico explícito.

## Límites del bloque

- El contrato todavía procede de la compatibilidad con `plan.featuresJson`. Los contratos individuales excluidos se simulan en las pruebas; no se han aplicado a una empresa real.
- P03 aún debe cerrarse junto a empleados, estaciones y tablero. No se trata el legajo de una persona como una licencia de usuario.
- F02 cubre extracto/deudores. Falta cerrar F01 y las reglas de clientes/crédito antes de certificar el recorrido financiero completo.
- Se mantienen como **control parcial** en el catálogo. La publicación, asignación, concurrencia de cambios y reversión de contratos siguen pendientes.

## Verificación

- 107 pruebas de API en once suites: barreras de escritura, etiquetas reales, aislamiento de stock, reservas, equipos, anticipos, borradores y diagnóstico de planes, y recorrido completo cotización → emisión → producción → cobro → entrega.
- 25 pruebas de interfaz en cinco suites: etiqueta manual sin QZ, ausencia de acciones excluidas, pago sin extracto, cuenta corriente, navegación y estaciones.
- TypeScript de API, interfaz y pruebas focales. Lint de interfaz sin errores; el lint de API conserva observaciones previas fuera de las líneas modificadas.
- PostgreSQL dedicado `gdi_saas_test`, sin cambios comerciales en desarrollo ni envíos a impresoras.

## Próximo bloque

Revisar el catálogo que alimenta la cotización (materiales, productos, procesos, maquinaria, tarifas) y los maestros de clientes/empleados. Hay que separar **configurar datos nuevos** de **usar datos guardados en operaciones existentes**. Después se completa tablero/estaciones y cobro básico, y recién entonces la publicación y asignación de versiones reales de planes.
