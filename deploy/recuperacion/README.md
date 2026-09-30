# Recuperación de Grafoprint

**Estado operativo del 30/09, desde las 11:00 UTC: nuevas copias pendientes de normalización.** El monitor detectó un fallo posterior a los ensayos exitosos descritos debajo. La última copia completa verificada es de las 10:42 UTC. Consultar el estado vigente en [VALIDACION.md](../staging/VALIDACION.md); los ensayos anteriores no acreditan que la copia más reciente esté protegida.

**Staging: ejecutor activado y horario comprobado el 30/09/2026.** Copias al arrancar y después en cada cambio de hora UTC, cifradas antes de salir del ejecutor, en una cuenta independiente y protegidas contra borrado durante al menos 30 días. La copia realizada desde Fly se recuperó con las claves de las cuatro notas cortas del titular: base, archivos, fuentes y comprobante firmado; la API recuperada pasó ingreso con MFA, operación y aislamiento entre empresas. Healthchecks recibió las señales reales y avisa por fallo o tras 90 minutos sin confirmación. Se comprobó el reinicio tras una interrupción en plena copia y la reutilización de los archivos sin cambios. Las ejecuciones de las 07:00, 08:00 y 09:00 UTC terminaron automáticamente. Tras el despliegue de seguridad se actualizaron revisiones e imágenes y se comprobó otra copia: 299 migraciones, 13 archivos y cuatro fuentes exactas, con firma y huellas correctas. Ver versión, evidencia y límites en [VALIDACION.md](../staging/VALIDACION.md) y procedimiento en [OPERACION.md](OPERACION.md).

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

   `lib/lector-postgres.mjs` crea exclusivamente un rol nuevo y limita sus permisos a lectura de tablas/secuencias actuales y futuras del dueño indicado. Comprueba base/dueño, rechaza objetos de otros dueños/esquemas y revierte toda la transacción si hereda escritura, DDL o funciones privilegiadas. No cambia `PUBLIC`, roles existentes ni contraseñas anteriores. En PostgreSQL 16 habilita temporalmente al dueño para asumir el nuevo lector durante la comprobación y revoca esa concesión antes de confirmar. Ejecutar con el dueño sólo durante el aprovisionamiento; no entregar esa credencial al copiador.
4. Guardar la configuración del destino en un archivo privado fuera de Git (0600) y ejecutar, con Node 22 o superior:

   ```sh
   node --env-file=/ruta/privada/respaldo.env deploy/recuperacion/validar-destino.mjs
   ```

   El control rechaza cuenta/bucket/prefijo incorrectos, permisos administrativos, almacenamiento público, retención distinta de la acordada y reglas automáticas de borrado. Hace dos consultas al proveedor; no imprime claves ni respuestas. Un resultado correcto **no acredita independencia de los administradores ni de su custodia**, que se revisan por separado.
5. Preparar y ensayar el ejecutor descrito abajo antes de programarlo. Cifrado con herramienta mantenida; sólo clave pública de respaldo en el ejecutor. Directorio temporal privado, plazos de red, límites de disco, una ejecución a la vez y limpieza de temporales en caso de fallo. No usar la API ni los workers habituales como ejecutor.

## Ejecutor manual preparado

`ejecutar.mjs` sólo habilita staging. No crea recursos, no instala un horario y no modifica la base ni los archivos de origen. Sus dependencias están aisladas de las de la aplicación en el `package-lock.json` de esta carpeta. Requiere Node 22+, `age` (ensayado con 1.3.2), `pg_dump` 16 y certificados raíz del sistema. Ambos accesos PostgreSQL validan TLS y nombre de servidor; usar el host directo de Neon, sin `-pooler`.

1. Instalar las dependencias en el ejecutor separado: `npm ci --ignore-scripts --prefix deploy/recuperacion`. Instalar `age` desde su distribución oficial verificada y el cliente PostgreSQL 16 desde una fuente confiable.
2. Copiar `configuracion.example.json` **fuera de Git**, con permisos 0600 y directorio 0700. Usar rutas absolutas sin enlaces simbólicos. Completar accesos exclusivos de lectura a la base y al bucket R2. El endpoint jurisdiccional US termina en `.us.r2.cloudflarestorage.com`.
3. Completar revisión Git e imágenes **realmente desplegadas**, con digest `@sha256:…`. En `idsClavesInternas`, registrar sólo nombres de las versiones de claves de integración/MFA que están bajo custodia; nunca los secretos. Actualizar estos datos con cada despliegue o rotación. El script no consulta Fly ni acredita esa custodia por sí mismo.
4. La identidad privada de `age` se guarda en otro lugar controlado para recuperar. En el ejecutor sólo se carga su destinatario público (`recipient`). Verificar que se pueden recuperar la identidad privada, los recibos y las claves internas aunque Fly, la computadora de trabajo o sus cuentas principales no estén disponibles. **Perder la identidad privada impide descifrar los respaldos.**
5. Sólo después de comprobarlo, marcar `accesoOrigenSoloLecturaVerificado` y `custodiaVerificada`. Son constancias de revisión, no controles automáticos sobre la custodia o los permisos R2. El programa sí rechaza roles PostgreSQL con permisos de escritura, propiedad, membresías adicionales o funciones privilegiadas accesibles. Verificar concesiones para tablas futuras.
6. Ejecutar `node deploy/recuperacion/ejecutar.mjs /ruta/privada/configuracion.json`. No pasar claves como argumentos de consola. Guardar el recibo `recibo-<id>.json` fuera del ejecutor junto con el registro de recuperación: fija las versiones y huellas, y permite detectar la sustitución de una copia.

