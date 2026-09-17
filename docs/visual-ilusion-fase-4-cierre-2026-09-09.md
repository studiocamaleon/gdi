# Cierre de las ampliaciones de F4 — 09/09/2026

**Estado: F4 y sus ampliaciones CERRADAS, VALIDADAS E INTEGRADAS EN LOCAL.** Este cierre sucede a la [auditoría del 09/09](visual-ilusion-fase-4-revision-final-2026-09-09.md). No inicia F5 ni declara demostrado un óptimo geométrico global.

## Corrección de H10 y volumen de snapshots

El problema no era que 150 exhibidores no pudieran fabricarse. El resultado válido tenía 1.350 piezas, 96 placas y cinco layouts. Al guardar y emitir se serializaban repetidamente unos 36,6 MB y se excedían las transacciones de cinco segundos.

Cambios de contrato:

- Codec JSON estructural, autónomo y versionado. Un diccionario guarda estructuras idénticas una vez y conserva los contornos numéricos completos, sin redondear, eliminar capas ni depender de una caché mutable.
- En PostgreSQL se compactan exclusivamente bloques geométricos. Pasos, componentes, materiales, cantidades y costos permanecen consultables mediante SQL para los reportes existentes. El diccionario comprimido reside en el mismo snapshot.
- El lector Prisma admite JSON histórico y restaura las geometrías de forma diferida. Crear una OT copia los bloques inmutables sin expandirlos ni volver a codificarlos. La visualización y la exportación reciben el contrato habitual. Si se modifica una geometría leída, se codifica su valor nuevo; no se reutiliza una versión anterior ignorando cambios.
- El motor prepara la persistencia antes de abrir su transacción. Las escrituras que sólo necesitan identidad solicitan el ID. La materialización de componentes y lotes reutiliza sus lecturas dentro de cada operación.
- La numeración definitiva se asigna después de materializar la geometría, conservando contador, rollback e idempotencia dentro de la misma transacción. El número provisional no sale de la transacción ni se almacena en sus eventos finales.
- La inicialización concurrente de la configuración de fidelización usa inserción tolerante a duplicados; dos primeras órdenes de una empresa no compiten con un `upsert` de actualización vacía.
- BullMQ guarda la cotización compacta. HTTP negocia el formato mediante `Accept: application/vnd.grafoprint.snapshot+json`; los clientes anteriores conservan JSON convencional. La compactación ocurre después de aplicar permisos de costos. El frontend restaura el resultado antes de entregarlo a sus pantallas.

No se aumentó el timeout global ni el de las transacciones de aceptación.

## Mediciones y aceptación

Medición final con lectura diferida y transacciones normales:

| Cantidad | Snapshot expandido | Snapshot almacenado | Recotizar y guardar | Emitir OT |
| --- | ---: | ---: | ---: | ---: |
| 50 | 12.260.959 bytes | 208.219 bytes | 346 ms | 213 ms |
| 100 | 24.436.266 bytes | 247.895 bytes | 590 ms | 198 ms |
| 150 | 36.613.509 bytes | 286.230 bytes | 837 ms | 197 ms |

El snapshot de 150 ocupa un **99,22 % menos**. El resultado completo de transporte queda en ~1,82 MB de JSON compartido y ~155 KB con gzip HTTP. Los valores no son una simplificación ni una pérdida de precisión del DXF.

Una tanda de cuatro guardados de 150 y tres emisiones concurrentes pasó: guardados 3,27 s; emisiones 224 ms en total. Las transacciones de esas emisiones tardaron 130–165 ms. Son mediciones locales con búsquedas capturadas, no un ensayo de cientos de sesiones ni una promesa de latencia de producción. Los tiempos de recotización de la tabla aíslan persistencia del tiempo de búsqueda de GrafoNest.

El contrato de aceptación verifica guardar→reabrir→recotizar→emitir→ejecutar→reportes/tracking para 50/100/150. Comprueba cantidades, poses y capas exactas; importes y costos variables; cero duplicación por reintento; aislamiento entre empresas; rollback y lectura de registros anteriores. Los doubles aíslan la búsqueda ya calculada, comunicaciones y preparación externa de recorridos; las operaciones comerciales y de producción usan servicios y transacciones reales.

## Verificación final

