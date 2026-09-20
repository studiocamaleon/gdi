# Grafo frente a Twist y Smartier

**Relevamiento: 19 de septiembre de 2026.** Base de Grafo: `main`, commit `c874b852b`. Documento de análisis y propuesta; no modifica precios ni capacidades.

## 1. Conclusión ejecutiva

Grafo tiene una base competitiva para imprentas digitales, gran formato, centros de copiado y fabricantes de cartelería. El motor técnico, las recetas de productos compuestos, el aprovechamiento de material, la planificación y el circuito comercial ya justifican una propuesta más ambiciosa que un simple cotizador.

La principal decisión es **qué operación queremos resolver completamente primero**. Recomiendo enfocarnos en talleres que combinan impresión digital, gran formato y cartelería. Intentar competir simultáneamente en flexografía industrial, packaging, logística de campañas y contabilidad multinacional dispersaría el desarrollo y el soporte.

Los próximos avances de mayor valor son: activación e implementación repetible, coherencia entre planes y producto, inventario reservado y compras, cierre económico de la OT y calidad/reproceso. La impresión directa es un diferenciador prometedor, pero debe conservar su condición de piloto Founder hasta completar su operación y soporte.

**Precios de lista sugeridos:** Print USD 190/mes, Sign USD 290/mes e Industrial desde USD 590/mes, con implementación separada. Los dos primeros importes actuales son defendibles. Industrial requiere alcance acordado y capacidades operativas verificadas; no debería venderse como un ERP industrial completo.

## 2. Alcance y criterio de evidencia

- Competidores: precios, matrices, páginas de producto/industria, preguntas frecuentes y procedimiento público de implementación. En Smartier se revisaron visualmente las marcas verdes y cruces: la extracción de texto sola atribuye funciones excluidas a los planes inferiores.
- Las prestaciones de terceros son **declaraciones comerciales**, no una certificación de que funcionen con la profundidad prometida. No se accedió a sus productos autenticados ni se solicitó una cotización comercial.
- Grafo: revisión de código, modelos, servicios, documentación reciente y catálogo de planes de la base local. La configuración local no demuestra cuál está publicada en producción.
- Se distingue entre implementado, parcial, piloto y no encontrado en el alcance revisado. Un endpoint o un modelo por sí solos no prueban madurez operativa.
- No se toma el diagnóstico de agosto como estado actual: campañas, documentos versionados, recetas, dependencias productivas y parte de la planificación se implementaron después.

## 3. Twist: oferta publicada

### 3.1 Planes y matriz completa, agrupada

| Plan | USD/mes | Usuarios |
|---|---:|---:|
| Go! | 299 | Ilimitados |
| Lite | 400 | 10 |
| Pro | 1.000 | 50 |
| Enterprise | 1.500 | Ilimitados |

Comunes: almacenamiento ilimitado, TLS, personalización URL/cuenta, presupuestos, CRM, OT, compras, stock, materiales, solicitudes, planta, despachos, documentación y chat.

✓ incluido; — excluido; + adicional.

| Funciones | Go! | Lite | Pro | Enterprise |
|---|:---:|:---:|:---:|:---:|
| AutoMode; programación de prensas; importación masiva | — | ✓ | ✓ | ✓ |
| Acabados; informes por estación; caminos críticos IA | — | — | ✓ | ✓ |
| Terceros; terminados; retrabajos; mantenimiento; calidad; wiki | — | — | ✓ | ✓ |
| Consultor; responsable de implementación | — | — | ✓ | ✓ |
| Integraciones | ✓ | — | ✓ | ✓ |
| Finanzas; constancia/satisfacción de entrega; preprensa | ✓ | + | + | + |
| Servicios de incorporación | + | + | + | + |
| Atención exclusiva; multiempresa | — | — | — | ✓ |

