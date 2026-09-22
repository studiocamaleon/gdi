# Cierre de planes de Plataforma

Objetivo: dejar los planes funcionando de punta a punta. El cierre en desarrollo y sandbox incluye contratación mensual y anual. La activación de cobros reales quedó diferida por el usuario al lanzamiento de Grafo.

**Actualización consolidada del 22/09:** el piloto mensual de sandbox y los controles por función ya se contrastaron con la regresión completa; el [cierre anual](planes-anuales-cierre-sandbox-2026-09-22.md) agrega las ofertas v3 y un checkout anual con adicionales confirmado por Paddle. Consultar la [auditoría consolidada](planes-auditoria-consolidada-2026-09-22.md) para el inventario de evidencia; las listas de cada incremento conservadas abajo describen su momento de ejecución.

## Decisiones comerciales confirmadas

| Plan | Usuarios incluidos | GB | USD por mes | USD por año | Adicional / mes | Adicional / año |
| --- | --- | --- | --- | --- | --- | --- |
| Grafo Esencial | 3 | 250 | 190 | 1.900 | 15 | 150 |
| Grafo Pro | 20 | 500 | 290 | 2.900 | 15 | 150 |
| Grafo Avanzado | 40 | 1500 | 690 | 6.900 | 15 | 150 |

El usuario confirmó diez mensualidades por año, bonificando dos meses, y activación real al lanzamiento. Los tres borradores están en revisión 4 y sus versiones 3 tienen ofertas mensuales y anuales activas en sandbox. Esencial +2 se comprobó por USD 2.200/año, con cinco usuarios; luego se canceló la suscripción ficticia y se cerró el túnel temporal. Los contratos operativos anteriores se conservaron. Los apartados históricos siguientes mantienen la evidencia del recorrido mensual previo.

`ContenidoPlan.precios` contiene moneda USD e importes mensual, anual, usuarioMensual y usuarioAnual. Es opcional para conservar versiones anteriores; los importes nulos significan «por definir», nunca precio cero. DTO y servicio validan números positivos de hasta dos decimales. La edición usa la revisión y auditoría existentes.

## Cierre realizado en este incremento

- Historial de Compras accesible por listado y detalle aun sin la función contratada; los permisos de inventario y costos siguen siendo necesarios. Los endpoints de catálogo, necesidades y todas las escrituras mantienen controles de plan.
- La navegación muestra «Historial de compras» y el panel presenta sólo pedidos y recepciones. No carga catálogo ni necesidades, no monta formularios de alta/oferta y el detalle no ofrece acciones. La misma compra resulta invisible bajo otra empresa.
- Editor de precios integrado en «Usuarios y oferta», conservado al cambiar de pestaña y guardado junto con la propuesta.
- Validación de este incremento: 64 pruebas API de recorridos/compras/capacidades, 22 de borradores/versiones, 30 de interfaz de Compras/planes/navegación. Tipos API/web y lint focal sin errores.
- Guardado real de los seis precios mensuales por navegador y verificación visual del editor, con scroll interno y pie separado.

## Requisitos de cierre y evidencia pendiente

