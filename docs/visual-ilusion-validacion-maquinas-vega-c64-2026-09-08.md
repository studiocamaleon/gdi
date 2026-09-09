# Visual Ilusión: validación de Vega y Kongsberg C64

Fecha: 08/09/2026. Código analizado: `41b7f9a01`, rama `codex/cotizacion-operaciones-herramientas-corte`.

## Dictamen

**La base permite configurar y cotizar trabajos básicos en placa, pero todavía no representa fielmente todas las configuraciones ni todos los procesos de estas máquinas.** Registrar tres máquinas con sus nombres es posible; certificar que sus recetas, tiempos y archivos de producción coinciden con los equipos instalados requiere cerrar los límites identificados y probar trabajos reales.

La investigación respalda mantener **una plantilla Mesa de corte con capacidades instaladas configurables**, tanto para equipos pequeños como industriales. Tamaño de mesa, módulos, herramientas, alimentación y controlador deben ser datos de cada máquina. No hace falta una plantilla independiente por tamaño o marca.

Este informe combina documentación de fabricantes, inspección visual de diagramas/manuales y 16 observaciones ejecutables sobre las funciones actuales. No se accedió al controlador ni se ejecutaron trabajos en las máquinas de Visual Ilusión. Tampoco se modificó su catálogo. Las observaciones usan datos sintéticos, sin conexión a una base de datos.

## 1. Identificación y alcance de la evidencia

| Equipo informado por el cliente | Identificación utilizada | Qué falta confirmar |
| --- | --- | --- |
| Vega 1.6 | Probablemente Vega de ST-Control | Fabricante en placa, modelo completo, año, área útil, módulos y software instalados |
| Vega 2.5 | Probablemente la misma familia; no se pudo identificar la variante exacta | Los mismos datos; no asumir que 2.5 identifica por sí solo ancho, largo o versión |
| Esko C64 | Familia Esko/Kongsberg C64 | Año/generación, variante, módulos, accesorios y versión del controlador |

