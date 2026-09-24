# Inventario de parámetros y plantillas

Fecha: 23/09/2026. Extracción del registro en código; no representa los materiales instalados de cada empresa.

**45 plantillas**, 199 declaraciones de campos (86 claves distintas), 34 familias de paso con 45 declaraciones de parámetros. Una clave repetida puede cambiar de significado o unidad según su plantilla.

## Plantillas de materiales

Los campos marcados como dimensión identifican variantes; no significa que todos deban ser preguntas visibles para ventas.

### Sustrato hoja

`sustrato_hoja_v1` · sustrato / sustrato_hoja

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Nombre/Descripción · `formatoComercial` | text | Sí | — |
| Ancho · `ancho` | number · cm | Sí | — |
| Alto · `alto` | number · cm | Sí | — |
| Gramaje · `gramaje` | number · g_m2 | Sí | — |
| Material · `material` | text | Sí | — |
| Color · `color` | text | Sí | Blanco, Color |
| Acabado · `acabado` | text | Sí | Brillo, Mate |

### Sustrato rollo flexible

`sustrato_rollo_flexible_v1` · sustrato / sustrato_rollo_flexible

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho de rollo · `ancho` | number · m | Sí | — |
| Largo de rollo · `largo` | number · m | Sí | — |
| Acabado · `acabado` | text | Sí | Brillante, Mate |

### Vinilo esmerilado en rollo

`vinilo_esmerilado_rollo_v1` · sustrato / sustrato_rollo_flexible

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho de rollo · `ancho` | number · m | Sí | — |
| Largo de rollo · `largo` | number · m | Sí | — |
| Acabado · `acabado` | text | Sí | Blanco, Gris |

### Vinilo de corte en rollo

`vinilo_de_corte_rollo_v1` · sustrato / vinilo_corte

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho de rollo · `ancho` | number · m | Sí | — |
| Largo de rollo · `largo` | number · m | Sí | — |
| Color · `color` | text | Sí | Color, Negro, Blanco |
| Acabado · `acabado` | text | Sí | Brillo, Mate |

### Sustrato rígido

`sustrato_rigido_v1` · sustrato / sustrato_rigido

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · m | Sí | — |
| Alto · `alto` | number · m | Sí | — |
| Espesor · `espesor` | number · mm | Sí | — |
| Color base · `colorBase` | text | Sí | — |

### Tinta impresión

`tinta_impresion_v1` · tinta_colorante / tinta_impresion

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tecnología compatible · `tecnologiaCompatible` | text | No | — |
| Color · `color` | text | Sí | — |
| Volumen de presentación · `volumenPresentacion` | number · ml | Sí | — |
| Equipo compatible · `equipoCompatible` | text | Sí | — |

Defaults sin campo declarado: `baseQuimica`, `rendimientoReferencia`. Su exposición requiere revisión.

### Máster para duplicadora

`master_duplicadora_v1` · tinta_colorante / auxiliar_proceso

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Largo · `largo` | number · m | Sí | — |
| Másteres por rollo · `rendimientoMasters` | number | No | — |
| Equipo compatible · `equipoCompatible` | text | Sí | — |

### Tóner

`toner_v1` · tinta_colorante / toner

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Color · `color` | text | Sí | — |
| Rendimiento · `rendimientoPaginasIso` | number | Sí | — |
| Equipo compatible · `equipoCompatible` | text | Sí | — |
| Presentación · `presentacion` | text | No | — |

Defaults sin campo declarado: `oemOAlternativo`. Su exposición requiere revisión.

### Film transferencia

`film_transferencia_v1` · transferencia_laminacion / film_transferencia

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Largo · `largo` | number · m | Sí | — |
| Tecnología compatible · `tecnologiaCompatible` | text | No | — |

Defaults sin campo declarado: `tipoRelease`, `espesorMicrones`. Su exposición requiere revisión.

### Papel transferencia

`papel_transferencia_v1` · transferencia_laminacion / papel_transferencia

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Largo · `largo` | number · m | No | — |
| Gramaje · `gramaje` | number · g_m2 | Sí | — |

Defaults sin campo declarado: `ladoImprimible`. Su exposición requiere revisión.

### Laminado film

