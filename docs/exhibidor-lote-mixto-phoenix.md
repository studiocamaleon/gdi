# Nesting del exhibidor: 34 placas y cantidades exactas

Relevamiento y prueba local del 7 de septiembre de 2026. Se analizaron los seis DXF entregados por el usuario, la captura de Phoenix y el motor actual de Grafo. El resultado es un prototipo reproducible de planificación por patrones; todavía no está integrado al cotizador.

**Se encontró una combinación de 34 placas, con tres patrones repetidos 25, 5 y 4 veces, que produce exactamente las 450 piezas para 50 exhibidores.** Igualamos el número de placas y de patrones de la referencia, con una distribución diferente. La captura de Phoenix tiene repeticiones 25, 6 y 3; el usuario confirmó sus 34 placas, pero desconoce si permite excedentes. Por eso no se atribuye a Phoenix un balance exacto que no se puede verificar desde la imagen.

[Ver las tres distribuciones](benchmarks/exhibidor-50/plan-34-placas.svg) · [Ver las seis siluetas](benchmarks/exhibidor-50/piezas.svg)

| Patrón | Repeticiones | Cuerpo | Soporte | Faldón | Estante | Costilla | Header |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A: mixto | 25 | 2 | 2 | 2 | 0 | 1 | 2 |
| B: estantes + costillas | 5 | 0 | 0 | 0 | 20 | 5 | 0 |
| C: estantes alternados | 4 | 0 | 0 | 0 | 25 | 0 | 0 |
| **Total fabricado** | **34 placas** | **50** | **50** | **50** | **200** | **50** | **50** |

Las cantidades de cada fila de patrón son por placa. El patrón A completa cuerpos, soportes, faldones y headers, además de 25 costillas. B completa las otras 25 costillas y aporta 100 estantes. C aporta los 100 estantes restantes. No hay faltantes ni piezas sobrantes.

## Condiciones geométricas de esta comparación

- Placa de 564 × 860 mm, margen de 5 mm en cada borde: **554 × 850 mm útiles**. Es una reserva más restrictiva que los 560 × 856 mm útiles mencionados por el usuario; esas dos definiciones de margen deben unificarse al configurar la producción.
- Separación entre piezas de 0 mm. Se permite contacto de bordes; no superposición de áreas. Compartir borde no implica haber generado todavía un recorrido de corte común.
- Giros permitidos de 0°, 90°, 180° y 270°, sin reflejar ni redimensionar piezas. **El patrón A gira header y faldón 90°**; confirmar que la orientación de la fibra/onda permita esos giros. C alterna filas de estantes a 0° y 180°.
- Sólo la envolvente exterior de cada componente ocupa espacio. Los trazos auxiliares y contornos internos no se usan como piezas adicionales ni como huecos disponibles para nesting.
- La unidad no está declarada en los seis DXF. Se aplicó **25,4/72 mm por unidad**, inferido de la medida del estante que confirmó el usuario. La misma escala en los otros cinco archivos es una hipótesis de la comparación; no una unidad informada por los archivos.

| Componente | Cantidad | Envolvente en mm | Entidad exterior |
| --- | ---: | --- | --- |
| Cuerpo | 50 | 384,04 × 424,35 | AD |
| Soporte | 50 | 48,71 × 94,14 | 74 |
| Faldón | 50 | 176,22 × 115,72 | 88 |
| Estante | 200 | 103,39 × 176,19 | D6 |
| Costilla | 50 | 100,81 × 113,45 | 7C |
| Header | 50 | 163,69 × 152,94 | 7B |

**Hay una discontinuidad que debe revisarse antes del corte:** la entidad exterior D6 del estante está abierta y sus extremos están separados 13,878 mm. Para calcular su envolvente, el benchmark los une con una recta. Esto permite estudiar la ocupación; no certifica que el archivo original esté listo para fabricar. Los DXF originales se conservaron intactos.

