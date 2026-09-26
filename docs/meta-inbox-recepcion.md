# Recepción de conversaciones de Meta

26/09/2026 · Rama `codex/meta-historial-recepcion` · Desarrollo local.

## Qué quedó preparado

Grafo puede conservar y procesar los eventos documentados de coexistencia: historial, contactos, mensajes enviados desde el celular, entradas nuevas, estados, ediciones, eliminaciones y desconexiones. Este documento registra el bloque inicial de almacenamiento y procesamiento. Los bloques siguientes ya incorporan [alta](meta-conexion-empresas.md), [lectura general](meta-inbox-lectura-general.md) y [estado del historial y reconexión](meta-importacion-reconexion.md), todavía deshabilitados para uso real.

```text
Meta entrega un evento
          ↓
La API comprueba su firma
          ↓
Guarda el original + trabajo pendiente, en una misma transacción
          ↓
El worker existente procesa hasta 50 operaciones por lote
          ↓
Guarda conversaciones + avance + revisión, juntos
          ↓
Redis avisa del cambio a los procesos que sirven el Inbox
```

PostgreSQL conserva la cola y el cursor para retomar después de un reinicio. Los bloqueos permiten ejecutar más de un worker sin aplicar el mismo lote simultáneamente. Redis acelera los avisos; su caída no elimina trabajos ni mensajes. El transporte de tiempo real ya tenía respaldo mediante revisiones de PostgreSQL, pero sus permisos y la lectura de la interfaz siguen limitados al piloto: falta conectarlos al canal general.

## Comportamientos comprobados

- **Separación por empresa:** se usa el vínculo comprobado de cuenta y número. Los eventos sin asociación válida quedan crudos, fuera de la bandeja. Las claves de base impiden relacionar un mensaje o contacto con el vínculo de otra empresa.
- **Duplicados y orden:** un `wamid` identifica un mensaje dentro del vínculo. Las reentregas no duplican mensajes; los bloques pueden llegar desordenados. Los estados de entrega no retroceden.
- **Historial:** conserva la fecha original, entradas y salidas. No genera notificaciones ni abre por sí solo una ventana de atención. Una entrada nueva válida registra su fecha por separado; aún falta aplicar las reglas completas en el envío general.
- **Adjuntos:** guarda sus referencias y completa el mensaje aunque lleguen antes que su marcador. El complemento no cambia su dirección ni fecha. La ampliación de [adjuntos privados](meta-inbox-adjuntos.md) agenda su copia en un bucle independiente; no hace descargas durante la proyección del mensaje ni crea enlaces públicos permanentes.
- **Ediciones y eliminaciones:** conserva cambios que llegan antes del original. Un historial atrasado no recupera el contenido de un mensaje eliminado. El original crudo permanece según la política de conservación todavía pendiente.
- **Contactos:** mantiene nombres y eliminaciones con su fecha. No crea ni elimina clientes fiscales en Grafo.
- **Recuperación:** un fallo revierte todo el lote, incluido el avance. Reintenta con espera creciente; al sexto fallo o ante una identidad contradictoria requiere revisión. Los errores almacenan códigos internos, no contenido ni credenciales.
- **Desconexión:** da prioridad a los avisos de cuenta, retira el token y pausa los trabajos. Un evento anterior al alta actual no la cancela. Actualizado en el bloque de [reconexión](meta-importacion-reconexion.md): una pausa temporal conserva el acceso y puede restaurarlo con un evento posterior, sin repetir el historial. Una revocación definitiva exige una nueva autorización.

## Avance y límites

`InboxImportacion` registra el progreso informado por Meta, rechazo explícito y necesidad de revisión. `InboxBloqueHistorial` conserva fase y orden de cada bloque aplicado. **Progreso 100 significa que Meta informó el final; todavía no equivale a una importación reconciliada y completa.** La [ampliación de estado](meta-importacion-reconexion.md) ya coteja la cola recibida, contempla eventos tardíos y presenta el resultado sin inventar un total de bloques ni garantizar datos que Meta no entregó.

Hay una distinción entre el evento crudo y su trabajo: la proyección anterior del piloto puede marcar un crudo como procesado; la recepción general usa su propio estado y cursor. No toma aquel indicador como prueba de que ya incorporó el evento.

El parser normaliza texto, referencias de medios y respuestas básicas de botones/listas. Conserva otros tipos en el crudo y los señala para revisión. No es soporte completo de todos los tipos de mensaje de Cloud API.