Implementación: importe único variable en Lite/Pro/Enterprise; Go! no la requiere. SAP: presupuesto específico. Finanzas menciona QuickBooks. Hay ambigüedades: Go! incluye complementos cobrados arriba; se anuncia implementación incluida y también un cargo. Confirmar alcance por escrito. [Fuente: precios de Twist](https://www.twistsoftware.com/es/precios).

### 3.2 Profundidad funcional que publicitan

**Cotización e IA.** Ingesta de especificaciones desde formulario, archivo o correo; cálculo con equipos y costos del cliente; propuesta económica revisable por una persona; comparación con márgenes históricos. También anuncian acceso mediante API y MCP para agentes. No hay aquí una prueba independiente de precisión, ahorro o calidad de sus recomendaciones. [Cotizador](https://www.twistsoftware.com/es/cotizador-ia).

**Impresión comercial.** Evaluación de prensas, formatos, planchas y materiales; opciones por tirada recalculadas; repetición de pedidos; parte de producción desde estaciones y métricas de capacidad, margen y cumplimiento. Publican arranque en semanas para las configuraciones pequeñas. [Impresión comercial](https://www.twistsoftware.com/es/industrias/comercial).

**Packaging.** Acomodo de piezas en pliego, troquelado, pegado y acabados; trabajo con sustratos como SBS y microcorrugado; órdenes y archivos para proveedores; existencia de producto terminado por cliente, salidas parciales y registros de calidad por trabajo. [Empaque](https://www.twistsoftware.com/es/industrias/empaque).

**Etiquetas.** Flexografía angosta y digital en rollo; cálculo según desarrollo, tintas, herramientas y terminaciones; cantidades en metros o millares; secuenciación que considera cambios de tinta/troquel; reportes por prensa y turno. [Etiquetas](https://www.twistsoftware.com/es/industrias/etiquetas).

**Gran formato.** Materiales por superficie, rollos y placas, acabados y montaje; visibilidad de urgencias y programación de entregas/instalaciones. [Gran formato](https://www.twistsoftware.com/es/industrias/gran-formato).

**Localización.** Documenta integración fiscal mexicana CFDI/SAT. La cobertura fiscal debe verificarse país por país; no asumir equivalencia automática con ARCA argentina. [México](https://www.twistsoftware.com/es/software-para-imprentas-en-mexico).

### 3.3 Lectura competitiva

Su posición más fuerte es la amplitud industrial presentada como un circuito integrado. Para una planta, el valor no depende únicamente de cotizar rápido: importa que compras, programación, producción, entregas y resultado económico permanezcan conectados.

La otra ventaja comercial es la evidencia pública de clientes de distinto tamaño y rubro. Eso reduce el riesgo percibido al reemplazar el sistema de una empresa. Sus testimonios son referencias comerciales, no mediciones controladas de resultados. [Clientes](https://www.twistsoftware.com/es/clientes).

Para Grafo, competir sólo con una pantalla más atractiva sería insuficiente. La oportunidad está en una operación más específica, comprensible y rápida de adoptar, demostrada con los trabajos reales de cada prospecto.

## 4. Smartier: oferta publicada

### 4.1 Planes y matriz completa

| Plan | Mensualidad publicada | Usuarios desde |
|---|---:|---:|
| Lite | $79 | 3 |
| Pro | $239 | 5 |
| Enterprise | Cotización | 20 |

Los importes son «desde». La página no identifica claramente la moneda ni cuantifica la inversión inicial.

✓ incluido; — excluido; NP no publicado en esa tarjeta.

| Funciones | Lite | Pro | Enterprise |
|---|:---:|:---:|:---:|
| CRM; clientes; vendedores; automatizaciones | ✓ | ✓ | ✓ |
| Cotizador; plantillas; troqueles; ofertas; indicadores comerciales | ✓ | ✓ | ✓ |
| Órdenes; programación; suministros | — | ✓ | ✓ |
| Archivos | NP | ✓ | ✓ |
| Operarios; indicadores productivos; Excel | — | ✓ | ✓ |
| Inventario; entregas; transportistas; gestión ISO 9001; API | — | — | ✓ |

La inversión inicial depende de la implementación; Enterprise y ampliaciones requieren propuesta comercial. No equiparar gestión ISO con certificación de la imprenta. [Planes de Smartier](https://smartiersoftware.com/planes/).

### 4.2 Servicios y condiciones

Publicitan cotización multitecnología, conversión de presupuestos aceptados a producción, archivos con historial/permisos/aprobaciones y supervisión del trabajo en tiempo real. También anuncian personalización visual y parametrización de procesos.

El soporte por chat se incluye en todos los planes. La suscripción no obliga a contratar un año. Describen una devolución de la inversión de implementación por insatisfacción a los 60 días de uso productivo: no debe confundirse con una devolución de todas las mensualidades ni con una prueba gratuita.

La web estima implementación en 3–4 semanas y ofrece acompañamiento de configuración y capacitación. [Producto y preguntas frecuentes](https://smartiersoftware.com/).

Su procedimiento descargable plantea 30–60 días, sesiones recurrentes, referentes del cliente, parametrización de equipos/materiales/procesos y validación con trabajos reales, seguida de entrenamiento. Hay que confirmar cuál plazo aplica a la contratación actual. [Procedimiento de implementación](https://smartiersoftware.com/wp-content/uploads/2025/04/porc-impl-sm.pdf).

### 4.3 Lectura competitiva

Su entrada comercial permite captar negocios que quieren resolver primero la cotización. La operación completa requiere otra escala de producto y acompañamiento; no corresponde comparar esa puerta de entrada con toda la capacidad de Grafo.

La implementación documentada es una fortaleza: transforma conocimiento del dueño de la imprenta en datos y reglas utilizables por sus vendedores y operarios. Grafo necesita un proceso igual de claro, aunque logre hacerlo más breve para casos simples.

## 5. Grafo hoy: qué está realmente disponible

### 5.1 Matriz de capacidades y brechas

| Capacidad | Situación de Grafo | Evaluación competitiva / próximo paso |
|---|---|---|
| Cotización técnica | Motor por materiales, máquinas, tiempos, rutas, cargos y márgenes; snapshots económicos | Fortaleza. Demostrar exactitud con un conjunto de trabajos aceptados por cada imprenta. |
| Productos complejos | Recetas versionadas, componentes, condiciones, ramas paralelas y convergencias | Fortaleza relevante para cartelería y fabricación. Evitar que la configuración abrume a un taller simple. |
| Aprovechamiento del material | Nesting, piezas vectoriales, rollos/pliegos, consolidación en compuestos y exportaciones | Activo diferencial. El centro de corte operativo completo y su gestión persistente siguen siendo otra entrega. |
| Cartelería visual | Configurador, geometría, estructuras y visor 3D en main | Fortaleza demostrable para familias soportadas. La rama Grafo3D separada no se cuenta como funcionalidad disponible. |
| Presupuestos y OT | PDF, aprobación/rechazo, archivos y continuidad hacia producción | Base implementada. Medir tiempo de operación y reducir pasos para uso diario. |
| Relación con clientes | Clientes, historial, embudo de presupuestos, cupones y fidelización | Implementado. No equiparar automáticamente ese alcance a un CRM comercial completo con todas las automatizaciones posibles. |
| Proyectos/campañas | Coordinación comercial y documental | Ya existe; no clasificarla como pendiente por usar diagnósticos antiguos. Falta completar fulfillment de campañas. |
| Documentos/aprobaciones | Maestros, revisiones, solicitudes, decisión pública, liberación y gates | Ya existe una base fuerte. Faltan capacidades de preflight gráfico integral verificadas: fuentes, resolución, sangrado, perfiles de color, etc. |
| Producción | Tablero, estaciones, responsables, dependencias, bloqueos y registro de tiempos | Implementado; importante para vender control de taller y no sólo cálculo de precio. |
| Planificación | ETA de capacidad finita, calendarios, distribución de entregas y reprogramación asistida | Avanzado parcialmente. No presentarlo como optimización global industrial ni como F11 completa. |
| Lotes y entregas | Distribución por cantidades/fechas y operaciones de lote | El avance cuantitativo real, transferencias y despacho físico parcial siguen pendientes del alcance completo. |
| Inventario | Almacenes, ubicaciones, entradas/salidas, transferencias, Kardex y valorización | Base real. Faltan compromisos, reservas por OT, demanda y circuito integral de abastecimiento. |
| Compras y terceros | Proveedores y seguimiento de procesos tercerizados | No equivale a solicitud → OC → recepción parcial → conciliación. Brecha prioritaria. |
| Finanzas | Cobros, cuenta corriente, comprobantes, deudores, tesorería, egresos y cuentas por pagar | Buena base para pymes. No confundirla con contabilidad general completa. |
| Facturación argentina | Integración ARCA/AFIP implementada y condicionada por plan/configuración | Valor local. La existencia del código no acredita homologaciones o puesta en producción de cada cliente/país. |
| Rentabilidad | Márgenes, contribución y equilibrio a partir de snapshots; comparación de tiempos medidos | Falta un cierre integral de costo real por OT que incluya consumo, merma, terceros, fletes y reprocesos. |
| Calidad y retrabajo | Gates/bloqueos/reaperturas como base | No se encontró módulo completo de inspecciones, no conformidades y costo del retrabajo. F7 pendiente. |
| Mantenimiento | Equipos y calendarios como base | No se encontró gestión completa de órdenes preventivas/correctivas, repuestos y paradas asociadas. |
| Entrega y logística | Seguimiento público, retiro mediante QR y control comercial de entrega | Retirar una OT no equivale a bultos, transportistas, varios destinos y prueba de entrega. Brecha grande para industria/campañas. |
| Centro de copiado/CAD | Archivos, páginas/rangos, copias, faz, orientación y medidas; cantidades por página CAD | Diferenciador práctico para mostrador. La cotización ya se independizó de la conexión a impresoras. |
| Impresión directa | Documentos, CAD, etiquetas, perfiles y asistente; capacidad Founder | Piloto. El ejecutor depende del navegador y QZ; no hay todavía conector residente comercial terminado. |
| IA e integraciones | MCP con búsqueda de producto/cliente, formulario y cotización real sin persistir | Ya hay una base; no proponer construirla de cero. Falta empaquetar la experiencia y ampliar integraciones/API pública de forma controlada. |
| Acceso y SaaS | Multi-tenant, permisos, MFA, archivos privados, registro y suscripciones | Base implementada. Falta acreditar operación de servicio: recuperación, monitoreo, soporte, disponibilidad y despliegue repetible. |

**Evidencia principal del inventario anterior:**

- [Plan maestro y registro de fases](/Users/lucasgomez/gdi-saas/docs/visual-ilusion-plan-maestro.md:1723).
- [Capacidad, entregas y límites de F6](/Users/lucasgomez/gdi-saas/docs/visual-ilusion-plan-maestro.md:1046).
- [Servicios de inventario](/Users/lucasgomez/gdi-saas/apps/api/src/inventario/inventario-stock.controller.ts:27).
- [Documentación versionada y aprobaciones](/Users/lucasgomez/gdi-saas/apps/api/src/desarrollo-documental/desarrollo-documental.controller.ts:75).
- [Rentabilidad basada en snapshots](/Users/lucasgomez/gdi-saas/apps/api/src/reportes/rentabilidad.service.ts:39) y [tiempos medidos](/Users/lucasgomez/gdi-saas/apps/api/src/reportes/produccion.service.ts:192).
- [Herramientas MCP existentes](/Users/lucasgomez/gdi-saas/apps/api/src/mcp/mcp-server.factory.ts:56).
- [Alcance y disponibilidad de impresión](/Users/lucasgomez/gdi-saas/docs/impresion/plan-impresion-operativa.md:8).
- [Preparación de despliegue: diagnóstico documentado](/Users/lucasgomez/gdi-saas/docs/despliegue-entornos-arquitectura.md:329). Parte de las pruebas de carga se amplió después en F6; eso no sustituye una operación productiva acreditada.

### 5.2 El desajuste comercial que corregiría primero

La web del repositorio anuncia **Print / Sign / Industrial**, mientras el catálogo local tiene **Taller / Producción / Enterprise**. No son sólo nombres:

| Catálogo local | Mensualidad | Usuarios | OT/mes | Archivos | Capacidades particulares |
|---|---:|---:|---:|---:|---|
| Taller | USD 190 | 6 | 300 | 20 GB | WhatsApp; sin ARCA ni Centro de copiado habilitados |
| Producción | USD 290 | 15 | 1.200 | 100 GB | WhatsApp, ARCA y Centro de copiado |
| Enterprise | A consultar | Sin tope declarado en esa configuración | 1.200 | 100 GB | Lo anterior, prioridad y 4 horas de especialista declaradas |
| Founder | Interno | Acceso general | Interno | Interno | Impresión directa habilitada |

Taller y Producción tienen prueba de 14 días. Enterprise no tiene alta pública autónoma. El valor técnico cero de Enterprise no significa gratuidad: está marcado «a consultar». Founder no debe emplearse como referencia comercial.

La web propone diferenciar por tipo de fabricación, pero esos derechos no se reflejan de la misma forma en las capacidades del plan. Además, dejar el Centro de copiado fuera de Print/Taller reduce el valor de entrada precisamente para centros de impresión. **Recomiendo incluir su cotización en el plan base y conservar la impresión directa como capacidad separada.**

Fuentes locales: [planes de la web](/Users/lucasgomez/gdi-saas/apps/marketing/src/app/page.tsx:65), [catálogo comercial migrado](/Users/lucasgomez/gdi-saas/apps/api/prisma/migrations/20260827190000_registro_publico_tenants/migration.sql:23), [habilitación del centro](/Users/lucasgomez/gdi-saas/apps/api/src/centro-copiado/centro-copiado.controller.ts:46). Los valores fueron contrastados con `Plan` en la base local, sin modificarla.

## 6. Dónde competir y dónde ser prudentes

### Ventajas defendibles

1. **Trabajo heterogéneo:** combinar impresión, corte, estructuras, montaje y componentes dentro de la misma cotización/OT. Hay una oportunidad en empresas que hoy reparten eso entre planillas y varias aplicaciones.
2. **De mostrador a fabricación:** atender una carga de PDFs y también un producto compuesto. La clave comercial es mostrar una interfaz proporcional a cada caso.
3. **Costeo explicable:** poder responder qué material, tiempo, máquina y margen producen un precio. Demostrarlo es más convincente que afirmar genéricamente que el cálculo es inteligente.
4. **Experiencia cliente:** presupuesto con identidad del tenant, aprobación, seguimiento y retiro por QR conectados al estado comercial.
5. **Especialización argentina inicial:** administración y facturación local reducen trabajo fuera del sistema, siempre que la puesta en marcha esté validada.

Son fortalezas del producto; este relevamiento no demuestra que sean exclusivas ni que los competidores carezcan de equivalentes.

### Riesgos de competir antes de cerrar las brechas

- Un margen calculado con el presupuesto original puede ocultar que la fabricación consumió más material o tiempo. Es necesario distinguir **margen previsto** de **resultado real**.
- La falta de reservas hace posible prometer el mismo stock a varias órdenes. No se arregla mostrando mejor el saldo.
- La disponibilidad de un operario o una máquina no demuestra que el pedido pueda salir: pueden faltar material, un tercero, una aprobación o una operación logística.
- Un cotizador potente exige parametrización. Si sólo Lucas puede dejarlo funcionando, el límite de crecimiento será implementación y soporte.
- Una prueba de carga local o un conjunto amplio de tests no equivalen a miles de empresas operando con respaldo, observabilidad y recuperación ensayada.
- La promesa de «Industrial» aumenta la expectativa de continuidad, trazabilidad y servicio. El nombre exige más que agregar módulos.

## 7. Prioridades de desarrollo recomendadas

**Actualización de prioridad acordada el 19/09/2026:** el usuario prioriza completar materiales, reservas y compras antes de la preparación comercial. Se desarrolla el [plan de compras y abastecimiento](../compras-abastecimiento-investigacion-y-plan-2026-09-19.md), con políticas configurables para gráficas pequeñas, medianas e industriales. El orden siguiente conserva la recomendación original del relevamiento; esta decisión posterior gobierna el próximo trabajo.

Orden de inversión propuesto, no cronograma comprometido. Antes de estimar fechas hay que acordar alcance y responsables.

| Prioridad | Entrega concreta | Criterio de aceptación | Motivo |
|---|---|---|---|
| P0 | Matriz única de planes/capacidades, usada por web, registro, API y UI | Una cuenta contratada obtiene exactamente lo anunciado; cambio de plan y límites probados | Evita promesas contradictorias y soporte manual |
| P0 | Implementación guiada por rubro | Una imprenta externa configura sus principales trabajos con ayuda acotada y deja registrada su validación | Convierte funcionalidad en adopción |
| P0 | Operación SaaS verificable | Restauración ensayada, alarmas, despliegue/reversión y responsable de incidentes | Hace defendible cobrar un servicio mensual |
| P1 | Materiales comprometidos y compras | Dos OT compiten por el mismo stock sin sobrerreservarlo; compra y recepción parcial actualizan disponibilidad | Cierra la brecha operativa más transversal |
| P1 | Cierre económico de OT | Diferencia estimado/real explicada por material, tiempo, tercero y gastos imputados | Permite aprender qué trabajos ganan o pierden dinero |
| P1 | Calidad y reproceso básico | Registrar cantidad buena, rechazo, causa, responsable y retrabajo con costo propio | Evita esconder el problema reabriendo un paso |
| P2 | Entregas físicas parciales y bultos | Una OT puede despacharse parcialmente sin quedar toda entregada; hay receptor y evidencia | Necesario antes de logística avanzada |
| P2 | Preflight inicial y experiencia de revisión | Detectar errores acordados; conservar versión y aprobación utilizada para producir | Reduce desperdicio y discusiones con clientes |
| P2 | Asistente comercial apoyado en MCP | Completa un borrador con datos verificables, usa el motor y requiere revisión humana | Aprovecha lo existente sin delegar decisiones económicas a texto generado |
| P2 | Conector de impresión y onboarding | Recupera estado tras cerrar navegador/reiniciar equipo; evita duplicados y diagnostica fallos | Convierte el piloto en un producto soportable |
| P3 | Mantenimiento, logística multidestino, API pública e integraciones empresariales | Casos concretos acordados con clientes que los necesitan | Ampliación industrial, no requisito para vender el núcleo |

### 7.1 Implementación guiada: qué construir

- Paquetes iniciales por rubro con equipos, materiales, recetas y ejemplos seleccionables; siempre confirmar costos y velocidades del taller.
- Importación con vista previa, validación, deduplicación e informe de errores. Ya existe importación de clientes; extender con criterio, no rehacerla.
- Lista visible de datos faltantes y quién debe completarlos.
- Comparación de 10–20 trabajos reales contra la forma actual de presupuestar. Explicar diferencias y aprobar parámetros.
- Capacitación por rol: comercial, operario, administración y responsable.
- Revisiones de activación y uso. La unidad de éxito es operar trabajos reales, no completar formularios.

La prueba gratuita puede mostrar valor con datos de demostración; para operaciones complejas debe acompañarse de una implementación con alcance. No prometer que cualquier fábrica estará calibrada en 14 días.

### 7.2 Orden de stock, costo real y calidad

Conviene compartir un modelo de cantidades y movimientos. Primero distinguir físico, reservado y disponible; después registrar entradas, consumos, devoluciones y desperdicio por OT. La recepción debe soportar faltantes sin cerrar toda la compra. Ese registro alimenta el costo real y luego las no conformidades.

Un MVP útil de calidad no necesita convertirse en una suite ISO: necesita identificar qué salió mal, cuántas unidades afectó, qué se hizo y cuánto costó. La gestión documental de una norma y la certificación de una empresa son asuntos diferentes.

### 7.3 Qué no priorizaría ahora

- Copiar un ERP contable general, integrar SAP sin cliente concreto o abordar todas las localizaciones fiscales simultáneamente.
- Publicitar IA autónoma para fijar precios o modificar compromisos sin supervisión.
- Hacer del envío a impresoras un requisito para cotizar o una promesa común a todos los planes.
- Completar todos los casos de shopper antes de vender a talleres cuya operación ya se puede cubrir.

## 8. Propuesta de precios y paquetes

**Hipótesis comercial:** venta inicial a pymes gráficas de Argentina y Latinoamérica; precios de Grafo expresados en USD por empresa/mes, antes de impuestos y extras. No es una medición de disposición a pagar ni de costos reales de Grafo.

### 8.1 Lista recomendada

| Plan propuesto | Precio | Cliente objetivo | Alcance propuesto |
|---|---:|---|---|
| Print | **USD 190/mes** | Imprenta digital, copiado, CAD y gran formato con flujo simple | Cotización, archivos/rangos, presupuestos, OT, producción básica, clientes, cobros, seguimiento, QR y stock base; 6 usuarios de referencia |
| Sign | **USD 290/mes** | Taller con fabricación y productos compuestos | Print más cartelería soportada, estructuras, componentes, costeo/recetas y planificación ampliados; 15 usuarios de referencia |
| Industrial | **Desde USD 590/mes** | Operación con mayor coordinación y acompañamiento | Alcance pactado, mayor capacidad, implantación y soporte; referencia de 30 usuarios. Reservas/compras/calidad sólo se ofrecen como incluidas cuando estén listas |
| Founder | **Privado** | Validación interna | Pilotos y experimentos, incluido el envío directo a impresoras |

No cambiaría el precio sólo para quedar por debajo de una cifra de entrada ajena. Los niveles actuales de USD 190 y 290 tienen sentido si conseguimos que el comprador vea una operación completa para su tamaño y una implementación confiable.

**Industrial no es una licencia para prometer pendientes.** Hoy puede ofrecerse como proyecto acotado a capacidades disponibles, con servicios explícitos. Las funciones futuras deben figurar como futuras, con su propia aceptación.

### 8.2 Entrada al mercado

Para una cohorte pequeña de clientes de lanzamiento se puede ensayar **USD 149 Print / USD 249 Sign durante 12 meses**, mostrando desde el inicio el precio posterior. No usar Founder como plan público ni otorgar descuentos vitalicios.

No agregaría ahora un cuarto plan muy barato: cotización técnica, configuración y soporte tienen costo, aun cuando el cliente tenga pocos usuarios. Si las entrevistas muestran demanda de un cotizador comercial aislado y autoservicio, entonces evaluar una oferta específica de USD 79–99, con alcance menor y economía propia.

### 8.3 Implementación y extras

| Concepto propuesto | Rango orientativo | Condición |
|---|---:|---|
| Inicio asistido Print | USD 300–600 una vez | Caso estándar, plantilla acordada y datos ordenados |
| Inicio asistido Sign | USD 700–1.500 una vez | Recetas, equipos, materiales y validación de casos definida |
| Proyecto Industrial | Desde USD 1.500 | Presupuesto por alcance, migración, integraciones y capacitación |
| Impresión conectada, futura | Ensayo de USD 49–99/mes por puesto conectado | Sólo después de medir instalación, soporte y confiabilidad; alcance/cantidad de equipos definidos |

Son hipótesis, no costos observados. El asistente gratuito de alta y la implementación hecha por una persona deben ser ofertas distinguibles. Los proyectos fuera de alcance se cotizan, no se absorben indefinidamente en la mensualidad.

Evitar cobrar cada escaneo o cada clic del operario: eso desalienta el registro. Si se separan licencias de gestión y perfiles operativos, tiene que existir ese derecho en el producto. No prometer usuarios ilimitados antes de conocer la operación y el costo.

Los topes actuales de 300/1.200 OT merecen validación: 300 órdenes son unas 10 por día en un mes de 30 días. Un centro de copiado activo puede alcanzarlas pronto. Recomiendo límites claramente comunicados, alertas y una vía de ampliación, sin sorpresas al emitir un pedido urgente. Archivo, OT y copia impresa deben tener unidades de cobro distintas y comprensibles.

### 8.4 Economía mínima antes de fijar definitivamente los precios

Medir por empresa: infraestructura, almacenamiento/transferencia, procesamiento de PDF/nesting, mensajería, comisiones de cobro, licencias de terceros y horas de soporte. La adquisición y el desarrollo también importan, pero no deben confundirse con el costo directo mensual del servicio.

Ejemplo propio, **no medición**: para un margen bruto objetivo de 75%, el costo directo máximo sería USD 47,50 en Print, USD 72,50 en Sign y USD 147,50 en Industrial de USD 590. Si Print consume USD 20 de infraestructura y dos horas de soporte a USD 25/h, cuesta USD 70 y su margen bruto baja a aproximadamente 63%. Eso justificaría mejorar activación, acotar servicios o revisar precio; no regalar más soporte.

El costo del primer año debe comparar **12 mensualidades + implementación + usuarios/extras + integraciones + impuestos**. Un precio publicado «desde» sin el resto de la cotización no permite concluir qué proveedor resulta más barato para una empresa concreta.

## 9. Cómo validar la estrategia comercial

1. Elegir entre 5 y 10 imprentas externas del segmento objetivo, incluyendo operaciones sin impresión directa.
2. Llevar los mismos casos reales por el circuito completo: presupuesto, archivos, aprobación, producción, entrega y cobro.
3. Medir activación: primera cotización útil, primera OT completada, horas de ayuda y porcentaje de trabajo que el cliente lleva al sistema.
4. Registrar objeciones separadas: precio, función ausente, dificultad de configuración y confianza. Un rechazo por falta de compras no demuestra que el precio sea alto.
5. Probar los precios de lista antes de descontar. Ofrecer lanzamiento a una cohorte definida y medir renovación/soporte.
6. Publicar casos autorizados con métricas: tiempo de cotización, retrabajos, cumplimiento y uso sostenido. No extrapolar resultados de un único taller.

No prometer retorno numérico sin medirlo. El argumento comercial debería ser un trabajo real resuelto mejor, con sus costos y límites a la vista.

## 10. Preguntas abiertas para cotizaciones formales de competidores

- Moneda exacta, impuestos, periodicidad, permanencia, revisión de precios y costo de alta.
- Precio final con las tecnologías y usuarios de una imprenta concreta; diferencia entre usuario administrativo, vendedor y operario.
- Exportación completa al salir, retención de archivos, límites de uso y recuperación de información.
- Horarios y niveles de soporte, capacitación incluida y condiciones de reembolso.
- Demostración de reserva de stock concurrente, recepción parcial, costo real, reproceso y entrega parcial.
- Alcance de API, costos por integración y disponibilidad de un entorno de prueba.
- Demostración de geometría/nesting con archivos del cliente; exactitud y controles de las funciones de IA.

Estas incertidumbres no impiden diseñar Grafo, pero sí impiden afirmar una equivalencia funcional o un ahorro porcentual exacto frente a una contratación real.

## 11. Decisión recomendada

**Mantener USD 190/290 como referencia, construir una implementación repetible y cerrar stock/compras/costo real.** Comercializar lo que ya resuelve trabajos concretos. Conservar la impresión directa como piloto Founder y liberar su futura oferta sólo cuando el conector y el soporte estén listos. Ofrecer Industrial con alcance explícito, creciendo sobre las capacidades validadas.
