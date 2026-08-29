# Lenguaje visual rector — Programa Visual Ilusión

**Estado:** contrato visual obligatorio  
**Aplica a:** Fases 1–16 del Plan Maestro  
**Referencias canónicas:** Tesorería y detalle de Orden de Trabajo de Grafoprint  
**Plan rector:** `docs/visual-ilusion-plan-maestro.md`

## 1. Decisión

Todas las fases del programa deben sentirse como una evolución nativa de Grafoprint.

Existen dos familias visuales canónicas:

1. **Gestión ejecutiva**, basada en Tesorería: campañas, coordinación, inventario, compras, logística y vistas de consolidación.
2. **Operación técnica**, basada en la Orden de Trabajo: recetas, rutas, producción, lotes, calidad, nesting, packing e instalación.

No se usará una estética shadcn genérica. Los componentes shadcn instalados son primitivas de comportamiento, accesibilidad y estructura; deben componerse y vestirse con el lenguaje propio de Grafoprint.

## 2. Qué significa “no usar shadcn simple”

### Sí se permite

- Reutilizar `Dialog`, `Sheet`, `Field`, `Select`, `Table`, `Tabs`, `Alert`, `Empty`, `Skeleton`, `Badge`, `Button` y demás primitivas existentes.
- Aprovechar su semántica, teclado, foco, ARIA y manejo de overlays.
- Usar variantes existentes cuando coincidan con la intención.
- Crear composición y layout propios mediante CSS Modules.
- Definir variantes Grafoprint en componentes compartidos cuando se repita un patrón real.

### No se permite

- Resolver una página como una grilla indiferenciada de `Card` defaults.
- Entregar componentes con el aspecto de ejemplo del registry sin adaptación.
- Usar dashboards genéricos de tarjetas blancas, ícono, título y número sin jerarquía narrativa.
- Repetir el mismo radio, sombra y espaciado en todas las superficies por comodidad.
- Introducir colores Tailwind crudos como identidad de módulo.
- Crear un design system paralelo desconectado de Tesorería y OT.
- Agregar estilos de módulo a `globals.css`.

## 3. Base visual compartida

### Tipografía

- Sans de producto para lectura, navegación y acciones.
- Monoespaciada para códigos, importes, métricas, cantidades, porcentajes, fechas operativas y datos de máquina.
- Títulos compactos con tracking negativo moderado y peso medio/semibold.
- Eyebrows en mayúsculas, pequeños y espaciados para ubicar contexto, no para decorar cada panel.

### Color

- Tinta principal casi negra, superficies claras y fondos cálidos/neutros existentes.
- Naranja Grafoprint como acento de acción, foco narrativo y marca; no colorear indiscriminadamente.
- Estados con semántica estable: correcto, atención, crítico, bloqueado, pausado e informativo.
- El color acompaña texto e ícono; nunca es la única señal.
- Los módulos nuevos consumen tokens existentes o tokens locales con nombre semántico dentro de su scope.

### Superficies

- Borde fino cálido/neutro.
- Radios moderados y jerarquizados: control < panel < KPI destacado.
- Sombras suaves para separar profundidad funcional, no para hacer flotar cada elemento.
- Gradientes y tramas sólo en una superficie protagonista o un estado que lo justifique.
- Densidad media/alta: Grafoprint es una herramienta de trabajo, no una landing page.

### Espaciado

- Ritmo consistente basado en gaps, no márgenes arbitrarios.
- Encabezado, resumen, herramientas y contenido forman bloques reconocibles.
- Las tablas y paneles técnicos priorizan comparación vertical y escaneo rápido.

### Iconografía

- `lucide-react`, consistente con el proyecto.
- Íconos lineales y sobrios.
- Los íconos refuerzan tipo de información o acción; no se usan como decoración repetitiva.

### Movimiento

- Transiciones cortas para hover, expansión, cambio de estado y progreso.
- Animación sólo si explica flujo, actualización o relación.
- Respetar `prefers-reduced-motion`.
- No usar animaciones de entrada masivas en pantallas operativas.

## 4. Familia A — Gestión ejecutiva

### Referencia

`src/components/administracion/tesoreria-view.tsx` y `tesoreria-view.module.css`.

### Casos de uso

- listados y fichas de campaña;
- dashboards agregados;
- inventario comprometido;
- compras y proveedores;
- destinos y logística;
- rentabilidad y cierre del programa.

### Anatomía

