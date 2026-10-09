# Paginación de Facturación y Comprobantes

Las vistas generales consultan páginas de 25 registros mediante `GET /administracion/facturacion/pendientes/pagina` y `GET /administracion/comprobantes/pagina`. Devuelven items, total, pagina, tamanoPagina y resumen. Se conserva el contrato anterior de arrays para consumidores existentes, como comprobantes asociados a una OT. No requiere migración.

La búsqueda se confirma con Buscar o Enter, se aplica en SQL antes de paginar y no distingue mayúsculas ni acentos. Facturación busca número de OT y cliente; Comprobantes busca número completo, nombre/CUIT del cliente o receptor congelado y todas las OT vinculadas, incluidas agrupadas. Estado y tipo también se filtran antes del límite; Con CAE y Sin CAE son distintos. El orden incluye ID para desempatar y una página fuera de rango se ajusta a la última disponible. Los indicadores se calculan sobre todo el resultado filtrado, no sólo sobre las filas visibles; el mes se obtiene de la zona de la empresa.

Facturación conserva la selección entre páginas, permite hasta 100 OT por lote y la descarta al buscar o aplicar filtros. La emisión se confirma mostrando todas las OT seleccionadas. Cambiar de página conserva filtros en la URL. Durante la navegación se indica carga y se bloquea la selección/emisión de la página anterior. Los permisos de lectura y el tenant autenticado se aplican en ambos endpoints; la cabecera enviada por un cliente no cambia su empresa.

Pruebas: más de 500 OT y 200 comprobantes ficticios, búsqueda de registros fuera del límite antiguo, orden estable, agregados, CAE, vacío, página inválida, aislamiento HTTP y selección entre páginas. El CI de separación incluye las regresiones nuevas. Dependencia temporal: PR #49; rama `codex/paginacion-facturacion-comprobantes`.

La publicación y las comprobaciones por entorno se registran en `deploy/staging/VALIDACION.md` y `deploy/produccion/VALIDACION.md`.

Publicado en staging y producción con backend `cdeab2cf9a4611d1882adca64a0b6f897169a140` y web `a2999b3337d670e8572b033476f6c600aa97addb`, con las mismas imágenes verificadas y sin nuevas migraciones. Chrome comprobó la selección entre páginas y búsqueda histórica en staging; producción se recorrió sin emitir ni enviar comprobantes. La evidencia completa, versiones y respaldos figuran en los registros por entorno.
