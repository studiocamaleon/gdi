# Planes reales: evaluador, comparación y primer desacople

**Estado:** circuito básico y capacidades opcionales desacoplados; cupos de usuarios, invitaciones y adicionales implementados. Los borradores siguen sin asignarse a empresas. Continúa en `codex/rediseno-backoffice-plataforma`.

## Resultado para quien usa Plataforma

En **Planes → Revisión → ¿Qué cambiaría en esta empresa?**, buscar una empresa y comparar. La consulta usa la propuesta que está en pantalla, aunque todavía no esté guardada.

Muestra las condiciones actuales, membresías activas, usuarios incluidos en cada propuesta, excedentes, cambios de funciones y avisos sobre reservas, necesidades de materiales y compras abiertas. Un excedente con adicionales permitidos requiere definir y contratar esos adicionales; no significa desactivar usuarios automáticamente. El conteo ahora usa la ocupación común: accesos habilitados e invitaciones pendientes vigentes, deduplicados. El cupo actual incorpora los adicionales de la empresa.

La comparación no escribe `Plan`, `Suscripcion`, `PlanBorrador`, inventario o cobros. No llama a Paddle. Una edición de la propuesta invalida el resultado y las respuestas tardías no pueden reemplazarlo con información anterior. La búsqueda muestra hasta 20 empresas y pide afinar el texto si hay más.

## Evaluador común

`suscripciones/evaluador-capacidades.ts` define dos fuentes separadas:

1. **Compatibilidad:** interpreta el contrato anterior de cada cuenta. Preserva los cuatro controles existentes, los pilotos con habilitación explícita, las cuentas sin suscripción y la semántica anterior de `todo` y cupos. Una lista cerrada de 65 claves evita conceder funciones futuras automáticamente.
2. **Propuesta:** valida el catálogo, las dependencias, las claves y la base obligatoria. Mantiene los cupos de 3/20/40 separados de la inclusión de funciones. Sólo se usa para comparación y pruebas aisladas.

`CapacidadesEmpresaService.actual()` lee la empresa y su suscripción desde la base local; no acepta derechos enviados por el cliente ni consulta borradores para autorizar operaciones. Separa **función incluida** de **cuenta habilitada para operar**. `exigir()` deniega la operación si falta cualquiera de ellas. Los permisos del usuario siguen siendo un control adicional: tener el plan no reemplaza el rol.

La compatibilidad describe el comportamiento previo, no certifica que todas las superficies tengan ya controles comerciales. Las restricciones nuevas están incorporadas únicamente en los puntos detallados abajo. La publicación sigue separada para no activar contratos incompletos.

## Desacople de materiales implementado

| Recorrido | Con reservas / previsión | Sin esa capacidad |
|---|---|---|
| Emitir OT directamente o desde borrador | Conserva política y reserva automática existentes | Emite sin crear necesidades persistidas, reservas ni movimientos |
| Cambiar política o ejecutar comandos de reserva | Exige capacidad y cuenta operativa | Rechaza la operación |
| Consultar previsión mientras se cotiza | Calcula disponibilidad y reposición | Devuelve `no_incluido`, no consulta existencias/compras ni agrega una condición de materiales a la fecha |
| Modificar OT con control de materiales histórico | Conserva reconciliación | Rechaza reconciliación hasta definir continuidad; no altera silenciosamente reservas |
| Cancelar OT con reservas anteriores | Libera compromisos | La limpieza también sigue disponible |

La previsión excluida no afirma que haya stock: no participa de la estimación. El panel no muestra una exigencia de materiales si el contrato no incluye esa función. El catálogo marca estos dos controles como **parciales**, con revisión operativa todavía pendiente.

Las empresas reales conservan el acceso anterior. En las pruebas se sustituye únicamente la resolución del contrato de la empresa de prueba por la propuesta válida; la emisión, transacciones, política, necesidades y reservas se ejecutan contra la base de pruebas. No existe un endpoint de simulación que permita al cliente habilitar derechos en producción.