CORTE_3 contiene también geometría auxiliar y contornos casi coincidentes. En varios archivos, exterior e interior difieren unos 2,117 mm en dimensiones totales. No se asume si esa diferencia representa sangrado, compensación o una copia de trabajo. Además, el color puede heredarse de la capa o del bloque: “azul” no es una identificación suficiente. Para este ensayo se seleccionó la mayor silueta por archivo porque cada archivo corresponde a una pieza. Esa selección **no debe generalizarse a archivos con varias piezas reales**.

[Procedencia, hashes y supuestos](benchmarks/exhibidor-50/procedencia.json) · [Entrada geométrica normalizada](benchmarks/exhibidor-50/entrada.json)

## Qué mostró la prueba

| Método ensayado | Placas | Alcance |
| --- | ---: | --- |
| Patrones repetidos por diseño, calculados por separado | 43 | Se suman los seis resultados individuales |
| Motor actual con las seis demandas juntas | 35 | Conservó su base segura tras 120 s |
| Prototipo: cartera de patrones + selección del lote | **34** | **Tres patrones, cantidades exactas** |
| Referencia Phoenix | 34 | Tres patrones; excedentes y condiciones completas desconocidos |

La corrida del servicio actual agotó los 120.005 ms, realizó seis intentos y registró cero candidatos nativos válidos; mantuvo las 35 placas de la base segura. Ese contador no distingue por sí solo si un intento terminó por timeout, devolvió una solución parcial o falló la validación. No alcanza para afirmar una única causa. El código sí impone ventanas individuales de 8, 20 o 30 segundos: aumentar el presupuesto global no equivale a darle todo ese tiempo continuo a una búsqueda. Conviene registrar el resultado de cada intento y adaptar su duración al tamaño del lote.

El prototipo generó 9.651 patrones candidatos mediante el packer rectangular existente, filas de siluetas repetidas y variantes que quitan excedentes para equilibrar la demanda. Después eligió repeticiones enteras: primero menos placas, luego menos patrones distintos. La ejecución reproducible guardada demoró unos 23 segundos en este equipo; no es una garantía de rendimiento para otros trabajos.

La validación de Grafo comprobó las 450 instancias, identidad y transformación de contornos, giros permitidos, límites de placa, ausencia de solapamientos y separación. Una comprobación adicional con `polygon-clipping` evaluó las **636 parejas** de piezas de las tres plantillas y obtuvo **0 mm² de intersección máxima**. Como las plantillas se repiten sin cambiar posiciones, esa comprobación cubre todas las repeticiones.

[Resultado y validación](benchmarks/exhibidor-50/resumen.json) · [Intersecciones](benchmarks/exhibidor-50/validacion-intersecciones.json) · [Medición del motor actual](benchmarks/exhibidor-50/motor-actual.json)

**No está demostrado que 34 sea el mínimo geométrico absoluto.** El optimizador entero probó el mejor número de placas y patrones dentro de la cartera generada. Otras geometrías de colocación podrían mejorarla. La cota basada sólo en área es 28 placas y es demasiado débil para demostrar que se puedan fabricar en 28. La ocupación de siluetas en las 34 placas completas es aproximadamente 79,68%.

## La lógica general y cómo llevarla a Grafo