El motor exporta la base con `pg_dump` y una instantánea compartida con la consulta de archivos requeridos. Incluye toda la base y migraciones; inventaría **todo el bucket R2**, incluidos fotos de perfil y QR que no figuran en `Archivo`. Verifica los documentos `LISTO` y `ELIMINADO` y las fotos de perfil referenciadas. Registra los otros estados; las subidas `PENDIENTE` y purgas en curso requieren conciliación al recuperar, sin reactivar automáticamente sus trabajos.

La exportación y cada objeto se cifran por streaming; no se guardan temporales con datos originales al copiar. El índice incremental local tiene permisos 0600 y contiene metadatos privados. Perderlo provoca una copia completa de archivos; cambiar origen o destinatario de cifrado también impide reutilizarlo. Al reutilizar un objeto se verifica su versión y se extiende su protección. Base, manifiesto y cierre se guardan nuevos en cada ejecución. Los objetos de ensayo se separan bajo `staging/ensayos/`; no cuentan como backups operativos.

Límites de esta versión: una ejecución a la vez, máximo 45 minutos, 4 GiB por archivo o exportación, 100.000 objetos y manifiesto de 32 MiB. Superarlos produce fallo, nunca truncamiento. Antes de cifrar se comprueba espacio libre; procesar archivos uno por uno limita el disco temporal. Una interrupción normal limpia temporales y libera el bloqueo. Si el proceso muere abruptamente, el siguiente intento se detiene: comprobar que no siga ejecutándose antes de retirar su bloqueo/temporales. No hay reintento ilimitado ni limpieza remota automática.

Los objetos quedan protegidos hasta 30 días después del límite de ejecución (hasta 45 minutos extra respecto del comienzo). Esto asegura cobertura del cierre aun si la copia tarda. La recuperación valida SHA-256 de cada cifrado y del contenido original, además de la autenticación de `age`. Los nombres públicos en B2 son identificadores aleatorios; nombres, claves R2 y manifiestos están cifrados.

## Preparar una recuperación sin activar servicios

`recuperar.mjs` exige una clave B2 de **sólo lectura**, limitada al mismo bucket/prefijo: `listBuckets`, `readBucketRetentions`, `listFiles`, `readFiles`, `readFileRetentions`. No reutilizar el acceso de escritura del copiador en la configuración permanente de restauración.

Copiar `recuperar.example.json` a un directorio privado separado, completar el recibo conservado bajo custodia, la identidad privada y el acceso lector. Ejecutar `node deploy/recuperacion/recuperar.mjs /ruta/privada/recuperar.json`. Se crea una carpeta nueva con `base.dump`, archivos de nombres locales neutros, manifiesto y `archivos-verificados.json` que vincula cada archivo con su clave R2. No se extraen rutas proporcionadas por el contenido. Ante fallo se elimina esa recuperación parcial. La herramienta **no ejecuta SQL, no sube a R2 y no arranca servicios**.

`VERIFICADO.json` sólo acredita datos descargados y descifrados. Luego restaurar en una base y bucket **nuevos**, aislados, con versiones compatibles. Reconstruir roles/permisos desde infraestructura revisada: el dump excluye ownership y ACL, no contiene roles globales. Los secretos de entorno, DNS, imágenes y claves privadas se recuperan por el procedimiento separado. No conectar la aplicación hasta desactivar sus integraciones externas, invalidar sesiones y conciliar las colas.

## Comprobaciones del programa

`npm test --prefix deploy/recuperacion` comprueba permisos, destinos y controles sin acceder a cuentas reales. Para incluir cifrado real, definir `ENSAYO_AGE_BIN` y `ENSAYO_AGE_KEYGEN` con rutas absolutas a las herramientas verificadas. Sin ellas se muestran como omitidos los ensayos que las requieren.

