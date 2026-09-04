# Fase 4.4 — Nesting compartido dentro de productos compuestos

**Estado:** IMPLEMENTADA · PENDIENTE DE VALIDACIÓN FUNCIONAL DEL MOTOR IRREGULAR · FASE 5 BLOQUEADA

**Rama propuesta:** `visual-ilusion/fase-4-4-nesting-compuestos`

**Dependencias:** Fases 4.2 y 4.3 cerradas. Prepara, pero no reemplaza, Fase 5.

## 1. Problema que resuelve

Cada componente fabricado se cotiza hoy mediante una ejecución recursiva e
independiente del motor. Si dos componentes usan el mismo sustrato compatible,
cada rama redondea sus propios pliegos o metros y ejecuta su propio nesting.

La BOM ya puede reconocer ocurrencias de un mismo material, y el motor dispone
de algoritmos multi-pieza, pero todavía no existe una etapa que reúna demandas
de distintas ramas antes de costear el consumo.

La consecuencia es sobrecosteo y desperdicio aparente en productos como
exhibidores, carteles o kits que combinan varias piezas imprimibles o cortables
del mismo material.

## 2. Alcance y frontera con Fase 5

Esta fase consolida nesting únicamente entre componentes de una misma unidad
comercial de producto compuesto y dentro de una misma ejecución de cotización.
Congela el lote compartido en cotización y OT para que el ahorro calculado sea
realizable en producción.

Fase 5 agregará el nivel superior:

- consolidación entre distintas órdenes o ítems comerciales;
- planes editables, aprobación y revisiones;
- cola del centro de corte;
- asignación de lote real de materia prima;
- consumo planificado versus real.

Fase 4.4 no crea un segundo `PlanNesting` ni adelanta la interfaz completa del
centro de corte.

## 3. Política del producto compuesto

```ts
type PoliticaNestingCompuesto = "INDEPENDIENTE" | "CONSOLIDAR_COMPATIBLES";
```

`INDEPENDIENTE` conserva el comportamiento actual y será el valor por defecto.
En `CONSOLIDAR_COMPATIBLES`, cada componente podrá además excluirse de forma
explícita.

Dos ocurrencias del mismo producto hijo se consideran participantes distintos
por su código de uso. Pueden recibir medidas y parámetros diferentes, compartir
un mismo momento del Workflow y consolidarse sólo si sus demandas resultantes
cumplen la firma estricta de compatibilidad.

La decisión funcional queda cerrada con activación voluntaria por producto:

```ts
// Producto.atributosComercialesJson
{
  nestingCompuesto: {
    version: 1,
    politica: "CONSOLIDAR_COMPATIBLES"
  }
}

// RecetaProductoComponente.configuracionJson
{
  nestingCompuesto: {
    version: 1,
    excluido: true,
    motivo: "Opcional"
  }
}
```

Si la configuración falta, tiene otra versión o contiene un valor desconocido,
el motor aplica `INDEPENDIENTE`. La política forma parte de la huella productiva:
cambiarla exige publicar una nueva revisión antes de volver a cotizar.

La política se configura desde **Productos y servicios → Producto compuesto →
Rutas → Editar ruta**, mediante el botón **Nesting** del encabezado. El botón
abre un modal compacto para elegir entre cálculo por componente y consolidación
de compatibles, y excluir componentes de los lotes compartidos. El editor
preserva el resto de la configuración BOM y no expone códigos internos.

Al guardar el modelo, la política queda persistida en el producto y las
exclusiones en el borrador de la receta. La cotización continúa bloqueada por la
huella productiva hasta publicar esa revisión, evitando que el cálculo use una
política distinta de la receta vigente.

## 4. Firma estricta de compatibilidad

Compartir una variante de material no alcanza. Dos demandas sólo pueden entrar
en el mismo lote cuando coinciden todos los atributos que afectan el proceso:

- tenant, cotización, producto padre y revisión;
- variante exacta y formato de compra del material cuando la selección está
  fijada; si el motor elige automáticamente, intersección de variantes
  candidatas de la misma materia prima;
- familia, algoritmo y superficie de nesting;
- tecnología, máquina, perfil y geometría útil;
- caras, modo de color, tinta blanca u otra separación relevante;
- márgenes, sangrado, separación y rotación;
- sentido de fibra, orientación o restricciones vectoriales;
- tratamiento previo común hasta el punto donde las piezas se separan;
- política de ejecución y ventana productiva compatibles.