Phoenix documenta estrategias de anidado libre, rejillas y franjas, además de planificación de todo el proyecto, reglas de compatibilidad, reparto de un diseño entre varios layouts y repeticiones. Esto coincide con lo observable: algunos patrones mezclan componentes y otro concentra una pieza repetida. Es comportamiento documentado; no conocemos su código ni se afirma haber reproducido su algoritmo interno. [Documentación oficial de Imposition AI](https://docs.tilialabs.com/phoenix/userguide/impositionai/).

También hay una diferencia entre minimizar desperdicio y minimizar layouts: menos distribuciones pueden reducir preparaciones, incluso aceptando más desperdicio. Los excedentes deben ser una decisión explícita; para cantidades exactas, la documentación de Esko indica sobreproducción cero. [Opciones oficiales de planificación](https://docs.esko.com/docs/en-us/automationengine/18.1/userguide/en-us/common/ae/concept/co_ae_GRP_Nesting_tab_Layout.html).

La unidad que propongo optimizar en Grafo es **el lote de fabricación compatible**. El diseño conserva su identidad, pero no obliga a reservarle placas exclusivas. Tampoco hace falta que una placa contenga un exhibidor completo. El balance se cumple sobre todas las placas del lote.

El plan general tiene dos niveles:

1. **Generar distribuciones geométricamente válidas.** Comparar alternativas puras y mixtas, filas alternadas, franjas y nesting libre. Respetar material, espesor, área útil común de las máquinas, separación, sangrado, giros y dirección de fibra. Mantener varias alternativas cuando difieran en corte, retales o preparación.
2. **Elegir qué distribuciones repetir.** Cada patrón informa cuántas piezas de cada diseño produce. Buscar repeticiones enteras que cumplan `suma(cantidad_por_patron × repeticiones) = demanda` para cada componente. El objetivo inicial será minimizar placas y, a igualdad de placas, patrones distintos. El prototipo implementa esta selección con programación entera de SciPy/HiGHS. [Interfaz oficial de `milp`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html).

El algoritmo debe conservar siempre el mejor candidato validado y continuar explorando mientras haya presupuesto. Phoenix también documenta límites de búsqueda configurables; dejarlo más tiempo puede ampliar la búsqueda, pero no demuestra por sí solo un óptimo. Para Grafo conviene mostrar tiempo, mejor solución, motivo de parada y permitir continuar sin perderla. [Parámetros de parada de Phoenix](https://docs.tilialabs.com/phoenix/userguide/impositionai/#common-settings).

En fase 4 ya existen `CONSOLIDAR_COMPATIBLES`, agrupación de demandas, reconciliación de costos y soporte poligonal. No se necesita empezar esa arquitectura de cero. El trabajo pendiente para este caso es:

1. **Importación por componente y operaciones.** Identificar explícitamente el exterior y separar corte, hendido y arte de impresión; advertir unidades ambiguas y contornos abiertos. Mantener el archivo y la transformación de origen de cada componente.
2. **Planificación conjunta antes de fijar impresión.** Reunir las seis demandas compatibles, incorporar el planificador por patrones al worker y devolver plantillas, repeticiones y balance. Evaluar todas las restricciones de la ruta antes de ubicar piezas.
3. **Un solo layout registrado para impresión y corte.** Las dos etapas deben consumir las mismas posiciones, ángulos y escalas. No reacomodar el corte después de imprimir. La exclusión actual de layouts impresión–corte ya registrados protege esa relación; hace falta planificar el lote antes de congelarla.
4. **Costo y producción del lote.** Cobrar placas y preparaciones compartidas una sola vez, atribuirlas a sus componentes y preservar una versión común en cotización/OT. Mostrar patrón A ×25, B ×5 y C ×4, con faltantes/excedentes visibles y exportaciones registradas para cada etapa.

El primer desarrollo que conviene integrar es la selección por patrones con balance exacto sobre la consolidación existente, junto con la selección confiable de siluetas. Luego se puede enriquecer la cartera con candidatos NFP y mejoras locales. El resultado de este caso no depende de guardar posiciones especiales para “exhibidor”: el generador usa geometrías y cantidades, sin nombres ni disposiciones del cliente codificados.

## Reproducir

Desde la raíz del repositorio, con la API compilada en `apps/api/dist/src` y SciPy disponible en `.venv-opennest`:

```sh
node apps/api/scripts/nesting-lote-benchmark/benchmark.cjs docs/benchmarks/exhibidor-50/entrada.json /tmp/grafonest-exhibidor-50
```

`OPENNEST_PYTHON` permite seleccionar otro Python con SciPy. El script escribe cartera, plan, plantillas, resumen y las 450 posiciones validadas en el directorio de salida. No llama a servicios de cotización, no modifica productos ni crea órdenes. Es un benchmark acotado: 9.000 muestras y dos etapas de optimización de hasta 45 segundos cada una; no reemplaza todavía la política de búsqueda del servicio.

Los artefactos guardados corresponden a los archivos entregados y las condiciones indicadas. Antes de producir hay que confirmar escala, cierre del estante y orientación de la onda, y generar los recorridos técnicos y el arte registrado: este relevamiento entrega la distribución de ocupación.