1. Encabezado con eyebrow, título, descripción y acciones claras.
2. Banda de KPIs con una métrica protagonista cuando exista una pregunta dominante.
3. Superficie protagonista oscura opcional para estado global, saldo, riesgo o avance total.
4. Paneles con encabezado interno, descripción breve y controles contextuales.
5. Layout maestro-detalle o principal-lateral cuando haya selección/contexto.
6. Tablas densas con tipografía monoespaciada en códigos y números.
7. Filtros compactos; evitar formularios gigantes siempre abiertos.

### Carácter

- Ejecutivo pero operativo.
- Elegante sin parecer marketing.
- Jerarquía fuerte: responder primero “¿cómo estamos?” y después “¿por qué?”.
- Naranja reservado para acción principal, foco y señal de marca.

### Patrones de estado

- KPI principal oscuro para la métrica que gobierna la decisión.
- Estado de campaña como chip textual sobrio.
- Riesgos en superficies claras con acento lateral o callout, no cards rojas completas.
- Ceros y ausencias honestos: “Sin datos”, “No aplica”, “Aún no calculado”.

## 5. Familia B — Operación técnica

### Referencia

`src/components/produccion/orden-trabajo-detalle-view.tsx` y estilos OT existentes.

### Casos de uso

- receta/BOM;
- ruta productiva y DAG;
- mesa de corte/nesting;
- lotes y producción parcial;
- QC, incidencias y reproceso;
- planificación;
- packing por escaneo;
- instalación en campo.

### Anatomía

1. Identidad operativa visible: código, cliente/campaña, producto/lote, cantidad y fecha.
2. Ruta, timeline o grafo como objeto principal cuando la secuencia importa.
3. Paneles plegables por producto, componente, lote o nodo.
4. Especificaciones en pares etiqueta/valor, con valores técnicos alineados.
5. Barra o rail de estado persistente para acciones de piso.
6. Acciones primarias ligadas a transiciones reales: iniciar, pausar, completar, bloquear, inspeccionar o empacar.
7. Historial y evidencia accesibles sin dominar la primera lectura.

### Carácter

- Preciso, denso y trazable.
- Códigos y cantidades primero; decoración mínima.
- El usuario debe comprender en segundos qué está listo, qué bloquea y qué sigue.
- El grafo visual representa reglas reales del backend, nunca una ilustración desconectada.

### Patrones de estado

- Nodo hecho, activo, pendiente, pausado y bloqueado distinguibles por forma, texto e ícono.
- Dependencias visibles y explicables.
- Cantidades con balance: entrada, buenas, rechazo, scrap y reproceso.
- Alertas pegadas al objeto que bloquean.

## 6. Combinación de familias

Una misma fase puede necesitar ambas familias, pero no mezclarlas sin jerarquía.

Ejemplo Campaña:

- listado y dashboard: Gestión ejecutiva;
- panel de avance por etapas: bloque técnico inspirado en OT;
- detalle de una OT: navega a la vista técnica existente, no la duplica dentro de campaña.

Ejemplo Logística:

- planificación de envíos y costos: Gestión ejecutiva;
- escaneo, carga y entrega: Operación técnica.

La pantalla define una familia primaria y puede incrustar componentes secundarios de la otra.

## 7. Matriz visual por fase

| Fase | Familia primaria | Aplicación |
|---:|---|---|
| 1 Campañas | Gestión ejecutiva | Listado, ficha y dashboard; avance productivo como bloque técnico |
| 2 Arte/aprobaciones | Operación técnica | Revisiones, gates y timeline; bandeja global con lenguaje de gestión |
| 3 Recetas/BOM | Operación técnica | Editor estructurado, componentes y recursos |
| 4 DAG | Operación técnica | Grafo, fronteras y ejecución |
| 5 Nesting/corte | Operación técnica | Plan, placa/rollo, máquina y cola |
| 6 Lotes | Operación técnica | Cantidades, genealogía y estados físicos |
| 7 Calidad/reproceso | Operación técnica | Inspección, incidencia y acción correctiva |
| 8 Variantes | Gestión + técnica | Matriz comercial al cotizar; curva técnica en OT |
| 9 Reservas | Gestión ejecutiva | Disponibilidad, asignaciones y trazabilidad |
| 10 Compras | Gestión ejecutiva | Requisiciones, OC, recepciones; tercero en OT conserva lenguaje técnico |
| 11 Planificación | Operación técnica | Gantt, capacidad y restricciones |
| 12 Kits/destinos | Gestión ejecutiva | Definición y matriz; completitud como bloque técnico |
| 13 Packing/QR | Operación técnica | Flujo mobile/tablet y escaneo |
| 14 Logística | Gestión + técnica | Planificación/costos; despacho/POD operativo |
| 15 Instalaciones | Operación técnica | Orden móvil, checklist, evidencia y firma |
| 16 Consolidación | Gestión ejecutiva | Dashboard final y rollout |

