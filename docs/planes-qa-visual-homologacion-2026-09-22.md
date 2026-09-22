# Planes: cierre visual y homologación fiscal

Fecha: 22/09/2026. Rama: `codex/rediseno-backoffice-plataforma`.

## Interfaz

Se renderizaron en Chrome los componentes reales de contrataciones, arte de OT y detalle de comprobantes. Los estados poco frecuentes se prepararon con respuestas simuladas en un preview temporal, separado de la aplicación y de la base de desarrollo. Esto aporta evidencia visual y de interacción de los componentes; no se presenta como un recorrido autenticado completo de una empresa real.

- Contrataciones: tabla de 16 solicitudes en dos páginas; recuperación con referencia y motivo; resultado sin evidencia; historial de 12 consultas en dos páginas. El modal mantiene sus acciones visibles con contenido largo. El resultado incierto no ofrece otro cobro.
- Arte independiente de Proyectos: historial, revisiones y control de OT. Al retirar Arte se conserva la descarga, se impiden nuevas aprobaciones/revisiones y siguen disponibles cancelación, revocación y retiro del control existente.
- Comprobantes sin F08: permanece la consulta del envío pendiente, sin acción de emitir. Una respuesta inconcluyente informa que el resultado sigue por verificar.
- Se corrigieron el pie de acciones de arte y la separación entre avisos fiscales. Se comprobaron a 960 y 390 píxeles de ancho; el historial largo de contratación también se revisó en escritorio.

El preview se cerró y se restauró el tamaño del navegador. No se modificaron empresas operativas desde estas pantallas.

## Tickets de acceso de AFIP SDK

La documentación oficial de [la API de AFIP SDK](https://docs.afipsdk.com/integracion/api) aclara que `/auth` conserva y renueva el ticket en su servicio. Por lo tanto, el comentario anterior que exigía Redis para evitar una segunda autorización desde varios procesos no describía esta integración: Grafo llama a la API del proveedor, no directamente a WSAA. No se envía `force_create`.

Se conserva la caché local como optimización de red y se agregó:

- Agrupación de solicitudes simultáneas de autorización para la misma conexión.
- Separación por credencial, ambiente, CUIT y webservice; la clave utiliza una huella de la credencial.
- Una misma configuración para autorización y consulta, aunque cambie el entorno durante la llamada.
- Validación de token, firma y vencimiento antes de llamar al webservice.
- Liberación de consultas fallidas para permitir un intento posterior y limpieza de entradas vencidas.

Esto no certifica el servicio del proveedor bajo carga ni reemplaza la coordinación de numeración/envíos de Grafo. Esa coordinación sigue en `ComprobanteEmision` y sus locks de base de datos.

## Homologación real

Se verificaron explícitamente `AFIPSDK_ENVIRONMENT=dev`, el CUIT público de prueba documentado por AFIP SDK y la base `gdi_saas_test` antes de ejecutar el ensayo. No se usó un emisor fiscal real.

1. Consulta real `FECompUltimoAutorizado`: respondió un número válido, sin emitir.
2. Publicación/asignación de contrato de prueba y creación de un borrador ficticio con los servicios reales de Grafo.
3. Un único `FECAESolicitar`: factura B, punto 1, número **35194**, autorizada en homologación. Sin validez fiscal.
4. Se simuló la pérdida de la respuesta después de recibir la autorización del proveedor. Grafo persistió `por_verificar`.
5. Repetir la acción no realizó un segundo envío.
6. Se retiró F08 del contrato y se consultó el comprobante mediante `FECompConsultar`. Grafo recuperó el mismo CAE y cerró la reserva de la serie.
7. La consulta posterior no volvió a aplicar el resultado. Conteo del ensayo: **un envío y una consulta de recuperación**.

Los datos locales se revirtieron al finalizar la transacción de pruebas. El comprobante ficticio permanece en el entorno de homologación del proveedor. La preparación usó el helper transaccional con savepoints; no se afirma que este ensayo pruebe concurrencia entre conexiones. Esa evidencia procede de las pruebas PostgreSQL existentes.

Evidencia local de la ejecución: `/tmp/grafo-homologacion-fiscal-real.log`. El harness manual quedó en `/tmp/grafo-homologacion-fiscal-planes-ejecutada.ts`, fuera de la suite ordinaria, para evitar emisiones externas al correr tests. No contiene credenciales.

## Verificación y límites

- **56 pruebas API**: tickets, normalización de respuestas fiscales, admisión/recuperación por planes y concurrencia de envíos.
- **11 pruebas web**: arte y emisión por planes.
- **Un ensayo real de homologación**, descrito arriba.
- TypeScript API/web, lint focal y `git diff --check` sin errores.
- API reiniciada para cargar el proveedor actualizado.

Quedan como decisiones/configuración de lanzamiento los importes anuales y el entorno comercial real: dominio de checkout, ofertas y credenciales Paddle live, webhook y correo. El checkout mensual sandbox ya tiene evidencia propia. Esta verificación no publica ofertas ni habilita cobros o facturación en producción. Los borradores fiscales antiguos numerados sin evidencia mantienen revisión manual; no se reenvían automáticamente.
