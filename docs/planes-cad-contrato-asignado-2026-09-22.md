# CAD y guardado de cotizaciones con contratos asignados

## Resultado

El recorrido de Planos CAD se verificó con versiones publicadas y asignadas de Esencial, Pro y Avanzado. El resolvedor consulta PostgreSQL durante el recorrido; no se reemplaza el mapa de capacidades.

- Catálogo comercial sin destinos QZ asociados al plotter de la prueba.
- Cotización con motor real en B/N y color, rango `1,3` y cantidades distintas por página.
- La página 1 solicita dos copias; la 3, una. La página 2 queda excluida aunque tenga siete copias configuradas y medidas mayores que el rollo.
- Escala declarada 100 %, medidas y configuración conservadas en el cálculo guardado que referencia la OT.
- Creación de una OT emitida con precio autoritativo y paso de impresión por área.
- El servicio de impresión rechaza operar por falta de `impresion_directa`, antes de descargar archivos o firmar envíos. No impide cotizar ni emitir normalmente.

## Corrección del guardado

La autorización inicial podía quedar desactualizada mientras el motor calculaba. Ahora `cotizarYGuardar` y `recotizarItem` toman el mismo lock de empresa que la asignación de planes y revalidan las funciones antes de escribir el borrador o su snapshot. El cálculo costoso permanece fuera de esa transacción.

La comprobación incluye Cotización, los metadatos de Copiado/CAD y geometría avanzada. También consulta la identidad de la plantilla reservada de Documentos: omitir `_centroCopiado` no elimina su control, ni el de sus pasos opcionales. Las reglas de carga y guardado de esa plantilla comparten el mismo resolvedor.

El guardado directo de tomos usa la misma protección, porque persiste un resultado compuesto y no pasa por `cotizarYGuardar`.

No se exige impresión directa para estos guardados. Tampoco se impide preparar borradores sólo por existir un cambio comercial pendiente: este bloque controla el contrato vigente, sin convertir una cotización en un compromiso de compra o producción.

## Transiciones comprobadas

| Cambio después del cálculo y antes de escribir | Resultado |
| --- | --- |
| Retirar CAD al guardar un plano nuevo | 403, sin cotización ni ítem nuevos |
| Retirar CAD al recotizar un plano existente | 403; snapshot y cantidades anteriores intactos |
| Presentar un lote A4 + CAD sin CAD | Rechazo de la carga completa; el A4 solo puede cotizarse y guardarse |
| Retirar Copiado y omitir la metadata de la plantilla | Se rechaza el guardado por la identidad del producto |
| Retirar Terminaciones al guardar otro tomo | 403; el tomo previo se conserva y no se agrega otro |

## Evidencia y límites

Pruebas en `apps/api/src/suscripciones/__tests__/planes-asignados-recorrido.integration.spec.ts`: 19 casos totales, siete agregados en este incremento. El helper `test/fixture-cad-planes.ts` adapta una receta de rollo del seed dentro de una transacción revertida. Se ejecuta exclusivamente contra `gdi_saas_test`, sin modificar la empresa operativa.

La retirada se intercala de forma controlada entre el cálculo real y la escritura, mediante publicación, diagnóstico y asignación reales. No es una prueba de concurrencia entre conexiones independientes. El lock compartido tiene pruebas de ese tipo en los incrementos anteriores; no se presenta esa evidencia como una carrera propia de CAD.

Verificación: **69 pruebas API aprobadas** en diez suites, sumando la suite de recorridos (19), Copiado y CAD (41), agregación y tomos (7) y la selección de guardado/recotización del motor (2). Tipos de producción y de las pruebas focales comprobados. Lint completo de los archivos pequeños correcto; los servicios conservan avisos de formato anteriores, por lo que también se comprobó su lint excluyendo únicamente `prettier/prettier`. No se imprime papel, no se leen PDF desde el navegador y no se ensaya aquí el controlador físico de HP.

Este incremento no cierra toda la matriz de funciones. Continúan pendientes otras combinaciones del editor, transiciones operativas de impresión, configuración concurrente de Copiado, recuperación comercial incierta y los requisitos de producción indicados en [cierre comercial](planes-cierre-comercial-2026-09-21.md).