`laminado_film_v1` · transferencia_laminacion / laminado_film

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Largo · `largo` | number · m | Sí | — |
| Acabado · `acabado` | text | Sí | — |
| Espesor · `espesor` | number · mm | No | — |
| Tipo de adhesivo · `adhesivoTipo` | text | No | — |

### Laminado pouch

`laminado_pouch_v1` · transferencia_laminacion / laminado_pouch

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Formato comercial · `formatoComercial` | text | Sí | — |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |
| Margen no usable · `margenNoUsable` | number · mm | No | — |
| Espesor (micrones) · `espesor` | number | Sí | — |

### Imán flexible en rollo

`iman_flexible_rollo_v1` · magnetico_fijacion / iman_ceramico_flexible

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Largo · `largo` | number · m | Sí | — |
| Espesor · `espesor` | number · mm | Sí | — |

### Imán redondo

`iman_redondo_v1` · magnetico_fijacion / iman_ceramico_flexible

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Diámetro · `diametro` | number · mm | Sí | — |
| Espesor · `espesor` | number · mm | Sí | — |
| Unidades por pack · `unidadesPorPack` | number | Sí | — |
| Grado · `grado` | text | Sí | — |
| Adhesivo · `adhesivo` | boolean | Sí | — |

### Tornillo / fijación

`fijacion_auxiliar_v1` · magnetico_fijacion / fijacion_auxiliar

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de fijación · `tipoFijacion` | text | No | Tornillo autoperforante, Tornillo, Remache, Otra |
| Material · `material` | text | No | Acero zincado, Acero fosfatado, Acero inoxidable, Otro |
| Calibre · `calibre` | number | Sí | — |
| Largo · `largo` | number · mm | Sí | — |
| Tipo de cabeza · `tipoCabeza` | text | Sí | Tanque / flangeada, Hexagonal, Otra |
| Tipo de punta · `tipoPunta` | text | Sí | Mecha, Aguja, Otra |
| Unidades por caja · `unidadesPorCaja` | number | No | — |

Defaults sin campo declarado: `encastre`. Su exposición requiere revisión.

### Químico acabado

`quimico_acabado_v1` · quimico_auxiliar / quimico_acabado

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Volumen de presentación · `volumenPresentacion` | number · ml | Sí | — |
| Tecnología compatible · `tecnologiaCompatible` | text | No | — |

Defaults sin campo declarado: `superficiesCompatibles`. Su exposición requiere revisión.

### Polvo DTF

`polvo_dtf_v1` · quimico_auxiliar / polvo_dtf

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de polvo · `tipoPolvo` | text | Sí | — |
| Rango de temperatura · `rangoTemperaturaAplicacion` | text | No | — |

Defaults sin campo declarado: `granulometria`. Su exposición requiere revisión.

### Controlador LED

`controlador_led_v1` · electronica_carteleria / controlador_led

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de controlador · `tipoControlador` | text | Sí | Mono, CCT, RGB, RGBW |
| Tension de entrada · `tensionEntrada` | number · v | Sí | — |
| Canales · `canales` | number | Sí | — |
| Corriente maxima por canal · `corrienteMaxCanal` | number · a | Sí | — |
| Corriente total maxima · `corrienteTotalMax` | number · a | No | — |
| Protocolo · `protocolo` | text | No | RF, Wifi, DMX, 0-10V, Bluetooth |

### Neon flex LED

`neon_flex_led_v1` · neon_luminaria / neon_flex_led

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |
| Tension · `tension` | number · v | Sí | — |
| Potencia lineal · `potenciaLineal` | number · w_m | Sí | — |
| Corriente nominal · `corrienteNominal` | number · a | No | — |
| Color de luz · `colorLuz` | text | Sí | 3000K, 4000K, 6500K, Rojo, Verde, Azul, RGB |
| Grado IP · `ip` | text | Sí | IP20, IP65, IP67, IP68 |

### Accesorio neon LED

`accesorio_neon_led_v1` · neon_luminaria / accesorio_neon_led

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de accesorio · `tipoAccesorio` | text | Sí | Clip, Tapa final, Conector recto, Conector L, Conector T, Grapa |
| Ancho compatible · `anchoCompatible` | number · mm | Sí | — |
| Material · `material` | text | No | Plastico, Metal, Silicona |

