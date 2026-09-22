# Recuperación de contrataciones desde Plataforma

Actualizado: 22/09/2026. Rama `codex/rediseno-backoffice-plataforma`.

## Interfaz y operación

En **Plataforma → Suscripciones → ficha de empresa → Contrataciones** se listan los intentos con plan, ciclo, adicionales, estado, fecha y referencia. La consulta inicial sólo lee Grafo, con paginación de 15 registros. Incluye empresas todavía bajo contrato manual cuyo primer checkout quedó sin confirmar.

**Revisar** abre el estado y el historial de consultas. Soporte conserva lectura. Administración con sesión personal y MFA puede consultar Paddle indicando un motivo. Si un checkout perdió su referencia, admite ingresar el `txn_…` obtenido en Paddle; la búsqueda automática sigue disponible al dejarlo vacío.

Se usan la tabla, campos, botones y diálogo compartidos de Grafo. El formulario tiene cuerpo desplazable y pie separado. El historial se pagina y un error de carga permite reintentar. Una respuesta perdida conserva el identificador y los datos de la consulta; una nueva lectura explícita usa otro identificador.

## Qué se verifica

La consulta de la empresa y la recuperación de Plataforma comparten `ConsultaContratacionService`:

1. Autorización y empresa del intento; entorno de la oferta y referencia ya vinculada.
2. Lectura de la transacción concreta, incluso después de encontrarla mediante listado. Se comprueban su identificador y los metadatos de empresa e intento.
3. Precios y cantidades de todos los ítems contra la oferta y el ciclo aceptados. No se vincula una transacción modificada con otras condiciones.
4. Para aplicar un checkout, la suscripción debe corresponder a la transacción, empresa e intento, estar activa/en prueba y resolver exactamente la oferta y adicionales. Para un cambio existente, se comprueba su referencia de suscripción y cualquier empresa informada por Paddle.
5. Antes de guardar, se revalida la autorización, se toman los locks compartidos de Paddle/empresa y se vuelve a leer el intento. Un webhook que ya lo terminó tiene prioridad. La sincronización conserva sus controles de versión, pertenencia y estado remoto.

La recuperación hace exclusivamente lecturas a Paddle: no crea checkout, no cambia ítems ni cancela remotamente. Una transacción `draft`/`ready` permite retomar el mismo pago. Una transacción cobrada/procesándose sin suscripción confirmada sigue en verificación; no se ofrece como un checkout nuevo. Sólo una cancelación comprobada cierra el intento como rechazado.

## Auditoría y fallos

- Se registra la consulta solicitada antes de salir a Paddle, con actor, motivo, empresa, intento y referencia opcional.
- El resultado y cualquier cambio del intento se guardan junto con el evento final de auditoría. No se guardan respuestas completas del proveedor ni datos de tarjeta.
- Repetir el mismo identificador devuelve el resultado registrado, sin otra consulta externa; reutilizarlo con otro actor, intento o datos se rechaza.
- Si se revoca el acceso durante la consulta, no se aplica el resultado. Puede quedar sólo el evento de inicio, que permite detectar una consulta sin cierre.
- El límite de espera de lectura es 15 segundos. Una respuesta tardía no dispara por sí sola la aplicación; otra consulta puede recuperar el estado actual.
- Una búsqueda sin coincidencias, un error de red o condiciones incompatibles conserva el intento pendiente y el bloqueo de nuevos cobros. No se interpreta ausencia como rechazo.

## Evidencia

Base exclusiva `gdi_saas_test`, transportes Paddle simulados, sin cobros externos nuevos:

- **35 pruebas de contratación**, incluidas 14 nuevas de recuperación: pago sin webhook, checkout por referencia, cancelación remota, metadatos ajenos, precios/cantidades alterados, transacción sin suscripción confirmada, identificador incorrecto, fallos y ausencia de resultados, revocación de sesión, roles, aislamiento/paginación, idempotencia y webhook aplicado durante la lectura.
- **8 pruebas HTTP** con guards reales de Plataforma/ADMIN y sesión de entrada simulada: lectura de soporte, rechazo de acceso inadecuado, DTO estricto, referencias, motivo, paginación y `no-store`. No sustituyen las pruebas del login/MFA.
- **16 pruebas existentes de Suscripciones de Plataforma**, incluidas reconciliación, auditoría e idempotencia.
- **20 pruebas de interfaz** en tres suites. Seis nuevas cubren lectura sin consulta externa, soporte, validación, recuperación, reintento estable, nueva lectura explícita, cierre de un intento aplicado y fallo al paginar.
- Tipos de producción API/web y de tests focales, lint focal y `git diff --check` verificados.

Total: **59 pruebas API y 20 web aprobadas**. No se necesita migración para este incremento.

### Revisión visual recuperada · 22/09

Chrome volvió a responder. Se ingresó por el formulario normal de Plataforma y se revisó la empresa ficticia del checkout anterior: las cuatro contrataciones, el detalle de un intento aplicado y el estado vacío de su historial de consultas. La tabla y el diálogo se comprobaron mediante capturas del navegador, con márgenes y pie de acciones separados. También se abrió Versiones → versión 2 de Esencial → Oferta comercial; muestra USD 190/mes en sandbox y el precio anual permanece sin definir. No se retiraron ofertas ni se hicieron nuevas consultas externas o pagos.

## Límites que siguen abiertos

- La búsqueda automática existente recorre hasta cinco páginas de 100 transacciones desde la ventana del intento. No encontrar una transacción allí no prueba que no exista. La referencia explícita permite localizarla sin depender de ese límite.
- No existe un botón para forzar «no cobrado». Un cambio remoto que no puede identificarse o demostrarse requiere revisar los registros de Paddle; hasta obtener evidencia se conserva el bloqueo. Tampoco se emiten devoluciones desde este flujo.
- La prueba del webhook durante la lectura verifica esa intercalación con los servicios reales dentro de la fixture transaccional; no es una carrera entre conexiones PostgreSQL independientes.
- El detalle de un intento pendiente que requiere recuperación por referencia y un historial con varias páginas siguen cubiertos por pruebas de interfaz; no se recorrieron en el navegador durante esta revisión. El bloqueo anterior de automatización ya no impide usar Chrome.
- No se repitió el checkout real de sandbox ni se abrió ngrok. La evidencia externa del recorrido comercial anterior está en `planes-cierre-comercial-2026-09-21.md`.

## Referencias de Paddle consultadas

- [Listado de transacciones y paginación](https://developer.paddle.com/api-reference/transactions/list-transactions/).
- [Datos propios en transacciones y suscripciones](https://developer.paddle.com/build/transactions/custom-data/).
- [Cambios de suscripción y comportamiento ante pago fallido](https://developer.paddle.com/api-reference/subscriptions/update-subscription/).