## Recorrido básico y capacidades opcionales

El segundo incremento incorpora el contrato común en la navegación, cotización, emisión, ejecución manual, cobro y entrega:

| Función | Comportamiento sin capacidad |
|---|---|
| Fidelización | Cotizar/emitir calcula cero puntos/canje; cobrar y entregar no crean cuentas ni ganancias. Un canje solicitado explícitamente se rechaza. Las ganancias anteriores no se borran por perder la capacidad; su reverso sigue disponible cuando se cancela/revierte la operación. |
| Cupones | Se rechazan creación, validación, reserva y redención. El cotizador omite el selector y su escucha del lector. Los descuentos comerciales manuales siguen disponibles. |
| Campañas/proyectos | No consulta ni ofrece campañas en una cotización nueva. API de campañas y vinculación al crear presupuesto/OT exigen la capacidad. |
| Arte | La emisión no materializa automáticamente requisitos nuevos sin capacidad. Las acciones de gestión están protegidas. Los gates y enlaces históricos se conservan; no se salta una aprobación existente. |
| ETA y asignación | No calcula promesas, cierres, snapshots ni reparto automático, también desde el scheduler. El tablero conserva ejecución manual; cotización conserva fecha elegida por el comercial. |
| Planificación de entregas | Solicitudes, selección, reprogramación, worker y adopción de planes en la OT exigen capacidad. La distribución histórica se muestra sin ofrecer su edición si queda excluida. |
| Recorridos de fabricación | La emisión omite su preparación automática; el trabajo básico se sigue emitiendo. |
| Cobros/entrega | Conserva recibo, caja, saldo y entrega por QR, sin exigir integración fiscal. El catálogo de permisos administrativos ya no considera ARCA un requisito del módulo entero. |

**Previsión de materiales y ETA son independientes:** Pro puede consultar faltantes y reposición sin activar el cálculo de carga de máquinas. La fecha manual sigue disponible. El importe de la cotización no depende de que se reserve stock.

`GET /capacidades` devuelve exclusivamente el contrato resuelto para la empresa de la sesión. Está declarado para todos los miembros autenticados y no acepta una empresa o funciones enviadas por el navegador. La interfaz lo consume al cargar el dashboard. El menú, el acceso directo a las rutas cubiertas y las acciones del cotizador usan el mismo mapa. Las páginas cubiertas comprueban la capacidad antes de consultar datos en el servidor; los guards HTTP y servicios son la autoridad aunque una pestaña conserve información anterior.

Los permisos personales siguen vigentes. El guard de lectura comprueba inclusión; no impide por sí mismo una lectura permitida de una suscripción en modo sólo lectura. Las operaciones explícitas comprueban además que la cuenta pueda operar.

## Verificación

- **187 pruebas de API** en 17 suites: evaluador, contratos, comparación, borradores, permisos, emisión, reservas, compras, fidelización, arte, asignación y planificación. Incluyen rechazos por capacidad y aislamiento por empresa.
- **Recorrido real en PostgreSQL de pruebas:** catálogo y tarifas de `gdi_saas_test`, cotización de 500 tarjetas, emisión, finalización de pasos, cobro en efectivo con recibo, lectura del QR y entrega. Finaliza entregada con saldo cero. La prueba activa la configuración de fidelización y excluye del contrato todas las funciones superiores, además de ARCA: no crea puntos, reservas ni promesas ETA.
- La prueba usa el catálogo sembrado de la empresa de pruebas dentro de una transacción que se revierte, un cliente propio y servicios reales. Se sustituye sólo la resolución del contrato, las comunicaciones externas y la generación del archivo PDF del recibo. La numeración y el enlace del recibo son reales. No cambia suscripciones de desarrollo ni imprime/envía mensajes.
- **22 pruebas web:** editor, comparación, navegación por plan, acceso directo, permisos, previsión sin ETA y estimación sin control de materiales.
- TypeScript web/API, lint focalizado y revisión real en Chrome de la cuenta Founder: dashboard y nueva OT cargan y conservan sus opciones.

