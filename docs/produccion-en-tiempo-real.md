# Producción en tiempo real

Vista de sólo lectura para televisores del taller. Implementada y comprobada en local y staging con el lote #110 (`acb576be0`, 19/10/2026). Publicada también en producción con el lote #113; no se configuró todavía un Raspberry físico. Ver [el registro del ensayo](../deploy/staging/VALIDACION.md).

## Entrada y vinculación

1. En el navegador del TV, abrir `/pantalla/produccion` en el mismo dominio de Grafo. En desarrollo: `http://localhost:3000/pantalla/produccion`.
2. En otra computadora, ingresar a Grafo y abrir **Producción → Tablero → Pantallas** (`/produccion/pantallas`). Se requieren `produccion.tablero.ver` y `produccion.configurar`.
3. Escribir el código mostrado en el TV, asignarle un nombre y elegir la duración de cada página (10–60 segundos; 15 por defecto).
4. La TV cambia automáticamente a las entregas de la empresa que autorizó el código. No necesita una sesión de usuario en ese dispositivo.

El código tiene ocho caracteres y vence a los diez minutos. Sólo se puede canjear una vez, incluso con solicitudes simultáneas. Cada vinculación dura 180 días. Al vencer o revocarse, el TV borra los datos mostrados y permite generar otro código. La revocación se comprueba en la siguiente consulta, normalmente dentro de diez segundos si hay conexión.

La gestión muestra nombre, duración, vencimiento y última conexión conocida de cada pantalla. El heartbeat se registra como máximo una vez por minuto. «Vinculada» indica autorización, no garantiza que el aparato esté encendido. Para cambiar nombre o duración, revocar y vincular nuevamente.

## Qué muestra

- Entregas pendientes con fecha de hoy o anterior, ordenadas por fecha, OT e ítem. Las fechas civiles se comparan usando el día y la zona horaria de la empresa.
- Una tarjeta por producto entregable o lote; los componentes se agrupan con su trabajo. Los agrupadores de lotes no duplican cantidades.
- Número de OT, producto, cliente (o cliente de mostrador), cantidad, fecha, etapa y pasos completados. No se publican precios, márgenes, adjuntos ni datos de contacto.
- Las órdenes finalizadas y los productos listos permanecen hasta registrar la entrega. Se excluyen borradores, canceladas, entregadas, ítems retirados, fechas futuras e ítems sin fecha comprometida.
- «Atrasadas» y «Para hoy» cuentan entregas, no órdenes. «Listas para entregar» es un subconjunto de ambas: las tarjetas aclaran su estado.

La vista ocupa la altura disponible y calcula cuántas tarjetas entran. Usa una columna en vertical y dos cuando hay suficiente ancho. Rota todas las páginas, sin desplazar automáticamente la página; incluye pausa y pantalla completa. La consulta se repite cada diez segundos independientemente de la rotación. Si falla, conserva la lectura anterior con un aviso visible; vuelve a sincronizarse cuando se recupera la conexión. Una autorización rechazada borra las entregas.

## Raspberry

Usar un navegador Chromium actualizado, con perfil persistente, a pantalla completa. La rotación de páginas la hace Grafo. Ejemplo para un Raspberry con escritorio y Chromium instalado (reemplazar el dominio por el entorno publicado):

```sh
chromium --kiosk --no-first-run --user-data-dir="$HOME/.config/grafo-tv" 'https://grafo.example.invalid/pantalla/produccion'
```

No usar incógnito ni borrar las cookies del perfil. La orientación física y el ahorro de pantalla se configuran en el sistema del Raspberry. El arranque automático depende de su versión: en el escritorio con labwc, la guía oficial indica `~/.config/labwc/autostart`. Agregar allí el comando de lanzamiento con `&`, conservando las entradas existentes. Ver [guía oficial de kiosco de Raspberry Pi](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/).