`ENSAYO_POSTGRES=1` habilita un ensayo adicional contra el contenedor **ya existente** `gdi-saas-postgres`, puerto local 5436. Sólo crea y elimina sus bases y rol aleatorios `qa_backup_…`, con datos completamente ficticios; no reinicia Docker. Prueba una escritura concurrente para comprobar la instantánea, permisos efectivos de sólo lectura, dos empresas, migraciones, cuatro archivos, reutilización y restauración. Usa un esquema pequeño de ensayo y un origen R2 simulado: no acredita la recuperación funcional de la aplicación completa.

Únicamente si se agrega `ENSAYO_B2_CONFIG=/ruta/privada/b2.json`, ese ensayo escribe datos **ficticios** en B2 real, bajo `staging/ensayos/`, con el acceso limitado ya verificado. Esos objetos cifrados quedan retenidos; no se intentan borrar. El ensayo no usa datos de Neon/R2 de staging ni activa un horario. Resultado del 30/09/2026: dos copias, cuatro archivos reutilizados en la segunda, recuperación de la primera desde versiones exactas y base consistente pese a la escritura concurrente; recorrido completo de ensayo en aproximadamente 25 segundos. **No es una medición de RTO/RPO de staging.**

### Primera recuperación de datos reales del entorno staging — 30/09/2026

Ensayo manual separado bajo `staging/ensayos/`: exportación consistente de PostgreSQL, cifrado local y copia protegida de los 13 objetos de R2. Se recuperaron desde B2 con el lector exclusivo, comprobando hashes de cifrado/contenido y la identidad `age`. PostgreSQL se restauró en una base nueva con un dueño sin privilegios elevados: 213 tablas, 298 migraciones con sus checksums y 1.588 filas. Se comprobó el descifrado de los dos valores internos presentes en las cinco columnas cifradas revisadas. No se iniciaron API, workers ni integraciones; el rol de restauración quedó sin login al terminar.

La copia tomó unos 70 segundos; descarga, descifrado y restauración inicial de datos, unos 13 segundos. Son medidas de este conjunto pequeño y de este ensayo local; **no equivalen a tiempo de recuperación del servicio completo ni garantizan RTO/RPO**. La base recuperada contiene una sola empresa. En el ensayo funcional posterior se agregó una segunda empresa exclusivamente dentro de la recuperación aislada y se comprobó la denegación de acceso a datos ajenos. Las evidencias y el kit con secretos/comprobante permanecen fuera de Git. No se modificó el entorno local de desarrollo ni se activó programación.

La primera tentativa detectó una diferencia de precisión de fechas en R2 y no publicó cierre de copia. Los objetos ya cifrados de esa tentativa permanecen retenidos. El caso se reprodujo en un test: el listado incluye milisegundos, mientras `Last-Modified` de GET/HEAD utiliza segundos. La comparación ahora usa esa precisión HTTP, manteniendo ETag y tamaño exactos y la fecha completa del inventario para decidir reutilización. Fechas ausentes/inválidas, otro segundo o ETag distinto siguen rechazándose. Referencias: [compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/) y [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html).

Regresión posterior: 106 pruebas aprobadas, con `age` y PostgreSQL locales reales; sin omisiones ni nuevo ensayo cloud sintético.

### Ensayo funcional, código y avisos — 30/09/2026

La API de la revisión realmente desplegada se inició contra la base recuperada y un almacenamiento de disco separado. El sandbox del sistema operativo negó conexiones externas: se permitió exclusivamente acceder a sus servicios locales. Cron y workers desactivados; sesiones anteriores revocadas sólo en la copia. No se cambiaron contraseñas de los usuarios de staging: el ensayo creó identidades QA en la copia y utilizó allí el secreto MFA restaurado.

Se comprobó ingreso con MFA, lectura de un cliente recuperado, creación/lectura de un cliente nuevo, 401 sin sesión y 404 desde una segunda empresa. Un adjunto de cliente pasó por la ruta autenticada de archivos; los 13 objetos recuperados se abrieron mediante URLs firmadas del almacenamiento aislado y coincidieron sus huellas. Los adjuntos de Inbox usan una ruta propia: no se ensayó su pantalla ni se renovó Meta. Al terminar, el usuario SQL de ese ensayo quedó sin login y se detuvo únicamente el Redis temporal creado para esta prueba.

Se guardaron en B2 dos archivos cifrados con el código exacto de backend y web; se descargaron con el lector, descifraron y verificaron sus hashes y contenido necesario para reconstruir. `artefactos` fija esas versiones en cada manifiesto y prolonga su retención junto con los datos.