Esto verifica el circuito básico y las superficies descritas; no certifica todavía el cierre de las 65 funciones ni habilita una migración de plan sobre trabajos abiertos.

## Compras, administración, precios, reportes y comunicaciones

Implementado en el siguiente incremento, aún bajo el contrato compatible de cada empresa:

| Área | Control incorporado | Base que se conserva |
|---|---|---|
| Compras y recepciones | Guard HTTP para compras; recibir exige compras y recepciones. Altas, ofertas, acciones y recepción también comprueban capacidad en el servicio. | Existencias, material/costo de catálogo y cotización sin emitir compras. |
| Proveedores | Gestión, importación y ficha controladas por `proveedores`. | Opciones de proveedores existentes para referencias de materiales. La propuesta Esencial incluye proveedores. |
| Tesorería y valores | Fondos, movimientos detallados, transferencias, arqueos y conciliación usan `tesoreria`. Cheques usan `valores`, incluso en cobros y pagos al contado desde Egresos. | Cuentas destino, métodos de pago, movimientos que respaldan el cobro y recibos. Creación de cuentas desde Configuración → Métodos de pago, sin abrir Tesorería. |
| Egresos y recurrentes | `cuentas_pagar` en rutas y escrituras; `gastos_recurrentes` adicional en plantillas. El generador revisa función y estado operativo antes de emitir. | Cobros y entrega. Egresos carga sin Gastos fijos, análisis financiero ni plantillas recurrentes. |
| Gastos fijos | Rutas controladas por `gastos_fijos`; no bloquea centros de costo ni tarifas del cotizador. | Esencial conserva esta función; su exclusión se prueba como configuración a medida. |
| Precios especiales | Gestión controlada; el motor consulta acuerdos sólo con `precios_especiales`. | Precio normal del producto si no está incluida. No modifica precios finales guardados ni elimina acuerdos. |
| Reportes | Familias avanzadas verificadas por API, página servidor, catálogo y selector. | Resumen ejecutivo agregado, comercial y embudo bajo `reportes_resumen`, con permisos personales y de márgenes. El resumen agregado no se reclasifica como informe avanzado. |
| WhatsApp | Capacidad del canal al encolar y despachar. WATI revisa prueba, credenciales operativas y sincronización programada. La extensión revisa contexto, configuración, reserva e inicio. | El evento comercial continúa sin avisos. El resultado de un envío Web ya autorizado sigue disponible con los controles de tenant, dispositivo y token. |

Los requisitos de clase y método se acumulan: habilitar recepciones no permite saltar compras. Los ajustes compartidos de WhatsApp admiten cualquiera de sus canales; cada envío exige el suyo. Permisos y estado de suscripción siguen siendo controles independientes.

### Continuidad antes de publicar

- Compras, recepciones, egresos, valores y acuerdos se conservan. Excluir una función no borra registros ni altera stock o saldos. La asignación de nuevos contratos deberá resolver cómo terminar operaciones abiertas y consultar históricos.
- Avisos WATI pendientes quedan sin enviar ni consumir intentos. Hay que definir su vencimiento o reanudación antes de permitir cambios de plan, para evitar avisos antiguos al recuperar acceso.
- Las plantillas recurrentes se conservan. El generador se detiene sin derechos, pero la lógica existente recupera períodos pendientes al reactivarse; ese tratamiento debe formar parte del diagnóstico de cambio de plan.
- Este bloque figura como cobertura parcial: controles y pruebas no equivalen a certificar cambios de plan ni el cierre de las 65 funciones.

### Verificación de este incremento

165 pruebas API en 10 suites y 32 pruebas web en 7 suites. Incluyen bloqueos de rutas y servicios, generación recurrente detenida, ambos canales de avisos, revalidación de avisos encolados, compras/recepciones, tesorería/egresos y la OT Esencial completa. La interfaz verifica acceso por URL antes de consultar y Egresos sin Gastos fijos.