La prueba del parser cubre 3.000 mensajes; la de PostgreSQL comprueba varios lotes y reinicio. **No es una prueba de carga productiva.** El límite HTTP actual de 3 MB, los proxies, el tiempo de confirmación y la memoria deben medirse antes del alta real. El worker procesa en serie hasta diez lotes por ciclo y comparte proceso con cálculos: medir interferencia y capacidad antes de ampliar volumen.

## Activación y siguientes pasos

La variable nueva `META_INBOX_RECEPCION_ENABLED` queda desactivada por defecto. Tanto API como worker tendrán que usarla. Además, cada vínculo requiere una autorización vigente y `recepcionDesdeEl` establecido por la orquestación del alta. Verificar activos, por sí solo, no establece esa fecha. No establecer esa fecha manualmente para eludir el recorrido de alta.

En desarrollo, `GRAFO_LOCAL_DISABLE_CRON=true` con `NODE_ENV=development` también impide arrancar este bucle automático. Las pruebas invocan el procesador directamente con datos ficticios en la base de tests. No se habilitaron variables reales, solicitudes, suscripciones ni conexiones nuevas a Meta.

Actualización del mismo día: la [orquestación, el SDK y los estados de alta](meta-conexion-empresas.md) y la [lectura general con SSE](meta-inbox-lectura-general.md) ya están implementados y continúan deshabilitados. Los puntos 1/2 y la presentación de estados de 3 quedaron cubiertos; sigue pendiente reconciliar importaciones y validar el recorrido real.

Plan de integración:

1. Orquestar suscripción y solicitudes de contactos/historial, con resultados persistidos y recuperación de respuestas inciertas; preparar la recepción antes de solicitar datos. La guía de Meta establece una ventana inicial de 24 horas y restricciones de repetición por alta.
2. Conectar el SDK v4 y los controladores protegidos con Configuración e Inbox. Ampliar lectura, paginación y autorización de tiempo real a las conversaciones generales.
3. Mostrar importación en curso, historial no compartido y situaciones que requieren atención; reconciliar progreso y mensajes faltantes.
4. Validar la descarga privada de archivos en staging; completar tipos pendientes, envío, plantillas, conservación, barrido de autorizaciones y observabilidad.
5. Probar el conjunto en staging con un número propio elegible y los permisos disponibles. Las pruebas locales no sustituyen ese recorrido real.

## Verificación reproducible

Migración aditiva `20260926110000_meta_inbox_recepcion`, aplicada sólo a `gdi_saas` y `gdi_saas_test` locales: 287 migraciones. Sin seed ni reset. Tablas nuevas: `InboxTrabajoEvento`, `InboxImportacion`, `InboxBloqueHistorial`, `InboxConversacion`, `InboxMensaje`, `InboxContacto`.

Resultado: **55 pruebas nuevas; 229 aprobadas al incluir Meta, webhooks, tiempo real, aislamiento y snapshots**. TypeScript de la API y ESLint de los archivos de implementación aprobados. Permisos de lectura/escritura del rol local `grafo_app` comprobados sobre las seis tablas nuevas. Web y API responden en sus puertos habituales.

Desde `apps/api`, con Node 24 y hasta 3 GB para las comprobaciones, ejecutar en serie:

```sh
NODE_OPTIONS=--max-old-space-size=3072 npx jest --runInBand --testPathPatterns='integraciones/meta/|webhooks-whatsapp/|inbox-tiempo-real/|prisma/__tests__/tenant-guard|prisma/__tests__/aislamiento-tenants|prisma/snapshots.extension.integration' --silent
NODE_OPTIONS=--max-old-space-size=3072 npx tsc -p tsconfig.build.json --noEmit --incremental false
```

La ampliación del esquema excedió la unión de tipos que Prisma generaba para el guard de empresa. Se pasó al callback global de consultas, manteniendo los filtros y dejando pasar consultas sin modelo como antes. Se incluyen las pruebas existentes de aislamiento y snapshots; el escáner estático excluye también los fixtures `.spec.ts` colocados junto al código, como ya excluía `__tests__`.

Staging y producción no se modificaron.

## Fuente

[Guía oficial de coexistencia de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), consultada el 26/09/2026 en inglés. Los campos y eventos siguen sus ejemplos; los lotes, tablas, prioridades y reintentos son decisiones internas de Grafo.
