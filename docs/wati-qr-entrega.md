# QR de retiro y entrega de Wati

El encabezado de las plantillas de retiro debe declarar `{{qr_url}}`. La URL de muestra se utiliza para aprobar la plantilla; cada envío incorpora su propia imagen mediante el parámetro nombrado. Las variantes con y sin saldo pasan a `_v2`. Una imagen estática no admite el envío de un QR variable: el cliente HTTP lo rechaza antes del POST.

Se genera una imagen con el número de la OT, aislada por empresa, y una firma de 24 horas. El envío utiliza `sendTemplateMessage` v2 y conserva el identificador del destinatario. Su aceptación se registra como `wati_aceptada`, no como entrega.

Cada intento tiene una campaña identificada por su token de reserva. El barrido existente consulta, sin enviar mensajes, la campaña y su destinatario. Exige coincidencia de campaña, teléfono e identificador cuando existe. Distingue enviado, entregado, leído y fallo confirmado. No deduce fallos por timeout o por ausencia de datos; tampoco habilita reenviar un mensaje cuya salida ya se confirmó. El seguimiento rota hasta 25 filas por empresa, consulta como máximo cinco páginas de campañas y cubre los últimos siete días. Si el proveedor no permite consultar campañas, permanece pendiente de confirmación.

Un fallo confirmado ofrece el reintento manual existente y usa la plantilla vigente. Los avisos históricos sin evidencia de entrega se muestran como aceptados. No se reenvían automáticamente los avisos anteriores. La confirmación manual queda identificada como tal en el registro.

La migración `20261008190000_wati_entrega_confirmada` agrega únicamente identificador de mensaje, última consulta e índice. La migración no cambia avisos previos.

## Comprobación local

- Plantillas con imagen variable aprobadas por el proveedor.
- Ensayo explícitamente autorizado a un número del titular, con datos de orden ficticios. Confirmó recepción del QR; la consulta al proveedor informó `entregado`.
- Pruebas de aceptación, entrega, rechazo, correlación de destinatario, aislamiento de empresa y protección contra reintentos duplicados.
- No se ejecutaron envíos a otros clientes ni se activaron cron locales.

Referencias: [imagen personalizada](https://support.wati.io/en/articles/11463469-how-to-send-images-or-pdfs-using-wati-template-messages), [aceptación del envío v2](https://docs.wati.io/reference/v2_sendtemplatemessage), [consulta de campañas](https://docs.wati.io/reference/campaigns_getbroadcasts).