TypeScript web/API, lint focalizado y control CSS sin globales nuevas. Revisión en Chrome con Founder: cuentas de cobro, formulario compartido, catálogo de reportes e informe financiero; sin guardar operaciones de negocio.

## Secuencia pendiente

1. **Cerrar cada control por capacidad:** rutas API, servicios internos, jobs, integraciones, navegación y acciones. Los controles visuales nunca reemplazan los del servidor. Ampliar los avisos de continuidad a todas las funciones con datos históricos.
2. **Continuidad de cupos:** usuarios, invitaciones y archivos ya tienen control transaccional común en sus respectivas operaciones. Quedan la contratación y facturación automática de adicionales y el diagnóstico previo de cambios de contrato (incluidas reservas de cargas vigentes). Resolver `todo` explícitamente para nuevos contratos, manteniendo las condiciones anteriores hasta una migración revisada.
3. **Publicar versiones inmutables y asignar:** diagnóstico de impacto, tratamiento de trabajos abiertos e históricos, fecha de vigencia, auditoría, cambios de nivel y reversión. Los cambios del editor no deben alterar una versión ya contratada.
4. **Venta y cobro:** definir precios, almacenamiento, adicionales y vincular cada versión/precio al proveedor de cobro. Validar altas, renovaciones, mora, bajas y cambios programados.

**Siguiente corte recomendado:** implementar el diagnóstico de continuidad para publicar versiones inmutables y asignarlas. Antes de activar una propuesta se debe cerrar el inventario de superficies restantes y las políticas de operaciones abiertas indicadas arriba. Todavía no hay un botón que asigne estos borradores a empresas.


## Cupos de usuarios y adicionales — 21/09/2026

### Regla de ocupación

- Un acceso habilitado a una empresa (`Membership.activa`) ocupa un lugar, incluso si todavía usa la clave provisoria. Desactivar ese acceso lo libera; el historial se conserva. Un bloqueo global de identidad no da de baja automáticamente sus accesos contratados.
- Una invitación vigente, no aceptada ni revocada, reserva un lugar. Se deduplica por identidad/correo normalizado y no suma otro si la persona ya tiene acceso habilitado a esa empresa.
- Aceptar una invitación o sustituirla por un alta con clave provisoria convierte la reserva en acceso. No exige un segundo lugar. Las invitaciones vencidas liberan automáticamente su reserva al consultar; no requieren un cron.
- Configuración → Usuarios muestra ocupación, incluidos, adicionales e invitaciones que reservan lugar. Se pueden cancelar estas últimas; también se revocan las invitaciones correspondientes al desactivar a una persona.
- La invitación desde Empleados reserva el lugar, pero ya no crea una membresía activa antes de aceptarse. Las membresías históricas que ya estaban activas se conservan.

### Garantía del servidor

`cupos-usuarios.ts` es la lectura común de cupo y ocupación. El cupo total es el límite del contrato vigente más `Suscripcion.usuariosAdicionales`. Las cuentas legacy y Founder con `todo` conservan su condición ilimitada; un límite explícito de cero no significa ilimitado.

Todas las altas, reactivaciones, emisiones/aceptaciones/revocaciones de invitaciones y ajustes administrativos toman el lock de la fila `Tenant` antes de leer y guardan dentro de la misma transacción. La autorización del cupo lee desde esa transacción, nunca desde un conteo anterior del navegador. Los cambios manuales de plan y la sincronización comercial ya comparten ese lock.

Si un cambio externo deja el uso por encima del cupo, se informa el excedente y se frenan nuevas incorporaciones. No se desactiva a personas ni se recortan datos automáticamente. Un cambio manual de plan o reducción de adicionales se rechaza si el cupo resultante no cubre la ocupación.

La comparación de borradores, los límites de Suscripciones y la ficha de empresa incorporan esta misma regla. La propuesta sigue siendo informativa: no activa nuevos planes.

### Adicionales en Plataforma