La firma será determinística, versionada y visible en trazabilidad. Ante una
duda de compatibilidad, el sistema separa los lotes; nunca consolida de forma
optimista.

## 5. Pipeline de cálculo

El motor compuesto pasará de una recursión cerrada por hijo a un pipeline en
dos etapas:

1. resolver los `JobContext`, rutas, outputs y demandas de nesting de todos los
   componentes sin cerrar todavía el consumo compatible;
2. agrupar demandas por firma;
3. ejecutar un único nesting multi-pieza por grupo;
4. devolver a cada componente sus placements, consumo asignado y costo;
5. completar tiempos, materiales, costos y pricing de Fase 4.3;
6. congelar el lote compartido y sus participantes.

Los pasos que no producen una intención consolidable siguen recorriendo el
motor actual sin cambios.

## 6. Identidad, asignación de costos y operación

Cada pieza conservará:

- componente y producto de origen;
- paso y slot que originaron la demanda;
- medida, cantidad e identidad vectorial cuando corresponda;
- placement y sustrato asignado;
- área útil y porción de desperdicio asignada.

El costo de material se distribuirá por área útil ocupada más una proporción
determinística del desperdicio del lote. Los costos de preparación compartidos
se cuentan una vez y se asignan mediante una regla explícita y congelada. Los
costos exclusivos posteriores a la separación permanecen en su componente.

La OT materializará una referencia compartida de ejecución. Los componentes
mantienen sus ramas, estados y convergencias, pero el paso común no puede
ejecutarse varias veces ni consumir varias veces el material. Al terminar el
lote, cada participante recibe su salida y continúa por su subruta.

## 7. Contrato mínimo del lote compartido

```ts
type LoteNestingCompuestoSnapshot = {
  id: string;
  versionContrato: number;
  firmaCompatibilidad: string;
  materialVarianteId: string;
  participantes: Array<{
    componenteCodigo: string;
    productoId: string;
    pasoClave: string;
    piezas: string[];
    costoMaterialAsignado: number;
    costoPreparacionAsignado: number;
  }>;
  nestingResult: NestingViewerInput;
  costoMaterialTotal: number;
  costoPreparacionTotal: number;
};
```

La suma de costos asignados debe reconciliar exactamente con el costo del lote
dentro de la precisión monetaria del tenant.

## 8. Interfaz

En la BOM del producto compuesto:

- selector de política general;
- indicador de componentes potencialmente compatibles;
- exclusión por componente con motivo opcional;
- advertencias que expliquen por qué dos componentes no pueden consolidarse.

**Implementado en el editor de ruta:** botón contextual y modal compacto con
selector de política, ayudas mediante tooltip y exclusión individual por
componente. El botón sólo aparece en productos compuestos; con política
independiente, las exclusiones quedan visibles pero deshabilitadas.

En la cotización:

- vista previa del nesting compartido;
- ahorro de material comparado con el cálculo independiente;
- participantes identificados por color/etiqueta;
- desglose de asignación de costos para usuarios autorizados.

En Producción, el lote común se presenta una sola vez y enlaza las ramas que
alimenta. No se duplican tarjetas ni estados.

## 9. Invariantes

- `INDEPENDIENTE` reproduce el resultado anterior.
- Mismo material sin firma compatible nunca implica consolidación.
- Toda pieza pedida aparece exactamente una vez en un placement o produce un
  error bloqueante.
- El consumo y la preparación compartidos se cuentan una sola vez.
- La suma asignada a componentes coincide con el costo total del lote.
- El ahorro cotizado tiene una representación ejecutable en la OT.
- Reabrir o invalidar el lote controla todas las ramas participantes.
- Los snapshots históricos no se recalculan por cambios de algoritmo.
- La identidad vectorial y la correspondencia print/cut no se pierden.

## 10. Implementación incremental

### 4.4.1 — Firma y observabilidad sin cambiar costos

- emitir intenciones de nesting por componente;
- calcular la firma y mostrar grupos candidatos;
- comparar resultado independiente contra consolidado en modo sombra;
- registrar diferencias sin alterar precios ni OT.

**Resultado implementado:**

- el dispatcher conserva la demanda rectangular exacta que originó cada
  `NestingEjecutado`, incluso cuando proviene de panelización;
