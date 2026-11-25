# Staging bajo demanda

Abrir `https://staging.grafoprint.com.ar` enciende la web existente. Su controlador
arranca API y Gotenberg, comprueba salud y después arranca los dos workers. Durante
ese intervalo aparece una pantalla de espera que se actualiza sola. No hay nuevas
máquinas, cambios de tamaño, migraciones ni cambios de aplicación comercial.

Después de **15 minutos sin solicitudes de usuarios ni conexiones abiertas**, el
controlador consulta las colas Redis y los pendientes de PostgreSQL. Las comprobaciones
de salud `/api/health` no renuevan ese plazo. Una pestaña abierta con eventos en vivo
o consultas periódicas cuenta como uso: cerrar las pestañas al terminar las pruebas.

Sólo si no hay trabajos pendientes drena los workers con SIGTERM, vuelve a consultar
las colas, detiene Gotenberg y API, y termina la web con código cero. Fly conserva
las máquinas y vuelve a iniciar la web ante la siguiente visita. Una visita durante
el apagado cancela el reposo y recupera el conjunto. Si falla una comprobación,
conserva o recupera los servicios; no interpreta un error como ausencia de trabajo.

El copiador `grafoprint-staging-respaldo`, sus datos y sus tareas siguen activos.
Neon, Redis Cloud y R2 conservan su configuración y costos propios. Las tareas
programadas y webhooks de prueba de la API quedan sin servicio mientras staging
duerme. Para un ensayo de integraciones, abrir y mantener staging primero.

## Alcance y permisos

Los nombres de las cuatro aplicaciones administrables están fijados en
`control.mjs`. No existe un parámetro para producción o respaldos. El controlador
sólo arranca en `grafoprint-staging-web` con `STAGING_PRIVATE=true` y activación
explícita. La consulta de ocupación sólo admite la API de staging.

Los secretos `STAGING_DEMANDA_TOKEN_API`, `STAGING_DEMANDA_TOKEN_WORKER`,
`STAGING_DEMANDA_TOKEN_WORKER_PDF` y `STAGING_DEMANDA_TOKEN_PDF` son tokens de
despliegue separados, cada uno restringido a su app de staging. El quinto,
`STAGING_DEMANDA_TOKEN_LECTURA`, es un token `machine-exec` de la API que sólo
permite `node /app/staging-demanda/ocupacion.cjs`. Nunca usar un token de organización
o personal aquí. Next se ejecuta como proceso hijo sin estos secretos.

Los tokens iniciales vencen al año de su emisión del 10/11/2026. Rotarlos antes
del 10/11/2027, comprobando primero el nuevo acceso; después revocar los anteriores.
No incluirlos en Git, logs o cuerpos de PR. Fly los recibe por `secrets import --stage`
a través de stdin. El código fuente y los nombres de los secretos no son secretos.

## Desplegar y probar

Antes de un despliegue o prueba prolongada sin navegador, abrir staging y ejecutar:

```sh
FLYCTL_BIN="$HOME/.fly/bin/flyctl" node deploy/staging/demanda/mantener.mjs 120
```

Esto retiene el entorno por dos horas. Repetir después de actualizar/reiniciar la
web, porque `/tmp` es efímero. Al terminar, usar `0` en lugar de `120`. El plazo
máximo es 24 horas. Un trabajo pendiente sigue impidiendo el reposo al vencerlo.

Los manifiestos de staging incorporan los tres archivos mediante `[[files]]`,
relativos a cada `fly.toml`. Usar los manifiestos de esta rama en despliegues
posteriores: un manifiesto anterior eliminaría el controlador. Los archivos de
control son independientes de las imágenes; registrar ambos en VALIDACION.md.
La API debe recibir `ocupacion.cjs` antes de activar el controlador web. Conservar
`auto_stop_machines="off"`: el controlador decide cuándo es seguro apagar.
La web requiere `auto_start_machines=true`, mínimo cero y reinicio `on-failure`.

```sh
node --test deploy/staging/demanda/demanda.test.mjs
flyctl config validate -c deploy/staging/fly.api.toml
flyctl config validate -c deploy/staging/fly.web.toml
```

Para comprobar reposo, consultar `flyctl machine list` en los cinco apps; consultar
la URL pública despertaría la web. Tras esperar el plazo, los cinco deben estar
`stopped` y el respaldo `started`. Abrir la web, verificar login, API y un recorrido
de prueba. Comparar también configuración/revisiones de producción antes y después.

Para investigar un entorno que no duerme, ejecutar el comando de ocupación en la
API de staging. Devuelve sólo cantidades; si hay pendientes, resolver su causa sin
borrar colas ni datos para forzar el ahorro. Los logs `staging_demanda:` distinguen
inicio, preparación, reposo y fallos. Los accesos HTTP no se registran en este proxy.

## Reversión

Conservar las configuraciones previas en almacenamiento privado. Primero restaurar
la web a `node server.js`, puerto 3000, sin archivos del controlador, con autostart y
autostop desactivados; iniciar explícitamente API, workers y Gotenberg. Verificar
salud y acceso. Luego retirar los cinco secretos del controlador y revocar sus tokens.
No eliminar aplicaciones, volúmenes, respaldos ni datos. Los tamaños e imágenes
originales permanecen disponibles. No usar ningún manifiesto de producción.
