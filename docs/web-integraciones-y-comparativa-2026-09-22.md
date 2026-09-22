# Web pública: integraciones y comparación de planes

## Fuente de verdad

La web consulta `GET /api/registro/planes` sin caché persistente. Tanto la tabla
como la disponibilidad de integraciones utilizan `prestaciones`, la lista de
capacidades efectivas de cada oferta publicada. Los borradores y planes privados
no participan. La web no supone que un plan hereda todo lo de otro.

Decisión comercial del 22/09/2026: la extensión de WhatsApp Web se retira.
No se anuncia en integraciones ni en la comparativa, aunque ofertas históricas
todavía incluyan `whatsapp_web`. Este ajuste de la web no modifica esos contratos
ni elimina aún la implementación de la extensión del sistema.

Las tarjetas mantienen precio, implementación, prueba, adicionales y capacidades
básicas. Las funciones pasan a una tabla común agrupada por categoría, con filtro
de diferencias. Cabecera y primera columna permanecen visibles en el área de
desplazamiento; las marcas de inclusión tienen texto accesible.

## Integraciones verificadas en el repositorio

| Conector | Evidencia | Tratamiento en la web |
| --- | --- | --- |
| ARCA | `apps/api/src/administracion/afip-integracion.service.ts` y emisión fiscal | Se muestra con `fiscal_argentina`. Aclara Argentina y delegación fiscal. |
| Wati | `apps/api/src/integraciones/wati/wati.client.ts`, catálogo y notificaciones | Se muestra con `whatsapp_automatico`. Requiere cuenta y plantillas aprobadas. |
| WhatsApp Web | `apps/api/src/integraciones/whatsapp-web/`, módulo Chrome y extensión | Retirada de la web por decisión comercial del 22/09/2026. |
| MCP | `apps/api/src/mcp/` y gestión de credenciales | Implementado, pero oculto mientras ninguna oferta pública incluya `mcp`. |
| QZ Tray | `apps/api/src/impresion/` y cliente de impresión | Implementado, pero oculto mientras ninguna oferta pública incluya `impresion_directa`. |
| Mercado Pago | `src/lib/integraciones.ts`: `disponible: false`; sin conector de cobros de clientes | Se elimina de la sección pública. Registrar un medio de pago no equivale a integrarlo. |
| Google Drive | `src/lib/integraciones.ts`: descartado; sin conector | Se elimina de la sección pública. El almacenamiento propio no es Google Drive. |
| Paddle | `apps/api/src/cobro/` | Cobra la suscripción de Grafo; no se anuncia como pasarela para los clientes de la gráfica. |

El catálogo editorial vive en `apps/marketing/src/lib/public-integrations.ts`:
sólo contiene conectores implementados. Sus planes visibles se calculan desde
las ofertas públicas. Si el catálogo falla, no se anuncian disponibilidades
recordadas ni se inventan precios.

## Alcance

Verificación de implementación y visualización local. No implica probar cuentas
externas de clientes, enviar mensajes, emitir comprobantes ni publicar la web en
producción. No se modifica ninguna oferta, suscripción o permiso.
