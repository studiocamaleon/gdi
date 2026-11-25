# Cierre de PR y ramas — noviembre de 2026

Lucas autorizó revisar e integrar los PR pendientes, publicar el conjunto y alinear producción, GitHub y local. Incluyó después los avances locales de Chile y el plan/prototipo de GrafoCommerce. El lote se revisa en [PR #133](https://github.com/studiocamaleon/gdi/pull/133).

## Trabajo incorporado

- PR #116 y #127: registro de WhatsApp y operación de staging bajo demanda.
- PR #123 y #124: condiciones/orden de pasos y reintentos de B2.
- PR #125 y #126: piloto Chile, invitación, dependencias y sus pruebas.
- PR #63, #64, #71, #72, #73 y #105: geometría, imágenes base y React.
- Avances locales de Chile: RUT normalizado y validado, alta pública y caja inicial CLP; búsqueda por CUIT/RUT conservando empresa e identidad.
- GrafoCommerce: plan y prototipo preservados. Sus recorridos de tarjeta y transferencia son simulados; no se habilitó una tienda ni un cobro real.
- Cotización: se completó la rama `codex/cotizacion-contexto-materiales`, conservando la normalización vigente del transporte y agregando la presentación del rechazo de contrato y sus pruebas. Pasaron 13 pruebas web y 3 de API.
- Manual inicial: conservado como [archivo histórico](historico/manual-desarrollo-2026-09-25.md); el [flujo actual](flujo-pull-requests.md) sigue siendo la referencia operativa. No se reemplazaron las reglas actuales por las de septiembre.
- Se recuperó el registro documental de la migración de catálogo del 03/10/2026, que seguía únicamente en `codex/registro-migracion-staging`.

## Ramas cuyo trabajo ya estaba incorporado

Se compararon commits, parches y archivos actuales. Las integraciones de historial conservan el árbol vigente cuando el trabajo ya estaba aplicado; no vuelven a publicar la versión antigua de una funcionalidad.

| Rama o grupo | Evidencia y tratamiento |
| --- | --- |
| `descartar-borradores`, `detalle-cargos-presupuesto` | `278b50ee2` y `38c22e8f6` incorporados mediante `643147b67` y `a71339007`; comparación de parches confirma cargos y descarte con las mejoras posteriores de versiones, facturación y auditoría. `a4078be91` tiene parche equivalente. |
| `ensayo-recuperacion`, `inbox-recuperacion`, `staging-despliegue-20260929` | `ce4e06fca` incorporado en `c196b644c`, adaptado al vencimiento/revalidación de sesión. Los parches de cortes de respuesta y salida conservando origen son equivalentes. Se mantienen los controles de autorización actuales. |
| `local-cotizacion-inbox`, `local-layout-impresion-laser` | Cotización completada en este PR; Inbox absorbido según la fila anterior; impresión/corte y pruebas de optimización tienen parches equivalentes. |
| `grafo3d` | Aplicación integrada y adaptada a Grafoprint en `cf204396e`, con cambios posteriores. Se conservaron esos cambios, las fuentes, pruebas y licencias vigentes. El ZIP de muestra generado antiguamente no es código pendiente. |
| `local-memoria`, `lote-local-produccion`, `tracking-nombre-paso-manual` | `git cherry` confirma parches equivalentes en la base actual. |
| `staging-carteles-vinilo`, `respaldo-reintento-b2` | No quedan parches únicos de funcionalidad respecto del lote. Se conserva el historial de sus merges. |
| `staging-redireccion-sesion` | Corrección equivalente y registro de staging ya incorporado por la regularización anterior. |
| `dependencias-piloto-chile` local | Los ajustes de orden de CI están incluidos. La respuesta del servidor de pruebas usa JSON y `nosniff`, con prueba de contenido malicioso; Chromium conserva el pin posterior `.108`, no el `.79` antiguo. |

Antes de retirar referencias se guardó un bundle privado de todas las ramas y se comprobó con `git bundle verify`. El archivo, los inventarios y los accesos permanecen fuera de Git. Las carpetas con trabajo o procesos activos se comprueban antes de cambiar su rama; no se borran datos locales para alinear código.

## Publicación

Revisión funcional candidata: `101ed93273837bfbbb96a60497f3d9f33f9c4563`. Los merges de regularización posteriores sólo conservan historial/documentación. Las imágenes y resultados definitivos se registran en [staging](../deploy/staging/VALIDACION.md) y [producción](../deploy/produccion/VALIDACION.md).
