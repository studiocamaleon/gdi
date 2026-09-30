# Recuperación de Grafoprint

Diseño elegido: copias cada hora, cifradas antes de salir del ejecutor, en una cuenta independiente. Protección contra borrado por 30 días. **Todavía no hay un servicio de copias automáticas activado.** El control de esta carpeta comprueba el destino; no hace una copia ni demuestra una restauración.

## Separación de accesos

| Acceso | Puede hacer | No debe poder hacer |
| --- | --- | --- |
| Aplicación y sus workers | Operar sus datos y archivos habituales | Acceder al depósito o claves de recuperación |
| Ejecutor del respaldo | Leer la base y R2; escribir y revisar copias cifradas; extender protección de objetos referenciados | Escribir en la base de origen, borrar copias, administrar la cuenta o descifrar respaldos |
| Persona que restaura | Leer versiones exactas; acceder a las claves bajo custodia separada | Usar ese acceso diariamente desde la aplicación |
| Administrador del depósito | Configurar retención y accesos con MFA propio | Compartir la clave maestra con el ejecutor |

Propuesta de proveedor: Backblaze B2, con cuenta y recuperación separadas de Fly, Neon y R2. La elección horaria no reemplaza el alta de la cuenta, el consentimiento del titular ni la comprobación de costos y permisos reales.

## Antes de activar

1. Crear la cuenta independiente y configurar MFA y recuperación. Guardar sus códigos fuera de las cuentas principales. Crear un bucket privado distinto para cada entorno, con Object Lock en modo `compliance` y 30 días de retención por defecto. Esa protección no se puede acortar para los objetos ya retenidos; implica conservar y pagar su almacenamiento durante ese plazo.
2. Crear una clave del ejecutor limitada a ese bucket y al prefijo exacto `staging/` o `produccion/`. Capacidades requeridas: `listBuckets`, `readBucketRetentions`, `listFiles`, `readFiles`, `writeFiles`, `readFileRetentions`, `writeFileRetentions`. No conceder borrado, administración, enlaces públicos ni bypass. `writeFileRetentions` permite prolongar protección de objetos que siguen usando nuevas copias; no acorta una retención compliance vigente.
3. Preparar accesos de **sólo lectura** a R2 y PostgreSQL; acceso directo de Neon para exportar, usuario separado del migrador y del runtime. Comprobar permisos efectivos y tablas futuras. Conservar versiones necesarias de las claves de cifrado internas fuera del ejecutor.
4. Guardar la configuración del destino en un archivo privado fuera de Git (0600) y ejecutar, con Node 22 o superior:

   ```sh
   node --env-file=/ruta/privada/respaldo.env deploy/recuperacion/validar-destino.mjs
   ```

   El control rechaza cuenta/bucket/prefijo incorrectos, permisos administrativos, almacenamiento público, retención distinta de la acordada y reglas automáticas de borrado. Hace dos consultas al proveedor; no imprime claves ni respuestas. Un resultado correcto **no acredita independencia de los administradores ni de su custodia**, que se revisan por separado.
5. Implementar y ensayar el ejecutor antes de programarlo. Cifrado con herramienta mantenida; sólo clave pública de respaldo en el ejecutor. Directorio temporal privado, plazos de red, límites de disco, una ejecución a la vez y limpieza de temporales en caso de fallo. No usar la API ni los workers habituales como ejecutor.

## Qué debe contener cada copia completa

- Una exportación consistente de PostgreSQL, incluyendo migraciones. No exportar tablas por separado sin compartir la misma instantánea.
- Archivos nuevos/modificados y un manifiesto cifrado con **cada versión exacta** necesaria para esa base. Guardar identificador inmutable del proveedor, tamaño y SHA-256; el nombre del archivo solo no alcanza.
- Revisión de código e imágenes utilizadas, versión de PostgreSQL y herramientas, identificadores de las claves que necesita la recuperación. No adjuntar las claves privadas al mismo respaldo.
- Un registro de finalización escrito **al final**, tras comprobar que base, archivos y manifiesto quedaron almacenados y protegidos. Una ejecución incompleta nunca cuenta como copia exitosa.

Los archivos se copian de forma incremental. Si un archivo antiguo sigue referenciado por una copia nueva, hay que extender primero su protección hasta cubrir los 30 días de esa copia y comprobarlo. No aplicar una regla que elimine todos los objetos después de 30 días: rompería las copias nuevas que usan archivos antiguos. La limpieza requiere revisar referencias; mantenerla desactivada hasta ensayarla, medir crecimiento y definir alertas de costo.

La base y R2 no comparten una transacción. El ejecutor debe verificar que todos los archivos del estado exportado existen con el contenido esperado. Si falta alguno o cambió durante la copia, no publicar éxito: reintentar de forma acotada y alertar. Las restauraciones deben fijar los identificadores de las versiones protegidas; una versión posterior maliciosa no debe reemplazarlas.

## Ensayo y puesta en marcha

1. Subir objetos ficticios y comprobar la protección y el rechazo de borrado/modificación de retención con las credenciales previstas. No hacer ensayos destructivos sobre datos existentes.
2. Completar una copia real de staging y restaurarla en base y almacenamiento aislados. Deshabilitar correo, WhatsApp, cobros, facturación, cron y workers; no arrancar automáticamente la cola restaurada.
3. Validar datos, huellas de archivos, descifrado de secretos, dos empresas aisladas, ingreso/MFA y una operación de negocio. Registrar duración, punto de recuperación y errores. La clave equivocada o un archivo alterado deben fallar.
4. Programar cada hora sólo después del ensayo. Supervisar desde fuera del ejecutor la última copia **completa**, con alerta de fallo y de ausencia; propuesta inicial: más de 90 minutos sin copia nueva requiere atención. Medir duración para revisar ese umbral.
5. Ensayar periódicamente y antes de producción. Conservar además una copia cifrada desconectada y su procedimiento de custodia. Al recuperar tras un incidente, revocar accesos/sesiones anteriores y conciliar envíos y cobros antes de reanudarlos.

El objetivo inicial es perder como máximo alrededor de una hora más la duración del respaldo y recuperar el servicio en 4–8 horas con un volumen pequeño y operador disponible. **Son objetivos pendientes de medición, no garantías.** La estimación de USD 15–25/mes sólo corresponde al ejemplo pequeño de la comparación privada; el tamaño real, versiones retenidas, transferencia y cómputo cambian el costo.

Referencias: [Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock), [permisos de las claves](https://www.backblaze.com/docs/cloud-storage-application-key-capabilities), [autorización API v4](https://www.backblaze.com/apidocs/b2-authorize-account), [consulta de buckets](https://www.backblaze.com/apidocs/b2-list-buckets).
