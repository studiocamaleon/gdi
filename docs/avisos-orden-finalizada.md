# Avisos de órdenes finalizadas y reintentos

## Alcance

Corrección local de avisos automáticos por Wati y controles de la ficha de OT.
La rama `codex/avisos-orden-finalizada` depende de `codex/asignacion-operadores`
(PR #23); no implica una publicación en staging o producción.

## Causa y comportamiento

Finalizar el último paso desde Operación diaria ya invocaba el servicio de
notificaciones. El problema estaba después: se elegía siempre una plantilla con
QR, aunque esas variantes estaban desactivadas por defecto y figuraban como
pendientes de implementación en la configuración.

Ahora, para una orden finalizada:

1. El saldo determina si corresponde el aviso con deuda o sin deuda.
2. Si está habilitada la variante con QR, se usa esa variante.
3. En caso contrario se usa el texto sin imagen, si está habilitado.
4. Si ambas variantes están apagadas, no se genera el aviso.

Las variantes QR ya se pueden configurar. Continúan siendo optativas: no se
activan masivamente para empresas existentes. El despachador conserva las
comprobaciones de plan, integración, consentimiento, aprobación de la plantilla
y horario de envío. Los rechazos del proveedor, por ejemplo por créditos
insuficientes, son independientes de esta corrección.

Las cuatro variantes comparten la misma deduplicación por orden, incluyendo las
filas históricas. Cambiar el saldo o activar QR después no genera otro aviso de
finalización. No se hace un barrido de órdenes antiguas ni se reenvía ningún
mensaje al desplegar.

## Reintentar un aviso

En Configuración → Integraciones → historial de mensajes, los administradores
con permiso de gestionar la integración y con el servicio habilitado pueden
elegir **Reintentar envío** en un aviso Wati fallido.

- Antes se confirma el destinatario y se pide revisar la vigencia del mensaje.
- Se reutiliza la misma fila, destinatario y contenido; no se crea otra copia.
- Se conserva el contador de intentos y se registra quién pidió el reintento.
- Una versión opaca evita repetir la acción desde una pantalla desactualizada.
- Se respetan los horarios y las verificaciones normales del despachador.
- Un aviso enviado, en curso o con resultado incierto no puede reintentarse.
  Los inciertos mantienen su mecanismo de resolución manual.
- No se permite durante una impersonación ni desde otra empresa.

## Interfaz

Editar orden, Entregar, Imprimir y Seguimiento utilizan el mismo componente de
Grafo, tamaño pequeño: 32 px de alto, tipografía y redondeado comunes. Los menús
conservan documentos, etiqueta, historial de impresión, enlace de seguimiento y
QR de retiro. La muestra local está en `/dev/diseno/operadores` y sólo existe en
desarrollo.

## Verificación

Se comprobaron 169 casos locales entre catálogo, finalización atómica,
notificaciones y planes, aislamiento HTTP, reservas de despacho, horarios,
permisos de lectura, historial y menús. Usan datos ficticios y una base local de
pruebas; no envían mensajes reales.

También se comprobó visualmente la altura de los cuatro controles y las
acciones de etiqueta y QR en la muestra local. La compilación completa y el
chequeo global de tipos se realizan en CI remoto: el intento de tipado local de
la API excedió la memoria disponible y se interrumpió el de la web para evitar
sobrecargar la Mac.

Para publicar: comprobar el resultado del CI del PR, desplegar primero staging,
validar la configuración y acordar por separado cualquier ensayo que envíe un
mensaje real. Registrar la versión publicada en `deploy/staging/VALIDACION.md`.
