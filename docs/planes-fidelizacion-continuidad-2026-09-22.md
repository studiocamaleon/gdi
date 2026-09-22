# Fidelización (R03): contrato, puntos y continuidad

## Comportamiento

- Esencial conserva consulta de saldos, configuración e historial. Pro y Avanzado permiten gestionar Fidelización si el usuario tiene los permisos correspondientes y la cuenta puede operar.
- Retirar R03 no borra puntos ni movimientos. La navegación muestra **Historial de puntos**, también en la ficha del cliente. No ofrece configuración ni ajustes nuevos sin R03.
- El diagnóstico previo a la asignación interna y a la contratación identifica reservas de canje, presupuestos abiertos con puntos y OT con canjes abiertos o ganancias aún sin acreditar. Esos compromisos requieren conversión, entrega/cobro o cancelación antes de retirar R03. Incluye borradores y entregas con cobro pendiente.
- Los saldos ya acumulados requieren revisar y aceptar su continuidad: quedan consultables, pero no se canjean ni ajustan sin R03. Si se vuelve a incluir, se conserva la configuración anterior.
- Una ganancia histórica puede revertirse al corregir entrega/pago y restaurarse si vuelve a cumplir las condiciones, aun sin R03. Es continuidad de una acreditación existente; una OT sin ganancia previa no inicia puntos después de retirar la función. El reverso de un canje previo también se conserva.
- Cotizar sin R03 sigue funcionando, con cero puntos nuevos. Simular no crea configuración ni cuentas, comprueba que el cliente pertenezca a la empresa y no promete puntos si falta un cliente.

## Escrituras y reservas

Configuración, ajustes, reservas y consumo validan el contrato dentro de la transacción y bajo el bloqueo de empresa utilizado por los cambios de plan. Un checkout pendiente que retira R03 impide nuevos compromisos. Las OT y presupuestos también revalidan los puntos antes de guardar/emitir, aunque la simulación se haya hecho con un contrato anterior.

Las transferencias desde presupuestos, consumos y liberaciones bloquean primero la cuenta de puntos. Después del bloqueo se relee la reserva: otra transacción puede haberla dividido o transferido. Las liberaciones sólo descuentan si la reserva sigue vigente. Cancelar el remanente de un presupuesto no libera reservas ya asignadas a una OT.

La acreditación vuelve a consultar la última ganancia después de bloquear la cuenta. La creación inicial de cuentas tolera concurrencia y la clave de idempotencia de una restauración referencia su ganancia anterior; no se repite al realizar varias correcciones sucesivas.

## Evidencia

En `gdi_saas_test`, sin modificar datos operativos:

- `planes-fidelizacion.integration.spec.ts`: 13 casos con versiones publicadas y asignación real, API Nest, permisos, suscripción vencida, checkout pendiente, aislamiento entre empresas, consulta histórica, canje/reverso, ganancia/reverso/restauraciones, conversión parcial y motor real → OT borrador → emisión → cancelación. Incluye retirada del contrato entre simulación y guardado y un plan mínimo con R03 + Clientes + base.
- `fidelizacion-concurrencia.integration.spec.ts`: 4 casos con transacciones PostgreSQL independientes. Dos liberaciones que leyeron la misma reserva; dos acreditaciones simultáneas; transferencia parcial o completa mientras la cancelación espera después de leer.
- También pasaron las pruebas de cálculo de puntos, capacidades/recorridos, cupones, presupuestos, resolución pública, asignación de planes y contratación HTTP que cubren las superficies compartidas modificadas.
- Web: 21 pruebas entre la página de Fidelización, navegación por capacidades y permisos.
- TypeScript API (`tsconfig.build.json`) y web sin errores. Lint focal sin errores y `git diff --check` limpio.

## Límites y continuación

- La prueba de retirada entre simulación y escritura fuerza ese orden dentro de la fixture transaccional. Los casos de reservas/acreditaciones sí usan conexiones independientes; no se afirma cobertura de todas las intercalaciones posibles de cambio de contrato.
- Los recorridos de puntos usan servicios/API y base de pruebas. No se realizó una nueva sesión visual autenticada de empresa; la sesión del navegador disponible corresponde a Plataforma.
- La vista conserva los límites de consulta existentes (100 movimientos por cliente y 20 recientes en resumen). Este incremento no incorpora exportación ni paginación del libro completo.
- No habilita ventas anuales ni producción en Paddle. Esas definiciones y las transiciones pendientes de otras funciones siguen en el documento general.
- Próximo bloque de continuidad: aprobación de arte y revisiones (C08).