### Anillado encuadernación

`anillado_encuadernacion_v1` · terminacion_editorial / anillado_encuadernacion

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de anillo · `tipoAnillo` | text | Sí | ESPIRAL_PLASTICO, WIRE_O |
| Diámetro · `diametro` | number · mm | Sí | — |
| Capacidad (hojas, 80g) · `capacidadMaxHojas` | number | Sí | — |
| Color · `color` | text | Sí | — |
| Material · `material` | text | No | — |

Defaults sin campo declarado: `pasoPerforacion`. Su exposición requiere revisión.

### Tapa encuadernación

`tapa_encuadernacion_v1` · terminacion_editorial / tapa_encuadernacion

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |
| Material · `material` | text | Sí | — |

Defaults sin campo declarado: `espesor`, `colorBase`. Su exposición requiere revisión.

### Componente para carpeta

`componente_carpeta_v1` · terminacion_editorial / componente_editorial

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo · `tipoComponente` | text | Sí | Solapa, Bolsillo, Portatarjeta, Refuerzo, Otro |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |
| Material · `material` | text | Sí | — |
| Color · `color` | text | Sí | — |

### Componente editorial

`componente_editorial_v1` · terminacion_editorial / componente_editorial

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Material · `material` | text | Sí | — |
| Medida · `medida` | text | Sí | — |
| Unidades por caja · `unidadesPorCaja` | number | Sí | — |
| hojasDesde · `hojasDesde` | Sin metadatos de campo | Sí | — |
| hojasHasta · `hojasHasta` | Sin metadatos de campo | Sí | — |
| color · `color` | Sin metadatos de campo | Sí | — |

### Componente editorial en hoja

`componente_editorial_hoja_v1` · terminacion_editorial / componente_editorial

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Material · `material` | text | No | — |
| Ancho · `ancho` | number · cm | Sí | — |
| Alto · `alto` | number · cm | Sí | — |
| formatoComercial · `formatoComercial` | Sin metadatos de campo | Sí | — |
| color · `color` | Sin metadatos de campo | Sí | — |

### Pegatina raspadita

`pegatina_raspadita_v1` · terminacion_editorial / pegatina_raspadita

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |
| Forma · `forma` | text | Sí | Rectangular, Circular, Ovalada, Otra |
| Color · `color` | text | Sí | — |
| Unidades por pack · `unidadesPorPack` | number | No | — |

### Argolla llavero

`argolla_llavero_accesorio_v1` · herraje_accesorio / argolla_llavero_accesorio

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Diámetro · `diametro` | number · mm | Sí | — |
| Material · `material` | text | Sí | — |

Defaults sin campo declarado: `terminacion`. Su exposición requiere revisión.

### Ojal / ojalillo

`ojal_ojalillo_remache_v1` · herraje_accesorio / ojal_ojalillo_remache

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Diámetro interno · `diametroInterno` | number · mm | Sí | — |
| Material · `material` | text | Sí | — |

Defaults sin campo declarado: `terminado`. Su exposición requiere revisión.

### Embalaje / protección

`embalaje_proteccion_v1` · terminacion_editorial / embalaje_proteccion

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo · `tipoEmbalaje` | text | Sí | Bolsa, Caja, Sobre, Faja, Protección |
| Capacidad · `capacidadUnidades` | number | Sí | — |
| Ancho · `ancho` | number · cm | Sí | — |
| Alto · `alto` | number · cm | Sí | — |
| Material · `material` | text | Sí | — |

### Portabanner estructura

`portabanner_estructura_v1` · pop_exhibidor / portabanner_estructura

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de portabanner · `tipoPortabanner` | text | Sí | — |
| Ancho · `ancho` | number · cm | Sí | — |
| Alto · `alto` | number · cm | Sí | — |

Defaults sin campo declarado: `materialEstructura`. Su exposición requiere revisión.

### Repuesto técnico impresión