- el motor analiza únicamente componentes directos del mismo producto padre;
- la firma SHA-256 versión 1 exige coincidencia exacta de variante, formato,
  familia, algoritmo, máquina, perfil, color, tecnología, caras, tintas,
  márgenes, separación, demasía, rotación y estrategia de costo;
- el primer alcance se limita a pliegos rectangulares resueltos con
  `grid-2d-single` o `grid-2d-multi`; rollos, talonarios, caballetes y geometría
  irregular quedan excluidos de forma explicable;
- el cálculo consolidado reutiliza `nestGrid2DMulti` y mantiene en cada
  placement el componente, producto, paso y pieza de origen;
- el resultado expone pliegos y aprovechamiento independiente versus
  consolidado, ahorro potencial y motivos tipados de exclusión;
- `aplicadoACostos` permanece forzosamente en `false`: no modifica consumos,
  costos, precio ni la OT;
- el análisis se devuelve en la cotización y se congela en
  `CotizacionItem.trazabilidadJson.analisisNestingCompuesto`.

**Evidencia de cierre técnico 4.4.1:**

- dos componentes compatibles reducen en sombra dos pliegos independientes a
  un pliego consolidado sin alterar sus costos;
- cambios de máquina, perfil, color, tecnología, caras o tintas producen firmas
  diferentes aun cuando el material sea el mismo;
- una exclusión explícita de la relación BOM impide agrupar el componente;
- una cotización compuesta real agrupa ocurrencias activas, ignora la ocurrencia
  opcional omitida y persiste la comparación;
- 136 pruebas focalizadas del motor aprobadas y build de API aprobado;
- regresión integral de API aprobada (207 suites, 2.001 pruebas, 10 snapshots;
  2 suites y 3 pruebas omitidas).

El incremento 4.4.1 queda como base de observabilidad y compatibilidad. El
motor conserva la misma comparación aun cuando 4.4.2 decide no aplicar el
lote por una condición de seguridad.

### 4.4.2 — Consolidación rectangular segura

- habilitar pliegos rectangulares con material, proceso y configuración
  idénticos;
- utilizar el algoritmo multi-pieza existente;
- asignar costos y congelar el lote;
- materializar la referencia compartida en OT.

**Resultado implementado:**

- el intento de aplicación ocurre antes de cerrar el costo compuesto y antes
  del pricing de Fase 4.3, por lo que margen, impuestos, comisiones, descuentos
  y redondeo consumen una única base reconciliada;
- la primera activación operativa exige componentes `INDEPENDIENTE`, nesting
  rectangular completo y consumo costeado directamente por el nesting;
- el costo consolidado reutiliza la misma estrategia efectiva del material
  (`simple`, `m2-exact`, `consumed-length` o `plate-segments`) y exige igual
  precio unitario y segmentos entre participantes;
- material y preparación se reparten por área útil con residuo determinístico,
  de modo que la suma asignada coincide exactamente con el lote;
- una guarda de no regresión conserva el cálculo individual si el consolidado
  usa más sustratos o eleva el costo total; la causa y ambos escenarios quedan
  en trazabilidad;
- cada grupo aplicado congela un `LoteNestingCompuestoSnapshot` con firma,
  material, placements, participantes, asignaciones, costo y duración;
- la OT persiste el snapshot una sola vez en el paso `OPERATIVO`; los demás
  participantes quedan como aliases ocultos de duración cero;
- dependencias y gates de todas las ramas convergen sobre el paso operativo;
  iniciar, pausar, bloquear, completar, desbloquear o reabrir sincroniza los
  aliases dentro de la misma transacción;
- el tablero expone una sola tarjeta `Nesting compartido` y devuelve la
  referencia del lote para poder explicar sus participantes;
- configuraciones por fórmula, componentes inline o cualquier condición no
  reproducible continúan independientes sin modificar el resultado histórico.

**Evidencia de cierre técnico 4.4.2:**

- caso compatible: dos pliegos y dos preparaciones se convierten en un pliego
  y una preparación, con reconciliación exacta de costos;
- caso adverso: una alternativa de tres pliegos frente a dos se rechaza sin
  mutar costos;
- caso real compuesto: el intento y su fallback seguro se guardan junto con el
  pricing de Fase 4.3;
- la materialización de OT prueba paso único, aliases, convergencia de
  dependencias y unión de gates;
