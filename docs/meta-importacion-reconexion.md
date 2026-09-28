# Estado del historial y reconexión de WhatsApp

26/09/2026 · `codex/inbox-importacion-reconexion` · Sólo local.

Base: `6e6909a4b`. Servidor y migración: `d542b83c6`. Interfaz: `1aa9b0094`.

## Qué ve el usuario

El botón **Conexión** del Inbox abre un panel con el número, el progreso que informó Meta y el trabajo de Grafo. La demo en `/dev/diseno/inbox/conversaciones` muestra el panel con datos ficticios y no consulta cuentas reales. La consulta operativa sigue reservada a administradores con acceso a Configuración.

| Estado | Significado |
| --- | --- |
| Preparando conexión | El servidor todavía prepara la recepción y las solicitudes iniciales. |
| Esperando a Meta | Las solicitudes fueron aceptadas; aún no llegó historial. |
| Recibiendo historial | Llegaron partes, pero no la señal de fin. |
| Procesando historial | Hay eventos recibidos que Grafo todavía debe procesar. |
| Datos recibidos procesados | Meta informó 100% y todos los eventos de historial recibidos hasta esta consulta fueron procesados sin incidencias conocidas. |
| Historial no compartido | Meta informó que el usuario no autorizó compartirlo. |
| Requiere revisión | Hubo un formato no soportado, un conflicto, un fallo definitivo o una solicitud inicial interrumpida. No se repite automáticamente el alta. |

**“Datos recibidos procesados” no certifica seis meses completos.** Meta no documenta un total esperado de mensajes/bloques para cotejar. Las fases vacías no envían eventos. Grafo no inventa faltantes por no ver las tres fases ni por asumir que los índices comienzan en un valor determinado. Conserva fase/orden y cuenta bloques únicos. Tampoco confunde los marcadores de archivos con archivos descargados.

El resumen se obtiene en una transacción de lectura consistente, limitado a empresa, vínculo y autorización actuales. Cuenta los trabajos de `history`, no el tráfico cotidiano. Una entrega tardía vuelve a mostrar “Procesando”; un bloque duplicado no aumenta el contador. No hay una espera arbitraria que transforme un silencio de Meta en una importación completa.

## Pausa temporal y desconexión definitiva

```text
Número verificado
   ├─ ACCOUNT_OFFBOARDED → Suspendido: conserva credencial y conversaciones
   │                            └─ ACCOUNT_RECONNECTED posterior
   │                                  → Verificado, si el acceso sigue vigente
   │                                  → NO solicita otra vez el historial
   └─ PARTNER_REMOVED → Desconectado: retira credencial, conserva conversaciones
                              └─ Nueva autorización explícita por Embedded Signup
```

Meta documenta la pausa/reconexión al cambiar de celular o registrar nuevamente WhatsApp Business. Conserva el acceso a la cuenta y las suscripciones; no vuelve a sincronizar el historial en esa restauración. Grafo mantiene el canal suspendido, conserva los eventos pendientes y continúa recibiendo avisos de cuenta. La reconexión despierta los trabajos detenidos sin consumir reintentos. No restaura una credencial vencida, eliminada ni una autorización de otra generación.

La lectura y el stream exigen `VERIFICADO`: durante la suspensión no entregan conversaciones. Los cambios de cuenta generan revisión duradera y aviso de Redis. La pantalla de conexión consulta el estado cada cinco segundos; al recuperar el canal, el botón Actualizar del Inbox permite volver a cargarlo.

Los eventos anteriores al alta o a un cambio posterior no modifican el canal. En igualdad de fecha, una pausa/revocación gana frente a una restauración. Un evento idéntico ya aplicado no vuelve a cancelar intentos nuevos. Si una pausa interrumpe un POST del alta inicial, ese trabajo queda en revisión: incluso si la cuenta reconecta durante la llamada, su respuesta tardía no avanza ni repite las solicitudes.

Para la **desvinculación definitiva**, el titular usa WhatsApp Business → Configuración → Cuenta → Plataforma empresarial → Desconectar cuenta. Grafo espera `PARTNER_REMOVED`. No utiliza `deregister` para coexistencia. Sólo después de esa confirmación ofrece una nueva autorización, siempre sujeta a los flags y capacidad del plan. La nueva alta verifica otra vez los activos, conserva los mensajes y mantiene la reserva del mismo número/WABA.

El método interno para descartar una preparación local sigue sin exponerse como botón. Retira la credencial, cancela intentos y detiene altas pendientes, con el mismo orden de bloqueos. Ese descarte no se presenta como revocación confirmada por Meta. Los eventos de cuenta pueden confirmar la desvinculación después; mensajes e historial no se procesan mientras está desconectado.

## Validación local

Migración aditiva `20260926170000_meta_ciclo_cuenta`: agrega el estado `SUSPENDIDO` y el último evento de cuenta. Aplicada a `gdi_saas` y `gdi_saas_test`, **289 migraciones**; cliente Prisma regenerado. Sin seeds, resets, cambios de secretos, reinicio de Docker ni despliegues.

Pruebas: fases ausentes, fin anticipado, entregas tardías, duplicados, rechazo de historial, formatos incompletos, suspensión, reconexión fuera de orden, empate de fechas, credencial vencida, revocación durante pausa, confirmación después de descarte local, alta interrumpida durante red y aislamiento de lectura. Los fixtures usan empresas/teléfonos ficticios y bloquean llamadas externas.

Resultado del lote: **309 pruebas de API y 61 de web**, TypeScript de API/web y ESLint de implementación. Revisión visual del panel en Chrome. App local en `http://localhost:3000`; los flags reales de Meta y los cron continúan apagados. No se realizó compilación productiva ni prueba de carga.

## Pendientes concretos

1. Validar en staging la autorización real del SDK y las suscripciones `account_update`, `history`, contactos y mensajes; luego ensayar coexistencia con un número propio elegible. La aprobación de Meta no sustituye estas pruebas.
2. Resolver con diagnóstico operativo las solicitudes inciertas o historiales en revisión. No existe un botón que garantice recuperar mensajes que Meta nunca entregó.
3. Medir carga, límite HTTP y convivencia con cálculos; agregar métricas y conservación de eventos.
4. Validar la ampliación local de [archivos privados](meta-inbox-adjuntos.md) con Meta/R2 reales y completar respuestas, plantillas, ventana de atención y permisos de agentes antes de habilitar el Inbox para clientes.

## Fuentes oficiales

Consultadas el 26/09/2026 en Meta Developers. El estado del servidor, los bloqueos, contadores y nombres de pantalla son decisiones internas de Grafo.

- [Coexistencia, historial, fases, medios y desvinculación](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
- [Reconexión tras cambio de dispositivo o nuevo registro](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/reconnect-offboarded-coexistence-clients), incluyendo su contenido original en inglés.