`localhost` en el Raspberry apunta al propio Raspberry, no a la Mac. La prueba de esta entrega se hizo en el navegador local; no se abrió el servidor de desarrollo a la red. Para la prueba física están disponibles `https://staging.grafoprint.com.ar/pantalla/produccion` y `https://app.grafoprint.com.ar/pantalla/produccion`. Staging permite abrir esta vista sin la contraseña HTTP Basic adicional; los datos requieren la vinculación por código. La gestión de pantallas conserva el login y los permisos de Grafo.

## Implementación y comprobación

- Migración aditiva `20261019120000_pantallas_produccion`: aplicada a desarrollo, `gdi_saas_test`, staging y producción, con permisos de ejecución comprobados. Sin seeds, resets ni cambios en datos existentes.
- `PantallaProduccion` almacena hashes de credencial y código. La credencial aleatoria de 256 bits vive exclusivamente en una cookie HttpOnly, SameSite Strict y Secure en producción. No aparece en URLs, almacenamiento del navegador accesible a JavaScript ni respuestas JSON.
- El BFF `/api/pantalla/[accion]` acepta cuatro acciones cerradas, comprueba origen en escrituras y usa el canal privado existente hacia la API. No reenvía la sesión personal ni cabeceras arbitrarias.
- Los endpoints del dispositivo validan su credencial, empresa, miembro autorizante, permisos, IP y vencimiento en cada consulta. La TV no puede usar endpoints de usuario. La gestión excluye MCP, impersonación y sesiones de plataforma.
- El modelo se exceptúa del filtro automático de tenant porque el código nace antes de tener empresa. Su servicio es el único autorizado a consultarlo: todas las operaciones de gestión filtran explícitamente la empresa. Las pruebas HTTP comprueban el aislamiento y el canje concurrente.
- Las consultas de producción son sólo de lectura; no llaman a la reconciliación ni al backfill del tablero operativo. El único cambio durante una lectura es el heartbeat del dispositivo.
- Las nuevas pruebas de API y BFF están incluidas en el workflow de permisos HTTP. Los builds de producción se ejecutan en CI remoto, sin desplegar staging.

Comprobaciones locales: 11 pruebas nuevas de API y 17 de aislamiento del modelo; 38 comprobaciones de frontend/BFF/rutas (incluyendo las existentes de proxy), tipos de los módulos afectados, lint del frontend y guard de CSS. El chequeo completo de tipos de API y web agotó el límite local de 2 GB; la comprobación acotada de ambos módulos pasó. Se actualizaron tres entradas preexistentes del registro de servicios permitidos de la suite de aislamiento después de revisar que sus consultas filtran empresa y usuario según corresponde. No cambian los permisos de ejecución.

En el navegador se comprobó el ingreso normal de una cuenta ficticia, la autorización desde Pantallas, la lectura automática de 14 entregas de prueba, rotación y pausa, recarga conservando la vinculación, resoluciones CSS 1080×1920 y 1920×1080 sin desbordes, pérdida de conexión y recuperación. La revocación desde gestión elimina los datos del TV. Se corrigió durante el recorrido el uso de enlaces en botones Base UI. La empresa y el usuario ficticios del ensayo se retiran al finalizar; no se modifican usuarios ni órdenes existentes.

## Ensayo de staging — 19/10/2026

En una empresa ficticia separada se comprobó vinculación por código, 17 entregas de hoy/atrasadas, rotación cada diez segundos, pausa, recarga y revocación. Una segunda vinculación dejó una TV demo para la aceptación. Chrome solicitó nuevamente la protección HTTP Basic de staging después de revocar; completarla permitió continuar. Ese ensayo conservaba Basic; posteriormente se separó este control y se deshabilitó en staging para facilitar el acceso del Raspberry. La empresa de ensayo queda disponible hasta cerrar la aceptación, con notificaciones pausadas. El Raspberry físico y su arranque automático siguen pendientes.