- migración `20260902173000_fase_4_4_2_nesting_compuesto_operativo` aplicada;
- build de API aprobado y regresión integral aprobada: 207 suites, 2.004
  pruebas y 10 snapshots; 2 suites y 3 pruebas omitidas.

El siguiente incremento dentro de 4.4.3 queda limitado a geometría vectorial.

### 4.4.3 — Rollos y geometría vectorial

- extender a rollos cuando compartan tecnología y ventana productiva;
- preservar identidad y archivos para nesting irregular;
- validar correspondencia de impresión y corte.

**Resultado implementado para rollos rectangulares:**

- `shelf-rollo` y `maxrects-rollo` conservan ahora la demanda rectangular
  original; el consolidado no intenta reconstruirla desde paneles o dibujos;
- máquina, perfil, tecnología, color, caras, tintas, márgenes, demasía,
  separación, rotación, merma y preparación forman parte de la firma estricta;
- con material fijado se exige la misma variante y ancho físico;
- con `MOTOR_ELIGE_AUTO` sin elección comercial explícita, cada componente
  congela sus variantes candidatas y el lote vuelve a ejecutar el nesting para
  cada ancho común; gana el menor costo real del conjunto y luego el menor
  largo como desempate;
- la variante ganadora reemplaza la elección individual en todos los
  participantes y el snapshot congela ancho, largo, placements, costo y
  procedencia de cada pieza;
- el costo admite rollos tarifados por metro lineal o por m², conserva la merma
  operativa y se reparte por área útil con reconciliación exacta;
- la guarda de no regresión conserva el cálculo individual si aumenta el área
  física total de rollo o el costo completo; comparar sólo largo sería
  incorrecto cuando el motor puede elegir anchos distintos;
- el visor consume el algoritmo y sustrato del snapshot aplicado; no vuelve a
  simular el acomodo ni fuerza `grid-2d-multi`;
- el panelizado automático se puede reevaluar; el panelizado manual permanece
  individual para respetar el layout definido por el usuario.

**Evidencia focalizada:**

- dos piezas de medidas distintas comparten un único tramo de rollo y el largo
  visual coincide con el costeado;
- caso de selección automática: aunque 800 mm gane para cada pieza aislada,
  el lote elige 1000 mm cuando permite una sola fila y reduce el costo total;
- panelizado manual se excluye de forma segura;
- 58 pruebas de dispatcher y nesting compuesto aprobadas, incluyendo 13 casos
  propios de consolidación, y builds de API y frontend aprobados.

**Resultado implementado para geometría irregular:**

- contrato canónico neutral para demandas rectangulares y poligonales;
- solución versionada con hash reproducible y propietarios trazables;
- paridad del nesting vectorial individual sobre el nuevo contrato;
- cantidades heterogéneas y múltiples demandas en una misma ejecución;
- carga de SVG y medidas finales propia de cada componente u ocurrencia desde
  el contrato público de cotización;
- consolidación de contornos compatibles entre componentes;
- cálculo y reparto por área poligonal real, no por caja envolvente;
- estimación manual separada del nesting geométrico;
- exclusión segura de composiciones originales y layouts impresión–corte ya
  registrados, que nunca se reacomodan de manera independiente.

El diseño y la matriz de prueba están en
`docs/motor-nesting-irregular-generalizado-diseno.md`. Fase 5 permanece
bloqueada hasta la validación funcional del usuario.

## 11. Criterios de salida

- Dos componentes compatibles que por separado consumen dos pliegos comparten
  uno cuando geométricamente corresponde.
- Dos componentes con igual material pero distinta tinta, perfil o ruta no se
  consolidan y explican el motivo.
- El precio compuesto de Fase 4.3 consume los costos reasignados sin duplicar
  margen ni cargas.
- El visor identifica de qué componente proviene cada pieza.
- La OT ejecuta una sola vez el lote y libera correctamente todas las ramas.
- El modo independiente conserva resultados históricos.
- Pruebas de reconciliación, regresión, concurrencia y QA visual aprobadas.

## 12. Fuera de alcance, con destino

- Mezclar órdenes, clientes o fechas distintas: Fase 5.
- Reanidado manual, aprobación y versionado operativo del plan: Fase 5.
- Reservas y lote real de materia prima: Fase 9.
- División física y trazabilidad parcial de cantidades: Fase 6.
