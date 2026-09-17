# Fase 4 — cierre integral verificado

**Estado: COMPLETA. Integrada en `visual-ilusion/analisis` en local el 08/09/2026.**

Fecha: 07/09/2026. Este documento reemplaza el dictamen de cierre pendiente de la [auditoría original](visual-ilusion-fase-4-auditoria-integral-2026-09-07.md). El [registro de trabajo](visual-ilusion-fase-4-cierre-integral-en-progreso.md) conserva los diagnósticos y resultados intermedios, incluidos los fallos corregidos.

El cierre comprende F4 original, F4.1–F4.4, ocurrencias, colecciones de piezas rectangulares/vectoriales, fuentes reutilizables, patrones y conservación de capas. Se corrigieron los ocho hallazgos del informe y un noveno descubierto durante la ejecución real de Compras. No quedan bloqueos conocidos de esta matriz. El cierre acredita la versión local probada; no implica integración en main, publicación remota ni certificación de cualquier combinación futura del catálogo.

## Hallazgos resueltos

| Punto | Resultado final | Evidencia principal |
| --- | --- | --- |
| H1 · Precedencias y ahorro | La consolidación comprueba el DAG completo, incluso precedencias transitivas, lotes anteriores y nodos compuestos, antes de aplicar ahorro. La materialización rechaza ciclos antes de modificar pasos/dependencias. | Regresiones del motor y `consolidacion-produccion.spec.ts`; reproducción SQL con rechazo sin residuos; emisión y ejecución de lotes compatibles. |
| H2 · Simuladores | Cada operación usa el contexto y la traza congelados de su componente/lote. Participaciones excluidas. El plan registrado se muestra conservando su acomodo y no admite reanidado rectangular independiente. | Pruebas de seguridad/fronteras/lotes, cinco recorridos del catálogo y QA visual de “Planes listos para imprimir”. |
| H3 · Costos y reportes | Lectura recursiva de componentes, sin sumar otra vez lotes ni operaciones internas. Materiales, consumibles, desgaste y tercerización completos; recuperación compatible de snapshots históricos sin subtotal de proveedor. | Seis casos SQL GENERAL/MIXTO/POR_COMPONENTE actuales/históricos; conciliación de las cinco OT del catálogo con ventas, rentabilidad y producto. |
| H4 · Áreas vecinas | Reportes, entrega y tracking usan raíces comerciales. Tiempos, productividad y ETA excluyen participaciones. El avance incluye hijos y nietos. | Entrega parcial/completa/revertida y rechazo con nieto pendiente; tracking sin despiece económico; concurrencia y reportes sobre OT ejecutadas. |
| H5 · Facturación | Factura individual/general/parcial, descuentos y productos gratuitos conservan los importes, sin facturar componentes internos. NC completa con control de doble acreditación. | PostgreSQL con servicios reales; PDF de factura y NC renderizados y revisados visualmente. Ninguna emisión fiscal real. |
| H6 · Geometrías y transporte | Referencias compactas por cuenta, archivo y hash; resolución recursiva y contexto rehidratado al guardar/recotizar. Contrato de piezas rectangulares dentro de grupos corregido. | HTTP, ValidationPipe, Redis y worker reales; seis fuentes extensas; guardar/reabrir/recotizar; rechazo de mezcla de hash y acceso ajeno. Exhibidor real de 1/10/50/51 unidades. |
| H7 · Varios niveles | OT materializa todos los ámbitos con identidades de lote separadas y traza propia. El cambio posterior del maestro no altera el snapshot vendido. | Motor real de dos niveles y siete ítems; ejecución completa, cuatro operaciones de lote y participaciones sin tiempo. Extracción de planes anidados y exportación con fuente/hash/capas propios por ámbito. |
| H8 · Calidad irregular | Política 8 con primeros intentos deterministas acotados, seguida de estrategias dentro del presupuesto global. | Caso Puma real: tres repeticiones consecutivas de ocho piezas en dos placas; geometría validada. No se promete mínimo geométrico en todos los pedidos. |
| H9 · Compras | Respeta DAG, ramas paralelas y gates; impide deshacer recepción con descendientes iniciados. Comparte lock con Producción e impide eventos duplicados. Reapertura y progreso coherentes; secuencia histórica conservada. | Dos recorridos SQL, dos recepciones concurrentes, tenant ajeno y orden entregada; Backlight real ejecutado hasta finalizar. |