`repuesto_impresion_v1` · quimico_auxiliar / auxiliar_proceso

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de componente · `tipoComponenteDesgaste` | text | Sí | fusor, drum, drum_opc, developer, developer_unit, charge_unit, drum_cleaning_blade, correa_transferencia, transfer_belt_itb, transfer_roller, fuser_belt, pressure_roller, fuser_cleaning_web, wax_lubricant_bar, fuser_stripper_finger, waste_toner_subsystem, cabezal, lampara_uv, fresa, cuchilla, filtro, kit_mantenimiento, otro |
| Plantillas compatibles · `plantillasCompatibles` | text | Sí | impresora_laser, duplicadora_digital, impresora_gran_formato_por_area, guillotina, plotter_de_corte, plotter_cad, laminadora_bopp_rollo, corte_laser, router_cnc, anilladora, mesa_de_corte, plancha_termica |
| Unidad de vida útil · `unidadVidaUtil` | text | Sí | copias_a4_equiv, m2, metros_lineales, horas, ciclos, piezas |
| Vida útil de referencia · `vidaUtilReferencia` | number | Sí | — |
| Cantidad por recambio · `cantidadPorRecambio` | number | Sí | — |
| Maquinas compatibles · `maquinasCompatibles` | text | Sí | — |

Defaults sin campo declarado: `categoriaRepuesto`, `clasificacion`. Su exposición requiere revisión.

### Repuesto técnico corte/mecanizado

`repuesto_corte_mecanizado_v1` · quimico_auxiliar / auxiliar_proceso

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo de componente · `tipoComponenteDesgaste` | text | Sí | fusor, drum, drum_opc, developer, developer_unit, charge_unit, drum_cleaning_blade, correa_transferencia, transfer_belt_itb, transfer_roller, fuser_belt, pressure_roller, fuser_cleaning_web, wax_lubricant_bar, fuser_stripper_finger, waste_toner_subsystem, cabezal, lampara_uv, fresa, cuchilla, filtro, kit_mantenimiento, otro |
| Plantillas compatibles · `plantillasCompatibles` | text | Sí | impresora_laser, duplicadora_digital, impresora_gran_formato_por_area, guillotina, plotter_de_corte, plotter_cad, laminadora_bopp_rollo, corte_laser, router_cnc, anilladora, mesa_de_corte, plancha_termica |
| Unidad de vida útil · `unidadVidaUtil` | text | Sí | copias_a4_equiv, m2, metros_lineales, horas, ciclos, piezas |
| Vida útil de referencia · `vidaUtilReferencia` | number | Sí | — |
| Cantidad por recambio · `cantidadPorRecambio` | number | Sí | — |
| Material de trabajo dominante · `materialTrabajo` | text | Sí | — |

Defaults sin campo declarado: `categoriaRepuesto`, `clasificacion`. Su exposición requiere revisión.

### Sello automático

`sello_automatico_v1` · sellos / sellos_automaticos

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | Sí | Colop, Trodat, Nykon, Otro |
| Modelo · `modelo` | text | Sí | — |
| Ancho de polímero · `anchoPolimero` | number · mm | Sí | — |
| Alto de polímero · `altoPolimero` | number · mm | Sí | — |
| Líneas de texto (máx.) · `lineasTexto` | number | Sí | — |
| Forma · `forma` | text | Sí | Rectangular, Redondo, Ovalado |
| Color de carcasa · `colorCarcasa` | text | Sí | — |

### Sello manual

`sello_manual_v1` · sellos / sellos_manuales

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | Sí | Colop, Trodat, Nykon, Otro |
| Modelo · `modelo` | text | Sí | — |
| Ancho de polímero · `anchoPolimero` | number · mm | Sí | — |
| Alto de polímero · `altoPolimero` | number · mm | Sí | — |
| Líneas de texto (máx.) · `lineasTexto` | number | Sí | — |
| Forma · `forma` | text | Sí | Rectangular, Redondo, Ovalado |
| Material del mango · `material` | text | Sí | Madera, Plástico |

### Repuesto de almohadilla de sello

`almohadilla_sello_v1` · sellos / almohadilla_tinta

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | No | Trodat, Colop, Nykon, Otro |
| Código de repuesto · `codigoRepuesto` | text | Sí | — |
| Modelo de sello compatible · `modeloCompatible` | text | Sí | — |
| Color de tinta · `colorTinta` | text | Sí | Negro, Azul, Rojo, Verde, Violeta, Neutro, MCI, Bicolor |

### Tinta para sellos