| Requisito | Estado / prueba que falta |
| --- | --- |
| Catálogo de funciones y dependencias editable | Implementado; completar recorridos de las combinaciones pendientes del barrido |
| Publicaciones inmutables y asignación manual auditada | Implementado y probado con contratos persistidos |
| Recursos y límites aplicados desde el contrato | Implementado; ampliar escenarios concurrentes ligados a cambios de plan |
| Historial y continuidad al retirar una función | Compras cerrado en este incremento; continuar la matriz de otras funciones |
| Definición de precios | Mensuales confirmados y guardados; anuales pendientes |
| Versión comercial vigente y precios Paddle vinculados a derechos inmutables | Tres ofertas v2 activadas en desarrollo con seis precios reales de Paddle sandbox; producción comercial pendiente |
| Alta pública y Trial con la versión elegida | Implementado: `RegistroTenant.ofertaId` fija versión, cupos y plazo; probado al publicar otra oferta durante la verificación |
| Misma oferta en web, registro, suscripción y checkout | Web comercial, registro y contratación consumen el catálogo vigente. Taller, Producción y Enterprise retirados de nuevas altas en desarrollo |
| Usuarios adicionales con cantidad confirmada y cobro | Comprobado en sandbox: Esencial +2, Pro +3 y retirada de los tres adicionales; cupos y precios coinciden |
| Cambio comercial con diagnóstico y vista previa de cobro | Cambio real en sandbox y rechazo de prorrateo obsoleto verificados. Admisión y edición administrativa protegidas durante pagos pendientes; quedan compromisos operativos y recuperación incierta |
| Webhooks y reconciliación preservan versión y extras | Implementado para precios versionados; se preservan precios históricos, se rechazan mezclas y se aplican bajas/mora aunque un payload incompleto requiera revisión |
| Founder y contratos anteriores preservados y fuera de la oferta pública | Catálogo unificado probado. Founder conserva su precio y contrato; las dos suscripciones previas no se migraron |
| Recorrido real de contratación en entorno de pruebas de Paddle | Completado para pago mensual, cambio, adicionales, baja programada e inmediata, con empresa ficticia. Correo de alta simulado, login/checkout/webhooks reales de sandbox |
| Auditoría final de las 65 funciones y combinaciones de planes | Pendiente; no usar conteos de referencias como prueba de cobertura |

## Asociación entre versión, precio y suscripción

Registro y vista del tenant presentan la oferta desde `PlanOferta.version`; el precio del contrato actual respeta la versión asignada, el ciclo y los adicionales. El endpoint anterior de cambio de plan rechaza contratos versionados para impedir que esquive la revisión de impacto.

Se implementó una oferta comercial que apunta a una versión publicada y conserve una asociación durable de **precio Paddle → versión → tipo de ítem → ciclo**. Distinguir plan base y usuario adicional. Cambiar la oferta vigente no debe reinterpretar los precios históricos ni migrar a suscriptores anteriores. No resolverlo copiando indiscriminadamente el último borrador a `featuresJson`.

El registro captura la oferta elegida y concede su versión al completar el alta; publicar otra versión durante la verificación del correo no cambia la elección. Las ofertas versionadas sólo aparecen tras activación explícita. El catálogo anterior se conserva hasta realizar el cambio comercial de los planes; retirar una oferta versionada no revive su fallback.

La sincronización de Paddle debe resolver el plan base y contar extras desde los ítems confirmados. La edición de una suscripción debe enviar la lista completa de ítems y mantener un ciclo común: Paddle sustituye la lista recibida. Es necesario mostrar una previsualización y aplicar el diagnóstico de cupos/compromisos antes del cambio. [Ítems y adicionales en Paddle](https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons/).

