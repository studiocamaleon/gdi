# Conexión de WhatsApp por empresa

26/09/2026 · Rama `codex/meta-conexion-empresas` · Desarrollo local.

## Qué resuelve este bloque

Prepara la parte del servidor que recibe una autorización de Meta, comprueba a qué cuenta y número permite acceder y guarda la credencial cifrada para una empresa de Grafo. Separa la autorización de la activación del canal.

**Todavía no habilita conexiones reales.** `MetaConexionService` no tiene un controlador HTTP ni está registrado en el módulo. Ninguna variable de entorno activa por sí sola este recorrido. La bienvenida del Inbox conserva el botón deshabilitado. Esta separación evita iniciar un alta y desperdiciar la oportunidad de importar el historial antes de terminar los procesadores.

## Recorrido preparado

```text
Administrador de una empresa de Grafo
             ↓
Intento privado con vencimiento de 15 minutos
             ↓
Código de Meta → canje inmediato en el servidor
             ↓
Token cifrado mientras se comprueban los activos
             ↓
Meta confirma aplicación, permisos, cuenta y número
             ↓
Vínculo VERIFICADO, pendiente de activación
             ↓
[pendiente] Suscripción + contactos/historial + canal operativo
```

El plazo del intento de Grafo permite completar el recorrido. **No prolonga el código de Meta**, que debe canjearse dentro de 30 segundos. El futuro navegador enviará el código en cuanto lo reciba, sin esperar el evento que contiene los activos. Se implementará Embedded Signup v4 mediante una configuración de Facebook Login for Business; el alta real requiere HTTPS. [Implementación oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).

## Protecciones implementadas

- El intento pertenece a una empresa, persona, membresía y sesión determinadas. Un secreto aleatorio protege su continuidad; en la base sólo queda su hash. No se guarda el código de Meta.
- Se vuelven a comprobar sesión, empresa, usuario, rol, permiso e IP después de las llamadas externas. Se exige WhatsApp operativo en el plan para preparar, canjear y verificar. Una sesión de soporte, plataforma o MCP no puede autorizarlo.
- PostgreSQL decide qué petición puede canjear el código. Dos pestañas o peticiones simultáneas no producen dos canjes. Un resultado incierto exige una nueva autorización explícita.
- El token sólo se conserva cifrado con AES-256-GCM. No sale en respuestas ni errores. Los vencimientos se obtienen de Meta; no se supone que la credencial dure indefinidamente.
- El servidor consulta los números de la cuenta usando ese token. No confía en un ID enviado por el navegador ni sigue URLs arbitrarias de paginación. Si falta el ID del número y hay varios, pide resolver la ambigüedad.
- Para este recorrido se comprueba que el número esté en coexistencia y Cloud API. La primera versión reserva un número y una cuenta por empresa. Cambiar a otros activos exige un traslado explícito que todavía no se implementó.
- Los índices únicos impiden que una cuenta o número pertenezcan a dos empresas. Se contemplan asociaciones anteriores y el piloto. Descartar el vínculo borra la credencial, conservando la reserva para evitar atribuir eventos tardíos a otra empresa.
- Cancelar o comenzar otro intento invalida las respuestas que todavía estén en vuelo. Los intentos vencidos no se pueden continuar y su token se retira al acceder. Falta el barrido periódico para retirarlos aun sin nuevas visitas.

`VERIFICADO` no significa conectado: todavía no se suscriben webhooks, solicitan datos ni envían mensajes. Tampoco se modifica WATI ni se crea una integración operativa en `IntegracionTenant`.

## Qué falta antes de habilitar el botón

1. Conectar el modelo general y los procesadores de historial, contactos, ecos y cambios de cuenta con la lectura y los permisos del Inbox. La [base de recepción](meta-inbox-recepcion.md) quedó implementada el 26/09 y continúa desactivada.
2. Completar la activación vinculada al alta, medir límites y agregar métricas sobre la recepción duradera ya preparada; barrido de autorizaciones vencidas y reglas de conservación. Mantener el aislamiento también durante desconexiones y reconexiones.
3. Orquestación de suscripción, contactos e historial con estados persistidos. No repetir una solicitud de resultado incierto sin reconciliarla.
4. Controladores protegidos y adaptador del SDK v4: código inmediato, origen exacto de mensajes, intentos cancelables y estados comprensibles. Coordinar la desconexión con la ruta genérica de integraciones. Registrar dominios HTTPS y configuración en Meta.
5. Prueba integral en staging con una cuenta propia elegible y permisos disponibles. Validar renovación, revocación y desconexión desde WhatsApp Business. El descarte local de credenciales no revoca por sí mismo el permiso otorgado en Meta.
6. Envíos, archivos, estados y plantillas: siguen siendo requisitos antes de presentar el Inbox como una integración completa.

En coexistencia se omite registrar nuevamente el número. La sincronización inicial tiene una ventana de 24 horas y debe comenzar desde el servidor, antes de depender de que el cliente visite su bandeja. [Guía de coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).

## Configuración y verificación local

Variables previstas únicamente en el servidor: `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `META_GRAPH_API_VERSION` y la clave existente `INTEGRACIONES_ENCRYPTION_KEY`. No se agregaron valores reales ni secretos de staging a local.

Migración aditiva `20260926100000_meta_conexion_empresas`: tablas `MetaAutorizacion` y `MetaVinculo`, estados e índices únicos. Aplicada a `gdi_saas` y `gdi_saas_test`, ambas locales: 286 migraciones, sin seed ni reset. Permisos del rol local `grafo_app` comprobados.

Desde `apps/api`, con Node 24:

```sh
npx jest --runInBand --testPathPatterns='meta-conexion' --silent
NODE_OPTIONS=--max-old-space-size=3072 npx tsc -p tsconfig.build.json --noEmit --incremental false
```

Resultado: **52 pruebas nuevas aprobadas; 152 al incluir la regresión de Meta, webhooks e Inbox**. TypeScript del código de la API y ESLint de los archivos de implementación aprobados. El filtro reproducible del conjunto es `integraciones/meta/|webhooks-whatsapp/|inbox-tiempo-real/`; evitar `meta-` porque también coincide con el nombre absoluto de este worktree y seleccionaría pruebas ajenas al bloque.

La suite incluye contratos de Graph simulados y PostgreSQL real dedicado a tests. Sólo crea empresas ficticias y elimina las filas que creó. Rechaza bases remotas o cuyo nombre no termine en `_test`. Las pruebas bloquean llamadas reales a Meta. Se comprobaron canjes concurrentes, colisiones entre empresas, cancelaciones durante la red, permisos retirados, expiración, cifrado, renovación y conservación de propiedad tras desconectar. No reemplazan la prueba real de Embedded Signup.

Staging, producción, DNS y configuración de Meta permanecen sin cambios.

## Referencias de la implementación

Consultadas el 26/09/2026 en Meta Developers:

- [Alta como Tech Provider: canje en el servidor y pasos posteriores](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider).
- [Debug Token: aplicación, permisos, destinos y vencimientos](https://developers.facebook.com/docs/graph-api/reference/debug_token/).
- [Números pertenecientes a una cuenta y paginación](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/phone-number-management-api).
- [Credenciales de la aplicación, sólo entre servidores](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/#apptokens).

Las protecciones, estados y decisiones de almacenamiento anteriores son implementación de Grafo, no requisitos textuales de Meta.