El usuario agregó que las Vega son españolas. ST-Control declara fabricación en España y publica la familia Vega; esto refuerza la identificación, pero **no prueba qué variantes tiene el cliente**. Su oferta incluye cuchilla tangencial y oscilante, medio corte, hendido, corte a 45°, disco, dibujo y fresado de 2,2 kW. También anuncia un módulo láser específico para textiles de poliéster, cámara y distintas soluciones de software. No se presume que todas esas opciones estén instaladas. La velocidad máxima publicada es 1.200 mm/s; no es una velocidad calibrada para cada material. [ST-Control: Vega](https://st-control.com/mesa-de-corte-vega/).

El catálogo 2025 enumera **VEGA 1620, 1625, 1630, 2030 y 3220**, no modelos llamados literalmente «1.6» y «2.5». Por eso no se asignaron dimensiones a las dos máquinas del cliente. El catálogo también distingue opciones de alimentación y cambio manual, semiautomático o automático de herramienta en la unidad de fresado. Un cambiador de fresas no implica intercambio automático de todos los cabezales. Se revisaron visualmente las páginas PDF 4 y 5. [Catálogo del fabricante, alojado por un distribuidor](https://opcion-grafica.com/wp-content/uploads/2024/10/Nuevo-catalogo-st-control-2025_compressed.pdf).

Para la **C64 estándar**, la ficha actual publica área útil de **3.210 × 3.200 mm**, velocidad máxima de 100 m/min, aceleración máxima de 1,57 G y ocho zonas de vacío. Permite fresado de 3 kW y hendido de hasta 500 N con la unidad correspondiente. Los 70 mm de despeje del travesaño **no equivalen al espesor que puede cortar cada herramienta**. Tampoco debe confundirse tamaño máximo de material con área útil. Son especificaciones documentales, sujetas a verificar contra la generación instalada. [Ficha C Series](https://www.kongsbergsystems.com/en/cutting-systems/tables/c/features).

La **C64 Edge** tiene otra especificación de velocidad/aceleración: 75 m/min y 1 G. No debe usarse su ficha indistintamente para una C64. [C64 Edge](https://www.kongsbergsystems.com/en/cutting-systems/tables/c-edge/c64-edge). Se consultó además el [manual histórico de Esko Kongsberg C](https://docs.esko.com/docs/en-us/Kongsberg_C/1.1/referenceguide/UserManual_Cxx_ipc_us_3621.pdf), relevante para equipos comercializados con la marca Esko.

### Cómo funcionan sus herramientas

La C Series tiene posiciones con funciones diferentes y módulos/adaptadores compatibles con cada una. No son tres alojamientos universales. El adaptador FTA amplía compatibilidades; el portainsertos no admite una unidad de fresado HPMU. Además existen láminas romas de hendido para plásticos: hendir no siempre significa usar una rueda. La guía contiene una discrepancia entre tabla y texto sobre PressCut; no se convirtió esa información en una matriz automática. Debe prevalecer el manual de la configuración instalada. [Guía oficial de herramientas C Series, páginas impresas 4–5 y 36](https://store.kongsbergsystems.com/cms/delivery/media/MCWCIWECK55BCT7GFOVU5CIY7BOM).

El **Dual HDU**, opcional, combina dos ruedas independientes dentro de un conjunto, con posiciones para 150 y 60 mm. Ofrece hendido/perforado y otros adaptadores, y requiere iPC 2.3 o superior. Es un ejemplo de módulo con subposiciones, no evidencia de que Visual Ilusión lo tenga. [Dual Heavy Duty Unit](https://www.kongsbergsystems.com/en/cutting-systems/tooling/dual-heavy-duty-unit).

**MultiZone** permite descargar/cargar una zona mientras la máquina trabaja en la otra. No significa dos herramientas cortando simultáneamente. La C64 también puede equiparse para alimentación de bobinas. Ambas opciones cambian el cálculo de tiempos y ocupación de mesa. [Automatización Kongsberg](https://www.kongsbergsystems.com/en/cutting-systems/automation).

## 2. Qué podemos configurar hoy

| Necesidad | Estado en Grafoprint | Alcance real |
| --- | --- | --- |
| Tres máquinas independientes, dimensiones y centro de costo | Sí | Cada equipo puede tener capacidades y tarifas propias; faltan los datos exactos de las Vega |
| Cuchilla, oscilante, rueda y fresa en una mesa | Sí, básico | IDs estables, posiciones numéricas, estado montado y desgaste |
| Material, espesor y perfil por herramienta | Sí | Velocidad por pasada o efectiva, pasadas, ancho de corte y tiempos auxiliares |
| Corte completo, parcial y hendido en la cotización | Sí, en placa | Recorridos vectoriales interpretados; requiere corte completo en cada pieza |
| Reemplazos de herramientas y ajustes | Parcial | Cuenta cambios según montaje y secuencia; no conoce módulos/adaptadores ni duración específica de cada transición |
| Receta congelada hacia fabricación | Sí | Conserva perfiles, herramientas, parámetros y entidades fuente; no equivale a receta del controlador |
| Dos recetas diferentes para una misma operación en un nodo | No | Un perfil de hendido, uno de corte parcial y uno de corte completo para todo el nodo |
| Hendido a favor/contra onda | No como receta diferenciada | Existe control de permitir rotación; falta eje de onda ligado a parámetros y recorridos |
| Medio corte sin atravesar el soporte | No en este motor | El contorno seleccionado para nesting se convierte en corte completo |
| Perforado, dibujo, taladrado, corte en V como procesos propios | No | Se podría conservar geometría como referencia; no hay operación técnica y económica específica |
| Módulo láser en la misma mesa | No | La plantilla mesa rechaza LASER; la plantilla láser separada sí existe |
| Bobina, avance de cinta y carga solapada | No en el cálculo por herramientas | El sistema tiene otros cálculos de bobina, pero esta ruta exige placas |
| DXF con geometría/capas conservadas | Sí | Exportación geométrica, sin perfil de salida por controlador |
| Archivo probado para ejecutar la receta cotizada | Pendiente | Falta asociación entre receta interna y métodos/herramientas del software de destino |

No hay contradicción entre disponer de plantillas de láser/CNC y que una mesa pueda llevar esas tecnologías. La clasificación actual por plantilla es demasiado rígida para algunos equipos híbridos. Crear varias máquinas ficticias para un único equipo podría duplicar preparación, ocupación y costos.

## 3. Límites comprobados y ejemplos

### A. Capas, operaciones y recetas necesitan una relación más precisa

El motor agrupa por `CORTE_COMPLETO`, `CORTE_PARCIAL` y `HENDIDO`; selecciona **un perfil por operación**. Si hay dos perfiles de hendido compatibles, bloquea por ambigüedad. Elegir uno explícitamente aplica ese perfil a todas las fuentes de hendido.

Ejemplo: un exhibidor tiene dos capas de dobleces, una longitudinal y otra transversal. Hoy no podemos asignarles dos recetas distintas dentro del mismo nodo. Lo mismo ocurre con dos cortes completos que deban usar herramientas diferentes. Separarlo en nodos podría alterar nesting y costos comunes; no constituye soporte integrado equivalente.

La distinción tiene fundamento práctico: iPC permite seleccionar herramienta y parámetros por capa, profundidad a favor/contra onda, velocidad y operación por reverso; el orden de capas define la secuencia de ejecución. [Manual iPC 2.0, páginas 44–45](https://docs.esko.com/docs/en-us/Kongsberg_ipc/2.0/referenceguide/UserManual_ipc200_3389_us.pdf).

**Propuesta:** una pieza conserva su geometría y cada conjunto de recorridos referencia una receta de proceso. La operación indica qué se hace; la receta determina herramienta, material, parámetros y condiciones de orientación/cara. Agrupar costos por receta compatible, manteniendo preparación común.

### B. La silueta de nesting todavía obliga a cortar completamente

El intérprete reserva el exterior elegido y le asigna `CORTE_COMPLETO`. El motor también exige que exista esa operación. Una prueba con silueta cerrada y solo medio corte fue rechazada.

Ejemplo: vinilos que se deben despegar de un papel soporte. Su forma sirve para acomodarlos en la mesa, pero no debería obligar a atravesar el papel.

**Propuesta:** separar completamente silueta de ocupación y operación física. Permitir exterior de medio corte o solo de referencia, conservando validaciones geométricas. Esto completa una separación conceptual que el contrato ya empezó, pero que la interpretación actual no permite en todos los casos.

### C. Posiciones numéricas no validan la máquina real

El validador acepta una fresa en cualquier posición dentro de la cantidad declarada. Si un usuario llama «posición 3» al portainsertos de la C64, el sistema no tiene cómo impedir asignarle un módulo incompatible. También rechaza hendido con cuchilla/lámina y admite hendido únicamente con rueda.

**Propuesta:** máquina → alojamiento → módulo/adaptador → herramienta/consumible. Para una mesa sencilla puede mostrarse como una sola posición. Registrar compatibilidades, opciones instaladas, subposiciones y qué se reemplaza realmente. No es necesario mostrar toda esa complejidad en máquinas que no la necesitan.

### D. Los parámetros guardados no son todos parámetros de cálculo

Profundidad, profundidad por pasada, presión y RPM se conservan en la receta, pero no derivan automáticamente pasadas ni duración. La prueba pasó de profundidad no informada a 3 mm con 0,5 mm por pasada y mantuvo el mismo tiempo, porque las pasadas explícitas no cambiaron. El validador también aceptó valores deliberadamente absurdos de profundidad/presión/RPM: comprueba números no negativos, pero carece de los límites físicos necesarios.

Esto no implica que deba inferirse toda estrategia CAM. Sí exige mostrar con claridad qué parámetros afectan la estimación, comprobar coherencia entre ellos y vincular la receta a capacidades reales. En fresado, profundidad/pasadas, entradas, terminaciones y compensación pueden cambiar el recorrido ejecutado; el perímetro nominal del DXF no representa todas esas estrategias.

### E. Tiempo de recorrido y manejo necesitan calibración del modo de trabajo

El modelo actual suma recorridos, entradas por entidad, ajustes, reemplazos/activaciones y carga/registro por placa. Luego el motor general incorpora preparación, limpieza, tiempos fijos y tarifa del centro. Es una base útil para placas con trabajo secuencial.

Hay tres límites diferentes:

1. La velocidad máxima de catálogo no equivale al avance efectivo sobre cada material. Trazos cortos, curvas, aceleración, viajes en vacío y penetraciones cambian el resultado. Una velocidad efectiva medida sirve para un dominio acotado; no convierte la fórmula en simulación universal.
2. Cada entidad geométrica cuenta como entrada. Un contorno formado por varios segmentos conectados podría requerir menos entradas después de que el controlador los una. Hay que comparar recorrido nominal y recorrido ejecutado, especialmente cuando `entradaSeg` es significativo.
3. La carga es siempre aditiva. En la prueba de 20 placas, 1 minuto de carga/descarga y 0,5 de registro sumaron 30 minutos. No puede descontar solapamiento de zonas ni representar avances de bobina. Máquinas y operarios tampoco deben confundirse: solapar carga no elimina automáticamente el trabajo del operario.

**Propuesta:** modos explícitos de placa secuencial, zonas alternadas y avance de material, habilitados solo cuando corresponden. Calibrar con trabajos medidos; modelar ciclos y tiempos de montaje por módulo. No duplicar una mesa en dos máquinas para representar MultiZone.

### F. El DXF exportado todavía no transporta la receta al controlador

La salida actual recupera entidades originales, verifica su hash y aplica las transformaciones del nesting. Conserva capas; ante colisiones incompatibles puede prefijar nombres para no mezclar información. El endpoint recibe geometrías y transformaciones, **no la máquina de destino ni el perfil cotizado**.

Por tanto, una capa conservada llamada `HENDIDO` puede abrirse correctamente y, aun así, quedar sin método asignado en el controlador. Y un prefijo agregado para resolver una colisión puede dejar de coincidir con una regla de importación. El color no es un identificador universal de herramienta.

iPC tiene reglas de importación y configuraciones de producción; la recepción de DXF debe ensayarse con las reglas concretas instaladas. [Manual iPC 2.0, páginas 118–123](https://docs.esko.com/docs/en-us/Kongsberg_ipc/2.0/referenceguide/UserManual_ipc200_3389_us.pdf). El ecosistema Esko ofrece archivos de corte como CUT, HPGL, PDF, MFG o ACM, con mapeos de capas/tipos; ACM es lenguaje nativo de Kongsberg. No hay que asumir G-code como salida de la C64. [Exportación de producción de Esko](https://docs.esko.com/docs/en-us/icutlayout/18/userguide/en-us/common/icl/topic/to_export_production_files.html).

Para una Vega que use OptiScout, existe importación DXF y soporte de cabezales múltiples. [OptiScout Front-End](https://www.optiscout.com/produkte/eng/OptiScout%2BFront-End%2B-%2BInfo~OSF-I.html). OptiScout documenta reglas que asocian nombres de capas importadas con métodos/herramientas de su base. [Mapeo de capas de OptiScout](https://www.optiscout.com/support/release_news.dml?sprache=eng). Sus perfiles de material y parámetros de máquina también forman parte del flujo de producción. [OptiScout 8](https://www.optiscout.com/neue_version8_news.dml?sprache=eng). **No se confirmó que ese sea el software de las Vega del cliente.**

**Propuesta:** perfil de salida por máquina/controlador/versión, con asociación entre receta cotizada y método de destino. Mantener el original como fuente, y generar un archivo de producción con capas técnicas estables, referencias excluidas de mecanizado y manifiesto de correspondencias. Un DXF correctamente mapeado puede ser suficiente para el primer piloto; no hace falta escribir todos los formatos propietarios.

En la ruta vectorial examinada tampoco existe un contrato específico de marcas de registro/cara de impresión ligado a la exportación, aunque se cotice un tiempo de registro. El criterio de aceptación debe abarcar también escala, orientación, cámaras/marcas y orden de operaciones.

### G. Volumen de archivos

La lectura del DXF original limita cada fuente a **512 KiB**. La exportación admite hasta 2.000 instancias por petición y el DXF base tiene límite de 2.097.152 caracteres. No se puede afirmar que los archivos de Visual Ilusión excedan estos límites: faltan muestras. Conviene medirlos antes de prometer tiradas industriales. Subir límites sin medir memoria, tiempo y complejidad geométrica no es una solución completa.

## 4. Evidencia reproducible en el repositorio

Diagnóstico: [validacion-maquinas-visual-ilusion.ts](/Users/lucasgomez/gdi-saas/apps/api/test/validacion-maquinas-visual-ilusion.ts).

```bash
cd apps/api
npx ts-node --project tsconfig.json test/validacion-maquinas-visual-ilusion.ts
```

Ejecutado con comprobación de tipos. Produce 16 observaciones, incluidas tres variantes de operación no admitida. No es una suite que declare deseables los límites encontrados; imprime comportamiento actual, que puede cambiar al ampliarse el sistema.

| Observación | Resultado del código actual |
| --- | --- |
| 10 piezas, 2 placas, tres operaciones | 4 m de corte completo / 8 m con dos pasadas; 1 m parcial; 2 m hendido |
| Dos herramientas ya montadas | 0 reemplazos; 3 min manejo; 5,5 min recorrido; 9,74 min de ejecución con ajustes/activaciones |
| Dos cuchillas alternando una posición en dos placas | 4 reemplazos físicos |
| Fresa en posición 3 | Aceptada sin comprobar tipo físico del alojamiento |
| Láser en mesa; lámina para hendido; procesos adicionales | Rechazados por taxonomía actual |
| Dos perfiles de hendido | Ambigüedad; la elección explícita aplica uno a ambas fuentes del ejemplo |
| Solo medio corte; plan en bobina | Rechazados con explicación |
| Presión/RPM/profundidad fuera de cualquier rango práctico | Aceptados por falta de límites físicos |
| Cambio de profundidad sin actualizar pasadas/velocidad | Mantiene 2,67 min en el ejemplo |
| 20 placas con manejo 1 + 0,5 min | 30 min aditivos, sin solapamiento |
| Modificar herramienta/velocidad después del cálculo | El snapshot conserva nombre y velocidad originales |

**Todos esos números son sintéticos; no deben cargarse como parámetros de ninguna máquina real.** No se volvió a ejecutar aquí la validación integral con PostgreSQL, exportación e interfaz de la implementación anterior. Esa evidencia está documentada en el [cierre técnico previo](/Users/lucasgomez/gdi-saas/docs/mesa-de-corte-herramientas-implementacion-2026-09-08.md); no acredita calibración ni compatibilidad con estos equipos.

Puntos de código que sustentan el análisis:

- [Contrato y validadores de herramientas/perfiles](/Users/lucasgomez/gdi-saas/apps/api/src/maquinaria/procesamiento-corte.ts:1): taxonomía, posiciones, parámetros y límites.
- [Preparación y cálculo de operaciones](/Users/lucasgomez/gdi-saas/apps/api/src/motor-universal/procesamiento-corte.ts:140): selección de perfil por operación, placas, secuencia y fórmula.
- [Interpretación del exterior](/Users/lucasgomez/gdi-saas/apps/api/src/productos-servicios/geometrias/interpretar-vector.ts:277): reserva del contorno y asignación de corte completo.
- [Plantilla Mesa de corte](/Users/lucasgomez/gdi-saas/src/lib/maquinaria-templates.ts:1840): dimensiones físicas y editor de perfiles.
- [Contrato de exportación](/Users/lucasgomez/gdi-saas/apps/api/src/productos-servicios/geometrias/exportar-fabricacion.controller.ts:56): límites y ausencia de destino/receta.
- [Exportación geométrica de DXF](/Users/lucasgomez/gdi-saas/apps/api/src/productos-servicios/geometrias/python/dxf_fabricacion.py:208): recursos, capas, colisiones y transformaciones.

## 5. Propuesta de configuración y prioridades antes de F5

**Cada Vega:** una máquina Mesa de corte independiente; mantener «1.6» y «2.5» como nombres informados, sin inferir sus dimensiones. Cargar área útil y herramientas cuando se confirme la placa/configuración. Crear perfiles distintos por material, espesor y proceso, con velocidades de trabajos medidos. Vincular cada una con su centro de costo y software real.

**C64:** una máquina Mesa de corte. Usar la ficha estándar como referencia para verificar dimensiones, no copiar todas sus opciones al catálogo. Relevar alojamientos, cabezales/adaptadores y herramientas disponibles, qué empieza montado y qué cambios son manuales. Confirmar si trabaja en mesa completa, zonas o alimentación continua. Los perfiles deben representar los trabajos que efectivamente realizan, sin usar velocidad máxima publicitaria como receta.

Orden propuesto:

1. **Base técnica previa a F5:** compatibilidades de módulos/herramientas, recetas asignables a conjuntos de recorridos, separación de silueta y operación física. Mantener snapshots antiguos legibles y versionar el contrato nuevo.
2. **Primer circuito real en placa:** exhibidor con corte completo, parcial y hendido. Incluir orientación del corrugado si cambia su proceso. Calibrar tiempos por material/espesor y validar costo del centro sin duplicar preparación/desgaste.
3. **Salida de producción verificada:** un perfil de exportación para el controlador realmente utilizado; reimportar el archivo y comprobar las herramientas/recetas que toma. Corregir marcas, cara, unidades y nombres según ese circuito.
4. **Según uso confirmado:** medio corte de vinilos, hendido con lámina, perforado, fresado o corte en V. Son procesos de cotización cuando forman parte del producto; no deben nacer recién en el Centro de corte.
5. **Si están instalados y se usan:** MultiZone, cinta/bobina, Dual HDU, cambios automáticos y módulo láser. No bloquean un piloto limitado a placa secuencial, pero sí impiden declararlo compatible con todo el parque de máquinas.

La gestión de revisiones, liberación y agrupación operativa puede seguir en F5. La receta técnica y la estimación económica deben existir desde la cotización. No hace falta terminar todo un CAM antes de F5; sí definir un dominio validado y rechazar explícitamente trabajos fuera de él.

## 6. Qué falta obtener y cómo cerrar la validación real

Datos de Visual Ilusión: identificación completa/año de cada equipo; listado o fotos de módulos, adaptadores y consumibles; software/versión/driver; modos de alimentación utilizados; materiales/espesores frecuentes; un archivo original y un trabajo de controlador que hoy produzcan correctamente. Luego tiempos observados de preparación, ciclo, manejo y cambios.

Protocolo sugerido para cada circuito usado:

1. Tomar un trabajo conocido y cargar su receta real en una configuración de prueba. Registrar qué datos provienen del operador, del controlador o del catálogo.
2. Cotizar cantidades pequeñas y de tirada. Comparar piezas, placas, metros por proceso, pasadas, herramientas, montaje y tiempo del centro de costo. Separar estimación del controlador y medición real.
3. Descargar y reimportar la salida. Exigir coincidencia de unidades, siluetas, capas/recetas, orientación, marcas y orden; ninguna referencia debe convertirse accidentalmente en mecanizado. Si hace falta reasignar herramientas manualmente, el circuito aún no está automatizado.
4. Ejecutar mediante el procedimiento normal del taller y comparar tiempos. Acordar tolerancias por familia de trabajo después de medir; no declarar una precisión porcentual sin datos.
5. Emitir la OT, modificar después un perfil del catálogo y comprobar que el trabajo conserva la receta aprobada. Si se cambia la máquina de producción, validar la nueva compatibilidad y registrar cualquier diferencia de tiempo/costo.

**Estado de esta validación: investigación y diagnóstico de software completados; validación del equipo instalado, intercambio con su controlador y calibración física pendientes.**