## 8. Aplicación específica a Fase 1 — Campañas

### Listado

- Familia Gestión ejecutiva.
- Encabezado con eyebrow `OPERACIONES`, título `Campañas` y acción naranja `Nueva campaña`.
- KPIs: activas, en riesgo, próximas a vencer y completadas; sólo una métrica protagonista si aporta una decisión real.
- Barra compacta de filtros por estado, cliente, responsable y fecha.
- Tabla densa con código monoespaciado, cliente, nombre, responsable, fecha compromiso, avance y riesgo.
- No usar mosaico de cards como vista principal: dificulta comparar campañas.

### Ficha

- Encabezado ejecutivo con código, cliente, nombre, estado y acciones.
- Superficie protagonista oscura para avance global, fecha compromiso o riesgo, sólo si los datos lo justifican.
- KPIs agregados: presupuestado, vendido/OT, facturado, cobrado y rentabilidad según permiso.
- Layout principal con panel de actividad/hitos y lateral con responsables, fechas y contexto.
- Bloque técnico de avance por etapas usando el lenguaje de ruta/estado de OT.
- Presupuestos y OTs como tablas relacionadas, nunca como cards decorativas.
- Archivos y timeline dentro de tabs o paneles con jerarquía clara.

### Formularios

- Dialog para alta breve y edición focalizada.
- `FieldGroup` y `Field` para estructura accesible.
- Selección buscable de cliente y responsable.
- Estado y prioridad no compiten visualmente con nombre y cliente.
- Errores inline más toast de resultado; no depender sólo del toast.

### Mobile

- KPIs apilables, tablas con columnas prioritarias o filas técnicas adaptadas.
- Acción principal accesible sin tapar contenido.
- Hitos y timeline conservan orden cronológico.
- No convertir toda la ficha en acordeones cerrados sin una lectura-resumen inicial.

## 9. Implementación CSS y componentes

- Cada vista nueva nace con `*.module.css`.
- `globals.css` no recibe clases de fase; sólo tokens realmente compartidos aprobados.
- Si un patrón aparece de manera estable en al menos tres módulos, se evalúa extraerlo como componente Grafoprint.
- Antes de extraer, mantener el estilo dentro del módulo para no generalizar prematuramente.
- Las primitivas shadcn existentes no se sobrescriben para resolver una única fase.
- Composición base:
  - shadcn para semántica y accesibilidad;
  - CSS Module para identidad, jerarquía, layout y estados del módulo;
  - tokens de Grafoprint para coherencia.
- Ejecutar `npm run css:guard` en cada cambio visual.

## 10. Requisitos de accesibilidad

- Contraste suficiente en texto, estados y controles.
- Foco visible y orden lógico de teclado.
- Títulos obligatorios en Dialog, Sheet y Drawer.
- Labels reales; placeholders no reemplazan etiquetas.
- Estados anunciables y comprensibles sin color.
- Tablas con encabezados; controles icon-only con nombre accesible.
- Targets táctiles adecuados en flujos de piso/mobile.
- Reducción de movimiento respetada.

## 11. QA visual obligatorio por fase

Cada fase debe verificar como mínimo:

- escritorio ancho y notebook;
- tablet cuando haya operación técnica;
- mobile cuando haya piso, packing, logística o instalación;
- datos vacíos, pocos datos y volumen alto;
- textos largos;
- loading, error y permisos restringidos;
- estados normales, atención, bloqueado y completado;
- importes ocultos para usuarios sin permiso;
- navegación por teclado y foco de overlays;
- comparación visual con Tesorería u OT según familia primaria.

La aceptación visual no consiste sólo en que “no se rompa”: debe sentirse inequívocamente parte de Grafoprint.

## 12. Criterio de rechazo visual

Una pantalla se considera incompleta si:

- parece una demo de componentes;
- podría pertenecer a cualquier SaaS cambiando el logo;
- no establece una jerarquía clara;
- usa cards para todo sin relación con la tarea;
- esconde densidad necesaria detrás de exceso de aire;
- inventa una paleta o patrón ajeno al producto;
- representa estados o flujo que el backend no garantiza;
- sólo fue validada en un viewport o con datos ideales.