Plataforma → Suscripciones → ficha → **Usuarios del plan** muestra incluidos, adicionales, activos, pendientes y disponibles. Para contratos manuales con límite existe **Ajustar adicionales**. Se exige sesión personal de administrador de Plataforma con MFA, motivo y valor anterior para evitar pisar otro ajuste. Se registra un `PlataformaEvento` dentro de la transacción.

Se agrega `usuariosAdicionales` con valor inicial cero y restricción de base no negativa. No se cambia el JSON del plan compartido. Este ajuste registra plazas acordadas manualmente; **no genera cargos**. Las suscripciones vinculadas a Paddle u otro proveedor conservan consulta, sin botón ni endpoint habilitado de ajuste manual. La contratación automática de adicionales requiere catálogo comercial, sincronización de cantidades, vigencias y cobro: pendiente de la etapa comercial.

Los adicionales vigentes se conservan al cambiar de plan. Al implementar versiones hay que definir explícitamente cuándo se trasladan, vencen o cancelan; los webhooks no deben transformarse en un segundo editor de concesiones manuales.

### Verificación

- 104 pruebas API en 10 suites; 18 casos nuevos de PostgreSQL dedicado a pruebas. Incluyen altas simultáneas, alta contra reactivación, correo duplicado, invitaciones al límite, cancelación, expiración, acceso desde Empleados, aislamiento entre empresas, autorización con MFA, ajustes simultáneos y protección de contratos con pasarela.
- 14 pruebas web en 3 suites: desglose, sólo lectura para soporte/pasarela, reducción inválida, envío al guardar, conflicto sin cerrar el formulario y cancelación de invitaciones.
- TypeScript web/API, lint focalizado y control CSS. Panel de suscripción revisado en Chrome con los contratos vigentes, sin cambiar planes ni plazas de empresas reales.
- Migración `20260921180000_cupos_usuarios` aplicada en desarrollo y `gdi_saas_test`. Las pruebas de escritura usan exclusivamente la base de pruebas.


## Cupo de almacenamiento — 21/09/2026

### Qué ocupa espacio

- Los archivos confirmados ocupan sus bytes reales, leídos del almacenamiento. Incluye adjuntos y los PDF que produce Grafo.
- Las cargas pendientes reservan el tamaño declarado durante 24 horas. El espacio disponible descuenta lo guardado y lo reservado. Al confirmar se sustituye la reserva por el tamaño real; nunca se suman ambos.
- Fallos de transferencia y cancelaciones del navegador solicitan liberar la reserva. Un endpoint específico cancela sólo cargas incompletas: si se perdió la respuesta de una confirmación exitosa, no borra el archivo guardado. En multipart se abortan los demás PUT antes de liberar espacio.
- Si se cierra el navegador o no puede comunicarse con el API, la reserva vence automáticamente a las 24 horas, sin esperar al cron. Las subidas iniciadas antes de esta migración conservan su estado y se validan contra el cupo al confirmar.
- La papelera conserva la política de 30 días y libera cuota al borrar. Restaurar vuelve a ocupar espacio y debe respetar las cargas en curso. Borrar y restaurar son idempotentes bajo concurrencia.

### Control común y rendimiento

`archivos/cupo-almacenamiento.ts` toma la cuota del contrato compatible vigente. Un ajuste positivo de la empresa tiene prioridad. Se conservan las condiciones anteriores: `todo` y `storageGb: 0` implican ausencia de límite de archivos; no se activan borradores ni se eligen GB comerciales en esta etapa.

Cada reserva, confirmación, publicación PDF, borrado, restauración y reconciliación del contador toma primero el lock de `Tenant`. La lectura de la cuota y el cambio de estado se realizan en esa misma transacción. La suma de reservas vigentes usa el índice `(tenantId, estado, reservaHasta)`. Empresas distintas tienen locks distintos.