`tinta_sello_v1` · sellos / almohadilla_tinta

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | No | Trodat, Colop, Nykon, Otro |
| Referencia · `referencia` | text | Sí | — |
| Color de tinta · `colorTinta` | text | Sí | Negro, Azul, Rojo, Verde, Violeta |
| Volumen · `volumen` | number · ml | Sí | — |
| Uso · `uso` | text | Sí | General, Telas |

### Almohadilla de escritorio

`almohadilla_escritorio_v1` · sellos / almohadilla_tinta

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | No | Trodat, Colop, Nykon, Otro |
| Referencia · `referencia` | text | Sí | — |
| Ancho · `ancho` | number · cm | Sí | — |
| Alto · `alto` | number · cm | Sí | — |
| Color de tinta · `colorTinta` | text | Sí | Negro, Azul, Rojo, Verde, Neutro |
| Uso · `uso` | text | Sí | Escritorio, Dactilar |

### Goma laserable

`goma_laserable_v1` · sellos / goma_laserable

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Marca · `marca` | text | Sí | — |
| Color · `color` | text | Sí | Rojo, Verde, Gris, Otro |
| Espesor · `espesor` | number · mm | Sí | — |
| Ancho · `ancho` | number · mm | Sí | — |
| Alto · `alto` | number · mm | Sí | — |

### Objeto promocional (blank)

`objeto_promocional_base_v1` · sustrato / objeto_promocional_base

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Categoría · `categoria` | text | No | Drinkware, Escritura, Oficina, Tecnología, Llavería, Hogar y bazar, Bolsos y estuches, Escolar, Salud, Automotor, Regalería |
| Tipo de objeto · `tipoObjeto` | text | Sí | Taza, Botella, Termo, Vaso, Mate, Mousepad, Llavero, Lapicera, Cuaderno, Agenda, Posavasos, Otro |
| Material · `material` | text | Sí | Cerámica, Vidrio, Plástico, Metal, Acero inoxidable, Aluminio, Madera, Silicona, Otro |
| Capacidad · `capacidad` | number · ml | Sí | — |
| Color · `color` | text | Sí | — |
| Modelo/Descripción · `modelo` | text | Sí | — |

### Textil / indumentaria (blank)

`textil_indumentaria_v1` · sustrato / textil_indumentaria

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Categoría · `categoria` | text | No | Remeras, Camisas y chombas, Buzos y abrigo, Camperas, Gorras y sombreros, Bolsos de tela, Indumentaria de trabajo, Bebé y niños, Deportivo, Hogar textil, Accesorios |
| Tipo de prenda · `tipoPrenda` | text | Sí | Remera, Remera manga larga, Musculosa, Chomba, Camisa, Buzo canguro, Buzo cerrado, Campera, Gorra, Tote bag, Otro |
| Material · `material` | text | Sí | Algodón, Poliéster, Mixta (poly/algodón), Frisa, Piqué, Otro |
| Color · `color` | text | Sí | — |
| Talle · `talle` | text | Sí | Único, XS, S, M, L, XL, XXL, XXXL |
| Gramaje · `gramaje` | number · g_m2 | Sí | — |
| Marca · `marca` | text | Sí | — |

### Módulo LED de cartelería

`modulo_led_carteleria_v1` · electronica_carteleria / modulo_led_carteleria

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Modelo · `modelo` | text | Sí | — |
| Potencia por módulo · `potencia` | number · w | Sí | — |
| Tensión · `tension` | text | Sí | 12V, 24V, 220V |
| Paso entre módulos · `paso` | number · mm | Sí | — |
| Temperatura de color · `temperaturaColor` | text | Sí | Cálido, Neutro, Frío |

### Fuente de alimentación LED

`fuente_alimentacion_led_v1` · electronica_carteleria / fuente_alimentacion_led

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Corriente · `corriente` | number · a | Sí | — |
| Tensión de salida · `tension` | text | Sí | 12V, 24V |
| Protección · `proteccion` | text | Sí | IP20, IP65, IP67 |

Defaults sin campo declarado: `capacidad`. Su exposición requiere revisión.

### Cable y conectores

`cableado_conectica_v1` · electronica_carteleria / cableado_conectica

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Sección · `seccion` | text | Sí | — |
| Tipo · `tipo` | text | Sí | Cable taller, Unipolar, Conector fast |