La custodia de recibos usa Ed25519 mediante `node:crypto`. La clave pública se conserva en el kit; la privada de firma vive en el ejecutor y no permite descifrar. `comprobantes.mjs` lista versiones y recupera una raíz firmada por `fileId`. Rechaza cambios, otro firmante, entorno o propósito. Antes de avisar éxito, el copiador vuelve a descargar y verificar el comprobante que acaba de guardar en B2.

Healthchecks gratuito quedó conectado al correo del titular. Se ensayó ausencia con período y tolerancia de un minuto, observando estado caído y entrega de correo informada por el proveedor; también aceptó la señal explícita de fallo. Después se restablecieron una hora y 30 minutos. No se atribuye lectura humana del correo. El monitor permanece identificado como ensayo hasta activar el copiador.

Regresión de este lote: 117 pruebas aprobadas, sin omisiones, incluyendo PostgreSQL y `age` reales. Imágenes de Node/PostgreSQL fijadas por digest y archivo oficial de `age` verificado por SHA-256. El contenedor se construye en remoto; su arranque operativo todavía debe verificarse.

## Qué debe contener cada copia completa

- Una exportación consistente de PostgreSQL, incluyendo migraciones. No exportar tablas por separado sin compartir la misma instantánea.
- Archivos nuevos/modificados y un manifiesto cifrado con **cada versión exacta** necesaria para esa base. Guardar identificador inmutable del proveedor, tamaño y SHA-256; el nombre del archivo solo no alcanza.
- Revisión de código e imágenes utilizadas, versión de PostgreSQL y herramientas, identificadores de las claves que necesita la recuperación. No adjuntar las claves privadas al mismo respaldo.
- Un registro de finalización escrito **al final**, tras comprobar que base, archivos y manifiesto quedaron almacenados y protegidos. Una ejecución incompleta nunca cuenta como copia exitosa.

Los archivos se copian de forma incremental. Si un archivo antiguo sigue referenciado por una copia nueva, hay que extender primero su protección hasta cubrir los 30 días de esa copia y comprobarlo. No aplicar una regla que elimine todos los objetos después de 30 días: rompería las copias nuevas que usan archivos antiguos. La limpieza requiere revisar referencias; mantenerla desactivada hasta ensayarla, medir crecimiento y definir alertas de costo.

La base y R2 no comparten una transacción. El ejecutor comprueba presencia y tamaño de referencias, y exige el mismo ETag/fecha al descargar y al verificar el objeto. Si falta alguno o cambia, no publica éxito. Esto detecta cambios durante la copia, pero **no demuestra por sí solo que un objeto mutable tuviera esos bytes al instante exacto de la base**. Antes de activar, verificar las rutas de escritura del código desplegado y mantener claves inmutables/versionadas para los documentos requeridos. Los QR regenerables se inventarían aparte. Las restauraciones fijan los identificadores de las versiones protegidas; una versión posterior no las sustituye.

## Ensayo y puesta en marcha

1. Subir objetos ficticios y comprobar la protección y el rechazo de borrado/modificación de retención con las credenciales previstas. No hacer ensayos destructivos sobre datos existentes.
2. Completar una copia real de staging y restaurarla en base y almacenamiento aislados. Deshabilitar correo, WhatsApp, cobros, facturación, cron y workers; no arrancar automáticamente la cola restaurada.
3. Validar datos, huellas de archivos, descifrado de secretos, dos empresas aisladas, ingreso/MFA y una operación de negocio. Registrar duración, punto de recuperación y errores. La clave equivocada o un archivo alterado deben fallar.
4. Programar cada hora sólo después del ensayo. Supervisar desde fuera del ejecutor la última copia **completa**, con alerta de fallo y de ausencia; propuesta inicial: más de 90 minutos sin copia nueva requiere atención. Medir duración para revisar ese umbral.
5. Ensayar periódicamente y antes de producción. Conservar además una copia cifrada desconectada y su procedimiento de custodia. Al recuperar tras un incidente, revocar accesos/sesiones anteriores y conciliar envíos y cobros antes de reanudarlos.

El objetivo inicial es perder como máximo alrededor de una hora más la duración del respaldo y recuperar el servicio en 4–8 horas con un volumen pequeño y operador disponible. **Son objetivos pendientes de medición, no garantías.** La estimación de USD 15–25/mes sólo corresponde al ejemplo pequeño de la comparación privada; el tamaño real, versiones retenidas, transferencia y cómputo cambian el costo.

Referencias: [Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock), [permisos de las claves](https://www.backblaze.com/docs/cloud-storage-application-key-capabilities), [autorización API v4](https://www.backblaze.com/apidocs/b2-authorize-account), [subida y retención de versiones](https://www.backblaze.com/apidocs/b2-upload-file), [age](https://github.com/FiloSottile/age), [pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html), [validación TLS de PostgreSQL](https://www.postgresql.org/docs/16/libpq-connect.html).
