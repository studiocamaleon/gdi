# Etiquetas de órdenes con QZ Tray

## Uso

- Configuración → Impresoras: equipo con QZ, buscar cola y guardar. La selección se guarda **por tenant en ese navegador**, sin cambiar otros puestos.
- Disponible también al imprimir desde la OT o el aviso de producción finalizada: los operarios no necesitan acceso a Configuración.
- Etiqueta 100 × 150 mm, 203 dpi (8 puntos/mm), TSPL. Vista previa monocroma idéntica al raster enviado. Logo y nombre del tenant, OT, cliente, entrega comprometida y productos comerciales (sin duplicar componentes internos).
- Cinco productos por etiqueta; las órdenes más grandes se paginan. Copias de 1 a 20 por página, envío secuencial sin reintentos automáticos. «Enviada» significa aceptada por QZ/cola, no verificación física del papel.
- **QR = número OT**, por ejemplo `OT-2026-0060`. No lleva URL pública, saldo ni secretos. El lector 2D configurado como teclado con Enter/Tab activa `EntregaEscaneoWatcher` en Grafo. La sesión, empresa y permisos siguen vigentes; el saldo se consulta al abrir la entrega.
- Impresión no cambia estado de producción, cobros ni entregas. Se puede reimprimir una OT emitida, incluso ya entregada. Se rechazan borradores/canceladas.

## Instalación propia sin Premium

QZ admite una raíz propia administrada en cada puesto. La conexión TLS y la identidad de firma de Grafo son independientes.

1. En el servidor, generar una identidad: `node scripts/qz-generar-certificado.mjs /ruta/privada/qz`. El script no sobrescribe identidades existentes. Certificado RSA 2048, X509, vigencia un año; clave PKCS8 con permisos 600.
2. Variables del **API**:
   ```env
   QZ_SIGNING_PRIVATE_KEY_PATH=/ruta/privada/qz/private-key.pem
   QZ_SIGNING_CERTIFICATE_PATH=/ruta/privada/qz/digital-certificate.pem
   ```
   Reiniciar API al instalar o renovar. En producción montar archivos secretos persistentes; nunca incluir claves en Git, imágenes públicas, frontend ni paquete de instalación del puesto.
3. En cada equipo con QZ, cerrar QZ, copiar **sólo** `override.crt` a su directorio de instalación (Windows: `C:\Program Files\QZ Tray\override.crt`, requiere administrador), abrir QZ y autorizar «Grafo Impresion» marcando recordar decisión. La descarga del certificado público está en Configuración → Impresoras.
4. Si existe una raíz propia de otra aplicación, coordinar con su administrador antes de reemplazarla. Renovar antes de vencer y actualizar todos los puestos.
5. Para QZ remoto: certificado TLS que incluya el host/IP, confianza TLS en el navegador, puerto seguro 8181 permitido sólo desde los puestos autorizados, y permiso de red local del navegador cuando corresponda. No se habilita WebSocket inseguro como fallback.

Equipo del piloto: Windows `192.168.88.164`, cola `Xprinter XP-410B`. Estos valores no son defaults globales del SaaS.

## Implementación y seguridad

- `GET impresion/configuracion`: identidad pública y tenant activo. Nunca retorna clave privada.
- `POST impresion/impresoras`: firma una búsqueda de impresoras, con parámetros fijos.
- `GET impresion/ordenes/:id/etiqueta`: consulta tenant + OT y genera previews PNG sin Chromium.
- `POST impresion/ordenes/:id/etiqueta`: recibe solamente impresora, copias y página. El servidor construye el comando TSPL y los parámetros QZ. Firma RSA-SHA512 del SHA256 hexadecimal del JSON `{call, params, timestamp}`, como exige el SDK.
- **No existe endpoint que firme mensajes, hashes ni comandos arbitrarios del cliente.** Sólo `printers.find` y etiquetas derivadas de una OT autorizada. Los datos binarios viajan en base64; las opciones nunca aceptan destino de archivo/host ni URLs de descarga.
- El navegador comprueba el hash que produce el SDK contra el mensaje firmado, preserva su timestamp y deja que el SDK adjunte `signAlgorithm=SHA512`.
- Permisos: configuración/búsqueda con producción.ver, producción.ejecutar o configuración.ver. Etiquetas sólo producción.ver o producción.ejecutar. Todas las OT se filtran por tenant en servidor.
- Desconexión al cambiar host, empresa o certificado; exclusión de operaciones simultáneas, límite de espera y aviso ante estado incierto. Sin reimpresión automática.
- Raster 800 × 1200, 120 KB por página sin comprimir. PNG de preview usualmente 15–30 KB. Render de una sola página por envío; sin recalibrar GAP, velocidad ni densidad del equipo. TSPL BITMAP: 0 negro, 1 blanco según el manual TSC.
- Las notificaciones de impresión física, cola central compartida, múltiples modelos/dpi, bultos y despachos quedan fuera de esta primera versión.

## Verificación