Las transferencias al storage, las firmas y los HEAD se hacen fuera del lock. Los archivos siguen viajando directamente entre navegador y storage; no se agregan colas de subida a través de la API. Se revalida el cupo y el estado al publicar. La pantalla de uso hace una lectura consistente y filtra explícitamente por empresa.

Los PDF históricos reservan sólo la diferencia positiva respecto de su versión anterior. Reemplazo y contador cambian juntos: un fallo conserva el PDF anterior y no deja dos vigentes. Los PDF versionados comparten la reserva y mantienen la validación de lease del worker y la publicación única. Los errores al materializar recibos/comprobantes continúan siendo posteriores al registro del cobro/emisión fiscal, como en el flujo anterior.

### Limpieza y acceso

Se agregan `Archivo.bytesReservados`, `Archivo.reservaHasta` y el estado `PURGANDO`. La purga reclama la fila antes de borrar el objeto; desde ese momento no se puede confirmar ni restaurar. Si falla el storage, queda el rastro para reintentar. Un multipart registra su identificador antes de firmar las partes, para poder abortarlo incluso ante un fallo de firmas.

Al cancelar se libera la cuota inmediatamente, pero se conserva la clave durante un día antes de la limpieza física: un PUT ya iniciado o una URL todavía vigente pueden terminar después de la cancelación. El contador mide la cuota funcional, no toda la ocupación física del bucket (papelera y limpieza diferida se contabilizan aparte). Debe conservarse la higiene programada y la política del bucket de abortar multipart abandonados como defensa ante caídas entre la creación remota y su registro local.

Una reducción del cupo no elimina archivos: las descargas y consultas existentes siguen disponibles. Se frenan nuevas incorporaciones que consuman espacio y restauraciones que no entren; un reemplazo que no aumente consumo sigue permitido. La UI distingue guardados, reservados y excedente.

### Alcance y siguientes pasos

Este cupo corresponde a los documentos de empresa registrados en `Archivo`. Avatares personales y pequeños recursos técnicos de integraciones (QR) conservan su gestión específica; no representan almacenamiento de documentos contratado. El diagnóstico de futuras versiones debe mostrar consumo confirmado, reservas y ajuste de empresa juntos, y resolver qué política tendrá un cambio de plan mientras hay cargas en curso.

No se publicaron planes ni se modificaron cuotas de empresas reales. Antes de venderlos faltan: cerrar controles por capacidad, versionar contratos, diagnosticar continuidad/cambios y definir almacenamiento, precios y cobro de adicionales.

### Verificación de este incremento

- 71 pruebas API en 5 suites: 21 casos nuevos de almacenamiento sobre PostgreSQL dedicado a pruebas, más cuotas, actividad, entidades y PDF durables. Cubre concurrencia, tamaño real, cancelación, vencimiento, aislamiento, papelera, reemplazo, fallo de storage y recuperación del multipart.
- 8 pruebas web en 2 suites: subida exitosa, errores, cancelación previa/durante inicio, detención de multipart y presentación del uso/excedente.
- TypeScript web/API, lint focalizado y control CSS sin globales nuevas.
- Migración `20260921200000_reservas_almacenamiento` aplicada en desarrollo y `gdi_saas_test`. API local reiniciada correctamente.
- La verificación visual con sesión quedó pendiente: la conexión a Chrome se interrumpió y el navegador integrado redirigió al login. No se alteró la autenticación para continuar. La vista tiene pruebas de renderizado automatizadas.

## Diagnóstico previo al cambio de plan — 21/09/2026

### Dónde se ve

Plataforma → Planes → Revisión → **¿Qué cambiaría en esta empresa?** compara la propuesta editada con el contrato y uso reales. Permite actualizar el diagnóstico y lo invalida al cambiar la propuesta. Es una foto con fecha de consulta; no constituye una autorización de asignación.

Cada propuesta distingue condiciones por resolver y revisiones de continuidad. Muestra las funciones que se incorporarían/retirarían y sus diferencias, los accesos activos, las invitaciones pendientes, los adicionales vigentes y el almacenamiento guardado y reservado por subidas en curso.