### Perfil / caño estructural

`perfil_estructural_v1` · metal_estructura / perfil_estructural

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Sección · `seccion` | text | Sí | — |
| Espesor de pared · `espesor` | number · mm | Sí | — |
| Material · `material` | text | Sí | Acero, Aluminio, Galvanizado, Madera |
| Desarrollo de la sección (m²/ml, para pintura) · `desarrolloSeccion` | number · m2 | No | — |
| Largo de la barra comercial (se cobran barras enteras) · `largoBarra` | number · m | No | — |

### Chapa metálica

`chapa_metalica_v1` · metal_estructura / chapa_metalica

| Campo | Tipo y unidad | ¿Dimensión? | Opciones declaradas |
| --- | --- | --- | --- |
| Tipo · `tipo` | text | Sí | Galvanizada, Prepintada, Aluminio, Inoxidable |
| Espesor · `espesor` | number · mm | Sí | — |
| Presentación · `presentacion` | text | Sí | hoja |
| Ancho · `anchoMm` | number · mm | Sí | — |
| Alto · `altoMm` | number · mm | Sí | — |

## Parámetros de familias de paso

Exposición «Declarada» significa `expuestoAlComercial`; el resto depende de la configuración del producto o es técnico. No se propone exponer todos los parámetros.

### Pre-prensa / revisión y armado · pre_prensa

Sin parámetros en el schema de esta familia.

### Impresión por hoja · impresion_por_hoja

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Agrupado por talonario en el pliego · `modoTalonarioIncompleto` | enum | off, aprovechar_pliego, pose_completa | Según configuración |

### Impresión por área · impresion_por_area

Sin parámetros en el schema de esta familia.

### Impresión por pieza · impresion_por_pieza

Sin parámetros en el schema de esta familia.

### Impresión 3D · impresion_3d

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Gramos por pieza · `gramosPorPieza` | number | — | Según configuración |
| Relleno (%) · `rellenoPct` | number | — | Según configuración |

### Aplicación de transfer manual · aplicacion_transfer

Sin parámetros en el schema de esta familia.

### Aplicación de transfer textil · aplicacion_transfer_textil

Sin parámetros en el schema de esta familia.

### Grabado láser · grabado_laser

Sin parámetros en el schema de esta familia.

### Corte con guillotina · corte_guillotina

Sin parámetros en el schema de esta familia.

### Plotter de corte · plotter_corte

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Tipo de corte · `tipoCorte` | enum | MEDIO, PROFUNDO, COMPLETO | Según configuración |

### Corte láser · corte_laser

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Cotizar operaciones del archivo por herramienta · `cotizarOperacionesVectoriales` | boolean | — | Según configuración |
| Archivo vectorial para cotizar y preparar · `usarDisenoVectorial` | boolean | — | Según configuración |
| Permitir también cotizar por medidas · `permitirIngresoPorMedidas` | boolean | — | Según configuración |
| Optimizar líneas de corte compartidas · `usarCommonLine` | boolean | — | Según configuración |

### Mesa de corte digital · troquelado_digital

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Cotizar operaciones del archivo por herramienta · `cotizarOperacionesVectoriales` | boolean | — | Según configuración |
| Archivo vectorial para cotizar y preparar · `usarDisenoVectorial` | boolean | — | Según configuración |
| Permitir también cotizar por medidas · `permitirIngresoPorMedidas` | boolean | — | Según configuración |
| Optimizar líneas de corte compartidas · `usarCommonLine` | boolean | — | Según configuración |

### CNC · cnc

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Cotizar operaciones del archivo por herramienta · `cotizarOperacionesVectoriales` | boolean | — | Según configuración |
| Archivo vectorial para cotizar y preparar · `usarDisenoVectorial` | boolean | — | Según configuración |
| Permitir también cotizar por medidas · `permitirIngresoPorMedidas` | boolean | — | Según configuración |
| Optimizar líneas de corte compartidas · `usarCommonLine` | boolean | — | Según configuración |

### Plegado manual · plegado

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Tipo de pliegue · `tipoPliegue` | enum | simple, ventana, acordeon, cruzado | Según configuración |

### Corte manual · corte_manual

