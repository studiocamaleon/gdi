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
- La salida física de esta plantilla y la autorización recordada se completan en el puesto Windows después de instalar el certificado público. La prueba anterior de TSPL desde la demo ya había sido confirmada por el usuario.

Fuentes: [firma QZ](https://qz.io/docs/signing), [API QZ](https://qz.io/api/qz), [servidor de impresión QZ](https://qz.io/docs/print-server), [manual TSPL/TSPL2 de TSC](https://fs.tscprinters.com/system/files/31-0000001-00_tspl_tspl2_programming_3_0.pdf).