| Control | Resultado |
| --- | --- |
| API general | 280 suites, 2.464 pruebas y 10 snapshots aprobados; 11 opt-in omitidas en esa corrida. |
| Web general | 87 archivos, 740 pruebas aprobadas. |
| HTTP, Redis real y codec | 12 pruebas aprobadas en Redis efímero: worker, plan grande, aislamiento entre empresas, permisos de costos y compatibilidad. La última corrección de `Vary: Accept` se revalidó con 10 pruebas de codec/HTTP/Prisma. |
| Persistencia comercial y producción | 50/100/150 → guardar, reabrir, recotizar, emitir, ejecutar, reportes y tracking; concurrencia, reintentos y snapshots congelados incluidos en API general. |
| Motor/CAD y catálogo histórico | Se conserva la aceptación de esta misma auditoría: Puma real 4/4, CAD Python 12/12, catálogo histórico 5/5. El núcleo CAD no cambió en la corrección H10. Las pruebas históricas no sustituyen la nueva aceptación transaccional. |
| Builds | API y Next.js de producción aprobados. |
| Migraciones | 229 aplicadas en desarrollo; sin pendientes. La auditoría también verificó la base de pruebas. |
| CSS y diferencias | `npm run css:guard` y `git diff --check` aprobados. |
| Entorno local | API y worker actualizados; API y web responden 200. La pantalla comercial abierta sigue recibiendo datos con la negociación nueva. |
| Registros existentes | 48 examinados; 5 ítems de cotización y 2 de OT compactados; cero conflictos. Hashes canónicos de geometría/costos/fechas idénticos antes y después. Segunda ejecución: cero candidatos. |

La regresión general se completó antes de añadir la última prueba opt-in de Redis y la lectura escalar del codec para logging; ambos cambios se verificaron después en las suites dirigidas y el build final. No se suman corridas solapadas para inflar el total.

## Registros existentes, despliegue y reversión

1. Actualizar juntos los procesos de API y los workers antes de generar snapshots nuevos. El frontend negocia transporte y acepta respuestas anteriores.
2. Ejecutar `apps/api/scripts/compactar-snapshots-f4.ts --tenant=UUID` para revisar candidatos. Agregar `--aplicar` para cambiar su representación, registro a registro. Conserva valores y fechas. Compara `updatedAt` donde existe; en ítems de OT compara los JSON originales porque ese modelo no tiene `updatedAt`. Así no sobrescribe una edición concurrente.
3. Para volver a una versión de código anterior al codec, ejecutar primero el mismo script con `--aplicar --restaurar`. No arrancar un lector antiguo contra snapshots compactos. La caché de cotizaciones BullMQ también tiene un formato nuevo: drenar los trabajos antes de un rollback del worker y conservar el lector nuevo para consultar sus resultados, o retirar esa caché temporal una vez drenada; nunca borrar la fuente histórica de una OT.

El codec de transporte no se acepta como atajo para inputs del cliente. Los JSON pequeños y las configuraciones no geométricas siguen con su representación normal. Los consumidores de mantenimiento que leen estos campos deben usar `PrismaService` o la extensión de snapshots.

## Límite de cierre y siguiente etapa

Esta corrección cierra la persistencia del plan cotizado y su ejecución histórica. La liberación operativa genérica del plan, revisiones y consolidación entre órdenes siguen en F5. La calibración de herramientas/controladores reales debe validarse con un operador antes de liberar ese piloto. Lotes físicos y avances parciales corresponden a F6.

Capacidad física de CPU/RAM y pruebas prolongadas con cientos de sesiones deben medirse en la infraestructura de despliegue. No basta extrapolar el nesting de un producto ni la capacidad de esta máquina de desarrollo.

Evidencia de esta intervención: `output/cierre-fase-4-2026-09-09/`. La primera corrida conjunta de build API, build web y regresión agotó recursos del equipo de desarrollo y produjo timeouts de hooks; las verificaciones afectadas se repitieron de forma aislada y aprobaron. Tailwind ahora toma sus clases desde `src/`, evitando leer archivos CAD/fixtures como estilos.

## Integración y referencia recuperable

Implementación guardada en `db59fc660`; rama de origen `codex/cotizacion-operaciones-herramientas-corte`, conservada. Merge local `516e584ef` en `visual-ilusion/analisis` el 09/09/2026, incluyendo los tres commits previos de herramientas, piezas vectoriales y archivos de producción.

El árbol del merge coincide exactamente con el árbol validado (`5c95845aa8afefc411fb76816f3557def465bce2`); no hubo conflictos ni cambios de implementación durante la integración. Se verificó con `git diff --exit-code` entre ambas referencias. La actualización posterior al merge sólo registra este cierre documental. API y worker locales ejecutan el build aprobado. No se publicó a `main`, no se hizo push y no constituye despliegue a producción.

F5 queda habilitada para análisis y diseño; no se inicia automáticamente. El backlog de optimización global de GrafoNest y la capacidad física de despliegue conservan su alcance independiente.