Sin parámetros en el schema de esta familia.

### Corte con hilo caliente · corte_hilo_caliente

Sin parámetros en el schema de esta familia.

### Laminado Polipropileno · laminado

Sin parámetros en el schema de esta familia.

### Plastificado pouch · plastificado_pouch

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Separación entre piezas · `separacionEntrePiezasMm` | number | — | Según configuración |

### Pintura superficial · pintura_superficial

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Tipo de acabado · `variante` | enum | mate, brillo, satinado | Según configuración |

### Lijado y canteado · lijado_canteado

Sin parámetros en el schema de esta familia.

### Abrochado a caballete · abrochado_caballete

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Broches por libro · `brochesPorLibro` | number | — | Según configuración |

### Encuadernación con anillo (espiral / wire-o) · encuadernado_anillado

Sin parámetros en el schema de esta familia.

### Engomado / emblocado · engomado_emblocado

Sin parámetros en el schema de esta familia.

### Montado sobre material · montaje_sobre_sustrato

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Piezas a montar · `fuentePiezasMontaje` | enum | piezas_jobcontext, piezas_visibles, pliegos_impresos | Según configuración |

### Ensamble estructural · ensamble_estructural

Sin parámetros en el schema de esta familia.

### Estructura de bastidor · estructura_bastidor

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Tipo de bastidor · `tipoBastidor` | enum | simple, doble | Según configuración |
| Separación máx. refuerzos verticales (cm) · `sepRefuerzoVcm` | number | — | Declarada |
| Separación máx. refuerzos horizontales (cm) · `sepRefuerzoHcm` | number | — | Declarada |
| Solapa del plegado (cm por lado) · `solapaCenefaCm` | number | — | Declarada |
| Profundidad fija del cajón (mm) · `profundidadMm` | number | — | Según configuración |
| Anclajes: un par cada (cm de ancho) · `sepAnclajeCm` | number | — | Según configuración |
| Pérdida de pintura (%) · `margenPinturaPct` | number | — | Según configuración |
| Desperdicio de cenefa (%) · `desperdicioCenefaPct` | number | — | Según configuración |
| Montaje de la lona · `montajeLona` | enum | perimetral, contramarco | Según configuración |
| Demasía de agarre de la lona (cm por lado) · `demasiaAgarreCm` | number | — | Según configuración |

### Iluminación LED · iluminacion_led

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Modo de sembrado · `modoSembrado` | enum | area, recorrido | Según configuración |
| Densidad (multiplicador) · `densidad` | number | — | Declarada |
| Margen de la fuente (%) · `margenFuentePct` | number | — | Según configuración |
| Cable: factor sobre el perímetro · `factorCablePerimetro` | number | — | Según configuración |
| Cable por módulo (cm) · `cablePorModuloCm` | number | — | Según configuración |

### Embalaje · embalaje

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Piezas por caja · `piezasPorCaja` | number | — | Según configuración |

### Trabajo manual · trabajo_manual

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Tipo de trabajo · `tipoTrabajo` | string | — | Según configuración |

### Modificación post-producción · modificacion_post

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Sub-tipo de modificación · `subTipo` | enum | perforacion, redondeo_puntas, numeracion, aplicacion_pegamento, aplicacion_velcro | Según configuración |

### Colocación de ojales · colocacion_ojales

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Distribución de los ojales · `modoDistribucion` | enum | por_separacion, solo_esquinas | Según configuración |
| Separación máxima entre ojales (mm) · `separacionMaxMm` | number | — | Según configuración |
| Lados con ojales · `lados` | multi-enum | superior, inferior, izquierdo, derecho | Según configuración |
| Distancia al borde sin refuerzo (mm) · `distanciaBordeMm` | number | — | Según configuración |
| Ojal en cada esquina · `esquinasSiempre` | boolean | — | Según configuración |

### Colocación de raspadita · colocacion_raspadita

Sin parámetros en el schema de esta familia.

### Instalación en sitio · instalacion_in_situ

Sin parámetros en el schema de esta familia.

### Diseño gráfico · diseno_grafico

| Parámetro | Tipo | Valores | Exposición comercial |
| --- | --- | --- | --- |
| Horas estimadas (solo si T-2) · `horasEstimadas` | number | — | Según configuración |
