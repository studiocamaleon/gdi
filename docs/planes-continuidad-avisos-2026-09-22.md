# Continuidad de planes: avisos y resultados sin confirmar

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Comportamiento

| Situación | Resultado |
| --- | --- |
| Se crea un aviso mientras un cambio de plan retiraría su canal | No se encola. La operación comercial que lo originó puede concluir |
| El aviso ya estaba en cola antes del cambio pendiente | Puede terminar mientras el contrato vigente conserve el canal; sigue contando como compromiso abierto |
| El contrato cambia mientras se consultan plantillas de Wati | Se vuelve a validar antes de autorizar el envío. Si ya no está permitido, no se hace el POST |
| Se corta el proceso antes de autorizar el envío | La preparación puede volver a la cola, con un token nuevo |
| Wati no confirma si recibió el envío | Queda **Por confirmar**, sin reenvío automático |
| Llega la confirmación de un envío autorizado antes de una baja | Se conserva el resultado, sin abrir un nuevo envío |
| Un administrador verifica el resultado fuera de Grafo | Puede confirmar el aviso enviado o descartarlo, indicando el motivo |
| Se retira Wati o WhatsApp Web del plan | El historial sigue disponible con permiso de consulta; no habilita nuevos avisos |
| La empresa está en sólo lectura | Conserva el historial, sin acciones manuales de resolución |

La contratación pendiente contempla `enviando`, `checkout` y `verificar`, incluso si venció la revisión. Una ampliación sin confirmar no otorga permisos nuevos.

## Implementación

- Encolado y cambios de configuración/eventos toman primero el lock del contrato. Activar un canal o crear un aviso comprueba también si hay una contratación pendiente que retiraría la función. Pausar/desactivar no requiere conservar el canal pago.
- La cola conserva el canal original de cada aviso. Cambiar la configuración no mueve mensajes entre Wati y WhatsApp Web.
- Wati distingue `wati_reservada` (preparación), `enviando` (POST autorizado) y `wati_incierta`. El scheduler recupera sólo preparación; un envío abandonado se marca incierto. Los intentos usan un token propio para que un proceso anterior no sobrescriba otro resultado.
- Las transacciones no permanecen abiertas durante llamadas externas. La autorización se guarda antes de la red. Una respuesta perdida o una caída de la base después del POST no provoca un reenvío automático.
- La prueba de envío Wati también persiste su autorización y resultado; informa la incertidumbre al cliente de API y dirige al historial antes de repetir una prueba.
- La reserva e inicio de WhatsApp Web vuelven a comprobar el contrato dentro de sus transacciones. Su confirmación conserva la autorización previa, aunque después se retire el canal.
- El diagnóstico de cambio de plan cuenta mensajes pendientes, reservados, enviándose e inciertos de ambos canales. Se excluyen los estados cerrados.
- `POST /integraciones/notificaciones/:id/resolver` exige rol administrador, permiso de gestión, empresa operativa, estado esperado y motivo. No permite cerrar un envío todavía en curso. Guarda la resolución y un `EventoSistema` con actor real (incluida impersonación) en la misma transacción. Una resolución anterior o de otra empresa no se puede sobrescribir.
- **Configuración → Integraciones → Historial de avisos** permite consultar ambos canales, filtrar por **Por confirmar** y resolver con el diálogo Grafo. Se muestra también cuando los canales ya no están incluidos en el plan.

No hay cambios de estructura de base en este incremento. La documentación del campo de estado se actualiza para reflejar los estados nuevos; continúa siendo texto.

## Evidencia

Las escrituras de prueba utilizan `gdi_saas_test` y datos sintéticos. Los transportes Wati y de la extensión son dobles de prueba; no se enviaron WhatsApps reales.

- **69 pruebas en cinco suites:** contratos asignados y pendientes, encolado, autorización, prueba Wati, historial HTTP, validación y permisos de resolución, token sustituido, recuperación del scheduler, respuestas ambiguas/rechazos del cliente Wati y WhatsApp Web. Incluyen 19 casos en `planes-avisos.integration.spec.ts`.
- **22 pruebas de concurrencia en `compras-cambio-plan.integration.spec.ts`:** cuatro nuevas enfrentan encolado Wati/Web y asignación administrativa de plan en ambos órdenes. Usan conexiones PostgreSQL independientes y observan la espera con `pg_blocking_pids`. Las otras 18 mantienen la regresión de Compras, finanzas, campañas y reservas.
- **42 pruebas de regresión en seis suites:** contexto, reseñas, comprobantes, ventana horaria, catálogo de consentimiento y avisos de órdenes Web. Parte de estos casos usa dobles de servicios o reglas puras; no sustituyen las pruebas de contrato con persistencia.
- **3 pruebas web:** acceso histórico sin canales pagos, resolución con estado esperado/motivo y ausencia de acciones en sólo lectura.
- TypeScript de producción API y web, tipos de los escenarios de prueba, lint focal API/web y `git diff --check` aprobados. Una ejecución de integración excedió inicialmente el límite de 5 segundos mientras corrían verificaciones pesadas; la ejecución posterior pasó con el mismo límite, sin modificarlo.
- Recorrido autenticado en Chrome: entrada desde Integraciones, historial con registros, filtros, identificación de WhatsApp Web, apertura del modal, guardado deshabilitado sin motivo y cancelación. No se modificaron avisos del usuario. La resolución persistida se verificó en HTTP/base de pruebas.
- API local reiniciada con el código nuevo; catálogo público de planes, login y backoffice responden HTTP 200.

## Límites y continuidad

La autorización previa a un POST no demuestra entrega al teléfono: **enviada** conserva la semántica de aceptación/confirmación del canal. Un resultado ambiguo necesita verificación humana; no se deduce un fracaso por el tiempo transcurrido. La resolución manual registra lo que verificó el administrador, no consulta automáticamente el chat.

Este bloque no certifica rendimiento masivo ni un nuevo recorrido con Wati o la extensión reales. Tampoco resuelve la recuperación de un cobro Paddle incierto: es un flujo distinto. La cobertura del catálogo permanece parcial.

Siguientes frentes del objetivo general:

1. Consulta histórica financiera después de retirar módulos y continuidad de los demás automatismos de producción/lotes.
2. Combinaciones restantes del editor, CAD y recorridos de navegador sobre contratos asignados.
3. Recuperación administrativa de contrataciones inciertas sin referencia confirmada, sin repetir cobros ni liberarlos por una consulta vacía.
4. Preparación comercial de producción y precios anuales cuando se definan. Los pagos externos probados siguen siendo exclusivamente de sandbox; el túnel permanece cerrado.

Antecedentes: [reservas y planificación](planes-continuidad-reservas-planificacion-2026-09-22.md), [estado general](planes-estado-real-y-cierre-2026-09-21.md), [contratación sandbox](planes-cierre-comercial-2026-09-21.md).