- API: tenant ajeno/inexistente, estados no imprimibles, límites de copias/página, paginación, integridad de raster TSPL, firma verificable y rechazo al alterar impresora.
- Frontend: SDK QZ real con transporte simulado, coincidencia de hash/algoritmo/timestamp, persistencia por tenant, modal finalización.
- QR decodificado desde el PNG final con OpenCV: coincide exactamente con el número OT.
- Prueba física confirmada por el usuario el 17/09/2026: impresión desde Grafo en la Xprinter XP-410B, sin solicitudes de autorización en Windows después de instalar el certificado público; QR impreso reconocido por el lector y apertura de la entrega.
- Regresión de foco: pruebas DOM con el botón real de la aplicación verifican que Enter/Tab del lector abren entrega aunque «Imprimir etiqueta» tenga el foco. Se consumen pulsación y suelta antes de que lleguen al botón; Enter manual y escritura en campos editables mantienen su comportamiento. La misma prueba reproduce el fallo con el detector anterior.

Fuentes: [firma QZ](https://qz.io/docs/signing), [API QZ](https://qz.io/api/qz), [servidor de impresión QZ](https://qz.io/docs/print-server), [manual TSPL/TSPL2 de TSC](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf).

## Piloto de documentos A4 y eventos de Windows

En Configuración → Impresoras hay dos destinos independientes por tenant y navegador: **etiquetas** y **documentos**. El destino de documentos toma inicialmente el host de etiquetas, pero exige elegir y guardar su propia cola. Piloto configurado: `RICOH MP 9003 PCL 6` en `192.168.88.164`.

- **Prueba de documentos A4** envía un PDF fijo de dos páginas numeradas, blanco y negro, 1–3 copias. Simple faz: dos hojas por copia; doble faz por borde largo: una hoja por copia, ambas caras derechas. No crea ni modifica una OT.
- **Escuchar impresora** recibe avisos de Windows por QZ. Se muestran hasta 100 eventos en memoria y se pueden descargar como JSON. Se filtran los trabajos ajenos al piloto. No se solicitan archivos de la cola (`jobData`).
- La escucha se detiene al salir de esta pantalla. Ante desconexión se informa que el último evento puede estar desactualizado. No hay servicio residente ni historial persistente en esta etapa.
- `COMPLETE` se presenta como «Finalizado según la cola»; `DELETED` sólo como «Retirado de la cola». Ninguno confirma físicamente la salida ni finaliza producción. No hay reintentos automáticos de impresión.
- `POST impresion/prueba-documento` construye y firma exclusivamente ese PDF fijo y sus opciones validadas. `POST impresion/escuchar` reconstruye exclusivamente `printers.startListening` para una cola, con timestamp del SDK dentro de 60 segundos del servidor. La prueba requiere configuración.ver; la escucha admite además comercial.gestionar/produccion.ejecutar.
- QZ 2.2.6 no permite pasar timestamp a `startListening`. Usamos su API pública `setSha256Type` para conservar SHA256 y obtener la autorización de ese mensaje concreto. El backend no firma hashes/comandos libres. `getStatus` y `stopListening` no requieren firma según el SDK.
- Validado con el equipo real: búsqueda de la Ricoh, configuración independiente y evento de impresora `OK` («Disponible»). El usuario confirmó las tres pruebas físicas: simple faz con una copia (2 hojas), doble faz con una copia (1 hoja) y doble faz con dos copias (2 hojas). Los avisos de falta de papel, atasco y la correspondencia entre fin de cola y salida física aún no se verificaron específicamente.

Secuencia de prueba: una copia simple faz (2 hojas), una copia doble faz (1 hoja) y dos copias doble faz (2 hojas). Con la escucha activa, pausar la cola de la Ricoh desde Windows y reanudarla para comprobar el aviso, cuidando no interrumpir trabajos ajenos. Las tres variantes físicas quedaron validadas; el flujo integrado se describe abajo.

## Documentos al emitir OT (18/09/2026)

- Emitir OT detecta A4 B/N de centro de copiado y ofrece **Emitir sin imprimir** / **Emitir e imprimir**, en órdenes nuevas y borradores. La impresora se configura por tenant y navegador, separada de etiquetas.
- Primero se emite la OT y terminan los intentos de subida. El servidor consulta los archivos `LISTO` del ítem y tenant: prepara sólo originales confirmados. Los archivos ausentes quedan pendientes con un motivo visible; no se deshace la emisión.
- El panel global se puede minimizar y permanece al navegar dentro del dashboard. Muestra páginas, copias/juegos, faz, hojas, avisos e historial por documento. También se abre desde **Impresión de documentos** en la OT. Cambiar de empresa desmonta la escucha.
- Los mensajes JOB se vinculan mediante un `jobName` único a OT + intento. Se persisten en `OrdenTrabajoEvento`, tipo `impresion_documento`, con actor, originales, destino, cantidades, estado y hasta 40 actualizaciones por intento. El panel recupera los 100 envíos más recientes y el último intento de cada documento. Esta telemetría no es prueba de salida física ni una transición de producción.
- Reservar un intento bloquea la fila OT dentro de una transacción. Dos pestañas no pueden autorizar el mismo primer envío. Reimprimir exige el ID del último intento y confirmación explícita; repetir un request no devuelve otra autorización. Ante error/timeout se detiene el lote. Nunca se reenvía al recargar/reconectar.
- Cerrar/recargar la pestaña interrumpe el seguimiento. Los trabajos enviados siguen en Windows y el historial permanece. **Conectar seguimiento** consulta estados presentes, sin reconstruir eventos que Windows descartó. **Desconectar seguimiento** libera la escucha para las pruebas de configuración.
- `COMPLETE`/`PRINTED` indican finalización según cola; `DELETED` sólo indica retirada. ACK/borrados tardíos no degradan una finalización. Los avisos PRINTER describen la cola completa, sin atribuirlos a un documento.
- **Todo impreso correctamente** registra una verificación humana con usuario y fecha en los últimos envíos y en el historial de la OT (`impresion_confirmada`). Cierra el panel y retira su indicador flotante; conserva el seguimiento de otras órdenes. Requiere que todos los documentos tengan un intento y que termine el envío actual. Si falla el guardado, el panel permanece abierto. No cambia el estado de producción ni sustituye los eventos de Windows. Una reimpresión necesita una nueva verificación.
- `POST impresion/ordenes/:id/confirmacion-documentos` recibe los IDs de los últimos envíos. Valida tenant, permisos y que no haya nuevos intentos desde otra pestaña; repetir la confirmación no duplica el registro. El indicador minimizado usa el contenedor de estilos de Grafo, igual que el modal.

### Alcance

PDF A4 B/N, simple o doble faz por borde largo, hasta 25 MB de originales por ítem, 2.000 páginas seleccionadas por documento y 999 copias. Se validan páginas reales contra el snapshot. Los tomos con mismo papel/gramaje/faz se unen en orden, insertando un dorso vacío después de segmentos con una cantidad impar de páginas seleccionadas. Un tomo mixto o producto distribuido en entregas requiere impresión manual. El papel se prepara en la Ricoh; esta versión no selecciona bandejas por gramaje ni ejecuta terminaciones.

### Rangos de páginas del Centro de copiado

- Cada archivo asociado permite seleccionar páginas por posición en el original, desde 1: `1-7,9,12-16`. Vacío significa todas. Se ordenan y se eliminan repeticiones; un rango invertido, incompleto o fuera del original bloquea la cotización.
- `paginas` guarda la cantidad efectiva; `paginasOriginales` conserva el total del archivo y `rangoPaginas` la selección normalizada. Se guardan también en cada segmento de un tomo y se recuperan al editar la carga. Los originales adjuntos se conservan completos.
- Cotización, consumo de papel y terminaciones usan las páginas seleccionadas. Ejemplo: 13 páginas × 2 copias a doble faz = 26 carillas, 14 hojas físicas. Cada documento/copia empieza en un frente.
- Al preparar la impresión, el servidor verifica el total real del original, extrae las páginas seleccionadas y firma ese PDF. La cantidad de copias y la faz provienen del snapshot. Los rangos quedan en el registro de envío y se muestran en el modal de impresión.
- Los trabajos anteriores sin rangos mantienen su comportamiento. Word y Excel permiten cotizar una selección ingresando su cantidad de páginas; la impresión directa por QZ sigue requiriendo PDF.

Se corrigió el cómputo de doble faz impar: `ceil(páginas / faz) × copias`. Por ejemplo, 3 páginas × 2 copias a doble faz = 4 hojas. Las cotizaciones históricas que guardaron 3 hojas deben recotizarse antes de usar impresión directa.

Endpoints: `GET impresion/ordenes/:id/documentos`, `POST impresion/ordenes/:id/documentos/:itemId`, `POST impresion/ordenes/:id/envios/:intentoId`. Escritura: comercial.gestionar o produccion.ejecutar. Lectura: comercial.ver o produccion.ver/ejecutar. Escuchar QZ ahora también admite comercial.gestionar/produccion.ejecutar. El servidor reconstruye y firma el PDF y opciones; no acepta comandos libres ni cantidades arbitrarias.

### Verificación

Pruebas automáticas: aislamiento tenant/actor, reserva y reimpresión, páginas reales, tomos impares, eventos tardíos, seguimiento al minimizar y detención ante error parcial. Contrato probado contra SDK QZ 2.2.6 real con transporte simulado. Cotización verificada con pruebas de dominio e integración.

En navegador: OT-2026-0058 con original ausente correctamente bloqueado, Ricoh reconocida y escucha real conectada al minimizar/navegar. No se emitió una OT ni se envió un PDF real durante esa revisión; queda probar físicamente **Emitir e imprimir**. Las tres variantes físicas del panel de configuración ya fueron confirmadas por el usuario.