## Recorridos de aceptación

| Recorrido | Resultado comprobado |
| --- | --- |
| Producto simple histórico | Tarjetas: cotizar, guardar, emitir OT de prueba, ejecutar y finalizar. Importes del snapshot; rechazos por permisos, tenant y finalización prematura; reintentos idempotentes. |
| Precio del compuesto | GENERAL, MIXTO y POR_COMPONENTE: cotización, persistencia, emisión y ejecución. Costos y redondeos sin duplicación. La prueba no atribuye ahorro a un material incompatible. |
| Kit de Vinilos | 1/10/50 unidades → 3/30/150 piezas. Ajuste de piezas a 40; inicio vacío e incluido; grupos adicionales de 10/20 piezas. Guarda y ejecuta el desglose. QA de catálogo en escritorio y 390 × 844. |
| Backlight | 200 × 100 × 20 cm. Bastidor guarda 200 mm de profundidad y publica lona de 2.200 × 1.200 mm. Lona consume ese output. Compra, producción y nodo de ensamble único convergen hasta finalizar. El catálogo actual tiene dos ramas; los opcionales/condicionales se acreditan con las regresiones del motor/grafo, sin inventar ramas ausentes de esta receta. |
| Exhibidor | Receta publicada v5, seis tipos de pieza. 1/10/50/51 unidades → 9/90/450/459 piezas, sin excedentes. Impresión y corte conservan posiciones, rotaciones y recorridos. Los cuatro resultados reales se persisten y ejecutan como OT en PostgreSQL de prueba. |
| Pedido de 50 exhibidores | 34 placas, tres patrones repetidos 25/5/4; 79,68 % de aprovechamiento. Pedido de 51: 34 placas, cinco patrones. Las búsquedas grandes agotaron 120 s y entregaron una solución válida. |
| Lotes y varios niveles | Rechazo de precedencias incompatibles; operación física única; concurrencia de inicio/cierre; dos ámbitos con códigos repetidos; maestro modificado después de cotizar sin afectar OT; finalización y tiempos sin aliases. |
| Áreas vecinas | Las mismas cinco OT del catálogo conciliaron una raíz comercial por pedido, costo completo y variables auditadas; producción contó únicamente operaciones ejecutadas y tracking mostró un producto al 100 %. Factura/NC y entrega se prueban en escenarios transaccionales específicos. |

La aceptación usa dos tramos explícitos: navegador/HTTP/worker calculan con el catálogo publicado; sus resultados capturados se importan en la base de prueba para persistir, emitir, ejecutar y consultar reportes. No se crearon ventas ni OT de prueba en la cuenta de desarrollo. Los servicios de persistencia, producción, compras, reportes y tracking son reales; las comunicaciones y preparación externa de recorridos están aisladas en el soporte de pruebas.

## Archivos de producción

- Se descargaron y reimportaron los DXF de una unidad y los tres patrones de 50 unidades con `ezdxf`: unidades mm, cero errores y cero reparaciones automáticas.
- La suma ponderada A×25 + B×5 + C×4 coincide con una unidad ×50: `CORTE_PARCIAL` 800 entidades, `HENDIDO` 600, `CORTE_3` 600, `GRAFICA` 650 y `Faldón_CORTE_3` 50. El prefijo humano identifica el conflicto de propiedades de esa capa; no es un identificador opaco.
- SVG y visor muestran capas sin operación y capas de proceso. La prueba de dos niveles comprueba fuente/hash/transformación propios aunque se repitan los códigos internos. La llamada CAD de esta prueba web está simulada; la reimportación nativa anterior y las doce pruebas Python acreditan el exportador real.
- La comparación geométrica al persistir normaliza a 10⁻⁹ mm por representación numérica PostgreSQL/Prisma; no cambia el acomodo productivo.

