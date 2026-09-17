# Configuración del taller — estética Grafoprint

Fecha: 08/09/2026.

**Estado: INTEGRADA EN LOCAL EN `visual-ilusion/analisis` · REGRESIÓN POSTERIOR APROBADA.**

Intervención intermedia fuera de las fases numeradas del Plan Maestro, solicitada después del cierre integral de F4. Rama: `codex/estetica-grafoprint-configuracion`, creada desde `visual-ilusion/analisis` después del merge de F4 (`f2dcfa8d9`). Destino de integración: `visual-ilusion/analisis`.

## Alcance implementado

| Área | Superficies |
| --- | --- |
| Centros de costo | Encabezado, filtros, tabla y acciones; ficha lateral de alta/edición con datos generales, gastos, ajustes e historial. |
| Maquinaria | Listado y filtros, alta, ficha de identidad, ajustes técnicos, perfiles y desgaste; modal de configuración de tintas/tóner. |
| Nodos de producción | Catálogo de simples/compuestos, editor de nodo simple y compuesto, asistentes y editor de paneles. El alta de nodo propio conserva el tratamiento Grafoprint incorporado en F4. |
| Flujos de producción | Listado, identidad y editor; duplicación, selección de nodos, cambio de nombre y confirmación de actualización de productos. |

Se unificaron encabezados, jerarquía tipográfica, superficies cálidas, acentos naranjas, tablas técnicas y acciones. Las fichas mantienen las acciones visibles y el desplazamiento dentro del contenido; los formularios adaptan sus columnas al ancho disponible.

Los estilos nuevos están en `grafoprint-configuracion.module.css` y el encabezado compartido en `encabezado-configuracion.tsx`. Se trasladaron 29 reglas del editor operativo desde `globals.css` al módulo compartido: 221 líneas globales menos, sin nuevas clases globales. El ámbito incluye tanto el editor de nodos como su uso dentro de productos para conservar la presentación existente.

El modal de consumibles utiliza el componente Dialog compartido, con título accesible, cierre por teclado y gestión de foco. Se añadieron nombres accesibles a selectores y búsquedas. Las operaciones, cálculos y contratos de guardado no cambian por esta intervención visual.

## Validación

- Revisión manual en navegador a 1920 × 878 y 390 × 844: listados, fichas, nodos simples/compuestos, flujos y modales principales.
- Corregida la barra de acciones de Flujos que cubría contenido en móvil y el panel lateral de Nodos que comprimía el formulario.
- Comprobados cierres/cancelaciones de diálogos, formularios sin cambios con Guardar deshabilitado, historial del centro y perfiles/tóner de Ricoh C8003. No se publicaron cambios ni se crearon registros durante la revisión visual.
- Web: 701 pruebas aprobadas. API: 2.260 pruebas aprobadas y 11 omitidas por la configuración de la suite general.
- TypeScript, CSS guard y `git diff --check` aprobados.
- Base de prueba aislada: `gdi_saas_estetica_20260908_test`, preparada con 226 migraciones y seed desde cero. El commit separado `c6e4d9c8f` estabiliza ese seed y los fixtures de regresión: catálogo propio de Tarjetas, receta alternativa aislada, identidades del catálogo base y tiempo suficiente para la prueba integral de OT.

La integración visual se realizó localmente mediante `eecd85896`, conservando ambas ramas. La primera regresión posterior encontró seis vencimientos de tiempo en dos suites: el caso de tres OT compartía un límite total de 30 s y los reportes tenían 5 s frente a transacciones de 25 s. Se alinearon esos límites con el trabajo real (120 s para las tres OT y 30 s por reporte), conservando todas las aserciones y los límites de cada transacción. No son pruebas de rendimiento.

La corrección de pruebas se integró en `eee4e4339`. Resultado final sobre `analisis`: 249 suites API, 2.260 pruebas y 10 snapshots aprobados; 11 pruebas optativas omitidas; web 701/701, TypeScript y CSS guard aprobados. Los resultados y logs están en `output/estetica-configuracion-2026-09-08/`; el primer log con vencimientos se conserva como diagnóstico, no como evidencia de aprobación. La base temporal propia se eliminó al terminar, sin eliminar ni reinicializar las bases habituales.

F5 permanece pendiente: el próximo alcance se decidirá con el usuario entre esa fase y un trabajo previo de Mesa de corte/perfiles. Esta intervención no inicia ninguna de esas alternativas.
