# Presupuestos: correo y avisos internos

Actualizado: 23/09/2026.

## Flujo de correo — implementado

- Envío mediante Resend desde un dominio verificado de Grafo, identificando a
  la empresa remitente. Las respuestas se dirigen al correo comercial del tenant.
- Destinatario, asunto y mensaje editables antes de enviar; plantilla habitual
  configurable por empresa.
- **Siempre adjuntar el PDF generado en Grafo correspondiente a la versión
  emitida**, junto con el enlace público para consultar y aprobar o rechazar.
  Si el PDF aún no está listo, esperar su generación; no enviar sin adjunto.
- El botón público usa el mismo enlace del presupuesto que WhatsApp. La decisión
  pertenece al presupuesto, no a un canal concreto.
- Separar los estados comerciales de los estados de entrega del correo y respetar
  el canal elegido, sin disparar WhatsApp por elegir enviar sólo un email.
- Las respuestas de texto llegan a la casilla del tenant; por sí solas no aprueban
  el presupuesto. El cliente puede aprobar desde el enlace o el comercial registrar
  su aceptación por otro canal.

### Dónde se utiliza

- **Emitir presupuesto** permite elegir correo, WhatsApp o ambos. Para correo,
  primero guarda la versión emitida y luego abre el editor del mensaje.
- **Enviar al cliente**, en la ficha del presupuesto, permite revisar el
  destinatario, asunto, mensaje y vista previa antes de confirmar.
- **Configuración de presupuestos → Correo electrónico** guarda la casilla de
  respuesta y la plantilla habitual. Si la casilla queda vacía, utiliza el email
  de Datos de la empresa. Variables: `{empresa}`, `{cliente}` y `{presupuesto}`.
- El bloque **Correos** de la ficha muestra el historial y los reintentos.

### Procesamiento y alcance

El envío queda persistido en una cola y continúa aunque se cierre el modal.
El proceso de la API revisa la cola cada diez segundos, espera el PDF emitido y
adjunta ese archivo, sin recalcularlo. Admite PDF de hasta 20 MB. Ante un fallo,
lo indica en el historial; nunca envía un mensaje sin PDF.

Los estados son pendiente, enviando, enviado y fallido. **Enviado** significa
aceptado por Resend; todavía no hay seguimiento de entrega, rebote o lectura.
Los reintentos conservan la identidad del envío para evitar duplicados. Pasadas
23 horas desde el primer intento al proveedor se detienen los reintentos de
esa misma fila para no exceder la ventana segura de deduplicación.

El canal de WhatsApp queda guardado también para los recordatorios automáticos.
Elegir sólo correo los desactiva para ese presupuesto; elegir ambos solicita
ambos canales. El correo requiere presupuestos, PDF y aprobación pública
habilitados, junto con permiso comercial de gestión. No depende del módulo de
WhatsApp.

Configuración técnica: `RESEND_API_KEY` existente y remitente opcional
`RESEND_PRESUPUESTOS_FROM`, por defecto `cotizaciones@grafoprint.com.ar`.
Es independiente del correo de registro. El dominio debe estar verificado en
Resend. La migración es `20260923100000_presupuestos_correo`.

## Avisos internos — implementados

Al aprobar o rechazar desde el enlace público:

1. Registrar la decisión y el comentario en el historial del presupuesto.
2. Crear una notificación en la campana de **cada usuario activo con membresía
   activa de la misma empresa**, independientemente de su rol.
3. Mostrar número de presupuesto, cliente, resultado y un resumen del comentario.
   El comentario completo se conserva en el historial.
4. Abrir el presupuesto al seleccionar el aviso. La lectura es individual.

La decisión, su historial y el evento con sus notificaciones se guardan en una
única transacción. Las peticiones repetidas o simultáneas sólo producen un evento
si logran cambiar el estado desde `enviado`. La entrega visual utiliza el canal
en vivo existente y su consulta periódica de respaldo.

No hay envío adicional de correo al equipo por este aviso. Las decisiones manuales
registradas por el comercial conservan su comportamiento actual.

## Destinatarios futuros

Por ahora no se agrega una pantalla de preferencias. La política está centralizada
en `PresupuestosService.notificarDecisionCliente`. Podrá evolucionar a responsable
comercial, roles o personas seleccionadas sin cambiar el enlace público ni la
persistencia individual del buzón. Los permisos para abrir el presupuesto siguen
siendo los propios de cada usuario.

## Validación

Pruebas unitarias e integración contra PostgreSQL de test: aprobación y rechazo,
comentarios largos, audiencia activa, aislamiento entre empresas (incluidas
identidades compartidas), lectura individual, doble envío, decisiones simultáneas
y reversión completa si falla la persistencia del aviso. No se generan decisiones
ni notificaciones de prueba sobre datos de desarrollo.

También se valida el envío con transporte simulado: adjunto obligatorio, contenido
congelado, elección del canal, concurrencia, reintentos, restricciones del plan y
aislamiento entre empresas. El editor y la vista previa se revisan en la sesión
real del navegador sin enviar presupuestos a clientes.