## Resultado de validación

| Control | Resultado final |
| --- | --- |
| API general posterior a H9 | 249 suites aprobadas, 2.260 pruebas y 10 snapshots aprobados; 3 suites/11 pruebas omitidas en la corrida general: cinco del catálogo y tres de Puma ejecutadas aparte, más tres benchmarks opt-in de placa/rollo. |
| Web general | 700 pruebas aprobadas, sin fallos. Después se añadió y aprobó la prueba de archivos anidados: su suite dirigida pasó 10/10. |
| Catálogo real → OT → reportes/tracking, opt-in | 5/5 aprobados, 61,2 s. |
| HTTP + worker real, opt-in | Aprobado, incluidos reuso de clave y aislamiento de cuenta. |
| Puma real, opt-in | Tres repeticiones aprobadas; evidencia conservada en `puma-aceptacion.json`. |
| Python CAD | 12/12 aprobadas. |
| Builds API y Next/webpack | Ambos aprobados con fuentes finales en copia aislada; assets Python incluidos. |
| CSS guard / diferencias | Aprobados, sin nuevas clases globales fuera de la base ni errores de whitespace. |
| PDFs | Borradores de factura y NC legibles, importes correctos, sin superposiciones ni recortes; proveedor fiscal no invocado. |

Los logs, capturas de resultados, CAD y PDF están en `output/cierre-fase-4-2026-09-07/`. Los logs fallidos intermedios permanecen como diagnóstico y no se usan como evidencia de aprobación.

## Entorno local final

- Migraciones de biblioteca de geometrías y traza de componentes aplicadas en desarrollo y en `gdi_saas_test`; Prisma Client regenerado.
- API y worker reiniciados con el build final. Frontend en `http://localhost:3000`, API en 3001. El frontend usa webpack para que los cambios globales de estilos se reflejen durante desarrollo.
- Fue necesario respaldar y regenerar la caché de Next al pasar desde Turbopack; el arranque limpio quedó operativo. Simulador y tablero responden correctamente con autenticación en el servidor habitual.
- API/web/worker de QA aislados detenidos y Redis efímero eliminado. La cola habitual estaba vacía al reiniciar. Se conservaron el build y la caché anteriores como respaldo local.
- Al emitir este informe el 07/09 aún no se había hecho commit ni merge. El 08/09 se consolidó el cierre en `8f220f650` y se integró en `visual-ilusion/analisis` mediante `f2dcfa8d9`. No hubo publicación ni despliegue remoto.

## Integración y continuidad del 08/09/2026

La regresión acumulada se verificó también sobre una base de prueba nueva, con 226 migraciones y seed completo: 2.260 pruebas API aprobadas, 11 omitidas según la configuración habitual, y 701 pruebas web aprobadas. La preparación del catálogo de pruebas y del seed se estabilizó en `c6e4d9c8f`; no se modificaron datos comerciales de desarrollo para obtener estos resultados.

Por decisión del usuario, antes de iniciar F5 se abrió una [intervención estética de configuración](grafoprint-configuracion-estetica-2026-09-08.md), fuera de las fases numeradas. Después se revisará si continuar con F5 o abordar primero Mesa de corte y perfiles.

## Límite de la fase y continuidad

F4 queda cerrada para el alcance anterior. F5 puede comenzar con el **centro de corte y planes operativos versionados**, estados/aprobación/liberación, consolidación entre órdenes, y herramientas/pasadas/tiempos por recorrido sobre las capas ya conservadas. Producción parcial y división/fusión van a F6; calidad y reprocesos a F7; reservas e inventario avanzado a F9.

Dos observaciones no bloquean este cierre: la optimización grande puede consumir el presupuesto de 120 s sin demostrar el mínimo geométrico; la descripción comercial del Kit aún conserva una mención antigua a MDF/placa aunque su configuración actual usa vinilo. Esta última es limpieza de contenido del catálogo, no un cambio del cálculo, y no se modificó silenciosamente el maestro real.
