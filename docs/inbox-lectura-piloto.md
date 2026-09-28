# Inbox: primera lectura conectada

Desarrollado en local el 25 de septiembre de 2026, en `codex/inbox-lectura`, sobre `codex/diseno-inbox`. No se desplegó en staging ni se modificó producción.

## Qué permite

El acceso **Inbox** del sidebar abre `/inbox` en otra pestaña, sin el sidebar de Grafo. Por decisión del 26/09 permanece visible para el rol autorizado, independientemente de la conexión, el plan o de tener mensajes. El botón de Configuración → Integraciones sigue siendo un atajo desde la recepción validada. Lee los mensajes guardados por el piloto: muestra los últimos 50 y permite cargar anteriores. Desde el 26/09 incorpora [actualización en tiempo real](inbox-tiempo-real.md), reconexión y respaldo, además de **Actualizar** y la consulta al volver a la pestaña.

El contexto se busca automáticamente por teléfono completo entre los clientes y sus contactos, dentro de la misma empresa. Una coincidencia muestra la ficha y las órdenes recientes permitidas. Varias coincidencias requieren elegir la ficha antes de mostrar sus órdenes; ninguna coincidencia indica que se debe registrar el teléfono en el cliente o contacto correspondiente. La selección es temporal y se vuelve a validar en cada consulta.

Esta entrega conserva el alcance del piloto: **un contacto autorizado, una empresa y acceso de administrador con `configuracion.gestionar`**. No habilita todavía el inbox para operadores ni la conexión de otras empresas.

El menú ya no consulta disponibilidad ni descarga mensajes/contactos. La ruta privada y la API conservan sus controles de sesión, permisos, plan y empresa aunque se conozca la URL. Mostrar el acceso no concede permisos sobre conversaciones.

Sin recepción configurada, la vista muestra una bienvenida y **Conectar WhatsApp**. El botón está deshabilitado con un aviso de disponibilidad futura porque el alta por empresa todavía no está implementada; no lleva a Wati ni simula autorizaciones. Un error de sesión/API conserva su estado de error y no se presenta como desconexión. Un piloto configurado sin mensajes mantiene la bandeja vacía. El endpoint de disponibilidad anterior se conserva por compatibilidad, sin consumidores en la web: su resultado no prueba la salud de Meta.

## Qué queda pendiente

- Conexión por empresa e importación de coexistencia: ver [diseño del historial de WhatsApp](meta-coexistencia-historial.md). Los seis meses no están importados ni habilitados por esta entrega.
- Respuestas reales y su historial de envío/entrega.
- Notas internas, responsables, resolución y contadores de lectura persistentes.
- Descarga y vista de adjuntos; por ahora se indica solamente su tipo.
- Presupuestos, saldos y otras acciones comerciales del diseño.
- Conversaciones de varios contactos y permisos propios del equipo de atención.
- Validación del conjunto en staging con el piloto real.

La muestra de diseño mantiene sus acciones simuladas por separado. La ruta privada `/inbox` no importa datos ni acciones ficticias.

## Cómo está conectado

1. `/inbox` valida la sesión, el cambio obligatorio de contraseña y los permisos. No admite impersonación.
2. El navegador consulta `GET /integraciones/meta/inbox` por el canal privado habitual de Grafo. La respuesta no se almacena en caché.
3. La API obtiene empresa de la sesión y teléfono/canal de la configuración del piloto. El navegador no puede elegir otra empresa ni otro número.
4. Los mensajes se filtran por empresa, cuenta de WhatsApp, número del canal y remitente autorizado. La paginación usa fecha más ID, también cuando dos mensajes tienen igual fecha. Un cursor ajeno se rechaza.
5. Se reutiliza `WhatsappContextoService`, con sus permisos de clientes y órdenes. No se reutiliza la ruta de la extensión Chrome ni su capacidad comercial.
6. Si falla la consulta, se retira la información anterior. Si cambia la empresa o usuario de la sesión, se pide volver a abrir desde la cuenta actual. Las respuestas tardías de consultas canceladas se descartan.

La lectura inicial no agregó migraciones ni credenciales. La ampliación de tiempo real agrega `20260926040000_inbox_revision` y reutiliza Redis. Requiere la tabla de mensajes del bloque previo de recepción. No agrega envíos a Meta.

## Cómo revisar sin conectar servicios

```sh
node scripts/preview-inbox.mjs
```

Abrir `http://127.0.0.1:3015/lectura`. Utiliza el componente real de lectura con un proveedor de datos ficticios: 53 mensajes, un cliente y una orden. No carga `.env`, no conecta con Meta ni con la API y no permite comprobar el login real. Los enlaces a fichas y órdenes no tienen destino en este servidor aislado. La raíz sigue mostrando el prototipo completo; `/abrir` muestra su acceso en nueva pestaña.

`/sin-conectar` muestra la bienvenida real con una respuesta ficticia sin conexión. No abre Meta ni solicita permisos.

Para probar con la aplicación local completa, seguir `docs/desarrollo-local.md`, mantener desactivadas las tareas programadas y usar únicamente sus accesos locales. No copiar credenciales de staging.

## Verificación realizada

- 57 pruebas de API: nueva lectura y controles HTTP, contexto por teléfono y regresiones de recepción.
- 22 pruebas de web: lectura, errores, cambio de identidad, paginación, respuestas tardías, tarjeta de acceso y protección de la ruta.
- TypeScript de web y API; ESLint del alcance web; guardia de CSS; diff sin errores de espacios.
- Ensayo en PostgreSQL local con 115 mensajes ficticios: historial completo sin saltos ni duplicados, separación entre empresas/canales/contactos, cursor ajeno rechazado, contacto secundario, coincidencias múltiples y piloto apagado.
- Chrome en escritorio y 390 × 844: historial por páginas, contexto, fecha de entrega, tema y último mensaje al entrar al chat móvil.

Revisión del acceso condicional del 25/09 (comportamiento reemplazado el 26/09): 26 pruebas de API y 31 de web aprobadas, incluyendo recepción sin comprobar, plan/permisos, fallo de consulta, cambio de identidad, respuesta tardía y enlace real del sidebar en nueva pestaña. TypeScript de web/API y ESLint del alcance también comprobados. No agregó migraciones ni llamadas a Meta.

Revisión del acceso permanente del 26/09: 45 pruebas de web aprobadas (sidebar sin consultas de conexión, plan, permisos, bienvenida, errores, sesión y lectura), TypeScript de la web, ESLint del alcance y guardia de CSS. Se retiró el hook que ocultaba el menú. Verificación visual local en escritorio y 390 × 844, con ambos temas. Este cambio sólo modifica UI/navegación; no habilita el alta real ni despliega staging.

El ensayo de PostgreSQL está en `apps/api/scripts/deploy/verify-meta-inbox.cjs`. Exige una base cuyo nombre termine en `_test` y coincida con `DEPLOY_DATABASE_NAME`; crea identificadores propios y elimina solamente esos datos al terminar. Usar `VERIFY_META_SOURCE=true` con `ts-node/register/transpile-only` para ejecutarlo desde fuentes. No ejecutarlo contra staging ni producción.

No se compiló la imagen de producción en la Mac. Antes del despliegue agrupado faltan la compilación remota, revisión del PR con la base correcta y comprobación con sesión/piloto real en staging. Registrar ese futuro despliegue en `deploy/staging/VALIDACION.md`.