La aplicación de estados se conserva independiente de la oferta comercial y se contrasta con webhooks y reconciliación. [Provisión de acceso](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/). Preparar precios/productos puede hacerse mediante el catálogo de Paddle, con los importes acordados; activar ventas requiere comprobar la correspondencia con la versión publicada. [Productos y precios](https://developer.paddle.com/build/products/create-products-prices/).


## Incremento de ofertas versionadas

- Migración `20260922020000_ofertas_planes` aplicada en desarrollo y test. `PlanOferta` y `PlanOfertaPrecio` son inmutables; `Plan.ofertaActualId` selecciona la oferta para altas nuevas con revisión y auditoría. La clave entorno + priceId no puede cambiar de significado.
- La activación consulta Paddle y valida producto/precio activos, importe exacto en USD, ciclo, impuestos separados, cantidades, ausencia de trial remoto y de precios por país. Sólo el precio anual explícitamente definido puede ofrecerse; se admite una oferta exclusivamente mensual.
- `RegistroTenant.ofertaId` conserva condiciones durante la verificación. El formulario envía ese identificador; el DTO acepta códigos del catálogo sin la lista fija de dos planes. La provisión administrativa también captura la versión y evita el fallback de permisos de planes anteriores.
- La sincronización interpreta todos los ítems y cantidades, exige un único plan base y adicionales de la misma oferta/ciclo. Reconoce ofertas retiradas, retira plazas cuando desaparece el adicional y conserva la versión. Un evento conocido de baja, pausa o mora sin ítems aplica el estado y guarda una advertencia sin inventar derechos; un evento activo incompleto no reactiva el acceso.
- Los endpoints anteriores de asignación/vinculación/cambio comercial no pueden reinterpretar una oferta ni reutilizar sus precios. Los contratos anteriores conservan su vía de compatibilidad.
- Pruebas nuevas con base real aislada y rollback: activación, inmutabilidad, autorizaciones, precios incompatibles, alta pública, sustitución de oferta durante verificación, cupos pagados, retirada, baja/pausa/mora incompletas y provisión administrativa. Transportes de correo/Paddle simulados; **no se ha efectuado un pago externo**.
- Se verificaron nuevamente los borradores reales: USD 190/290/690, USD 15 adicionales; importes anuales nulos. En ese punto aún no había ofertas activadas; el incremento del 22/09 descrito al final las activó en sandbox. API reiniciada; catálogo público HTTP 200 y API administrativa sin sesión HTTP 401.

### Trabajo siguiente

1. Completar la protección frente a nuevos compromisos operativos de funciones que se están retirando durante una contratación pendiente y pruebas de carreras entre transacciones.
2. Completar recuperación operativa de intentos inciertos sin referencia encontrada. No liberar un intento sólo porque la búsqueda remota falló o no devolvió coincidencias.
3. Continuar la matriz final de las 65 funciones y límites. Los accesos rápidos de creación del panel general ya verifican capacidades; resta auditar los demás accesos y recorridos.
4. Definir importes anuales cuando el usuario lo decida. Para producción faltan precios y webhook de producción, dominio definitivo y validación de correo real. El objetivo global sigue activo.

## Contratación comercial y formularios

- Migración `20260922030000_contratacion_planes` aplicada a desarrollo y test. `PlanContratacion` conserva actor, selección, diagnóstico, revisión del contrato, preview, estado y referencia remota. Un índice único parcial impide dos envíos pendientes por empresa.
- La API exige una sesión propia de administrador y vuelve a validar membresía y permisos. El diagnóstico incluye usuarios activos, invitaciones, bytes guardados/reservados y compromisos de las funciones retiradas. Se revalida al confirmar; no se envía un cambio si cambió el uso, la oferta o el importe del preview.
- Checkout creado en servidor con plan base y cantidad de adicionales. Paddle.js recibe `transactionId`; retomar o reintentar el formulario reutiliza la misma transacción. Un error después de enviar pasa a verificación; el backend no repite el POST/PATCH. Sólo una cancelación confirmada del checkout sin pago permite descartarlo y comenzar otra contratación.
- Los cambios de una suscripción vigente envían todos sus ítems con `onPaymentFailure: prevent_change`. El estado se reconcilia antes de declarar aplicado el contrato. Los precios públicos y `customData` no bastan para habilitar una oferta: Sync requiere un intento confirmado que coincida con oferta, ciclo y cantidad.
- Webhook y consultas conservan el resultado aplicado frente a errores concurrentes. Una baja, pausa o mora auténtica de una referencia conocida se aplica conservando el contrato cuando sus ítems no coinciden, sin conceder otra versión o cupo.
- La vista del tenant ofrece revisión, selección de adicionales, impacto de funciones, cupo resultante, total periódico y cobro inmediato. Guarda el intento pendiente para retomarlo después. La pantalla de pago de ofertas nuevas no promete otro trial ni un primer pago sin cargo.
- Plataforma: desde **Versiones → Ver contenido → Oferta comercial** se puede revisar la activación o el retiro. Usa la versión publicada, exige identificadores válidos de Paddle y un motivo, muestra el entorno y confirma las condiciones antes de enviar. Soporte sólo consulta. Los anuales sin definir permanecen deshabilitados.
- Verificación: 76 pruebas API en contratación/ofertas/cobro/webhook/ciclo/aislamiento; 28 de interfaz en contratación/oferta/editor/cupos. Tipos API/web y lint focal aprobados. Se comprobó visualmente el diálogo en Chrome con sesión de Plataforma y el bloqueo de una versión anterior sin precios. Catálogo público HTTP 200; contratación sin sesión HTTP 401.
- **Límite de esa evidencia automatizada:** transporte Paddle simulado. Se complementó con la prueba externa del 22/09 detallada a continuación; esto no constituye una prueba de cobros de producción.


## Prueba externa y cierre del catálogo · 22/09/2026

### Ofertas vigentes en desarrollo / sandbox

Se publicaron versiones **2**, desde borradores de revisión **3**, y se activaron desde Plataforma. Sólo mensual; 14 días de prueba local. Pro recomendado. Precios con impuestos separados.

| Plan | Oferta | Precio mensual Paddle | Adicional mensual Paddle |
| --- | --- | --- | --- |
| Esencial | `6fed0b0d-0c5e-41ca-bbd2-19bc24e3514f` | `pri_01m33fv8qdx4001gs3703pnbmd` | `pri_01m33fv95rhp4atdnd4aqk0nq1` |
| Pro | `34022cbb-edc6-4425-bda4-8d001dd4423e` | `pri_01m33fv9m5zxpha6ka9q72jzrv` | `pri_01m33fva1zxh3dyvx8t611hd9n` |
| Avanzado | `b3466487-b95e-48c5-964d-5a27ec5b32a2` | `pri_01m33fv7txtpjh47f4qmrxgn1q` | `pri_01m33fv8962k2bqmtsyrfbmddx` |

- Retiro auditado de Taller, Producción y Enterprise **sólo para altas nuevas**. No se eliminaron precios, productos ni contratos previos. Founder permanece interno.
- Marketing obtiene ofertas y funciones desde `/registro/planes`, sin caché. `connection()` mantiene la portada dinámica incluso cuando falta la configuración durante el build; no publica precios inventados ante un fallo. El enlace de alta incluye plan e identificador de oferta.
- Registro muestra nombres, almacenamiento y adicionales reales. Si cambió la oferta del enlace, exige revisar la oferta actual antes de enviarla.
- Verificación: catálogo HTTP y navegador muestran exactamente Esencial, Pro y Avanzado con 3/20/40 usuarios, 250/500/1500 GB y USD 190/290/690; adicional USD 15. Marketing build dinámico y ocho pruebas; registro nueve; ofertas/escrituras API veintisiete.

### Recorrido realizado

Empresa aislada: `99846682-3876-4420-94e3-6eeb1df2b3b0` · **PRUEBA · Planes Paddle 2026-09-22**. Alta con el servicio real de registro y provisión; únicamente correo y creación inicial de sesión simulados. El login posterior se realizó por el formulario normal, con cuenta sintética, en `127.0.0.1` para conservar la sesión real de Plataforma en `localhost`.

1. Esencial +2 adicionales: checkout real de sandbox por **USD 220/mes**, tarjeta ficticia oficial terminada en 4242. Transacción `txn_01m33grm8x56sacqarsbqtxecx`, contratación `80996760-8a48-4820-b0fe-32869f26c99d`.
2. Eventos auténticos `subscription.created` y `subscription.activated`, firma verificada por la API, respuesta HTTP 200, resultado aplicado. Versión de Esencial y cupo de cinco usuarios persistidos.
3. Cambio a Pro +3: **USD 335/mes**, cupo 23, ajuste inmediato USD 115. Un primer preview de USD 114,99 quedó obsoleto y el servidor lo rechazó antes de cobrar; la revisión nueva permitió completar el cambio.
4. Retirada de todos los adicionales: Pro **USD 290/mes**, cupo 20; crédito de USD 45. El portal de Paddle muestra un único ítem base y el crédito para el próximo período.
5. Cancelación programada por el portal de Paddle: el webhook conserva acceso hasta el 21/10 y Grafo muestra la fecha de finalización. Luego se dio de baja inmediatamente **sólo esa suscripción ficticia** por API para verificar `subscription.canceled`: estado local `baja`, versión conservada, modo de sólo lectura visible.

Suscripción de ensayo `sub_01m33gtynhc019awxft40m2500`, actualmente cancelada. No se usaron tarjetas reales ni se alteraron empresas operativas. El túnel ngrok se abrió con autorización explícita durante la prueba y **se cerró tras recibir el evento de baja**. La configuración del destino del webhook se conservó.

### Correcciones encontradas durante la prueba

- La pantalla consulta automáticamente un resultado pendiente durante una espera acotada (máximo doce consultas). No repite la orden de cobro; conserva recuperación manual y cancela la espera al cerrar. Al aplicarse el contrato deja de mostrar instrucciones para pagar.
- La selección visual del plan cambia junto con el contrato; el checkout incluye adicionales en el total de usuarios.
- Los cambios sin cargo inmediato se describen como tales. El resumen distingue precio base de renovación de importe final con impuestos, descuentos y créditos. Una suscripción dada de baja no promete renovación ni ofrece cancelar nuevamente.
- La admisión de usuarios y archivos respeta el menor cupo entre contrato actual y destino pendiente. No concede ampliaciones antes del pago; mantiene las reservas existentes y las excepciones de almacenamiento. Un intento pendiente no se libera sólo por vencer su revisión.
- La asignación administrativa de versión, cambio de plan anterior y ajuste de adicionales quedan bloqueados mientras hay cobro pendiente, bajo el mismo lock de empresa.
- Verificación: 32 pruebas de contratación/cuotas/confirmación de archivos, 73 de integración de asignación, usuarios, almacenamiento y Plataforma; doce pruebas de interfaz de contratación/ofertas. Tipos de producción API y web y lint focal verificados. El chequeo TypeScript general de API incluye errores previos en fixtures de otros tests; no confundirlo con el build de producción.

Pendientes: compromisos operativos concurrentes fuera del bloque Compras descrito a continuación, recuperación administrativa de envíos inciertos sin referencia, auditoría final de funciones y paso a producción. Los importes anuales siguen sin definirse.

## Compras concurrentes y accesos rápidos · 22/09/2026

- El panel general filtra **Crear orden** y **Registrar egreso** por capacidad y estado operativo. Esencial no ofrece registrar egresos; Pro sí. Una empresa dada de baja conserva las consultas, pero no esos accesos de creación. El control de API sigue siendo independiente del botón.
- Compras toma el lock de la empresa antes de sus propios locks y revalida el contrato dentro de la misma transacción que guarda la operación. Guardar una oferta de proveedor sigue ese mismo orden de locks. Una validación inicial anterior al cambio de plan ya no basta para escribir después del cambio.
- El lock compartido de empresa toma `NO KEY UPDATE`: sigue excluyendo otros cambios de contrato/cupo y permite los `KEY SHARE` de relaciones foráneas. El incremento posterior utiliza una actualización sin cambio de valores para detectar además snapshots anteriores en transacciones SERIALIZABLE; ver el apartado enlazado al final. Evita convertir una compra en un bloqueo de altas de otros módulos. [Modos de bloqueo de filas en PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).
- Durante un intento `enviando`, `checkout` o `verificar`, no permite crear o emitir una compra si el destino retira Compras o Recepciones que el contrato actual incluye. Un vencimiento de la revisión no demuestra que el proveedor haya descartado el pago.
- Si el cambio conserva esas funciones, las compras continúan. No se habilitan funciones del plan nuevo antes del pago. Se conservan consulta histórica, recuperación idempotente y cierre/cancelación de operaciones anteriores según el contrato vigente.
- Nuevo helper `exigirContinuidadCompromiso`: se usa después del lock de empresa y sólo para nuevos compromisos. No cambia las capacidades de consulta globales ni afecta todas las operaciones de la empresa por tener un pago pendiente.

### Evidencia

`apps/api/src/compras/__tests__/compras-cambio-plan.integration.spec.ts`: nueve pruebas con empresa y catálogo sintéticos en `gdi_saas_test`. Tres verifican el bloqueo efectivo entre conexiones PostgreSQL independientes con `pg_blocking_pids`:

1. La compra confirma primero: la asignación de plan rechaza el diagnóstico obsoleto y conserva el contrato anterior.
2. La asignación confirma primero: la compra que había superado el control inicial revalida y se rechaza sin guardar una orden.
3. El checkout pendiente confirma mientras la compra espera: la compra detecta que se retiran sus funciones y se rechaza.

Una cuarta prueba concurrente verifica que crear un proveedor, cuya relación referencia la misma empresa, puede terminar mientras la compra mantiene su lock. Las demás comprueban estados pendientes, ampliación de plan e idempotencia/cancelación.

No se simulan los locks ni las escrituras de los servicios. La limpieza de fixtures confirmadas aplica una excepción local a los triggers de inmutabilidad, sólo en la transacción de limpieza y después de exigir una base terminada en `_test`; no se altera ningún trigger global ni dato de desarrollo. Las pruebas de contratación existentes siguen usando transportes Paddle simulados; la prueba externa está documentada arriba.

Resultado final: **155 pruebas en nueve suites**, incluyendo Compras/concurrencia, contratación, asignación, recorridos, panel, usuarios, archivos y suscripciones de Plataforma; tipos de producción API y lint focal aprobados. El test anterior de entrega conserva avisos de lint ajenos a este cambio.

La evidencia de este apartado cubre Compras. El incremento posterior agrega finanzas y proyectos, con sus límites y pendientes explícitos: [continuidad de finanzas y proyectos](planes-continuidad-finanzas-proyectos-2026-09-22.md). El incremento posterior incorpora reservas/necesidades y planificación: [alcance, pruebas y pendientes](planes-continuidad-reservas-planificacion-2026-09-22.md). El siguiente incremento verifica avisos y sus colas, incluidos resultados inciertos y cambios concurrentes: [continuidad de avisos](planes-continuidad-avisos-2026-09-22.md). Otros automatismos y los pendientes generales siguen abiertos.


## Historial financiero · 22/09

Se completó la consulta de Egresos, Tesorería, Valores y Recurrentes al retirar su gestión del plan. Conserva permisos y aislamiento; no mueve fondos al abrir una consulta. Ver [alcance, 131 pruebas API y 21 web, y límites](planes-historial-financiero-2026-09-22.md).

## CAD y guardado de cotizaciones · 22/09

Recorrido CAD hasta la OT verificado con los tres planes publicados, sin impresión conectada. Guardado y recotización revalidan el contrato dentro de su transacción; los tomos conservan la misma protección. Ver [evidencia, transiciones y límites](planes-cad-contrato-asignado-2026-09-22.md).

## Continuidad de impresión · 22/09

Los nuevos envíos e intenciones revalidan el contrato bajo lock. Las órdenes conservan un historial independiente de QZ, con selección múltiple para verificar salidas existentes. Ver [alcance, concurrencia, pruebas y pendientes](planes-continuidad-impresion-2026-09-22.md). Chrome volvió a responder; no fue necesario repetir el checkout ni reabrir ngrok.

El diagnóstico de asignación y contratación también muestra solicitudes sin envío y salidas sin verificar. Exige aceptar su continuidad y vuelve a revisar la identidad de los pendientes antes de aplicar el contrato o solicitar el cobro. Se verificaron ambos órdenes de la carrera entre asignar y encolar. Evidencia del segundo incremento: 74 pruebas API y 15 de interfaz, detalladas en el documento de continuidad.

## Recuperación administrativa de contrataciones · 22/09

La ficha de Suscripciones incorpora **Contrataciones**, con historial y consulta auditada para Administración con MFA. Permite localizar un checkout por referencia cuando se perdió la respuesta, verificar su pertenencia y condiciones, y recuperar un pago confirmado sin reenviar el cobro. Comparte la reconciliación con la consulta de la empresa. Ver [alcance, 59 pruebas API, 20 de interfaz y límites](planes-recuperacion-contrataciones-2026-09-22.md). La ausencia de evidencia conserva el intento pendiente. Chrome volvió a responder: se revisaron la tabla con cuatro contrataciones reales de sandbox, el detalle de una aplicada y la oferta vigente de Esencial. Los casos visuales restantes están indicados en el documento de recuperación.