### Cupos

- Reutiliza `resumenCupoUsuarios`: invitaciones vigentes deduplicadas respecto de miembros activos. El cupo resultante conserva los adicionales ya otorgados. Si el borrador no admite esos adicionales exige definir su continuidad; no inventa nuevos cargos ni los elimina.
- Reutiliza `cupoAlmacenamiento`: los archivos guardados y las reservas vigentes ocupan espacio. Un ajuste positivo de empresa conserva prioridad sobre el plan y se señala para revisión. El cupo pendiente exige definición comercial, incluso si la empresa tiene un ajuste.
- Los excedentes exigen resolver cupos/ocupación antes de asignar; no desactivan personas ni borran datos. Las cargas en curso requieren actualizar la foto al finalizar.

### Continuidad

Se consultan conteos filtrados por empresa y sólo para funciones que alguna propuesta retiraría: reservas vigentes, necesidades sin consumir en OT no entregadas/canceladas, compras en borrador/emitidas/parciales, egresos pendientes/parciales, plantillas de gastos recurrentes activas, valores sin cierre, proyectos/campañas abiertos, avisos pendientes/en envío por canal y planes de entrega elegidos en presupuestos/OT abiertos.

Una función que sigue incluida no genera un aviso de retiro por tener operaciones abiertas. Los conteos no suman registros históricos cerrados como si fueran pendientes. Las plantillas recurrentes se muestran por activación; pueden tener una vigencia acotada que debe revisarse.

Los avisos explican qué gestión revisar. No enlazan directamente al módulo de empresa desde una sesión de Plataforma, para no abrir por error el contexto de otro tenant. Tampoco completan, cancelan ni transfieren operaciones.

La revisión manual sigue siendo explícita para las capacidades marcadas con revisión operativa en el catálogo que todavía no tienen detector, como exportación/recorridos de fabricación y MCP. La impresión exige revisar las colas con los operarios: el servidor no puede afirmar el estado físico de equipos o del spooler. Estos puntos no se presentan como automáticamente resueltos.

La lectura usa una transacción `RepeatableRead`; comparte la misma foto de contrato, ocupación y operaciones. No llama a pasarelas ni escribe suscripciones, borradores, tareas, cupos o archivos.

### Pendiente para asignar versiones comerciales

Publicar versiones inmutables del plan, establecer la política y fecha efectiva de transición, resolver cada revisión de continuidad y volver a validar bajo lock en el momento de asignar. Completar el desacople de capacidades y la sincronización comercial de adicionales/precios. La comparación por sí sola no publica ni concede capacidades nuevas.

### Verificación

Pruebas de PostgreSQL para ocupación real, deduplicación, reservas vencidas, ajustes, adicionales, aislamiento entre empresas, compras abiertas/cerradas y ausencia de escrituras. Pruebas de reglas puras para excedentes, cupos pendientes, adicionales no admitidos y continuidad. Pruebas de interfaz para datos enviados, invalidación por edición/respuesta tardía, lectura de los resultados, actualización y errores sin ofrecer asignación.

Cierre conjunto con MFA recordada: 56 pruebas API y 21 web, TypeScript API/web, lint focal y CSS correctos. Las 11 pruebas API de diagnóstico/comparación y las 5 de su interfaz pasaron. API local reiniciada; no se publicaron ni asignaron planes. Revisión visual autenticada pendiente por la pantalla de conexión fallida del navegador integrado.

## Revisión posterior del editor y Plataforma — 21/09/2026

Se completó un nuevo barrido del estado de las 65 capacidades y una revisión visual autenticada en Chrome. El estado actualizado, la matriz por función y el orden de cierre están en [Planes: estado real y camino de cierre](planes-estado-real-y-cierre-2026-09-21.md). Se unificaron controles, tablas y formularios de Plataforma y se dividió la ficha de suscripción en pestañas. Pasaron 40 pruebas de interfaz. Este incremento no publica ni asigna contratos nuevos.
