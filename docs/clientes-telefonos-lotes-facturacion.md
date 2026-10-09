# Teléfonos de clientes e historial de facturación

## Alcance

El formulario público de autoregistro (`/alta-cliente/:token`) usa el mismo selector buscable de país, inicia el teléfono con el país de la empresa del enlace y envía un único teléfono internacional canónico. La API vuelve a validar con metadatos completos antes de crear la solicitud. Al aprobar, se separan código y número y se comprueban coincidencias tanto con registros anteriores como con los nuevos. El resto de los datos fiscales del autoregistro conserva su alcance actual argentino.

El alta interna de clientes inicia el país del teléfono y el país del cliente con la configuración regional de la empresa. Editar un cliente conserva su teléfono. El selector permite buscar cualquier país o prefijo; el campo nacional muestra sólo dígitos y permite pegar un teléfono internacional con espacios, paréntesis o guiones. Un internacional válido cambia también el país del selector. Los contactos adicionales usan el mismo control.

Formulario y API comparten `apps/api/src/common/telefono-cliente.ts`, una función pura basada en los metadatos completos de libphonenumber-js. Se guardan el código internacional y el número nacional por separado. Un teléfono vacío sigue siendo opcional; uno incompleto o ambiguo impide guardar. Las importaciones y el alta rápida por documento también validan los teléfonos que incorporan. No se corrigen registros existentes en bloque ni se recortan repetidamente dígitos para obtener un número aparentemente válido.

La conversión para WhatsApp usa ese mismo normalizador, con la política móvil argentina anterior. Si la columna número ya contiene un internacional válido, no agrega otra vez el código de país. Los errores de envío no incluyen el teléfono completo. No se reenvían automáticamente avisos de lotes que ya terminaron con observaciones.

## Facturación e historial

Facturación muestra únicamente los lotes propios en curso. El enlace «Historial de lotes» abre `/administracion/facturacion/lotes`, con resultados fiscales y envíos separados, detalle desplegable y páginas de veinte registros. Cada cursor se valida contra empresa y usuario. La campanita abre ese historial y expande el lote correspondiente, aunque no esté entre los veinte más recientes. Los enlaces anteriores a `facturacion?lote=…` redirigen al historial.

Un lote continúa activo mientras espera envíos. La revisión del proveedor WhatsApp mantiene su frecuencia actual de cinco minutos; emitir todas las facturas no implica que el proveedor ya haya confirmado todas las entregas. La vista lo explica. No se cambió el cron ni se adelantó la notificación de éxito.

## Verificación y publicación

Implementación en `codex/telefonos-clientes-historial-facturacion`, dependiente del PR #48. Validación local: normalización y persistencia de teléfonos, pegado/cambio de país en el control, aislamiento HTTP, listado activo, paginación de más de veinte lotes y enlaces de la campanita. La muestra `/dev/diseno/facturacion` sólo existe en desarrollo y usa datos ficticios sin llamadas a la API ni envíos.

Se comprueban los tipos de la web y de la API con su configuración de compilación. La configuración general de tipos de la API incluye tests antiguos con errores ajenos al cambio; la configuración de compilación los excluye. La caché de tipos de Next de ramas anteriores debe regenerarse con `next typegen` antes de validar la web.

Publicados en staging y producción el 08/10/2026 desde `00511a1e1ed932fc23112b7e75ad4583809337ce`, sin migración de base de datos. API, ambos workers y web usan esa revisión: el filtrado y la paginación del historial necesitan el contrato nuevo de la API. En staging se verificaron el país regional diferente, pegado internacional, rechazo del prefijo repetido, solicitud pública y aprobación, aislamiento, páginas de más de veinte lotes y recorrido desde campanita. En producción se comprobaron el autoregistro con Argentina por defecto, Facturación sin lotes terminados y el historial existente, sin crear clientes ni emitir o enviar facturas como prueba. Los registros operativos completos están en `deploy/staging/VALIDACION.md` y `deploy/produccion/VALIDACION.md`.

La paginación de veinte corresponde sólo al historial de lotes. Facturación y Comprobantes incorporan páginas de 25 registros y búsqueda en el servidor para encontrar también los registros que quedaban fuera de los límites anteriores de 500 y 200. Facturación conserva la selección entre páginas hasta 100 OT por lote. Ver [paginación fiscal](./paginacion-fiscal.md) y los registros de publicación por entorno.
